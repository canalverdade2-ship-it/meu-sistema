import { runSshScript } from './ssh2-run.mjs';

async function main() {
  try {
    const res = await runSshScript(`
      sudo docker inspect realtime --format 'Image: {{.Config.Image}}, Ports: {{json .NetworkSettings.Ports}}, Env: {{json .Config.Env}}'
      echo "=== NGINX REALTIME PROXY ==="
      sudo grep -rn "realtime" /etc/nginx/ || true
    `, 20000);
    console.log(res.stdout);
    if (res.stderr) console.error('STDERR:', res.stderr);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
