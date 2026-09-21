import { runSshScript } from './ssh2-run.mjs';

async function main() {
  try {
    const res = await runSshScript(`
      echo "=== DOCKER INSPECT gsa-auth-session ==="
      sudo docker inspect gsa-auth-session --format 'Image: {{.Config.Image}}, WorkingDir: {{.Config.WorkingDir}}, Mounts: {{json .Mounts}}'
      echo "=== NGINX CONFIG FOR /functions/v1/ ==="
      sudo grep -rn "functions" /etc/nginx/ || true
    `, 30000);
    console.log(res.stdout);
    if (res.stderr) console.error('STDERR:', res.stderr);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
