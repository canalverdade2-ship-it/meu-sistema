import { runSshScript } from './ssh2-run.mjs';

const cmd = `
ffmpeg -y \\
  -ss 1 -i /home/opc/gsa-ai/work/identity-flow-20260907/replacements/business-opening-repl.mp4 \\
  -ss 5 -i /home/opc/gsa-ai/work/identity-flow-20260907/replacements/business-opening-repl.mp4 \\
  -ss 9 -i /home/opc/gsa-ai/work/identity-flow-20260907/replacements/business-opening-repl.mp4 \\
  -filter_complex "[0:v]scale=640:360[v0];[1:v]scale=640:360[v1];[2:v]scale=640:360[v2];[v0][v1][v2]hstack=inputs=3[out]" \\
  -map "[out]" -frames:v 1 /tmp/test-qc.jpg 2>&1
ls -la /tmp/test-qc.jpg
`;

const res = await runSshScript(cmd, 20000);
console.log(res.stdout);
