import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
echo '=== candidate images ==='
for i in gsa-tv/encoder-engine:1.2.0 gsa-tv/watchdog:1.3.0 gsa-tv/control-plane:1.8.0; do sudo docker image inspect "$i" --format '{{.RepoTags}}|{{.Id}}|{{.Created}}|health={{json .Config.Healthcheck}}' 2>/dev/null || echo "MISSING $i"; done
echo '=== candidate source trees ==='
sudo find /home/opc/gsa-ai/backups/pre-corrections-20260906 /opt/gsa-tv -maxdepth 4 -type f -newermt '2026-09-06 07:00:00 UTC' -printf '%TY-%Tm-%Td %TH:%TM:%TS %m %u:%g %s %p\n' 2>/dev/null | sort | tail -n 180
echo '=== relevant local deployment scripts ==='
find /home/opc/gsa-ai -maxdepth 2 -type f -newermt '2026-09-06 07:00:00 UTC' -printf '%TY-%Tm-%Td %TH:%TM:%TS %m %u:%g %s %p\n' 2>/dev/null | sort | tail -n 120
echo '=== active compose files ==='
sudo sed -n '1,180p' /opt/gsa-tv/encoder-engine/compose.yml
sudo sed -n '1,180p' /opt/gsa-tv/watchdog/compose.yml
sudo sed -n '1,200p' /opt/gsa-tv/control-plane/compose.yml
`,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
