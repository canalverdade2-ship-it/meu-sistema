import { runSshScript } from './ssh2-run.mjs';

async function main() {
  try {
    const res = await runSshScript(`
      sed -n '930,967p' /home/opc/gsa-auth-session.ts
    `, 10000);
    console.log(res.stdout);
    if (res.stderr) console.error('STDERR:', res.stderr);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
