import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
echo "=== CHECANDO PACOTES NA PORTA UDP 12345 ==="
sudo timeout 3 tcpdump -i lo -nn "port 12345" -c 10 2>&1 || echo "tcpdump concluido ou nao disponivel"

echo "=== VERIFICANDO STDERR DO PROCESSO OUTER ==="
sudo ls -l /proc/1480208/fd/
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
