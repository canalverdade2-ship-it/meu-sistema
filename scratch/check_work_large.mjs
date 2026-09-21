import { runSshScript } from './ssh2-run.mjs';

const cmd = `
du -sh /home/opc/gsa-ai/work/chamada-grade-v2/* | sort -hr
echo "--- identity-flow-20260907 ---"
du -sh /home/opc/gsa-ai/work/identity-flow-20260907/* | sort -hr | head -n 10
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
