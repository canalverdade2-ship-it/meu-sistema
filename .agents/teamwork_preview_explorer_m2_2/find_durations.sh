#!/bin/bash
python3 << 'EOF'
import os
import subprocess
import json
from pathlib import Path

def probe(p):
    try:
        r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(p)], capture_output=True, text=True, timeout=10)
        data = json.loads(r.stdout)
        dur = float(data.get('format', {}).get('duration', 0))
        return dur
    except Exception:
        return 0

# Check all mp4, mov, mkv under /opt/gsa-tv
for p in Path('/opt/gsa-tv').rglob('*'):
    if p.is_file() and p.suffix.lower() in ['.mp4', '.mov', '.mkv']:
        dur = probe(p)
        if 500 <= dur <= 1300 or 1750 <= dur <= 1850 or 7150 <= dur <= 7250:
            print(f"{dur:8.2f}s ({dur/60:5.2f}m) | {p}")
EOF
