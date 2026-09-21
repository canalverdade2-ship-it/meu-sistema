import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
mkdir -p /home/opc/gsa-ai/work/chamada-grade-v2/raw
docker exec gsa-ai-browser sh -lc "mkdir -p /data/downloads/vids-v2 && cp '/home/browser/Downloads/download (1)' /data/downloads/vids-v2/vids-master-bruto.mp4"
cp /home/opc/gsa-ai/data/downloads/vids-v2/vids-master-bruto.mp4 /home/opc/gsa-ai/work/chamada-grade-v2/raw/vids-master-bruto.mp4
file /home/opc/gsa-ai/work/chamada-grade-v2/raw/vids-master-bruto.mp4
stat -c 'size=%s' /home/opc/gsa-ai/work/chamada-grade-v2/raw/vids-master-bruto.mp4
sha256sum /home/opc/gsa-ai/work/chamada-grade-v2/raw/vids-master-bruto.mp4
`,60000);process.stdout.write(r.stdout);
