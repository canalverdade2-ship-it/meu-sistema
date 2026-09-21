#!/usr/bin/env bash
set -e

sudo python3 - <<'EOF'
with open('/opt/gsa-tv/bin/night-production.py', 'r') as f:
    code = f.read()

target = "target_words=max(500,int(budget*2.5))"
replacement = "target_words=min(1200,max(500,int(budget*0.6)))"

if target not in code:
    print("Target string not found!")
    exit(1)

code = code.replace(target, replacement)
with open('/opt/gsa-tv/bin/night-production.py', 'w') as f:
    f.write(code)

print("Successfully updated target_words in night-production.py!")
EOF

python3 -m py_compile /opt/gsa-tv/bin/night-production.py && echo "PY_COMPILE_OK"
