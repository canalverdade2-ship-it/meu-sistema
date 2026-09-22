#!/usr/bin/env python3
import datetime as dt
import hashlib
import importlib.util
import tempfile
from pathlib import Path
import unittest
from zoneinfo import ZoneInfo

MODULE_PATH = Path(__file__).with_name("autopilot-fallback-engine.py")
SPEC = importlib.util.spec_from_file_location("autopilot_fallback_engine", MODULE_PATH)
engine = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(engine)

TZ = ZoneInfo("America/Sao_Paulo")


class FallbackEngineTests(unittest.TestCase):
    def setUp(self):
        self.original_now = engine.now
        self.original_query = engine.query
        self.original_probe = engine.probe
        self.original_root = engine.ROOT
        self.original_media = engine.MEDIA

    def tearDown(self):
        engine.now = self.original_now
        engine.query = self.original_query
        engine.probe = self.original_probe
        engine.ROOT = self.original_root
        engine.MEDIA = self.original_media

    def test_sha256_file_is_deterministic(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "fallback.mp4"
            path.write_bytes(b"gsa-tv-official-fallback")
            expected = hashlib.sha256(b"gsa-tv-official-fallback").hexdigest()
            self.assertEqual(engine.sha256_file(path), expected)

    def test_official_continuity_rejects_checksum_change(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            media = root / "cache" / "media" / "1"
            target = media / "identity" / "gsa-tv-fallback-720p30.mp4"
            target.parent.mkdir(parents=True)
            target.write_bytes(b"new-official-fallback")

            engine.ROOT = root
            engine.MEDIA = media
            engine.probe = lambda _path: {
                "duration_s": 30.0,
                "video_codec": "h264",
                "width": 1280,
                "height": 720,
                "fps": 30.0,
                "audio_codec": "aac",
                "sample_rate": 48000,
                "channels": 2,
            }

            def fake_query(sql, params=None):
                if "select id,drive_path,metadata" in sql:
                    return [{
                        "id": engine.FALLBACK_MEDIA_ID,
                        "drive_path": "/media/1/identity/gsa-tv-fallback-720p30.mp4",
                        "metadata": {"sha256": "0" * 64},
                    }]
                self.fail("insert must not run after checksum mismatch")

            engine.query = fake_query
            with self.assertRaisesRegex(RuntimeError, "checksum changed"):
                engine.ensure_official_continuity()

    def test_official_continuity_pins_checksum_on_first_registration(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            media = root / "cache" / "media" / "1"
            target = media / "identity" / "gsa-tv-fallback-720p30.mp4"
            target.parent.mkdir(parents=True)
            payload = b"official-fallback-v1"
            target.write_bytes(payload)

            engine.ROOT = root
            engine.MEDIA = media
            engine.probe = lambda _path: {
                "duration_s": 30.0,
                "video_codec": "h264",
                "width": 1280,
                "height": 720,
                "fps": 30.0,
                "audio_codec": "aac",
                "sample_rate": 48000,
                "channels": 2,
            }
            calls = []

            def fake_query(sql, params=None):
                calls.append((sql, params))
                if "select id,drive_path,metadata" in sql:
                    return []
                return []

            engine.query = fake_query
            result = engine.ensure_official_continuity()
            expected = hashlib.sha256(payload).hexdigest()
            self.assertEqual(result["sha256"], expected)
            insert_params = calls[-1][1]
            self.assertIn(expected, insert_params[-1])

    def test_activation_window_opens_late_d0(self):
        engine.query = lambda *_args, **_kwargs: [
            {"policy": {"on_air_start": "06:00:00"}}
        ]
        engine.now = lambda: dt.datetime(2026, 9, 22, 22, 0, tzinfo=TZ)
        window = engine.activation_window(7)
        self.assertEqual(window["tomorrow"], dt.date(2026, 9, 23))
        self.assertEqual(window["activate_at"], dt.datetime(2026, 9, 22, 23, 0, tzinfo=TZ))
        self.assertFalse(window["active"])

        engine.now = lambda: dt.datetime(2026, 9, 22, 23, 5, tzinfo=TZ)
        self.assertTrue(engine.activation_window(7)["active"])

    def test_activation_uses_airtime_deadline_when_earlier(self):
        engine.query = lambda *_args, **_kwargs: [
            {"policy": {"on_air_start": "03:00:00"}}
        ]
        engine.now = lambda: dt.datetime(2026, 9, 22, 19, 30, tzinfo=TZ)
        window = engine.activation_window(7)
        self.assertEqual(window["activate_at"], dt.datetime(2026, 9, 22, 20, 0, tzinfo=TZ))
        self.assertFalse(window["active"])

        engine.now = lambda: dt.datetime(2026, 9, 22, 20, 1, tzinfo=TZ)
        self.assertTrue(engine.activation_window(7)["active"])

    def test_fallback_rejects_live_reprise_and_library(self):
        base = {
            "schedule_state": "published",
            "block_type": "program",
            "is_reprise": False,
            "metadata": {},
        }
        self.assertTrue(engine.eligible_block(base))
        self.assertFalse(engine.eligible_block(dict(base, block_type="live")))
        self.assertFalse(engine.eligible_block(dict(base, is_reprise=True)))
        self.assertFalse(engine.eligible_block(dict(base, metadata={"content_mode": "library"})))

    def test_actionable_issue_contract_is_restricted(self):
        self.assertIn("missing_media", engine.ACTIONABLE)
        self.assertIn("content_shortfall", engine.ACTIONABLE)
        self.assertNotIn("gap_or_overlap", engine.ACTIONABLE)
        self.assertNotIn("day_coverage", engine.ACTIONABLE)

    def test_fallback_outcome_requires_successful_compile(self):
        ready = {"state": "ready"}
        self.assertEqual(
            engine.fallback_outcome(ready, {"returncode": 0}, 0),
            ("fallback_ready", 0),
        )
        self.assertEqual(
            engine.fallback_outcome(ready, {"returncode": 1}, 0),
            ("fallback_compile_failed", 2),
        )
        self.assertEqual(
            engine.fallback_outcome({"state": "incomplete"}, None, 0),
            ("fallback_incomplete", 2),
        )

    def test_fallback_outcome_preserves_assignment_failure_exit(self):
        self.assertEqual(
            engine.fallback_outcome({"state": "ready"}, {"returncode": 0}, 1),
            ("fallback_ready", 2),
        )


if __name__ == "__main__":
    unittest.main()
