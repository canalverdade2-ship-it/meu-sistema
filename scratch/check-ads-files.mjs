import { runSshScript } from './ssh2-run.mjs';

async function main() {
  try {
    const res = await runSshScript(`
      head -n 40 /home/opc/gsa-ads-public.ts
      echo "=== /home/opc/gsa-ads-admin.ts ==="
      head -n 40 /home/opc/gsa-ads-admin.ts
    `, 30000);
    console.log(res.stdout);
    if (res.stderr) console.error('STDERR:', res.stderr);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
