"""Run the workflow's final gate with simulated SSH results, without a VPS."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import textwrap
import unittest


ROOT = Path(__file__).resolve().parents[3]
WORKFLOW = ROOT / ".github/workflows/gsa-tv-autopilot-runtime.yml"
READY = """PHYSICAL_OFF_AIR_EVIDENCE=true
DESIRED_STATE=stopped
SIGNAL_STATE=stopped
PLAYOUT_STATE=off_air
FIRST_MIGRATION_OFFAIR_READY=true
AUTOPILOT_DB_CONTRACT_READY=true
AUTOPILOT_MIGRATION_COUNT=5
LATEST_BACKUP_STATE=restored_test
LATEST_BACKUP_MANIFEST_OK=true
MISSING_PATHS=none
"""


class PreparationEvidenceTests(unittest.TestCase):
    def run_gate(self, status, rc, evidence=READY, step="Final first-migration preparation evidence", operation="prepare-first-migration"):
        source = WORKFLOW.read_text(encoding="utf-8")
        section = source.split(f"      - name: {step}\n", 1)[1]
        section = section.split("\n      - name:", 1)[0]
        script = textwrap.dedent(section.split("        run: |\n", 1)[1])
        bash = shutil.which("bash") or r"C:\Program Files\Git\bin\bash.exe"
        with tempfile.TemporaryDirectory() as directory:
            env = dict(os.environ, RUNNER_TEMP=Path(directory).as_posix(),
                       VPS_USER="test", VPS_HOST="test", PROBE_RC=str(rc),
                       RUNTIME_OPERATION=operation,
                       GITHUB_OUTPUT=(Path(directory) / "output").as_posix(),
                       PROBE_EVIDENCE=f"STATUS={status}\n{evidence}")
            mock = 'ssh() { printf "%s\\n" "$PROBE_EVIDENCE"; return "$PROBE_RC"; }\n'
            return subprocess.run([bash, "-c", mock + script], cwd=ROOT, env=env,
                                  capture_output=True, text=True, timeout=10)

    def test_ready_preparation_before_installation(self):
        result = self.run_gate("CONTROL_PLANE_MISSING", 20)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("FIRST_MIGRATION_PREP_READY=true", result.stdout)

    def test_other_supported_runtimes(self):
        for status, rc in [("LEGACY_COUPLED", 10), ("EXTERNAL_READY", 0)]:
            with self.subTest(status=status):
                self.assertEqual(self.run_gate(status, rc).returncode, 0)

    def test_transport_failure_is_rejected_even_with_ready_output(self):
        self.assertEqual(self.run_gate("CONTROL_PLANE_MISSING", 255).returncode, 255)

    def test_partial_runtime_is_rejected(self):
        self.assertNotEqual(self.run_gate("PARTIAL_EXTERNAL", 20).returncode, 0)

    def test_blocked_runtime_is_rejected(self):
        self.assertNotEqual(self.run_gate("CONTROL_PLANE_MISSING", 20, READY + "STATUS=BLOCKED\n").returncode, 0)

    def test_each_required_evidence_is_mandatory(self):
        for line in READY.splitlines():
            with self.subTest(evidence=line):
                result = self.run_gate("CONTROL_PLANE_MISSING", 20, READY.replace(line + "\n", ""))
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn("FIRST_MIGRATION_PREP_READY=true", result.stdout)

    def test_deploy_accepts_only_prepared_missing_runtime(self):
        for operation in ("deploy", "deploy-dry-run"):
            for status, rc, evidence, success in [
                ("CONTROL_PLANE_MISSING", 20, READY, True),
                ("PARTIAL_EXTERNAL", 20, READY, False),
                ("CONTROL_PLANE_MISSING", 255, READY, False),
                ("CONTROL_PLANE_MISSING", 20, READY + "STATUS=BLOCKED\n", False),
                ("CONTROL_PLANE_MISSING", 20, READY.replace("AUTOPILOT_DB_CONTRACT_READY=true", "AUTOPILOT_DB_CONTRACT_READY=false"), False),
                ("CONTROL_PLANE_MISSING", 20, READY.replace("PHYSICAL_OFF_AIR_EVIDENCE=true", "PHYSICAL_OFF_AIR_EVIDENCE=false"), False),
            ]:
                with self.subTest(operation=operation, status=status, rc=rc, evidence=evidence):
                    result = self.run_gate(status, rc, evidence, "Runtime preflight", operation)
                    self.assertEqual(result.returncode == 0, success, result.stderr)

    def test_dry_run_cannot_select_apply_steps(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        for name in ("Guarded deploy apply", "Post-deploy evidence"):
            section = source.split(f"      - name: {name}\n", 1)[1].split("\n      - name:", 1)[0]
            condition = section.split("\n", 1)[0]
            self.assertIn("env.RUNTIME_OPERATION == 'deploy'", condition)
            self.assertNotIn("deploy-dry-run", condition)
        self.assertIn('if [ "${GITHUB_REF_NAME}" != "main" ]; then', source)


if __name__ == "__main__":
    unittest.main()
