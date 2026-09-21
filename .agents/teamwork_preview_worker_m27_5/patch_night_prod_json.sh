#!/usr/bin/env bash
set -e

echo "=== PATCHING night-production.py JSON EXTRACTION ==="
sudo python3 - << 'EOF'
from pathlib import Path

path = Path('/opt/gsa-tv/bin/night-production.py')
content = path.read_text(encoding='utf-8')

old_code = """                    if child.returncode!=0: raise RuntimeError("Erro no pipeline autônomo: " + (stdout_data or '')[-500:])
                    result=json.loads(stdout_data.strip().splitlines()[-1])
                    item.update(state='validated',master=result['output'],duration=result['duration_s'],media_id=result['media_id'])"""

new_code = """                    if child.returncode!=0: raise RuntimeError("Erro no pipeline autônomo: " + (stdout_data or '')[-500:])
                    lines = [l.strip() for l in stdout_data.strip().splitlines() if l.strip()]
                    result = None
                    for l in reversed(lines):
                        try:
                            cand = json.loads(l)
                            if isinstance(cand, dict) and ('media_id' in cand or 'state' in cand):
                                result = cand
                                break
                        except Exception:
                            continue
                    if not result:
                        result = json.loads(lines[-1])
                    item.update(state='validated',master=result['output'],duration=result['duration_s'],media_id=result['media_id'])"""

if old_code in content:
    content = content.replace(old_code, new_code)
    path.write_text(content, encoding='utf-8')
    print("PATCHED_NIGHT_PROD_JSON_SUCCESSFULLY")
else:
    if "cand = json.loads(l)" in content:
        print("ALREADY_PATCHED_NIGHT_PROD_JSON")
    else:
        print("ERROR: OLD_CODE_NOT_FOUND")
EOF
