import hashlib
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('renderer', Path(__file__).with_name('render-original-reflection.py'))
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)


class ReflectionGate(unittest.TestCase):
    def setUp(self):
        digest = hashlib.sha256(b'Original narration').hexdigest()
        self.script = {'narration': 'Original narration', 'mode': 'original_reflection',
                       'script_sha256': digest, 'date': '2026-09-14', 'program': 'GSA Em Fé',
                       'review': {'pass': True, 'violations': [], 'script_sha256': digest}}
        self.manifest = {'script_sha256': digest, 'broadcast_date': '2026-09-14', 'program': 'GSA Em Fé'}

    def test_accepts_reviewed_matching_narration(self):
        renderer.validate_inputs(self.script, self.manifest, 1200)

    def test_rejects_script_changed_after_review(self):
        self.script['narration'] += ' Changed'
        with self.assertRaises(ValueError):
            renderer.validate_inputs(self.script, self.manifest, 1200)

    def test_rejects_wrong_date(self):
        self.manifest['broadcast_date'] = '2026-09-13'
        with self.assertRaises(ValueError):
            renderer.validate_inputs(self.script, self.manifest, 1200)

    def test_rejects_editorial_violation(self):
        self.script['review']['violations'] = ['Unsupported claim']
        with self.assertRaises(ValueError):
            renderer.validate_inputs(self.script, self.manifest, 1200)

    def test_cannot_substitute_for_movie(self):
        self.script['mode'] = 'library'
        with self.assertRaises(ValueError):
            renderer.validate_inputs(self.script, self.manifest, 1200)

    def test_rejects_programme_mismatch(self):
        self.manifest['program'] = 'GSA News'
        with self.assertRaises(ValueError):
            renderer.validate_inputs(self.script, self.manifest, 1200)

    def test_rejects_target_duration_under_minimum(self):
        with self.assertRaises(ValueError):
            renderer.validate_inputs(self.script, self.manifest, 59.9)

    def test_rejects_target_duration_over_maximum(self):
        with self.assertRaises(ValueError):
            renderer.validate_inputs(self.script, self.manifest, 7200.1)

    def test_rejects_non_finite_duration(self):
        with self.assertRaises(ValueError):
            renderer.validate_inputs(self.script, self.manifest, float('nan'))

    def test_rejects_unapproved_review(self):
        self.script['review']['pass'] = False
        with self.assertRaises(ValueError):
            renderer.validate_inputs(self.script, self.manifest, 1200)

    def test_rejects_missing_review(self):
        del self.script['review']
        with self.assertRaises(ValueError):
            renderer.validate_inputs(self.script, self.manifest, 1200)

    def test_rejects_manifest_hash_tampering(self):
        self.manifest['script_sha256'] = '0' * 64
        with self.assertRaises(ValueError):
            renderer.validate_inputs(self.script, self.manifest, 1200)


if __name__ == '__main__':
    unittest.main()
