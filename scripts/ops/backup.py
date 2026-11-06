#!/usr/bin/env python3
"""Encrypted, WAL-aware backup/isolated restore. Never controls Docker or live services."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tarfile
import tempfile
import time


def regular_file(path):
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise ValueError('Expected a regular, non-symlink file')
    return path


def secret_file(path):
    path = regular_file(path)
    if path.stat().st_mode & 0o077 or path.stat().st_size < 16:
        raise ValueError('Secret must be >=16 bytes and inaccessible to group/other')
    return path


def sqlite_snapshot(source, target):
    source = regular_file(source).resolve()
    started = time.monotonic()
    with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True, timeout=5) as src:
        with sqlite3.connect(target) as dst:
            def progress(status, remaining, total):
                if time.monotonic() - started > 60:
                    raise TimeoutError('SQLite snapshot timed out')
            src.backup(dst, pages=256, progress=progress, sleep=0.05)
            if dst.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                raise ValueError('SQLite integrity check failed')
            dst.execute('PRAGMA journal_mode=DELETE')


def copy_tree(source, target, exclude=()):
    source = Path(source)
    if source.is_symlink() or not source.is_dir():
        raise ValueError('Expected a source directory without symlinks')
    target.mkdir(parents=True, exist_ok=True)
    for item in source.iterdir():
        if item.name in exclude:
            continue
        if item.is_symlink():
            raise ValueError('Symlinks are not supported in backups')
        dest = target / item.name
        if item.is_dir():
            copy_tree(item, dest)
        else:
            shutil.copyfile(regular_file(item), dest)
            dest.chmod(0o600)


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def crypt(source, target, password, decrypt=False):
    # No shell, secret values or passphrases in argv/logs; no user GPG home touched.
    with tempfile.TemporaryDirectory(prefix='researchos-gpg-') as home:
        cmd = ['gpg', '--homedir', home, '--batch', '--yes', '--no-symkey-cache',
               '--pinentry-mode', 'loopback', '--passphrase-file', str(secret_file(password)),
               '--output', str(target)]
        cmd += ['--decrypt', str(source)] if decrypt else [
            '--symmetric', '--cipher-algo', 'AES256', str(source)]
        result = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        if result.returncode:
            raise ValueError('Encryption/decryption failed; verify key and archive')


def backup(database, documents, n8n, encryption_key, password, output, quiesced=False):
    if not quiesced:
        raise ValueError('Quiesce ALL writers or use a coordinated offline snapshot first')
    output = Path(output).absolute()
    if output.exists() or not output.parent.is_dir():
        raise ValueError('Backup output must be a new file in an existing directory')
    for source in (Path(documents).resolve(), Path(n8n).resolve()):
        if output.is_relative_to(source):
            raise ValueError('Backup output must be outside source directories')
    # Plaintext staging is private; use an encrypted local filesystem or private tmpfs.
    with tempfile.TemporaryDirectory(prefix='.researchos-backup-', dir=output.parent) as work:
        work = Path(work)
        payload = work / 'payload'
        (payload / 'research').mkdir(parents=True)
        sqlite_snapshot(database, payload / 'research/research.db')
        copy_tree(documents, payload / 'documents')
        n8n = Path(n8n)
        copy_tree(n8n, payload / 'n8n', ('database.sqlite', 'database.sqlite-wal', 'database.sqlite-shm'))
        sqlite_snapshot(n8n / 'database.sqlite', payload / 'n8n/database.sqlite')
        config = payload / 'n8n/config'
        if config.exists():
            configured_key = json.loads(config.read_text()).get('encryptionKey')
            if configured_key and configured_key != secret_file(encryption_key).read_text().strip():
                raise ValueError('n8n encryption key does not match settings')
        (payload / 'secrets').mkdir()
        shutil.copyfile(secret_file(encryption_key), payload / 'secrets/n8n_encryption_key')
        (payload / 'secrets/n8n_encryption_key').chmod(0o600)
        files = {str(p.relative_to(payload)): digest(p) for p in payload.rglob('*') if p.is_file()}
        (payload / 'manifest.json').write_text(json.dumps({'version': 1, 'quiesced': True, 'files': files}, indent=2))
        archive = work / 'snapshot.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            for path in sorted(payload.rglob('*')):
                if path.is_file():
                    tar.add(path, arcname=str(path.relative_to(payload)), recursive=False)
        sealed = work / 'snapshot.gpg'
        crypt(archive, sealed, password)
        sealed.chmod(0o600)
        with sealed.open("rb") as stream:
            os.fsync(stream.fileno())
        # Atomic no-clobber publication on the same filesystem.
        os.link(sealed, output)
        directory_fd = os.open(output.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    return output


def restore(archive, password, target):
    target = Path(target).absolute()
    if target.exists() or target.is_symlink() or not target.parent.is_dir():
        raise ValueError('Restore target MUST be a new directory; existing paths are forbidden')
    with tempfile.TemporaryDirectory(prefix='.researchos-restore-', dir=target.parent) as work:
        work = Path(work)
        plain = work / 'snapshot.tar.gz'
        crypt(regular_file(archive), plain, password, decrypt=True)
        payload = work / 'payload'
        payload.mkdir()
        with tarfile.open(plain, 'r:gz') as tar:
            seen = set()
            for member in tar:
                name = Path(member.name)
                if (not member.isfile() or name.is_absolute() or '..' in name.parts
                        or member.name in seen or not name.parts):
                    raise ValueError('Unsafe or duplicate archive member')
                seen.add(member.name)
                dest = payload / name
                dest.parent.mkdir(parents=True, exist_ok=True)
                with dest.open('xb') as stream, tar.extractfile(member) as src:
                    shutil.copyfileobj(src, stream)
                dest.chmod(0o600)
        manifest = json.loads((payload / 'manifest.json').read_text())
        actual = {str(p.relative_to(payload)): digest(p) for p in payload.rglob('*')
                  if p.is_file() and p != payload / 'manifest.json'}
        if manifest.get('version') != 1 or actual != manifest.get('files'):
            raise ValueError('Manifest checksum mismatch')
        for name in ('research/research.db', 'n8n/database.sqlite'):
            with sqlite3.connect((payload / name).as_uri() + '?mode=ro', uri=True) as db:
                if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                    raise ValueError('Restored SQLite integrity check failed')
        secret_file(payload / 'secrets/n8n_encryption_key')
        # mkdir is exclusive; no overwrite of a pre-existing destination, even in a race.
        target.mkdir(mode=0o700)
        try:
            copy_tree(payload, target)
        except BaseException:
            # Leave the failed NEW directory for inspection; never delete an operator path.
            raise
    return target


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    b = commands.add_parser('backup')
    for name in ('database', 'documents', 'n8n', 'encryption-key', 'password-file', 'output'):
        b.add_argument('--' + name, required=True)
    b.add_argument('--quiesced', action='store_true')
    r = commands.add_parser('restore')
    for name in ('archive', 'password-file', 'target'):
        r.add_argument('--' + name, required=True)
    args = parser.parse_args()
    try:
        if args.command == 'backup':
            backup(args.database, args.documents, args.n8n, args.encryption_key,
                   args.password_file, args.output, args.quiesced)
        else:
            restore(args.archive, args.password_file, args.target)
        print('PASS: encrypted backup' if args.command == 'backup' else 'PASS: isolated restore verified')
    except Exception as error:
        # Do not expose source paths, secret values, GPG stderr or DB content.
        parser.exit(1, f'FAILED: {type(error).__name__}; consult runbook and verify inputs\n')


if __name__ == '__main__':
    main()
