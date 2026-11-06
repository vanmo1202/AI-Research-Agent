#!/usr/bin/env python3
"""Read-only Docker health monitor. No socket is mounted in an application container."""
import argparse
import json
import subprocess
import sys
import shutil
import time
from pathlib import Path

def filesystem_checks(backup_file=None, max_age_hours=24, data_directory=None, min_free_bytes=2 * 1024**3):
    checks = {}
    if backup_file:
        try:
            path = Path(backup_file)
            age = time.time() - path.stat().st_mtime
            checks['backupFresh'] = path.is_file() and not path.is_symlink() and path.stat().st_size > 0 and -300 <= age <= max_age_hours * 3600
        except OSError:
            checks['backupFresh'] = False
    if data_directory:
        try:
            checks['diskFreeBytes'] = shutil.disk_usage(data_directory).free
            checks['diskSpaceOk'] = checks['diskFreeBytes'] >= min_free_bytes
        except OSError:
            checks['diskSpaceOk'] = False
    return checks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', required=True)
    parser.add_argument('--backup-file')
    parser.add_argument('--max-backup-age-hours', type=float, default=24)
    parser.add_argument('--data-directory')
    parser.add_argument('--min-free-bytes', type=int, default=2 * 1024**3)
    args = parser.parse_args()
    try:
        ids = subprocess.check_output(['docker', 'ps', '-aq', '--filter',
                                      'label=com.docker.compose.project=' + args.project], text=True).split()
        states = []
        for identity in ids:
            template = '{{ index .Config.Labels "com.docker.compose.service" }}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|{{.RestartCount}}|{{.State.OOMKilled}}'
            values = subprocess.check_output(['docker', 'inspect', '--format', template, identity], text=True).strip().split('|')
            states.append(dict(zip(('service', 'state', 'health', 'restarts', 'oomKilled'), values)))
        expected = {'edge', 'frontend', 'backend', 'worker', 'n8n'}
        files = filesystem_checks(args.backup_file, args.max_backup_age_hours,
                                 args.data_directory, args.min_free_bytes)
        ready = ({s['service'] for s in states} == expected and len(states) == 5
                 and all(s['state'] == 'running' and s['health'] == 'healthy'
                         and s['oomKilled'] == 'false' for s in states)
                 and files.get('backupFresh', True) and files.get('diskSpaceOk', True))
        print(json.dumps({'ready': ready, 'services': states, **files}))
        return 0 if ready else 1
    except (OSError, subprocess.SubprocessError):
        print(json.dumps({'ready': False, 'error': 'Docker health query failed'}))
        return 2


if __name__ == '__main__':
    sys.exit(main())
