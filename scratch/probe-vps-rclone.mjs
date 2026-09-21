import { runSshScript } from 'file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs';

async function main() {
  const script = `
echo "=== RCLONE REMOTES ==="
rclone listremotes 2>/dev/null || echo "No remotes configured"

echo ""
echo "=== RCLONE CONFIG FILE ==="
cat ~/.config/rclone/rclone.conf 2>/dev/null || echo "No rclone config found"

echo ""
echo "=== PROGRAM MASTERS - DETAILED ==="
find /opt/gsa-tv/cache/media/1/program-masters/ -type f -exec ls -lh {} \\; 2>/dev/null | head -40
echo "---DIR TREE---"
find /opt/gsa-tv/cache/media/1/program-masters/ -type d 2>/dev/null | head -20

echo ""
echo "=== IDENTITY MASTERS - DETAILED ==="
find /home/opc/gsa-ai/work/identity-flow-20260907/masters-final/ -type f -exec ls -lh {} \\; 2>/dev/null | head -40
echo "---DIR TREE---"
find /home/opc/gsa-ai/work/identity-flow-20260907/masters-final/ -type d 2>/dev/null | head -20

echo ""
echo "=== IDENTITY AUDIO - DETAILED ==="
find /opt/gsa-tv/cache/media/1/identity/audio/ -type f -exec ls -lh {} \\; 2>/dev/null | head -40

echo ""
echo "=== EDITORIAL TREE ==="
find /opt/gsa-tv/cache/media/1/production/editorial/ -type d 2>/dev/null | head -30

echo ""
echo "=== TOTAL SIZES ==="
du -sh /opt/gsa-tv/cache/media/1/program-masters/ 2>/dev/null
du -sh /home/opc/gsa-ai/work/identity-flow-20260907/masters-final/ 2>/dev/null
du -sh /opt/gsa-tv/cache/media/1/identity/audio/ 2>/dev/null
du -sh /opt/gsa-tv/cache/media/1/production/editorial/ 2>/dev/null
`;

  const res = await runSshScript(script, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
}

main().catch(console.error);
