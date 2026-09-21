#!/usr/bin/env bash
python3 - <<'EOF'
import json, glob
files = sorted(glob.glob('/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/gsa-tech*.json'))
for f in files:
    d = json.load(open(f))
    t = d.get('text', '')
    if isinstance(t, str):
        print(f"{f.split('/')[-1]}: {len(t.split())} words, title: {d.get('title')}")
    else:
        print(f"{f.split('/')[-1]}: text is not str ({type(t)})")
EOF
