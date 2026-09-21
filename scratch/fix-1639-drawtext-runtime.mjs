import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
src=/opt/gsa-tv/control-plane/src/app.js
stamp=$(date +%Y%m%d-%H%M%S)
sudo cp "$src" "$src.before-drawtext-runtime-fix-$stamp"
sudo python3 - <<'PY'
from pathlib import Path
p=Path('/opt/gsa-tv/control-plane/src/app.js')
s=p.read_text()
lines=s.splitlines()
matches=[i for i,line in enumerate(lines) if 'commands.push(' in line and '_body reinit fontfile=' in line]
if len(matches) != 1:
    raise SystemExit(f'expected one body reinit source, found {len(matches)}')
i=matches[0]
lines[i:i+1]=[
    '    // Body content is already refreshed by textfile reload=1. FFmpeg rejects',
    '    // drawtext reinit when the filter was initialized with textfile.',
    '    // Keep the encoder and RTMP session alive instead of issuing that invalid command.',
]
s='\n'.join(lines)+'\n'
lines=s.splitlines()
matches=[i for i,line in enumerate(lines) if 'const failed = replies.find' in line]
if len(matches) != 1 or matches[0] + 1 >= len(lines) or 'Comando gráfico recusado' not in lines[matches[0] + 1]:
    raise SystemExit('reply diagnostics source not found')
i=matches[0]
lines[i:i+2]=[
    '  const failedIndex = replies.findIndex((reply) => !String(reply).startsWith("0 "));',
    '  if (failedIndex >= 0) throw new Error("Comando gráfico recusado [" + commands[failedIndex] + "]: " + replies[failedIndex]);',
]
s='\n'.join(lines)+'\n'
p.write_text(s)
PY
sudo docker build -t gsa-tv/control-plane:1.6.39 /opt/gsa-tv/control-plane
sudo docker run --rm --entrypoint node gsa-tv/control-plane:1.6.39 --check /app/src/app.js
sudo docker image inspect gsa-tv/control-plane:1.6.39 --format 'image|{{.Id}}'
`;

const result = await runSshScript(script, 180000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
