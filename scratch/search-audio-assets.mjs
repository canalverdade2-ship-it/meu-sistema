import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
find /opt/gsa-tv -iname "*.mp3" -o -iname "*.wav" 2>/dev/null | head -n 40
find /opt/gsa-tv -iname "*bumper*" -o -iname "*ident*" -o -iname "*trilha*" 2>/dev/null | head -n 40
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
