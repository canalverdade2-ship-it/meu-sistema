import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
sudo docker exec gsa-ai-browser sh -lc 'kill $(pidof x11vnc) 2>/dev/null || true'
sudo docker exec gsa-ai-browser sh -lc 'kill 16 2>/dev/null || true'
sudo docker exec -d gsa-ai-browser sh -lc 'exec x11vnc -display :99 -forever -shared -nopw -localhost -rfbport 5900'
sudo docker exec -d gsa-ai-browser sh -lc 'exec websockify --web=/usr/share/novnc 6080 localhost:5900'
sleep 2
sudo docker exec gsa-ai-browser sh -lc 'ps aux | grep -E "x11vnc|websockify" | grep -v grep'
`,120000);
process.stdout.write(r.stdout);
