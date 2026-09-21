import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
echo "=== 1. BYTES ENVIADOS NA CONEXAO RTMP ==="
ss -ti 'dport = :1935'

echo "=== 2. CPU E STATUS DOS DOIS PROCESSOS FFMPEG ==="
ps -p 1480208,1480217 -o pid,ppid,%cpu,%mem,stat,time,wchan:20,args

echo "=== 3. CONFERIR SE O ENCODER ENGINE ESTA COM ERRO ==="
sudo cat /opt/gsa-tv/encoder-engine/src/app.js | grep -n -C 5 "lastError"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
