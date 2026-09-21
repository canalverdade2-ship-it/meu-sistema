import { runSshScript } from './ssh2-run.mjs';
const ids=['gsaTvMediaReadiness01','gsaTvScheduleCompile02','gsaTvStorageReady03','gsaTvPlayoutMonitor04','gsaTvYoutubeMonitor05','gsaTvRightsWatch06','gsaTvAiProduction07','gsaTvDailyReport08'];
const lines=ids.map((id,i)=>`run_one '${id}' ${5689+i}`).join('\n');
const script=`set -euo pipefail
run_one(){
  id="$1"; port="$2"
  set +e
  out=$(docker exec -e N8N_RUNNERS_BROKER_PORT="$port" n8n n8n execute --id="$id" --rawOutput 2>&1)
  rc=$?
  set -e
  if [ "$rc" -eq 0 ]; then echo "PASS|$id"; else echo "FAIL|$id|exit=$rc"; echo "$out" | tail -40; return "$rc"; fi
}
${lines}
`;
const r=await runSshScript(script,420000);process.stdout.write(r.stdout);process.stderr.write(r.stderr);
