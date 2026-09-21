import { runSshScript } from './ssh2-run.mjs';

const script = `
echo "=== LS /home/opc/gsa-ai/ ==="
ls -la /home/opc/gsa-ai/

echo "=== GSA_TV_MEMORY_CHANGELOG.md (tail 30) ==="
tail -n 30 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md 2>/dev/null || echo "No changelog in gsa-ai"

echo "=== CHECK OTHER GSA_TV_MEMORY_CHANGELOG.md ==="
find /opt/gsa-tv -name "GSA_TV_MEMORY_CHANGELOG.md" 2>/dev/null || true
find /home/opc -name "GSA_TV_MEMORY_CHANGELOG.md" 2>/dev/null || true

echo "=== CHECK /home/opc/gsa-ai/ start or Dockerfile ==="
for f in /home/opc/gsa-ai/*; do
  if [ -f "$f" ]; then
    echo "--- file: $f ---"
    head -n 20 "$f"
  fi
done
`;

const res = await runSshScript(script);
console.log(res.stdout);
