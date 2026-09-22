#!/usr/bin/env python3
import datetime as dt
import importlib.util
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

    def tearDown(self):
        engine.now = self.original_now
        engine.query = self.original_query

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


if __name__ == "__main__":
    unittest.main()
