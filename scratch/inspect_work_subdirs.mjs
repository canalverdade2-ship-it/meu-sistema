import { runSshScript } from './ssh2-run.mjs';

const cmd = `
for dir in chamada-grade-v2 identity-flow-20260907 chamada-grade-20260906 vinheta-flow-40s encoder-outer-audio-fix-20260907T051649Z bible-rebuild-20260909; do
  echo "=== WORK DIR: $dir ==="
  ls -lh "/home/opc/gsa-ai/work/$dir" | head -n 15
done
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
