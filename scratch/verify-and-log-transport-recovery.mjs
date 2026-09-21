import {runSshScript} from './ssh2-run.mjs';
const note=String.raw`

## 2026-09-04 — Correção da dupla propriedade do transporte RTMP

- Durante auditoria foi detectado um retransmissor FFmpeg órfão dentro do container antigo do Control Plane, mantendo a porta UDP 12345 ocupada.
- O Encoder Engine estava saudável, com produtor ativo, mas seu retransmissor supervisionado não conseguia assumir a porta e entrava em ciclo de restart; o banco alternava para degraded/recovering.
- O processo órfão foi identificado por PID, linha de comando e cgroup do container antes da intervenção e encerrado de forma controlada.
- O Encoder Engine assumiu automaticamente o transporte e refez um único handshake RTMP.
- Validação imediata: um produtor, um retransmissor, uma conexão RTMP ESTABLISHED e Send-Q=0.
- Nenhuma mudança foi feita na mosca, no selo AO VIVO, no conteúdo do master ou nas coordenadas gráficas.
`;
const n64=Buffer.from(note).toString('base64');
const sh=String.raw`set -euo pipefail
token=$(sudo awk -F= '$1=="ENCODER_ENGINE_TOKEN"{print substr($0,index($0,"=")+1);exit}' /opt/gsa-tv/control-plane/.env)
for i in 1 2 3 4; do
  date -Ins
  curl -fsS -H "Authorization: Bearer $token" http://127.0.0.1:9210/v1/status
  echo
  sudo ss -tnp | grep ':1935' | grep ESTAB || true
  sleep 5
done
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -F '|' -c "select status,desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main'"
printf '%s' '${n64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`;
const r=await runSshScript(sh,90000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
