import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== PROCESS TREE ==='
for p in 2168547 2173248 2227896; do test -d /proc/$p || continue; echo ---$p; ps -o pid,ppid,lstart,etime,cmd -p $p; cat /proc/$p/cgroup; done
echo '=== CONTAINERS INSPECT ==='
for c in gsa-tv-encoder-engine gsa-tv-control-plane gsa-tv-ffplayout; do echo ---$c; sudo docker inspect "$c" --format '{{json .Config.Cmd}} {{json .Config.Entrypoint}} {{json .HostConfig.RestartPolicy}}'; sudo docker top "$c" -eo pid,ppid,etime,args; done
echo '=== RELEVANT ENV NAMES ==='
for c in gsa-tv-encoder-engine gsa-tv-control-plane gsa-tv-ffplayout; do echo ---$c; sudo docker inspect "$c" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -E 's#(KEY|TOKEN|PASSWORD|SECRET)=.*#\\1=REDACTED#I' | grep -Ei 'RTMP|OUTPUT|MODE|OWNER|STREAM|CONTROL|MEDIA|PLAYOUT' || true; done
echo '=== RUNBOOK ==='
sed -n '1,240p' /home/opc/gsa-ai/docs/GSA_NEWS_DAILY_RUNBOOK.md
echo '=== EDITION 09-02 MANIFEST ==='
cat /home/opc/gsa-ai/editions/gsa-news-2026-09-02/work/manifest.json
echo '=== SCRIPTS ==='
sed -n '1,240p' /home/opc/gsa-ai/editions/gsa-news-2026-09-02/work/qc_and_take.sh
`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
