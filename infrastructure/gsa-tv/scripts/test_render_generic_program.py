#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import unittest

MODULE_PATH = Path(__file__).with_name("render-generic-program.py")
SPEC = importlib.util.spec_from_file_location("render_generic_program", MODULE_PATH)
renderer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(renderer)


class GenericRendererTimingTests(unittest.TestCase):
    def test_timing_uses_body_after_bumpers(self):
        body, speed = renderer.compute_timing(
            audio_duration=1620.0,
            slot_seconds=1800.0,
            bumper_duration=90.0,
        )
        self.assertEqual(body, 1620.0)
        self.assertAlmostEqual(speed, 1.0)

    def test_timing_rejects_slot_consumed_by_bumpers(self):
        with self.assertRaises(ValueError):
            renderer.compute_timing(
                audio_duration=60.0,
                slot_seconds=120.0,
                bumper_duration=40.0,
            )

    def test_timing_rejects_excessive_audio_stretch(self):
        with self.assertRaises(ValueError):
            renderer.compute_timing(
                audio_duration=1000.0,
                slot_seconds=1800.0,
                bumper_duration=40.0,
            )

    def test_timing_rejects_non_finite_values(self):
        with self.assertRaises(ValueError):
            renderer.compute_timing(
                audio_duration=float("nan"),
                slot_seconds=1800.0,
                bumper_duration=40.0,
            )


if __name__ == "__main__":
    unittest.main()
