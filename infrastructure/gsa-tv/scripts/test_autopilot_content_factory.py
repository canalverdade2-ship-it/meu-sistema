#!/usr/bin/env python3
import datetime as dt
import importlib.util
from pathlib import Path
import unittest
from zoneinfo import ZoneInfo

MODULE_PATH = Path(__file__).with_name("autopilot-content-factory.py")
SPEC = importlib.util.spec_from_file_location("autopilot_content_factory", MODULE_PATH)
factory = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(factory)

TZ = ZoneInfo("America/Sao_Paulo")
FIXED_NOW = dt.datetime(2026, 9, 22, 12, 0, tzinfo=TZ)


class ContentFactorySelectionTests(unittest.TestCase):
    def setUp(self):
        self.original_now = factory.now
        factory.now = lambda: FIXED_NOW

    def tearDown(self):
        factory.now = self.original_now

    def test_selects_nearest_future_day_with_missing_media(self):
        report = {
            "days_detail": [
                {"date": "2026-09-22", "schedule_state": "published", "issues": [{"issue": "missing_media"}]},
                {"date": "2026-09-23", "schedule_state": "published", "coverage_pct": 80, "content_coverage_pct": 75,
                 "issues": [{"issue": "missing_media", "block_id": "b1"}]},
                {"date": "2026-09-24", "schedule_state": "published", "coverage_pct": 50, "content_coverage_pct": 50,
                 "issues": [{"issue": "missing_media", "block_id": "b2"}]},
            ]
        }
        target, blockers = factory.select_target(report, 3)
        self.assertEqual(target["date"], "2026-09-23")
        self.assertEqual(target["days_ahead"], 1)
        self.assertEqual(target["missing_blocks"], 1)
        self.assertEqual(blockers, [])

    def test_shortfall_is_not_silently_replaced(self):
        report = {
            "days_detail": [
                {"date": "2026-09-23", "schedule_state": "published",
                 "issues": [{"issue": "content_shortfall", "block_id": "b1"}]}
            ]
        }
        target, blockers = factory.select_target(report, 3)
        self.assertIsNone(target)
        self.assertEqual(blockers[0]["shortfalls"], 1)

    def test_unpublished_schedule_is_not_produced(self):
        report = {
            "days_detail": [
                {"date": "2026-09-23", "schedule_state": "draft",
                 "issues": [{"issue": "missing_media", "block_id": "b1"}]}
            ]
        }
        target, _ = factory.select_target(report, 3)
        self.assertIsNone(target)

    def test_outside_horizon_is_ignored(self):
        report = {
            "days_detail": [
                {"date": "2026-09-29", "schedule_state": "published",
                 "issues": [{"issue": "missing_media", "block_id": "b1"}]}
            ]
        }
        target, _ = factory.select_target(report, 3)
        self.assertIsNone(target)

    def test_quiet_window_protects_morning_transition(self):
        self.assertTrue(factory.in_transition_quiet_window(dt.datetime(2026, 9, 22, 6, 0, tzinfo=TZ)))
        self.assertFalse(factory.in_transition_quiet_window(dt.datetime(2026, 9, 22, 7, 0, tzinfo=TZ)))

    def test_schedule_horizon_is_bounded_and_starts_d_plus_one(self):
        original_query = factory.query
        captured = {}
        try:
            def fake_query(sql, params=None):
                captured["sql"] = sql
                captured["params"] = params
                return [{"result": {"success": True}}]
            factory.query = fake_query
            result = factory.ensure_schedule_horizon(99)
            self.assertEqual(result, {"success": True})
            self.assertEqual(captured["params"], [30, "ch-main"])
            self.assertIn("date + 1", captured["sql"])
            self.assertIn("gsa_tv_refresh_fixed_schedule_horizon", captured["sql"])
        finally:
            factory.query = original_query


if __name__ == "__main__":
    unittest.main()
