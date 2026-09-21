import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `node -e 'try { require("pg"); console.log("pg found"); } catch { console.log("pg not found"); }'`;
  const res = await runSshScript(script);
  console.log('PG ON HOST:\n', res.stdout);
}

main().catch(console.error);
