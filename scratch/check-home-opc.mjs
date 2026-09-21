import { runSshScript } from './ssh2-run.mjs';

async function main() {
  try {
    const res = await runSshScript(`
      ls -la /home/opc/*.ts
      echo "=== DOCKER COMPOSE OR RUN SCRIPTS ==="
      find /home/opc -name "*docker*" -o -name "*compose*" -o -name "*auth*" | head -30
    `, 30000);
    console.log(res.stdout);
    if (res.stderr) console.error('STDERR:', res.stderr);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
