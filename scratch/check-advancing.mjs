import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
echo "=== CHECANDO AVANÇO DE CPU E TEMPO DOS DOIS FFMPEGS ==="
ps -p 1480208,1480217 -o pid,stat,time,%cpu,wchan:20
sleep 2
ps -p 1480208,1480217 -o pid,stat,time,%cpu,wchan:20
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
