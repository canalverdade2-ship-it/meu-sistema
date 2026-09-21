import { runSshScript } from './ssh2-run.mjs';

async function main() {
  try {
    const res = await runSshScript(`
      sudo docker inspect gsa-auth-session
    `, 30000);
    console.log(res.stdout);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
