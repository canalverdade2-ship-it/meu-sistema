#!/usr/bin/env bash
python3 - <<'EOF'
import json, glob
files = sorted(glob.glob('/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/gsa-tech*.json'))
for f in files:
    d = json.load(open(f))
    words = len(d.get('text', '').split())
    print(f"{f.split('/')[-1]}: {words} words, title: {d.get('title')}")
EOF
