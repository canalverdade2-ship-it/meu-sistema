import { runSshScript } from './ssh2-run.mjs';

const script = `
echo "=== TOOLS AVAILABLE ==="
which pidstat 2>/dev/null || echo "no pidstat"
which top 2>/dev/null || echo "no top"
which ps 2>/dev/null || echo "no ps"
which python3 2>/dev/null || echo "no python3"
which node 2>/dev/null || echo "no node"
which jq 2>/dev/null || echo "no jq"
which bc 2>/dev/null || echo "no bc"
which ffmpeg 2>/dev/null || echo "no host ffmpeg"
which ffprobe 2>/dev/null || echo "no host ffprobe"

echo "=== TEST PS OUTPUT ==="
ps -eo pid,psr,pcpu,comm,args --sort=-pcpu | head -n 15

echo "=== TEST TOP BATCH OUTPUT ==="
top -b -n 1 | head -n 20
`;

const res = await runSshScript(script);
console.log(res.stdout);
