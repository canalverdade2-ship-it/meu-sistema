import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
lscpu | grep "Model name\\|CPU(s):"
free -h
nvidia-smi 2>&1 || echo "Sem GPU Nvidia"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
