echo "=== CHECKING FOR GSA ENTREVISTA IN MASTERS-FINAL ==="
ls /home/opc/gsa-ai/work/identity-flow-20260907/masters-final/*entrevista* 2>&1 || echo "ZERO entrevista files in masters-final."

echo "=== CHECKING IN MANIFEST.JSON ==="
grep -i "entrevista" /home/opc/gsa-ai/work/identity-flow-20260907/masters-final/manifest.json || echo "ZERO entrevista in manifest.json."

echo "=== CHECKING IN BUILD-MASTERS-FINAL.PY ==="
grep -i "entrevista" /scratch/build-masters-final.py || echo "ZERO entrevista in build-masters-final.py."

echo "=== CHECKING IN REGEN-DEFECTIVE-STATE.JSON ==="
grep -i "entrevista" /home/opc/gsa-ai/work/identity-flow-20260907/regen-defective-state.json || echo "ZERO entrevista in regen-defective-state.json."

echo "=== CHECKING PROGRAM COUNT ==="
python3 -c '
import json
m = json.load(open("/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/manifest.json"))
progs = sorted(list(set(x["program"] for x in m)))
print(f"Total distinct programs in manifest: {len(progs)}")
for p in progs:
    print(" -", p)
assert "GSA Entrevista" not in progs
'
