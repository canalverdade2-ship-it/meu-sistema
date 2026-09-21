import { runSshScript } from './ssh2-run.mjs';

const script = `
curl -s -X POST http://127.0.0.1:8770/validate \\
  -H "Content-Type: application/json" \\
  -d '{"programa":"GSA Tech","slug":"gsa-tech","timeline":[{"tipo":"presenting"}]}'
echo ""
`;

async function main() {
  const r = await runSshScript(script, 30000);
  console.log('STDOUT:\n' + r.stdout);
  console.log('STDERR:\n' + r.stderr);
}

main().catch(console.error);
