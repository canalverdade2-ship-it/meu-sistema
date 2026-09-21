import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
echo "=== EVENTO 1: g-Kbyx_zG-Y ==="
curl -sL "https://www.youtube.com/watch?v=g-Kbyx_zG-Y" | grep -o '<title>[^<]*</title>'
echo "=== EVENTO 2: RqX4IJXdbGQ ==="
curl -sL "https://www.youtube.com/watch?v=RqX4IJXdbGQ" | grep -o '<title>[^<]*</title>'
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
