import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
sudo docker run --rm --entrypoint sh gsa-tv/control-plane:1.6.39 -c '
  f=/app/src/app.js
  awk '\''/async function sendGraphicsCommands/{show=1; count=0} show{print; count++} count>210{exit}'\'' "$f"
  echo PACKAGE
  cat /app/package.json
'
`;

const result = await runSshScript(script, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
