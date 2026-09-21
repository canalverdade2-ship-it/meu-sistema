import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-control-plane grep -n "Tipo de tarefa não suportado" /app/src/app.js || echo "not at /app/src/app.js"
`;
  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout, res.stderr);
}

main().catch(console.error);
