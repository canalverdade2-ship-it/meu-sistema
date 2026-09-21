import {runSshScript} from './ssh2-run.mjs';
const rogue=String.raw`#!/usr/bin/env bash
exec -a "rogue-app rtmps://c.rtmp.youtube.com:443/live2/FAKE-NO-CONNECTION" sleep 60
`;
const b64=Buffer.from(rogue).toString('base64');
let r=await runSshScript(`set -euo pipefail
echo '${b64}' | base64 -d | sudo tee /usr/local/sbin/gsa-rogue-test >/dev/null
sudo chmod 0755 /usr/local/sbin/gsa-rogue-test
sudo systemctl stop gsa-rogue-test.service 2>/dev/null || true
sudo systemd-run --unit=gsa-rogue-test.service /usr/local/sbin/gsa-rogue-test >/dev/null
sleep 7
STATE=$(systemctl is-active gsa-rogue-test.service || true)
test "$STATE" != active
sudo rm -f /usr/local/sbin/gsa-rogue-test
sudo systemctl reset-failed gsa-rogue-test.service 2>/dev/null || true
echo "isolated_rogue_state=$STATE"
echo ISOLATED_GUARD_PASS
`,120000);
process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
