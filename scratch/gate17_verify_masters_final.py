import json
import subprocess
import glob
import os
import hashlib

MANIFEST_PATH = '/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/manifest.json'
MASTERS_DIR = '/home/opc/gsa-ai/work/identity-flow-20260907/masters-final'

with open(MANIFEST_PATH, 'r') as f:
    manifest = json.load(f)

print(f"Total manifest entries: {len(manifest)}")

mp4_files = sorted(glob.glob(f"{MASTERS_DIR}/*.mp4"))
print(f"Total MP4 files on disk: {len(mp4_files)}")

# Check for entrevista
entrevista_files = [f for f in mp4_files if 'entrevista' in f.lower()]
print(f"Entrevista files: {entrevista_files}")

# Verify sha256 and ffprobe for each file
sha_mismatches = []
probe_failures = []
manifest_lookup = {}

# Build expected lookup from manifest
# Let's see how filenames correspond to manifest entries
for entry in manifest:
    slug = entry['program'].lower().replace(' ', '-')
    pt = entry['piece_type']
    manifest_lookup[(entry['program'], pt)] = entry

# Let's inspect manifest keys
print(f"Sample manifest item: {json.dumps(manifest[0], indent=2)}")

# Check real files
file_details = []
for f in mp4_files:
    filename = os.path.basename(f)
    with open(f, 'rb') as fp:
        actual_sha = hashlib.sha256(fp.read()).hexdigest()
    
    # Run ffprobe using docker
    cmd = [
        'sudo', 'docker', 'run', '--rm', '--user', '0:0', '-v', '/home:/home',
        'gsa-tv/control-plane:1.8.7', 'ffprobe', '-v', 'quiet',
        '-print_format', 'json', '-show_streams', '-show_format', f
    ]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        probe_failures.append((filename, p.stderr))
        continue
    data = json.loads(p.stdout)
    v_streams = [s for s in data.get('streams', []) if s['codec_type'] == 'video']
    a_streams = [s for s in data.get('streams', []) if s['codec_type'] == 'audio']
    v = v_streams[0] if v_streams else {}
    a = a_streams[0] if a_streams else {}
    dur = float(data.get('format', {}).get('duration', 0))
    
    w = v.get('width')
    h = v.get('height')
    r_fps = v.get('r_frame_rate')
    avg_fps = v.get('avg_frame_rate')
    v_codec = v.get('codec_name')
    a_codec = a.get('codec_name')
    a_rate = a.get('sample_rate')
    a_chan = a.get('channels')
    
    # Validation criteria:
    # 1080p (1920x1080), 30fps (or 30000/1001 or 30/1), H.264, AAC, 48kHz, stereo (2 channels)
    # duration between 8s and 12s
    is_valid = (
        w == 1920 and h == 1080 and
        v_codec == 'h264' and
        a_codec == 'aac' and
        a_rate == '48000' and
        a_chan == 2 and
        8.0 <= dur <= 12.5
    )
    
    file_details.append({
        'filename': filename,
        'sha256': actual_sha,
        'w': w, 'h': h,
        'v_codec': v_codec,
        'r_fps': r_fps,
        'avg_fps': avg_fps,
        'a_codec': a_codec,
        'a_rate': a_rate,
        'a_chan': a_chan,
        'duration': dur,
        'valid': is_valid
    })

# Check SHA matches with manifest
matched_manifest = 0
for d in file_details:
    found_in_manifest = any(entry.get('sha256') == d['sha256'] for entry in manifest)
    if not found_in_manifest:
        sha_mismatches.append(d['filename'])
    else:
        matched_manifest += 1

print(f"Files probed: {len(file_details)}")
print(f"Valid spec files (1080p, 30fps, h264, aac 48k stereo, 8-12s): {sum(1 for d in file_details if d['valid'])}")
print(f"Files matching manifest SHA-256: {matched_manifest} / {len(file_details)}")
if sha_mismatches:
    print(f"SHA mismatches: {sha_mismatches}")
if probe_failures:
    print(f"Probe failures: {probe_failures}")

invalid_files = [d for d in file_details if not d['valid']]
if invalid_files:
    print(f"Invalid files details: {json.dumps(invalid_files[:5], indent=2)}")
