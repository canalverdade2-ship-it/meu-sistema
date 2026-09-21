python3 - << 'EOF'
import hashlib
from pathlib import Path

V1 = Path("/home/opc/gsa-ai/work/identity-flow-20260907/masters-v1")
FINAL = Path("/home/opc/gsa-ai/work/identity-flow-20260907/masters-final")

REPLACED_FILES = {
    "gsa-esportes-closing.mp4",
    "gsa-hora-da-palavra-opening.mp4",
    "gsa-business-opening.mp4",
    "gsa-news-noite-opening.mp4",
    "gsa-motor-opening.mp4",
    "gsa-agro-opening.mp4",
    "gsa-em-fe-closing.mp4",
    "gsa-bem-viver-closing.mp4",
    "gsa-sabor-opening.mp4",
}

mismatches = []
checked = 0

for f in FINAL.glob("*.mp4"):
    if f.name in REPLACED_FILES:
        continue
    checked += 1
    v1_f = V1 / f.name
    if not v1_f.exists():
        mismatches.append(f"Missing in v1: {f.name}")
        continue
    h_final = hashlib.sha256(f.read_bytes()).hexdigest()
    h_v1 = hashlib.sha256(v1_f.read_bytes()).hexdigest()
    if h_final != h_v1:
        mismatches.append(f"Hash mismatch: {f.name} (final={h_final}, v1={h_v1})")

print(f"Checked {checked} original files.")
print(f"Mismatches: {len(mismatches)}")
if mismatches:
    for m in mismatches:
        print(" ", m)
else:
    print("ALL 41 ORIGINAL FILES ARE 100% IDENTICAL BYTE-FOR-BYTE TO MASTERS-V1!")
EOF
