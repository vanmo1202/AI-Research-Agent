#!/usr/bin/env python3
"""Prepare/run isolated n8n CLI copies. Never imports into an existing instance.
Requires fixture backend from backend/test/helpers/researchos-engine-server.cjs.
Only test copies replace trigger/Respond boundaries; HTTP, Code, IF/Switch and loops run in n8n.
"""
import argparse,json,pathlib,subprocess,tempfile,copy,time,threading
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
p=argparse.ArgumentParser();p.add_argument('--context',required=True);p.add_argument('--image',default='n8nio/n8n:2.46.1');a=p.parse_args()
context=json.loads(pathlib.Path(a.context).read_text());out=pathlib.Path(tempfile.mkdtemp(prefix='researchos-n8n-engine-'));out.chmod(0o777)
workflows=[]
nonce=str(time.time_ns())
for src in sorted(pathlib.Path('n8n/workflows/researchos-realigned').glob('WF*.json')):
 w=json.loads(src.read_text());wf=src.name[:4];w['id']='Test'+wf;w['name']='ISOLATED TEST '+wf;w['active']=False
 body={'requestId':context['requestId'],'idempotencyKey':'engine-'+wf+'-'+nonce,'options':{'orchestration':'n8n','searchMore':False}}
 if wf=='WF02':body={'documentId':context['documentId'],'jobId':context['jobId']}
 if wf=='WF03':body={'requestId':context['requestId'],'chatId':context['chatId'],'content':'No supporting evidence available','clientToken':'engine-chat-'+nonce}
 first=w['nodes'][0];target=w['connections'][first['name']]['main'][0];first.update(type='n8n-nodes-base.manualTrigger',typeVersion=1,parameters={})
 fixture={'id':'fixture-'+wf,'name':'Fixture Input','type':'n8n-nodes-base.code','typeVersion':2,'position':[100,-200],'parameters':{'jsCode':'return [{json:'+json.dumps({'body':body})+'}];'}}
 w['nodes'].append(fixture);w['connections'][first['name']]={'main':[[{'node':'Fixture Input','type':'main','index':0}]]};w['connections']['Fixture Input']={'main':[target]}
 for n in w['nodes']:
  if n['type']=='n8n-nodes-base.httpRequest':
   n['parameters']['url']=n['parameters']['url'].replace('http://backend:3000',context['base']);n['credentials']={'httpHeaderAuth':{'id':'fixtureOutbound','name':'Fixture outbound'}}
  if n['type']=='n8n-nodes-base.respondToWebhook':n.update(type='n8n-nodes-base.noOp',typeVersion=1,parameters={})
  if n['type']=='n8n-nodes-base.wait':n['parameters']['amount']=0.1
  if wf=='WF05' and n['name']=='02 - Build Schedule Window':n['parameters']['jsCode']=n['parameters']['jsCode'].replace('$vars.RESEARCHOS_SCHEDULE_ID',json.dumps(context['scheduleId']))
 workflows.append(w)
backend_variant=copy.deepcopy(workflows[0]);backend_variant['id']='TestWF01Backend';backend_variant['name']='ISOLATED TEST WF01 backend handoff'
next(n for n in backend_variant['nodes'] if n['name']=='Fixture Input')['parameters']['jsCode']='return [{json:'+json.dumps({'body':{'requestId':context['requestId'],'idempotencyKey':'engine-backend-'+nonce,'options':{'orchestration':'backend','searchMore':False}}})+'}];'
workflows.append(backend_variant)
class Faults(BaseHTTPRequestHandler):
 def do_POST(self):
  self.rfile.read(int(self.headers.get('Content-Length',0)))
  self.server.calls[self.path]=self.server.calls.get(self.path,0)+1
  if self.path=='/timeout':time.sleep(1)
  try:
   self.send_response(503);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'{"success":false,"error":"fixture unavailable"}')
  except (BrokenPipeError,ConnectionResetError):pass
 def log_message(self,*args):pass
faults=ThreadingHTTPServer(('127.0.0.1',0),Faults);faults.calls={}
threading.Thread(target=faults.serve_forever,daemon=True).start()
for source,ident,node_name,endpoint,timeout in [(workflows[2],'TestWF03Timeout','06 - Ask Backend RAG','/timeout',100),(workflows[3],'TestWF04DbError','03 - Backend Memory Maintenance','/db-error',1000)]:
 variant=copy.deepcopy(source);variant['id']=ident;variant['name']=ident
 http=next(n for n in variant['nodes'] if n['name']==node_name);http['parameters']['url']='http://127.0.0.1:'+str(faults.server_port)+endpoint;http['parameters']['options']['timeout']=timeout
 workflows.append(variant)
(out/'workflows.json').write_text(json.dumps(workflows));(out/'credentials.json').write_text(json.dumps([{'id':'fixtureOutbound','name':'Fixture outbound','type':'httpHeaderAuth','data':{'name':'X-Internal-Api-Key','value':'fixture-engine-internal-key'}}]))
command='n8n import:credentials --input=/fixtures/credentials.json > /fixtures/import-credentials.log 2>&1 && n8n import:workflow --input=/fixtures/workflows.json > /fixtures/import-workflows.log 2>&1; '
command+='; '.join('n8n execute --id='+w['id']+' --rawOutput > /fixtures/'+w['id'][4:]+'.log 2>&1' for w in workflows)
print('Isolated test artifacts:',out,flush=True)
result=subprocess.run(['docker','run','--rm','--network','host','--tmpfs','/home/node/.n8n:rw,uid=1000,gid=1000','-v',str(out)+':/fixtures','-e','N8N_RUNNERS_BROKER_PORT=56891','-e','N8N_DIAGNOSTICS_ENABLED=false','-e','N8N_PERSONALIZATION_ENABLED=false','-e','N8N_LOG_LEVEL=info','--entrypoint','sh',a.image,'-c',command])
summary={}
for w in workflows:
 ident=w['id'][4:]
 text=(out/(ident+'.log')).read_text() if (out/(ident+'.log')).exists() else ''
 data=None
 for pos,char in enumerate(text):
  if char!='{':continue
  try:
   obj,_=json.JSONDecoder().raw_decode(text[pos:])
   if isinstance(obj,dict) and 'data' in obj and 'resultData' in obj['data']:data=obj;break
  except (ValueError,TypeError):pass
 if data:
  r=data['data']['resultData'];summary[ident]={'error':r.get('error',{}).get('message'),'lastNode':r.get('lastNodeExecuted'),'nodesExecuted':len(r.get('runData',{}))}
  if ident=='WF01':
   runs=r.get('runData',{});polled=[t['data']['main'][0][0]['json']['data']['id'] for t in runs.get('27 - Poll Job',[]) if t.get('data',{}).get('main')]
   summary[ident].update(dispatchRuns=len(runs.get('25 - Dispatch Scheduled Job',[])),pollRuns=len(polled),distinctJobs=len(set(polled)))
   if len(set(polled))!=6:summary[ident]['error']='Polling did not observe six distinct stage jobs'
 else:summary[ident]={'error':'No execution result; inspect isolated log'}
expected=['17 - Terminal Summary','09 - Return Job Status','08 - Return Chat Result','04 - Maintenance Completed','06 - Dispatch Accepted']
for i,node in enumerate(expected,1):
 if summary['WF0'+str(i)].get('lastNode')!=node:summary['WF0'+str(i)]['error']=summary['WF0'+str(i)].get('error') or 'Unexpected terminal node'
if summary['WF01Backend'].get('lastNode')!='15 - Backend-Managed Handoff':summary['WF01Backend']['error']='Backend mode did not hand off correctly'
if summary['WF03Timeout'].get('lastNode')!='10 - Return 502' or faults.calls.get('/timeout')!=1:summary['WF03Timeout']['error']='Chat timeout was retried or returned wrong branch'
expected_error=summary['WF04DbError'].get('error') or ''
if 'MEMORY_MAINTENANCE_FAILED' in expected_error:
 summary['WF04DbError']['observedError']=expected_error;summary['WF04DbError']['error']=None;summary['WF04DbError']['expectedFailure']=True
else:summary['WF04DbError']['error']='DB failure was not surfaced'
summary['WF03Timeout']['postAttempts']=faults.calls.get('/timeout',0)
faults.shutdown()
(out/'SUMMARY.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary),flush=True)
if any(r.get('error') for r in summary.values()):raise SystemExit(1)
