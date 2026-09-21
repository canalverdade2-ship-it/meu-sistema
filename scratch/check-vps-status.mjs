import { runSshScript } from './ssh2-run.mjs';

async function main() {
  try {
    const res = await runSshScript(`
      echo "=== DOCKER CONTAINERS ==="
      sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
      echo "=== DENO / EDGE SERVICES ==="
      ps aux | grep -i deno | grep -v grep || true
    `, 30000);
    console.log(res.stdout);
    if (res.stderr) console.error('STDERR:', res.stderr);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
