#!/usr/bin/env bash
python3 - <<'EOF'
with open('/opt/gsa-tv/bin/night-production.py', 'r') as f:
    lines = f.readlines()

for i in range(0, 50):
    print(f"{i+1:3d}: {lines[i]}", end='')
EOF
