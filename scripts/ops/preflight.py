#!/usr/bin/env python3
"""Validate a rendered standalone hardened Compose config from stdin. Never print secrets."""
import json
import re
import sys
from urllib.parse import urlsplit


def validate(config):
    services = config['services']
    assert set(services) == {'edge', 'frontend', 'backend', 'worker', 'n8n', 'postgres', 'migrate'}, 'Unexpected service set'
    for name, service in services.items():
        assert re.search(r'@sha256:[a-f0-9]{64}$', service['image']), 'Images must be digest pinned'
        assert not service.get('privileged') and not service.get('network_mode'), 'Unsafe network/privilege'
        assert 'ALL' in service.get('cap_drop', []), 'Capabilities must be dropped'
        assert 'no-new-privileges:true' in service.get('security_opt', []), 'Privilege escalation must be blocked'
        assert not service.get('env_file'), 'env_file is forbidden in hardened release'
        if name != 'postgres':
            assert service.get('user') in ('1000:1000', '101:101'), 'Explicit non-root UID required'
        else:
            assert set(service.get('cap_add', [])) <= {'CHOWN','DAC_OVERRIDE','SETUID','SETGID','FOWNER'}, 'Unexpected database capability'
        assert service.get('mem_limit'), 'Memory cap required'
        if name != 'migrate':
            assert service.get('healthcheck'), 'Healthcheck required'
        else:
            assert service.get('restart') == 'no', 'Migration service must be one-shot'
        ports = service.get('ports', [])
        if name == 'edge':
            assert len(ports) == 1 and ports[0]['target'] == 8443, 'Only TLS ingress allowed'
        else:
            assert not ports, 'Only edge may publish ports'
        assert not any('/var/run/docker.sock' in str(v) for v in service.get('volumes', [])), 'Docker socket forbidden'
    for name in ('backend', 'worker'):
        env = services[name]['environment']
        origin = urlsplit(env['FRONTEND_ORIGIN'])
        assert origin.scheme == 'https' and origin.hostname and not origin.username and not origin.password, 'Exact HTTPS origin required'
        assert origin.path in ('', '/') and not origin.query and not origin.fragment, 'Origin cannot contain path/query'
        assert env['COOKIE_SECURE'] == 'true' and env['RESEARCH_LOAD_ENV'] == 'false', 'Secure isolated config required'
        assert env['TRUSTED_PROXY_CIDRS'] == '172.29.243.2/32', 'Unexpected proxy trust boundary'
        assert env.get('PGHOST') == 'postgres' and env.get('PGDATABASE') == 'researchos', 'Shared PostgreSQL required'
        assert 'RESEARCH_DB_PATH' not in env, 'SQLite runtime forbidden'
        for secret in ('INTERNAL_API_KEY', 'GEMINI_API_KEY', 'TAVILY_API_KEY', 'PGPASSWORD'):
            assert secret not in env and env.get(secret + '_FILE'), 'File secrets required'
    assert services['backend']['environment'] == services['worker']['environment'], 'Backend and worker config differ'
    assert services['backend']['depends_on']['migrate']['condition'] == 'service_completed_successfully', 'Backend must wait for migrations'
    assert services['migrate']['depends_on']['postgres']['condition'] == 'service_healthy', 'Migrations must wait for DB'
    assert config['networks']['app_proxy']['internal'], 'Backend proxy network must be internal'
    assert config['networks']['edge_proxy']['internal'], 'Frontend proxy network must be internal'


if __name__ == '__main__':
    try:
        validate(json.load(sys.stdin))
        print('PASS hardened topology, digest pins, secret references, TLS origin and proxy boundary')
    except (KeyError, AssertionError, TypeError, ValueError) as error:
        print('FAIL hardened configuration: ' + (str(error) if isinstance(error, AssertionError) else 'invalid input'), file=sys.stderr)
        sys.exit(1)
