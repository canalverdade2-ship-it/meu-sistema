#!/usr/bin/env python3
import hashlib
import importlib.util
from pathlib import Path
import unittest

MODULE_PATH = Path(__file__).with_name("render-generic-program.py")
SPEC = importlib.util.spec_from_file_location("render_generic_program", MODULE_PATH)
renderer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(renderer)


class GenericRendererTimingTests(unittest.TestCase):
    def test_media_url_rejects_http(self):
        with self.assertRaises(ValueError):
            renderer.validate_media_url("http://videos.pexels.com/video.mp4", "pexels")

    def test_media_url_rejects_unexpected_host(self):
        with self.assertRaises(ValueError):
            renderer.validate_media_url("https://example.com/video.mp4", "pexels")

    def test_media_url_rejects_private_dns_resolution(self):
        original = renderer.socket.getaddrinfo
        try:
            renderer.socket.getaddrinfo = lambda *_args, **_kwargs: [
                (renderer.socket.AF_INET, renderer.socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443))
            ]
            with self.assertRaises(ValueError):
                renderer.validate_media_url("https://videos.pexels.com/video.mp4", "pexels")
        finally:
            renderer.socket.getaddrinfo = original

    def test_media_url_accepts_public_allowed_resolution(self):
        original = renderer.socket.getaddrinfo
        try:
            renderer.socket.getaddrinfo = lambda *_args, **_kwargs: [
                (renderer.socket.AF_INET, renderer.socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443))
            ]
            value = renderer.validate_media_url("https://videos.pexels.com/video.mp4", "pexels")
            self.assertEqual(value, "https://videos.pexels.com/video.mp4")
        finally:
            renderer.socket.getaddrinfo = original

    def test_source_bound_program_is_supported(self):
        narration = "Texto factual neutro sustentado pelas fontes."
        digest = hashlib.sha256(narration.encode()).hexdigest()
        script = {
            "narration": narration,
            "review": {
                "pass": True,
                "violations": [],
                "script_sha256": digest,
            },
            "script_sha256": digest,
            "mode": "source_bound_program",
            "date": "2026-09-23",
            "program": "Programa Factual",
        }
        manifest = {
            "script_sha256": digest,
            "broadcast_date": "2026-09-23",
            "program": "Programa Factual",
        }
        renderer.validate_inputs(script, manifest, 1800.0)

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
