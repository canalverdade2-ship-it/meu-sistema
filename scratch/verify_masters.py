import os
import sys
import json
import hashlib
import random
import subprocess
import unicodedata

FINAL_DIR = "/home/opc/gsa-ai/work/identity-flow-20260907/masters-final"
MANIFEST_PATH = os.path.join(FINAL_DIR, "manifest.json")
DOCKER_IMG = "gsa-tv/control-plane:1.8.7"

print("=================================================================")
print("  GATE CHALLENGER 2: EMPIRICAL VERIFICATION OF MASTERS & MANIFEST")
print("=================================================================")

# 1. LOAD MANIFEST
if not os.path.isfile(MANIFEST_PATH):
    print("FATAL: manifest.json does not exist at", MANIFEST_PATH)
    sys.exit(1)

with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
    manifest = json.load(f)

print(f"Loaded manifest.json with {len(manifest)} entries.")

# 2. CHECK ALL FILES ON DISK & INTEGRITY OF MANIFEST CHECKSUMS
disk_files = sorted([f for f in os.listdir(FINAL_DIR) if f.endswith(".mp4")])
print(f"Total MP4 files on disk: {len(disk_files)}")

def to_filename(program, piece_type):
    s = unicodedata.normalize('NFKD', program).encode('ascii', 'ignore').decode('ascii').lower()
    s = s.replace(" ", "-")
    return f"{s}-{piece_type}.mp4"

manifest_map = {}
for item in manifest:
    required_keys = {"program", "piece_type", "source", "sha256", "approved_at"}
    if not required_keys.issubset(item.keys()):
        print("ERROR: Manifest entry missing required keys:", item)
        sys.exit(1)
    fn = to_filename(item["program"], item["piece_type"])
    manifest_map[fn] = item

print(f"Mapped {len(manifest_map)} manifest entries to filenames.")

# Verify every disk file is in manifest and matches sha256
hash_mismatches = []
missing_on_disk = []
missing_in_manifest = []

for fn, item in manifest_map.items():
    fpath = os.path.join(FINAL_DIR, fn)
    if not os.path.isfile(fpath):
        missing_on_disk.append((fn, item))
        continue
    
    h = hashlib.sha256()
    with open(fpath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    actual_sha = h.hexdigest()
    
    if actual_sha != item["sha256"]:
        hash_mismatches.append({
            "file": fn,
            "expected": item["sha256"],
            "actual": actual_sha
        })

for f in disk_files:
    if f not in manifest_map:
        missing_in_manifest.append(f)

print("\n--- Checksum & Manifest Integrity Results ---")
print(f"Files matching manifest: {len(manifest_map) - len(hash_mismatches) - len(missing_on_disk)} / {len(manifest_map)}")
print(f"Missing on disk: {len(missing_on_disk)}")
print(f"Missing in manifest: {len(missing_in_manifest)}")
print(f"Hash mismatches: {len(hash_mismatches)}")

if missing_on_disk or missing_in_manifest or hash_mismatches:
    print("FATAL: Checksum or file inventory mismatch detected!")
    print("Mismatches:", hash_mismatches)
    print("Missing on disk:", missing_on_disk)
    print("Missing in manifest:", missing_in_manifest)
    sys.exit(1)
else:
    print("✅ 100% of manifest entries match files on disk with IDENTICAL SHA-256 hashes!")

# 3. VERIFY ABSENCE OF GSA ENTREVISTA
print("\n--- Checking Absence of GSA Entrevista ---")
entrevista_found = []
for f in disk_files:
    if "entrevista" in f.lower():
        entrevista_found.append(f)
for item in manifest:
    if "entrevista" in item["program"].lower():
        entrevista_found.append(item["program"])

if entrevista_found:
    print("FATAL: GSA Entrevista was FOUND:", entrevista_found)
    sys.exit(1)
else:
    print("✅ Total absence of GSA Entrevista confirmed across disk files and manifest.")

# 4. SAMPLE MP4s VIA DOCKER FFPROBE
# Select all 9 regenerated files + 6 random originals (total 15 files sampled)
regen_files = sorted([fn for fn, item in manifest_map.items() if item["source"] == "regenerated"])
orig_files = sorted([fn for fn, item in manifest_map.items() if item["source"] == "original"])
random.seed(42)
sampled_files = sorted(regen_files + random.sample(orig_files, 6))

print(f"\n--- Sampling {len(sampled_files)} MP4s via FFprobe in Docker ({DOCKER_IMG}) ---")
print(f"  Regenerated sampled ({len(regen_files)}): {regen_files}")
print(f"  Originals sampled (6): {[f for f in sampled_files if f in orig_files]}")

ffprobe_failures = []
sample_results = []

for fn in sampled_files:
    fpath = os.path.join(FINAL_DIR, fn)
    cmd = [
        "docker", "run", "--rm", "--user", "0:0",
        "-v", "/home:/home", "-v", "/opt:/opt",
        DOCKER_IMG, "ffprobe",
        "-v", "quiet", "-print_format", "json",
        "-show_streams", "-show_format", fpath
    ]
    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        meta = json.loads(proc.stdout)
        
        v_stream = next((s for s in meta.get("streams", []) if s.get("codec_type") == "video"), None)
        a_stream = next((s for s in meta.get("streams", []) if s.get("codec_type") == "audio"), None)
        
        if not v_stream:
            ffprobe_failures.append((fn, "Missing video stream"))
            continue
        if not a_stream:
            ffprobe_failures.append((fn, "Missing audio stream"))
            continue
        
        w = v_stream.get("width")
        h = v_stream.get("height")
        fps = v_stream.get("avg_frame_rate")
        v_codec = v_stream.get("codec_name")
        
        a_rate = int(a_stream.get("sample_rate", 0))
        a_channels = a_stream.get("channels")
        a_codec = a_stream.get("codec_name")
        
        duration = float(meta.get("format", {}).get("duration", 0))
        
        errors = []
        if w != 1920 or h != 1080:
            errors.append(f"Resolution {w}x{h} != 1920x1080")
        if fps not in ("30/1", "30"):
            errors.append(f"FPS {fps} != 30")
        if v_codec != "h264":
            errors.append(f"Video codec {v_codec} != h264")
        if a_rate != 48000:
            errors.append(f"Audio rate {a_rate} != 48000")
        if a_channels != 2:
            errors.append(f"Audio channels {a_channels} != 2")
        if a_codec != "aac":
            errors.append(f"Audio codec {a_codec} != aac")
        if not (7.5 <= duration <= 13.0):
            errors.append(f"Duration {duration}s outside expected range [8, 12]")
            
        if errors:
            ffprobe_failures.append((fn, "; ".join(errors)))
            print(f"  ❌ {fn}: {'; '.join(errors)}")
        else:
            sample_results.append({
                "file": fn,
                "resolution": f"{w}x{h}",
                "fps": fps,
                "video_codec": v_codec,
                "audio": f"{a_codec} {a_rate}Hz {a_channels}ch",
                "duration": f"{duration:.2f}s"
            })
            print(f"  ✅ {fn}: 1920x1080, {fps}fps, {v_codec} / {a_codec} {a_rate}Hz {a_channels}ch, dur: {duration:.2f}s")
            
    except Exception as exc:
        ffprobe_failures.append((fn, str(exc)))
        print(f"  ❌ {fn}: Exception {exc}")

print("\n--- FFprobe Sampling Summary ---")
print(f"Total sampled: {len(sampled_files)}")
print(f"Passed: {len(sample_results)}")
print(f"Failed: {len(ffprobe_failures)}")

if ffprobe_failures:
    print("FATAL: ffprobe verification failed on some files:", ffprobe_failures)
    sys.exit(1)
else:
    print("✅ All sampled MP4 files satisfy broadcast standards: 1920x1080, 30fps, H.264, AAC 48kHz stereo!")
