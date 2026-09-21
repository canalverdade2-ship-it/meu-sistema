import os
import sys
import json
import subprocess
from pathlib import Path

print("=================================================================")
print("  GATE CHALLENGER 2: EMPIRICAL GSA AGRO MASTER VERIFICATION")
print("=================================================================")

MASTER_PATH = "/opt/gsa-tv/cache/media/1/program-masters/gsa-agro-master.mp4"
OLD_TEST_PATH = "/home/opc/gsa-ai/work/gsa-agro-builder-teste-publicado.mp4"
DOCKER_IMG = "gsa-tv/control-plane:1.8.7"
QC_DIR = "/home/opc/gsa-ai/work/identity-flow-20260907/qc-agro-adversarial"

# 1. Check file existence
if not os.path.isfile(MASTER_PATH):
    print(f"FATAL: Master file does not exist at {MASTER_PATH}")
    sys.exit(1)

size_bytes = os.path.getsize(MASTER_PATH)
mtime = os.path.getmtime(MASTER_PATH)
print(f"Master file: {MASTER_PATH}")
print(f"Size: {size_bytes:,} bytes ({size_bytes / (1024*1024):.2f} MB)")
print(f"Modification timestamp: {mtime}")

# 2. FFprobe inspection via Docker
probe_cmd = [
    "docker", "run", "--rm", "--user", "0:0",
    "-v", "/home:/home", "-v", "/opt:/opt",
    DOCKER_IMG, "ffprobe",
    "-v", "quiet", "-print_format", "json",
    "-show_streams", "-show_format", MASTER_PATH
]

proc = subprocess.run(probe_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
meta = json.loads(proc.stdout)

v_stream = next((s for s in meta.get("streams", []) if s.get("codec_type") == "video"), None)
a_stream = next((s for s in meta.get("streams", []) if s.get("codec_type") == "audio"), None)

assert v_stream, "Missing video stream"
assert a_stream, "Missing audio stream"

w = int(v_stream.get("width", 0))
h = int(v_stream.get("height", 0))
fps = v_stream.get("avg_frame_rate")
v_codec = v_stream.get("codec_name")

a_rate = int(a_stream.get("sample_rate", 0))
a_channels = int(a_stream.get("channels", 0))
a_codec = a_stream.get("codec_name")
duration = float(meta.get("format", {}).get("duration", 0))

print("\n--- FFprobe Technical Specifications ---")
print(f"  Resolution: {w}x{h} (required: 1920x1080)")
print(f"  FPS: {fps} (required: 30/1)")
print(f"  Video Codec: {v_codec} (required: h264)")
print(f"  Audio Codec: {a_codec} (required: aac)")
print(f"  Sample Rate: {a_rate} Hz (required: 48000)")
print(f"  Channels: {a_channels} (required: 2 stereo)")
print(f"  Total Duration: {duration:.2f}s")

assert w == 1920 and h == 1080, f"Resolution {w}x{h} != 1920x1080"
assert fps in ("30/1", "30"), f"FPS {fps} != 30"
assert v_codec == "h264", f"Video codec {v_codec} != h264"
assert a_codec == "aac", f"Audio codec {a_codec} != aac"
assert a_rate == 48000, f"Audio rate {a_rate} != 48000"
assert a_channels == 2, f"Audio channels {a_channels} != 2"
print("✅ Technical broadcast conformance confirmed!")

# 3. Check old test file status
print("\n--- Checking Old Test File Status ---")
if os.path.exists(OLD_TEST_PATH):
    print(f"Note: Old test file still on disk ({OLD_TEST_PATH}), checking size/mtime...")
    old_size = os.path.getsize(OLD_TEST_PATH)
    print(f"Old test size: {old_size} vs New master size: {size_bytes}")
else:
    print(f"Old test file {OLD_TEST_PATH} does not exist (discarded/cleaned).")

# 4. Generate visual QC sample frames
print(f"\n--- Generating Visual QC Sample Frames into {QC_DIR} ---")
os.makedirs(QC_DIR, exist_ok=True)
sample_times = [1.0, 4.0, 7.0, 10.0, 14.0, 18.0]
valid_times = [t for t in sample_times if t < duration]

for t in valid_times:
    out_img = os.path.join(QC_DIR, f"frame_{t:04.1f}s.jpg")
    cmd = [
        "docker", "run", "--rm", "--user", "0:0",
        "-v", "/home:/home", "-v", "/opt:/opt",
        DOCKER_IMG, "ffmpeg",
        "-y", "-ss", str(t), "-i", MASTER_PATH,
        "-vframes", "1", "-q:v", "2", out_img
    ]
    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    fsize = os.path.getsize(out_img)
    print(f"  Frame at {t:.1f}s -> {out_img} ({fsize} bytes)")

print("\n=================================================================")
print("  GSA AGRO MASTER VERIFICATION: 100% SUCCESS")
print("=================================================================")
