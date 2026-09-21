python3 - << 'EOF'
import json
import hashlib
import subprocess
from pathlib import Path

DIR_FINAL = Path('/home/opc/gsa-ai/work/identity-flow-20260907/masters-final')
MANIFEST_PATH = DIR_FINAL / 'manifest.json'

manifest = json.loads(MANIFEST_PATH.read_text())
manifest_map = {}
for item in manifest:
    key = (item['program'], item['piece_type'])
    manifest_map[key] = item

files = sorted(list(DIR_FINAL.glob('*.mp4')))
print(f"Auditing {len(files)} files in {DIR_FINAL}...")

failures = []
passed = 0

for f in files:
    # Compute sha256
    file_bytes = f.read_bytes()
    file_sha = hashlib.sha256(file_bytes).hexdigest()
    file_size = len(file_bytes)
    
    # Run ffprobe
    cmd = [
        "docker", "run", "--rm", "--user", "1000:1000",
        "-v", "/home:/home", "-v", "/opt:/opt",
        "gsa-tv/control-plane:1.8.7",
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration,size,bit_rate:stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels",
        "-of", "json", str(f)
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        failures.append((f.name, f"ffprobe error: {res.stderr[:200]}"))
        continue
        
    data = json.loads(res.stdout)
    streams = data.get('streams', [])
    v_streams = [s for s in streams if s.get('codec_type') == 'video']
    a_streams = [s for s in streams if s.get('codec_type') == 'audio']
    
    if not v_streams or not a_streams:
        failures.append((f.name, "Missing video or audio stream"))
        continue
        
    v = v_streams[0]
    a = a_streams[0]
    dur = float(data.get('format', {}).get('duration') or 0)
    
    # Validation checks
    checks = {
        'v_codec': v.get('codec_name') == 'h264',
        'width': v.get('width') == 1920,
        'height': v.get('height') == 1080,
        'fps': v.get('r_frame_rate') in ('30/1', '30'),
        'a_codec': a.get('codec_name') == 'aac',
        'sample_rate': int(a.get('sample_rate') or 0) == 48000,
        'channels': int(a.get('channels') or 0) == 2,
        'duration': 7.9 <= dur <= 12.1,
        'size': file_size > 1000000,
    }
    
    # Verify hash against manifest
    matching_manifest = [m for m in manifest if m['sha256'] == file_sha]
    if not matching_manifest:
        checks['manifest_hash_match'] = False
    else:
        checks['manifest_hash_match'] = True
        
    if all(checks.values()):
        passed += 1
    else:
        failed_reasons = [k for k, val in checks.items() if not val]
        failures.append((f.name, f"Failed checks: {failed_reasons}, dur={dur}, w={v.get('width')}, h={v.get('height')}, sha={file_sha[:10]}"))

print("=" * 60)
print(f"AUDIT SUMMARY: {passed}/50 PASSED ALL TECHNICAL & CRYPTOGRAPHIC CHECKS")
print(f"FAILURES: {len(failures)}")
if failures:
    for fn, reason in failures:
        print(f"  FAIL: {fn} -> {reason}")
else:
    print("ALL 50 MASTERS CONFORM 100% TO SPECIFICATIONS AND CRYPTOGRAPHIC HASHES!")
EOF
