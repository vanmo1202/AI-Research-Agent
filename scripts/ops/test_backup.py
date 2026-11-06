"""Run: python3 -m unittest discover -s scripts/ops -p 'test_*.py' -v"""
import importlib.util
import io
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('backup.py'))
ops = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops)


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='researchos-backup-test-')
        self.root = Path(self.temp.name)
        self.documents = self.root / 'documents'
        self.n8n = self.root / 'n8n'
        self.documents.mkdir()
        self.n8n.mkdir()
        (self.documents / 'synthetic.pdf').write_bytes(b'%PDF-1.4 synthetic fixture')
        self.connections = []
        for path in (self.root / 'research.db', self.n8n / 'database.sqlite'):
            db = sqlite3.connect(path)
            self.connections.append(db)
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('PRAGMA wal_autocheckpoint=0')
            db.execute('CREATE TABLE fixture(id INTEGER PRIMARY KEY, value TEXT)')
            db.execute("INSERT INTO fixture(value) VALUES('committed WAL data')")
            db.commit()
            self.assertTrue(Path(str(path) + '-wal').exists())
        self.key = self.root / 'encryption-key'
        self.password = self.root / 'backup-password'
        for path in (self.key, self.password):
            path.write_text('fake-test-secret-at-least-32-characters')
            path.chmod(0o600)
        (self.n8n / 'config').write_text(json.dumps({'encryptionKey': self.key.read_text()}))
        self.archive = self.root / 'snapshot.gpg'

    def tearDown(self):
        for db in self.connections:
            db.close()
        self.temp.cleanup()

    def backup(self, **kw):
        args = dict(database=self.root / 'research.db', documents=self.documents,
                    n8n=self.n8n, encryption_key=self.key, password=self.password,
                    output=self.archive, quiesced=True)
        args.update(kw)
        return ops.backup(**args)

    def test_encrypted_wal_roundtrip_and_independent_process(self):
        self.backup()
        self.assertNotIn(b'fake-test-secret', self.archive.read_bytes())
        target = self.root / 'isolated-restore'
        ops.restore(self.archive, self.password, target)
        self.assertEqual((target / 'documents/synthetic.pdf').read_bytes(),
                         (self.documents / 'synthetic.pdf').read_bytes())
        self.assertEqual((target / 'secrets/n8n_encryption_key').read_bytes(), self.key.read_bytes())
        self.assertEqual((target / 'n8n/config').read_bytes(), (self.n8n / 'config').read_bytes())
        for name in ('research/research.db', 'n8n/database.sqlite'):
            code = "import sqlite3,sys; d=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True); print(d.execute('select value from fixture').fetchone()[0])"
            result = subprocess.run(['python3', '-c', code, str(target / name)],
                                    check=True, capture_output=True, text=True)
            self.assertEqual(result.stdout.strip(), 'committed WAL data')
        self.assertEqual(target.stat().st_mode & 0o777, 0o700)

    def test_quiescence_required(self):
        with self.assertRaises(ValueError):
            self.backup(quiesced=False)
        self.assertFalse(self.archive.exists())

    def test_never_overwrite_backup_or_existing_restore(self):
        self.archive.write_bytes(b'preserve existing backup')
        with self.assertRaises(ValueError):
            self.backup()
        self.assertEqual(self.archive.read_bytes(), b'preserve existing backup')
        target = self.root / 'existing'
        target.mkdir()
        (target / 'sentinel').write_text('keep')
        with self.assertRaises(ValueError):
            ops.restore(self.archive, self.password, target)
        self.assertEqual((target / 'sentinel').read_text(), 'keep')

    def test_symlink_rejected(self):
        (self.documents / 'unsafe').symlink_to(self.key)
        with self.assertRaises(ValueError):
            self.backup()

    def test_secret_permissions_and_wrong_password_fail_closed(self):
        self.key.chmod(0o644)
        with self.assertRaises(ValueError):
            self.backup()
        self.key.chmod(0o600)
        self.backup()
        self.password.write_text('wrong-password-also-over-16-bytes')
        target = self.root / 'wrong-password-restore'
        with self.assertRaises(ValueError):
            ops.restore(self.archive, self.password, target)
        self.assertFalse(target.exists())

    def test_encrypted_traversal_archive_rejected(self):
        plain = self.root / 'unsafe.tar.gz'
        with tarfile.open(plain, 'w:gz') as tar:
            info = tarfile.TarInfo('../escape')
            info.size = 4
            tar.addfile(info, io.BytesIO(b'evil'))
        ops.crypt(plain, self.archive, self.password)
        with self.assertRaises(ValueError):
            ops.restore(self.archive, self.password, self.root / 'unsafe-target')
        self.assertFalse((self.root / 'escape').exists())

    def test_authenticated_archive_with_wrong_manifest_rejected(self):
        plain = self.root / 'wrong-manifest.tar.gz'
        with tarfile.open(plain, 'w:gz') as tar:
            value = json.dumps({'version': 1, 'files': {'missing': 'incorrect'}}).encode()
            info = tarfile.TarInfo('manifest.json')
            info.size = len(value)
            tar.addfile(info, io.BytesIO(value))
        ops.crypt(plain, self.archive, self.password)
        with self.assertRaises(ValueError):
            ops.restore(self.archive, self.password, self.root / 'bad-checksums')

    def test_backup_output_inside_source_is_rejected(self):
        with self.assertRaises(ValueError):
            self.backup(output=self.documents / 'recursive.gpg')

    def test_mismatched_n8n_key_is_rejected(self):
        self.key.write_text('different-key-at-least-32-characters')
        with self.assertRaises(ValueError):
            self.backup()
