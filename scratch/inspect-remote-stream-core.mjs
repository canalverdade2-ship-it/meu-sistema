import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
sudo docker run --rm --entrypoint sh gsa-tv/control-plane:1.6.39 -c '
  f=/app/src/app.js
  sed -n "360,1020p" "$f"
'
echo COMPOSE
sudo sed -E 's/(DATABASE_URL|INTERNAL_API_TOKEN|GSA_TV_SECRET_KEY|STREAM_KEY)=.*/\1=[REDACTED]/' /opt/gsa-tv/control-plane/compose.yml
`;

const result = await runSshScript(script, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
