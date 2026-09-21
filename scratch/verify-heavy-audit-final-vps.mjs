import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
echo '=== engine ==='; curl -fsS http://127.0.0.1:9210/health; echo
echo '=== hls ==='; now=$(date +%s); mt=$(sudo stat -c %Y /opt/gsa-tv/runtime/hls/program.m3u8); echo "age_s=$((now-mt)) recent_segments=$(sudo find /opt/gsa-tv/runtime/hls -maxdepth 1 -name 'program_*.ts' -mmin -1 | wc -l)"
echo '=== report ==='; stat -c '%a %U:%G %s %y %n' /home/opc/gsa-ai/GSA_TV_AUDITORIA_PESADA_2026-09-06.md; sha256sum /home/opc/gsa-ai/GSA_TV_AUDITORIA_PESADA_2026-09-06.md
echo '=== changelog tail ==='; tail -n 12 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
