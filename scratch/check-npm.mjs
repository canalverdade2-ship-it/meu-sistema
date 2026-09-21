import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `which npm || echo "no npm"`;
  const res = await runSshScript(script);
  console.log('NPM:', res.stdout);
}

main().catch(console.error);
