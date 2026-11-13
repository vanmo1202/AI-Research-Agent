#!/usr/bin/env python3
"""Prepare inactive imports only after an operator has provisioned a secured gateway.
Never exposes a tunnel, binds secrets, changes the source exports or uploads to Cloud.
"""
import argparse,ipaddress,json,pathlib,re
from urllib.parse import urlsplit
p=argparse.ArgumentParser();p.add_argument('--base-url',required=True);p.add_argument('--input-dir',default='n8n/workflows/researchos-realigned');p.add_argument('--output-dir',default='n8n-cloud-import');a=p.parse_args()
base=a.base_url.rstrip('/')
try:
 u=urlsplit(base);hostname=u.hostname or '';port=u.port
 valid=u.scheme=='https' and hostname and not(u.username or u.password or u.query or u.fragment) and not re.search(r'''[\s'"\\{}]''',base)
 if hostname=='localhost' or hostname.endswith(('.localhost','.local','.internal','.invalid')):valid=False
 try:
  if not ipaddress.ip_address(hostname).is_global:valid=False
 except ValueError:pass
except ValueError:valid=False
if not valid:p.error('A secured public HTTPS gateway URL without credentials/query/fragment is required')
in_dir=pathlib.Path(a.input_dir);out_dir=pathlib.Path(a.output_dir)
if in_dir.resolve()==out_dir.resolve():p.error('Refusing to overwrite source workflow directory')
files=sorted(in_dir.glob('WF*.json'))
if len(files)!=5:p.error('Expected the five agreed source workflows')
if any(out_dir.joinpath(f.name).exists() for f in files):p.error('Output files already exist; use a new directory')
out_dir.mkdir(parents=True,exist_ok=True)
for f in files:
 w=json.loads(f.read_text());w['active']=False
 for n in w['nodes']:
  if n['type'].endswith('httpRequest'):n['parameters']['url']=n['parameters'].get('url','').replace('http://backend:3000',base)
 out_dir.joinpath(f.name).write_text(json.dumps(w,ensure_ascii=False,indent=2)+'\n')
print('Created 5 inactive imports. Gateway reachability/auth are NOT verified; bind credentials and test before any publication.')
