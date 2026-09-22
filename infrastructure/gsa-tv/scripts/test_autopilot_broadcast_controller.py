#!/usr/bin/env python3
import datetime as dt
import importlib.util
from pathlib import Path
import unittest
from zoneinfo import ZoneInfo

MODULE_PATH = Path(__file__).with_name("autopilot-broadcast-controller.py")
SPEC = importlib.util.spec_from_file_location("autopilot_broadcast_controller", MODULE_PATH)
controller = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(controller)

TZ = ZoneInfo("America/Sao_Paulo")


class BroadcastControllerTests(unittest.TestCase):
    def test_legacy_broadcast_unit_detection(self):
        original = controller.subprocess.run
        try:
            class Result:
                def __init__(self, code):
                    self.returncode = code
            def fake_run(command, **_kwargs):
                unit = command[-1]
                return Result(0 if unit == "gsa-tv-morning-start.timer" else 3)
            controller.subprocess.run = fake_run
            self.assertEqual(
                controller.active_legacy_broadcast_units(),
                ["gsa-tv-morning-start.timer"],
            )
        finally:
            controller.subprocess.run = original

    def test_phase_prepare(self):
        moment = dt.datetime(2026, 9, 23, 5, 55, tzinfo=TZ)
        self.assertEqual(controller.phase(moment), "prepare")

    def test_phase_on_air(self):
        moment = dt.datetime(2026, 9, 23, 6, 0, tzinfo=TZ)
        self.assertEqual(controller.phase(moment), "on_air")

    def test_phase_off_air_at_stop(self):
        moment = dt.datetime(2026, 9, 23, 23, 59, tzinfo=TZ)
        self.assertEqual(controller.phase(moment), "off_air")

    def test_on_air_stopped_requests_start(self):
        action = controller.decide("on_air", {
            "desired_state": "stopped",
            "signal_state": "stopped",
            "playout_state": "off_air",
        })
        self.assertEqual(action, "start")

    def test_on_air_manual_pause_is_preserved(self):
        action = controller.decide("on_air", {
            "desired_state": "paused",
            "signal_state": "sending",
            "playout_state": "paused",
        })
        self.assertEqual(action, "hold_manual_pause")

    def test_on_air_manual_live_is_preserved(self):
        action = controller.decide("on_air", {
            "desired_state": "running",
            "signal_state": "sending",
            "playout_state": "manual-live:00000000-0000-0000-0000-000000000001",
        })
        self.assertEqual(action, "preserve_manual_live")

    def test_off_air_manual_live_is_not_force_stopped(self):
        action = controller.decide("off_air", {
            "desired_state": "running",
            "signal_state": "sending",
            "playout_state": "manual-live:00000000-0000-0000-0000-000000000001",
        })
        self.assertEqual(action, "hold_manual_live_overtime")

    def test_off_air_program_requests_stop(self):
        action = controller.decide("off_air", {
            "desired_state": "running",
            "signal_state": "sending",
            "playout_state": "program",
        })
        self.assertEqual(action, "stop")

    def test_off_air_confirmed_is_noop(self):
        action = controller.decide("off_air", {
            "desired_state": "stopped",
            "signal_state": "stopped",
            "playout_state": "off_air",
        })
        self.assertEqual(action, "noop_off_air")


if __name__ == "__main__":
    unittest.main()
