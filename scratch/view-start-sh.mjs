import { runSshScript } from './ssh2-run.mjs';

const script = `
echo "=== /home/opc/gsa-ai/start.sh ==="
cat /home/opc/gsa-ai/start.sh
`;

const res = await runSshScript(script);
console.log(res.stdout);
