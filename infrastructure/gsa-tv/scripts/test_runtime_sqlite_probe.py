"""Exercise the preparation probe with real SQLite and mocked container discovery."""
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import unittest


class RuntimeSQLiteProbeTests(unittest.TestCase):
    def run_probe(self, *, corrupt=False, container=True, database=True):
        source = Path(__file__).with_name("autopilot-runtime-preflight.sh").read_text(encoding="utf-8")
        # Execute the unconditional evidence section, excluding optional diagnostics.
        start = source.index('echo "MISSING_PATHS=')
        end = source.index('if [ "${#missing_paths[@]}" -gt 0 ]; then', start)
        probe = source[start:end]
        bash = shutil.which("bash")
        if not bash and os.name == "nt":
            bash = r"C:\Program Files\Git\bin\bash.exe"
        if not bash or not Path(bash).exists():
            self.fail("Bash is required to exercise the runtime probe")
        with tempfile.TemporaryDirectory() as directory:
            db = Path(directory) / "ffplayout.db"
            if database:
                if corrupt:
                    db.write_bytes(b"invalid sqlite database")
                else:
                    with sqlite3.connect(db) as connection:
                        connection.execute("create table sentinel(value text)")
                        connection.execute("insert into sentinel values ('preserve')")
                    connection.close()
            before = db.read_bytes() if database else None
            env = dict(os.environ, PROBE_STATE=Path(directory).as_posix())
            script = """set -euo pipefail
missing_paths=()
docker() { printf '%s\\n' "$PROBE_STATE"; }
python3() { python "$@"; }
""" + "container_exists() { " + ("true" if container else "false") + "; }\n" + probe
            result = subprocess.run([bash, "-c", script], env=env, capture_output=True, text=True, timeout=45)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("MISSING_PATHS=none", result.stdout)
            if database:
                self.assertEqual(db.read_bytes(), before, "Probe changed the source database")
            return result.stdout

    def test_healthy_database_with_all_paths_present(self):
        self.assertIn("HOST_SQLITE_BACKUP_PROBE=ok", self.run_probe())

    def test_corrupt_database_is_not_accepted(self):
        output = self.run_probe(corrupt=True)
        self.assertIn("HOST_SQLITE_BACKUP_PROBE=failed", output)
        self.assertNotIn("HOST_SQLITE_BACKUP_PROBE=ok", output)

    def test_missing_container_is_explicit(self):
        self.assertIn("HOST_SQLITE_BACKUP_PROBE=unavailable", self.run_probe(container=False))

    def test_missing_database_is_explicit(self):
        self.assertIn("HOST_SQLITE_BACKUP_PROBE=unavailable", self.run_probe(database=False))


if __name__ == "__main__":
    unittest.main()
