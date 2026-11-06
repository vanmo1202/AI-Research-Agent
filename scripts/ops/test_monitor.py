import importlib.util
import os
from pathlib import Path
import tempfile
import time
import unittest

spec = importlib.util.spec_from_file_location('monitor', Path(__file__).with_name('monitor.py'))
ops = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops)


class MonitorTests(unittest.TestCase):
    def test_missing_or_stale_backup_is_unhealthy(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'fixture.gpg'
            self.assertFalse(ops.filesystem_checks(file)['backupFresh'])
            file.write_bytes(b'synthetic archive')
            self.assertTrue(ops.filesystem_checks(file)['backupFresh'])
            old = time.time() - 48 * 3600
            os.utime(file, (old, old))
            self.assertFalse(ops.filesystem_checks(file)['backupFresh'])

    def test_symlink_backup_is_not_accepted(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'fixture.gpg'
            source.write_bytes(b'fixture')
            link = Path(directory) / 'symlink.gpg'
            link.symlink_to(source)
            self.assertFalse(ops.filesystem_checks(link)['backupFresh'])

    def test_disk_threshold_causes_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertTrue(ops.filesystem_checks(data_directory=directory, min_free_bytes=0)['diskSpaceOk'])
            self.assertFalse(ops.filesystem_checks(data_directory=directory, min_free_bytes=2**63)['diskSpaceOk'])
