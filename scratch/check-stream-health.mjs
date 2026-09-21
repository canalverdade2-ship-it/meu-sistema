import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const cmd = `
    echo "=== DOCKER CONTAINERS ==="
    sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "=== FFMPEG / RELAY PROCESSES ==="
    ps aux | grep -E "ffmpeg|relay" | grep -v grep
    echo ""
    echo "=== RTMP CONNECTION TO YOUTUBE ==="
    sudo netstat -natp 2>/dev/null | grep -E ":1935|:443" | grep ESTABLISHED | grep -i ffmpeg || ss -tnp | grep -E ":1935|:443" | grep -i ffmpeg
  `;
  const res = await runSshScript(cmd);
  console.log('STDOUT:', res.stdout);
  console.log('STDERR:', res.stderr);
}

main().catch(console.error);
