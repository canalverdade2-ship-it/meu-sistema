import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(String.raw`
set -eu
docker image inspect gsa-tv/render-engine:0.2.2 --format '{{json .Config}}'
docker run --rm --entrypoint sh gsa-tv/render-engine:0.2.2 -lc 'find /engine -maxdepth 4 -type f | sort | sed -n "1,260p"' || true
`);
process.stdout.write(result.stdout); process.stderr.write(result.stderr);
