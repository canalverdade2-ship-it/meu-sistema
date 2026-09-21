import { runSshScript } from 'file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs';

async function main() {
  const script = `
echo "=== RCLONE REMOTES ==="
rclone listremotes 2>&1
echo "---"

echo ""
echo "=== RCLONE CONFIG ==="
cat ~/.config/rclone/rclone.conf 2>/dev/null || echo "No config file found"

echo ""
echo "=== PROGRAM MASTERS LIST ==="
find /opt/gsa-tv/cache/media/1/program-masters/ -type f -exec ls -lh {} \\; 2>/dev/null

echo ""
echo "=== IDENTITY MASTERS LIST ==="
find /home/opc/gsa-ai/work/identity-flow-20260907/masters-final/ -type f -exec ls -lh {} \\; 2>/dev/null | head -60

echo ""
echo "=== IDENTITY AUDIO DIRS ==="
find /opt/gsa-tv/cache/media/1/identity/audio/ -type d 2>/dev/null

echo ""
echo "=== IDENTITY AUDIO COUNT ==="
find /opt/gsa-tv/cache/media/1/identity/audio/ -type f 2>/dev/null | wc -l
`;

  const res = await runSshScript(script, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
}

main().catch(console.error);
