import { runSshScript } from 'file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs';

async function main() {
  const script = `
echo "=== DISK SPACE ==="
df -h /opt/gsa-tv /home/opc 2>/dev/null || df -h /

echo ""
echo "=== PROGRAM MASTERS ==="
find /opt/gsa-tv/cache/media/1/program-masters/ -type f 2>/dev/null | head -60
echo "---SIZE---"
du -sh /opt/gsa-tv/cache/media/1/program-masters/ 2>/dev/null

echo ""
echo "=== IDENTITY MASTERS ==="
find /home/opc/gsa-ai/work/identity-flow-20260907/masters-final/ -type f 2>/dev/null | head -60
echo "---SIZE---"
du -sh /home/opc/gsa-ai/work/identity-flow-20260907/masters-final/ 2>/dev/null

echo ""
echo "=== IDENTITY AUDIO ==="
find /opt/gsa-tv/cache/media/1/identity/audio/ -type f 2>/dev/null | head -60
echo "---SIZE---"
du -sh /opt/gsa-tv/cache/media/1/identity/audio/ 2>/dev/null

echo ""
echo "=== EDITORIAL PRODUCTION ==="
find /opt/gsa-tv/cache/media/1/production/editorial/ -type f 2>/dev/null | head -60
echo "---SIZE---"
du -sh /opt/gsa-tv/cache/media/1/production/editorial/ 2>/dev/null

echo ""
echo "=== AVAILABLE TOOLS ==="
which rclone 2>/dev/null && echo "rclone: YES" || echo "rclone: NO"
which gdrive 2>/dev/null && echo "gdrive: YES" || echo "gdrive: NO"
which python3 2>/dev/null && echo "python3: YES" || echo "python3: NO"
which pip3 2>/dev/null && echo "pip3: YES" || echo "pip3: NO"
which curl 2>/dev/null && echo "curl: YES" || echo "curl: NO"
which node 2>/dev/null && echo "node: YES" || echo "node: NO"

echo ""
echo "=== RCLONE VERSION ==="
rclone version 2>/dev/null || echo "rclone not installed"

echo ""
echo "=== CRON JOBS ==="
crontab -l 2>/dev/null || echo "No crontab"

echo ""
echo "=== OS INFO ==="
cat /etc/os-release | head -5
uname -a
`;

  const res = await runSshScript(script, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
}

main().catch(console.error);
