import { runSshScript } from './ssh2-run.mjs';

async function investigate() {
  const script = `
echo "=== 1. DOCKER CONTAINERS ==="
sudo docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

echo -e "\n=== 2. DIRETÓRIOS EM /opt e /home/opc ==="
ls -la /opt/
ls -la /home/opc/

echo -e "\n=== 3. BUSCA POR 'vids' OU 'flow' ==="
find /home/opc /opt -maxdepth 3 -iname "*flow*" -o -iname "*vids*" 2>/dev/null || true

echo -e "\n=== 4. SYSTEMD SERVICES ==="
systemctl list-unit-files | grep -iE 'gsa|flow|vids|ai|video|n8n' || true

echo -e "\n=== 5. PROCESSOS RODANDO ==="
ps aux | grep -iE 'flow|vids|python|node' | grep -v grep | head -n 30 || true
`;

  const res = await runSshScript(script);
  console.log(res.stdout);
}

investigate().catch(console.error);
