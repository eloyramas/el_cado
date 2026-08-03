import importlib
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class ConfigQuotaTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.db_path = os.path.join(self.temp_dir.name, "test.db")
        self.app_module = importlib.import_module("app")
        self.app_module.DB_PATH = self.db_path
        self.app_module.init_db()

    def test_init_db_updates_legacy_quota_to_45(self):
        conn = self.app_module.sqlite3.connect(self.db_path)
        try:
            conn.execute("UPDATE config SET cuota_mensual = 20 WHERE id = 1")
            conn.commit()
        finally:
            conn.close()

        self.app_module.init_db()

        conn = self.app_module.sqlite3.connect(self.db_path)
        try:
            row = conn.execute("SELECT cuota_mensual FROM config WHERE id = 1").fetchone()
            self.assertEqual(row[0], 45.0)
        finally:
            conn.close()


if __name__ == "__main__":
    unittest.main()
