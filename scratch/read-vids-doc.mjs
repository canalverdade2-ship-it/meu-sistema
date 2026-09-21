import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
cat /home/opc/gsa-ai/START_HERE_GSA_TV.md
echo "--- GSA_TV_MEMORY_MASTER.md ---"
head -n 50 /home/opc/gsa-ai/GSA_TV_MEMORY_MASTER.md
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
