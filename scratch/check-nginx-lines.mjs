import { runSshScript } from './ssh2-run.mjs';

async function main() {
  try {
    const res = await runSshScript(`
      sed -n '180,195p' /etc/nginx/nginx.conf
    `, 30000);
    console.log(res.stdout);
    if (res.stderr) console.error('STDERR:', res.stderr);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
