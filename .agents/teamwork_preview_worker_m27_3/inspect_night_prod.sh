#!/usr/bin/env bash
set -e

echo "=== NIGHT-PRODUCTION.PY MAIN LOGIC ==="
python3 - <<'EOF'
with open('/opt/gsa-tv/bin/night-production.py', 'r') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")
# Print arguments parsing and main entry
for i, line in enumerate(lines):
    if 'def main(' in line or 'if __name__' in line or 'argparse' in line or 'def produce(' in line or 'def reconcile(' in line:
        print(f"Line {i+1}: {line.strip()}")
EOF
