ls -la /home/opc/gsa-ai/work/identity-flow-20260907/masters-final/ | head -n 30
echo "=== TOTAL FILES IN MASTERS-FINAL ==="
ls -1 /home/opc/gsa-ai/work/identity-flow-20260907/masters-final/*.mp4 | wc -l
echo "=== MANIFEST INFO ==="
ls -la /home/opc/gsa-ai/work/identity-flow-20260907/masters-final/manifest.json || ls -la /home/opc/gsa-ai/work/identity-flow-20260907/manifest.json || true
