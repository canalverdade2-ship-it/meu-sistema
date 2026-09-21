import {runSshScript} from './ssh2-run.mjs';
const note=String.raw`

## 2026-09-04 — Incidente registrado com transparência: órfão RTMP e script de verificação mutável

- Foi confirmado que existia um retransmissor RTMP órfão dentro do Control Plane antigo, ocupando a porta UDP 12345.
- Naquele instante existia somente uma conexão efetiva com a chave do YouTube: a conexão do órfão; o novo retransmissor falhava antes de conectar porque a porta UDP já estava ocupada.
- A execução nesta sessão do arquivo verify-external-encoder-architecture.mjs revelou que, apesar do nome “verify”, ele executava docker compose com force-recreate. Isso recriou o Encoder Engine e expôs o conflito latente. O uso desse script como diagnóstico foi uma falha operacional desta sessão.
- O processo órfão foi encerrado com alvo validado por PID, comando e cgroup. O Encoder Engine assumiu a porta, estabeleceu uma única conexão RTMP e zerou last_error.
- A partir deste registro, scripts com nome de verificação devem ser inspecionados e classificados como somente leitura antes da execução; scripts mutáveis não podem ser usados como auditoria passiva.
`;
const n64=Buffer.from(note).toString('base64');
const sh=String.raw`set -euo pipefail
token=$(sudo awk -F= '$1=="ENCODER_ENGINE_TOKEN"{print substr($0,index($0,"=")+1);exit}' /opt/gsa-tv/control-plane/.env)
status(){ curl -fsS -H "Authorization: Bearer $token" http://127.0.0.1:9210/v1/status; }
before=$(status)
bp=$(printf '%s' "$before"|python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["producer_pid"])')
bo=$(printf '%s' "$before"|python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["outer_pid"])')
echo "before producer=$bp outer=$bo"
sudo docker restart gsa-tv-control-plane >/dev/null
for i in $(seq 1 45); do h=$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}' 2>/dev/null||true); [ "$h" = healthy ] && break; sleep 1; done
sleep 8
after=$(status)
ap=$(printf '%s' "$after"|python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["producer_pid"])')
ao=$(printf '%s' "$after"|python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["outer_pid"])')
test "$bp" = "$ap"
test "$bo" = "$ao"
count=$(sudo ss -tnp | grep ':1935' | grep -c ESTAB || true)
test "$count" = 1
echo "after producer=$ap outer=$ao control_plane_health=$h rtmp_connections=$count"
echo "$after"
sudo ss -tnp | grep ':1935' | grep ESTAB
printf '%s' '${n64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`;
const r=await runSshScript(sh,90000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
