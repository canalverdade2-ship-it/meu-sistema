import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
STAMP=$(date -Iseconds)
sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null <<EOF

## $STAMP — Validação de ciclo completo do áudio tratado

- A primeira amostra curta do HLS coincidiu com um trecho silencioso da própria vinheta.
- Nova medição cobrindo 38 segundos, superior ao ciclo completo de 35 segundos, confirmou áudio presente e contínuo.
- Saída efetiva pós-encoder: -17,0 LUFS integrados, true peak -1,8 dBFS e RMS aproximado -18,16 dBFS.
- Cadeia de declique, redução de aspereza e limitação confirmada ativa no processo produtor.
- Publicador RTMP permaneceu único e a sessão externa não foi reiniciada.
EOF
echo LOGGED
`,120000);process.stdout.write(r.stdout);
