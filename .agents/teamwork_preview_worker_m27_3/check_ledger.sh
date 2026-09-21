#!/usr/bin/env bash
set -e

python3 - <<'EOF'
import json
from pathlib import Path

p = Path('/home/opc/gsa-ai/work/roteiros-2026-09-15/production-sources.json')
if p.exists():
    data = json.loads(p.read_text())
    print("production-sources.json programs:")
    for item in data.get('programs', []):
        print(f"  {item.get('slug')} -> state: {item.get('state')}")
else:
    print("File does not exist:", p)
EOF
