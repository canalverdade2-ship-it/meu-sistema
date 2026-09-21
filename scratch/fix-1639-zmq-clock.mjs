import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
src=/opt/gsa-tv/control-plane/src/app.js
sudo cp "$src" "$src.before-zmq-clock-fix"
sudo python3 - <<'PY'
from pathlib import Path
p=Path('/opt/gsa-tv/control-plane/src/app.js')
s=p.read_text()
needle="text='%{localtime\\:%H\\:%M\\:%S}'"
replacement="text='%{localtime\\\\:%H\\\\:%M\\\\:%S}'"
assert needle in s, repr([line for line in s.splitlines() if 'localtime' in line])
s=s.replace(needle,replacement,1)
p.write_text(s)
print([repr(line) for line in s.splitlines() if 'localtime' in line])
PY
sudo docker run --rm -v /opt/gsa-tv/control-plane/src:/check:ro --entrypoint node gsa-tv/control-plane:1.6.38 --check /check/app.js
sudo docker build -t gsa-tv/control-plane:1.6.39 /opt/gsa-tv/control-plane >/tmp/gsa-tv-build-1639-clockfix.log
sudo docker run --rm --entrypoint node gsa-tv/control-plane:1.6.39 --check /app/src/app.js
echo "candidate|$(sudo docker image inspect gsa-tv/control-plane:1.6.39 --format '{{.Id}}|{{.Created}}')"
`;

const result = await runSshScript(script, 300000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
