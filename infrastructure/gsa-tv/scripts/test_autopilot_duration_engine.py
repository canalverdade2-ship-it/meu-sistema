#!/usr/bin/env python3
import datetime as dt
import importlib.util
from pathlib import Path
import unittest
from zoneinfo import ZoneInfo

MODULE_PATH = Path(__file__).with_name("autopilot-duration-engine.py")
SPEC = importlib.util.spec_from_file_location("autopilot_duration_engine", MODULE_PATH)
engine = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(engine)

TZ = ZoneInfo("America/Sao_Paulo")
FIXED_NOW = dt.datetime(2026, 9, 22, 12, 0, tzinfo=TZ)


class DurationEngineTests(unittest.TestCase):
    def setUp(self):
        self.original_now = engine.now
        engine.now = lambda: FIXED_NOW

    def tearDown(self):
        engine.now = self.original_now

    def test_selects_nearest_future_shortfall(self):
        report = {
            "days_detail": [
                {"date": "2026-09-22", "schedule_state": "published",
                 "issues": [{"issue": "content_shortfall", "block_id": "today"}]},
                {"date": "2026-09-23", "schedule_state": "published",
                 "issues": [{"issue": "content_shortfall", "block_id": "tomorrow",
                             "planned_start_offset_s": 7200}]},
                {"date": "2026-09-24", "schedule_state": "published",
                 "issues": [{"issue": "content_shortfall", "block_id": "later",
                             "planned_start_offset_s": 3600}]},
            ]
        }
        target = engine.select_shortfall(report, 3)
        self.assertEqual(target["block_id"], "tomorrow")
        self.assertEqual(target["date"], "2026-09-23")

    def test_ignores_unpublished_and_non_shortfall(self):
        report = {
            "days_detail": [
                {"date": "2026-09-23", "schedule_state": "draft",
                 "issues": [{"issue": "content_shortfall", "block_id": "draft"}]},
                {"date": "2026-09-24", "schedule_state": "published",
                 "issues": [{"issue": "missing_media", "block_id": "missing"}]},
            ]
        }
        self.assertIsNone(engine.select_shortfall(report, 3))

    def test_validate_block_rejects_live_reprise_and_library(self):
        base = {
            "channel_id": "ch-main",
            "schedule_state": "published",
            "media_item_id": "old",
            "program_id": "p1",
            "program_name": "Programa",
            "block_type": "program",
            "is_reprise": False,
            "metadata": {},
            "planned_duration_s": 1800,
            "current_media_duration_s": 600,
        }
        live = dict(base, block_type="live")
        self.assertEqual(engine.validate_block(live)[1], "live_block")

        reprise = dict(base, is_reprise=True)
        self.assertEqual(engine.validate_block(reprise)[1], "reprise_block")

        library = dict(base, metadata={"content_mode": "library"})
        self.assertEqual(engine.validate_block(library)[1], "library_block")

    def test_validate_block_accepts_real_shortfall(self):
        block = {
            "channel_id": "ch-main",
            "schedule_state": "published",
            "media_item_id": "old",
            "program_id": "p1",
            "program_name": "Programa",
            "block_type": "program",
            "is_reprise": False,
            "metadata": {},
            "planned_duration_s": 1800,
            "current_media_duration_s": 600,
        }
        self.assertEqual(engine.validate_block(block), (True, None))

    def test_validate_block_detects_resolved_shortfall(self):
        block = {
            "channel_id": "ch-main",
            "schedule_state": "published",
            "media_item_id": "old",
            "program_id": "p1",
            "program_name": "Programa",
            "block_type": "program",
            "is_reprise": False,
            "metadata": {},
            "planned_duration_s": 1800,
            "current_media_duration_s": 1800,
        }
        self.assertEqual(engine.validate_block(block)[1], "shortfall_already_resolved")


if __name__ == "__main__":
    unittest.main()
