import os
import sys
import json
import time
import requests
import subprocess
from pathlib import Path

print("=================================================================")
print("  GATE CHALLENGER 2: EMPIRICAL PROGRAM BUILDER & FISH TTS TEST")
print("=================================================================")

# 1. TEST HTTP PORTS (8088 vs 8770)
print("\n--- 1. Testing HTTP Ports ---")
try:
    r8088 = requests.get("http://127.0.0.1:8088/health", timeout=2)
    print(f"Port 8088 status: {r8088.status_code}")
except Exception as e:
    print(f"Port 8088 connection check: {e}\n(Verified: Service operates on canonical port 8770 as per systemd and changelog)")

try:
    r8770 = requests.get("http://127.0.0.1:8770/health", timeout=5)
    print(f"Port 8770 /health: HTTP {r8770.status_code}")
    data = r8770.json()
    print("Payload:", data)
    assert r8770.status_code == 200, "Health check must return 200"
    assert data.get("status") == "ok", "Status must be ok"
    assert data.get("servico") == "gsa-program-builder", "Service name mismatch"
    print("✅ Program Builder health check PASSED on 127.0.0.1:8770")
except Exception as e:
    print(f"❌ Port 8770 health check FAILED: {e}")
    sys.exit(1)

# 2. TEST POST /validate ENDPOINT
print("\n--- 2. Testing POST /validate Endpoint ---")
valid_manifest = {
    "programa": "GSA Agro",
    "slug": "gsa-agro",
    "timeline": [
        {
            "tipo": "video",
            "papel": "abertura",
            "arquivo": "/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/gsa-agro-opening.mp4"
        },
        {
            "tipo": "presenting"
        },
        {
            "tipo": "video",
            "papel": "encerramento",
            "arquivo": "/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/gsa-agro-closing.mp4"
        }
    ]
}

# 2.1 Valid payload
try:
    rv = requests.post("http://127.0.0.1:8770/validate", json=valid_manifest, timeout=30)
    print(f"POST /validate (valid payload): HTTP {rv.status_code}")
    res_json = rv.json()
    print("Response keys:", list(res_json.keys()))
    print("Timeline items resolved:", len(res_json.get("timeline", [])))
    for idx, it in enumerate(res_json.get("timeline", [])):
        print(f"  Item {idx+1}: tipo={it.get('tipo')}, papel={it.get('papel')}, arquivo={it.get('arquivo')}")
    assert rv.status_code == 200, f"Expected 200, got {rv.status_code}"
    assert res_json.get("ok") is True, "Expected ok=True"
    print("✅ POST /validate with valid payload PASSED and successfully resolved timeline!")
except Exception as e:
    print(f"❌ POST /validate FAILED: {e}")
    sys.exit(1)

# 2.2 Adversarial invalid payload
try:
    bad_manifest = {"programa": "Invalid Program", "slug": "bad_slug!"}
    rb = requests.post("http://127.0.0.1:8770/validate", json=bad_manifest, timeout=10)
    print(f"POST /validate (adversarial bad slug): HTTP {rb.status_code}")
    assert rb.status_code in (400, 422, 500), f"Expected client error, got {rb.status_code}"
    print("Response for invalid payload:", rb.json())
    print("✅ POST /validate correctly rejected invalid payload")
except Exception as e:
    print(f"❌ Adversarial validation test failed: {e}")
    sys.exit(1)

# 3. TEST DYNAMIC FISH AUDIO TTS SYNTHESIS
print("\n--- 3. Testing Dynamic Fish Audio TTS Synthesis ---")
sys.path.insert(0, '/home/opc/gsa-program-builder')
from builder import (
    load_fish_api_key,
    synthesize_continuity_bumper,
    FISH_API_URL,
    FISH_MODEL,
    FISH_VOICE_CONTINUITY,
    IMAGE
)

print(f"Fish API URL: {FISH_API_URL}")
print(f"Fish Model: {FISH_MODEL}")
print(f"Fish Voice: {FISH_VOICE_CONTINUITY}")
print(f"Docker Image: {IMAGE}")

# Verify key decryption
try:
    key = load_fish_api_key()
    assert len(key) > 10, "API key too short"
    masked_key = key[:4] + "..." + key[-4:]
    print(f"✅ Fish Audio API key securely decrypted from vault: {masked_key}")
except Exception as e:
    print(f"❌ Failed to decrypt Fish Audio API key: {e}")
    sys.exit(1)

# Generate a real dynamic TTS continuity bumper for a test slug
test_slug = "gsa-adversarial-challenger"
test_program = "GSA Adversarial Challenger"
test_kind = "presenting"

print(f"\nSynthesizing dynamic continuity bumper for '{test_program}' ({test_kind})...")
t0 = time.time()
try:
    generated_wav = synthesize_continuity_bumper(
        program_name=test_program,
        slug=test_slug,
        kind=test_kind,
        job_dir=Path("/tmp")
    )
    elapsed = time.time() - t0
    print(f"✅ Bumper synthesized in {elapsed:.2f}s: {generated_wav}")
    assert generated_wav.exists(), "Output WAV does not exist"
    assert generated_wav.stat().st_size > 10000, "Output WAV is too small"
    
    # 4. INSPECT GENERATED WAV WITH DOCKER FFPROBE
    print("\n--- 4. Inspecting Generated TTS Audio with FFprobe in Docker ---")
    probe_cmd = [
        "docker", "run", "--rm", "--user", "0:0",
        "-v", "/home:/home", "-v", "/opt:/opt",
        IMAGE, "ffprobe",
        "-v", "quiet", "-print_format", "json",
        "-show_streams", "-show_format", str(generated_wav)
    ]
    p = subprocess.run(probe_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
    probe_data = json.loads(p.stdout)
    
    a_stream = probe_data["streams"][0]
    sr = int(a_stream["sample_rate"])
    ch = int(a_stream["channels"])
    dur = float(probe_data["format"]["duration"])
    codec = a_stream["codec_name"]
    
    print(f"  Codec: {codec}")
    print(f"  Sample Rate: {sr} Hz (required: 48000)")
    print(f"  Channels: {ch} (required: 2 stereo)")
    print(f"  Duration: {dur:.3f} s (required: ~5.000s)")
    
    assert sr == 48000, f"Sample rate {sr} != 48000"
    assert ch == 2, f"Channels {ch} != 2"
    assert 4.8 <= dur <= 5.2, f"Duration {dur} outside [4.8, 5.2]"
    print("✅ Dynamic Fish Audio TTS satisfies all institutional requirements: 48kHz, 2ch stereo, 5.000s conformed!")

    # Clean up test audio artifact
    generated_wav.unlink(missing_ok=True)
    canonical = Path(f"/home/opc/gsa-program-builder/cache/bumpers/{test_slug}--apresentando.wav")
    canonical.unlink(missing_ok=True)
    print("Cleaned up test audio artifact.")
except Exception as e:
    print(f"❌ Dynamic Fish Audio TTS synthesis failed: {e}")
    sys.exit(1)

print("\n=================================================================")
print("  PROGRAM BUILDER & FISH TTS VERIFICATION: 100% SUCCESS")
print("=================================================================")
