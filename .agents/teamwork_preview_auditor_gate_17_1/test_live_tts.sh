python3 - << 'EOF'
import sys
import os
import shutil
from pathlib import Path
sys.path.append('/home/opc/gsa-program-builder')
from builder import synthesize_continuity_bumper, probe

test_slug = "forensic-audit-test"
test_program = "Auditoria Forense"
kind = "presenting"

print("--- Testing Live Dynamic Synthesis via Fish Audio API ---")
try:
    wav_path = synthesize_continuity_bumper(test_program, test_slug, kind)
    print("Synthesized WAV path:", wav_path)
    print("File exists:", wav_path.exists())
    print("File size:", wav_path.stat().st_size)
    info = probe(wav_path)
    print("Probe info:", info)
    print("LIVE_TTS_SUCCESS: TRUE")
    # Clean up test artifact after verification
    wav_path.unlink(missing_ok=True)
    alias = Path('/home/opc/gsa-program-builder/cache/bumpers') / f"{test_slug}--apresentando.wav"
    alias.unlink(missing_ok=True)
    print("Cleaned up test audio files.")
except Exception as e:
    print("LIVE_TTS_ERROR:", repr(e))
EOF
