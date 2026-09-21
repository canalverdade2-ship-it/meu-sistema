import fs from 'node:fs';import {Client} from 'ssh2';import {readInfraKey,runSshScript} from './ssh2-run.mjs';
const local='assets/gsa-tv/voices/program-bumpers-2026-09-05/PAINEL_VINHETAS.html',remote='/home/opc/gsa-ai/qc/program-bumpers-2026-09-05/PAINEL_VINHETAS.html';
await new Promise((resolve,reject)=>{const c=new Client();c.on('ready',()=>c.sftp((e,s)=>{if(e)return reject(e);s.fastPut(local,remote,{mode:0o640},e=>{c.end();e?reject(e):resolve()})}));c.on('error',reject);c.connect({host:'147.15.43.141',port:22,username:'opc',privateKey:readInfraKey(),readyTimeout:15000})});
const sh=`set -e
bad=0
for f in /opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered/*.mp3; do
 d=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of csv=p=0 "/media/1/identity/program-bumpers-2026-09-05/mastered/$(basename "$f")")
 awk -v d="$d" 'BEGIN{exit !(d>1 && d<15)}' || bad=$((bad+1))
done
test "$bad" -eq 0
python3 - <<'PY'
from pathlib import Path
p=Path('/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md');s=p.read_text(encoding='utf-8')
marker='#### 2026-09-05 — PACOTE COMPLETO “ESTAMOS APRESENTANDO” E “ESTAMOS DE VOLTA”'
entry='''

#### 2026-09-05 — PACOTE COMPLETO “ESTAMOS APRESENTANDO” E “ESTAMOS DE VOLTA”

- Geradas pela API Fish Audio, modelo liberado e ilimitado s2.1-pro-free, as duas vinhetas de continuidade de todos os 25 programas oficiais.
- Frases: “Estamos apresentando: [programa]” e “Estamos de volta com: [programa]”.
- Total produzido: **50 locuções limpas + 50 versões masterizadas**, todas validadas tecnicamente.
- Cada um dos 22 programas com novo apresentador utilizou sua voz preliminar específica do casting.
- As três edições do GSA News utilizaram a voz master de continuidade da GSA TV; Holt e Nyla continuam preservadas exclusivamente como vozes dos apresentadores no Google Vids.
- A pronúncia de GSA foi sintetizada foneticamente como “Gê Esse Á” para naturalidade, mantendo a grafia oficial GSA nos metadados e nomes dos programas.
- As versões masterizadas receberam assinatura sonora original curta e normalização broadcast; as versões dry foram mantidas para futuras remasterizações.
- Houve uma rejeição inicial do filtro de fade por sintaxe decimal e, depois, permissão insuficiente no diretório de saída. Ambos foram corrigidos sem perda de locuções e a masterização foi repetida com sucesso em 50/50 arquivos.
- QC na VPS: /home/opc/gsa-ai/qc/program-bumpers-2026-09-05/
- Cópia operacional: /opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/
- Painel de audição: /home/opc/gsa-ai/qc/program-bumpers-2026-09-05/PAINEL_VINHETAS.html
- O pacote ainda não foi inserido automaticamente na playlist ou no encoder; aguarda audição/aprovação.
'''
if marker not in s:p.write_text(s.rstrip()+entry+'\\n',encoding='utf-8')
print('CHANGELOG_OK',marker in p.read_text(encoding='utf-8'))
print('DRY',len(list(Path('/home/opc/gsa-ai/qc/program-bumpers-2026-09-05/dry').glob('*.mp3'))))
print('MASTERED',len(list(Path('/home/opc/gsa-ai/qc/program-bumpers-2026-09-05').glob('*.mp3'))))
print('PANEL',Path('/home/opc/gsa-ai/qc/program-bumpers-2026-09-05/PAINEL_VINHETAS.html').exists())
PY
echo BAD_DURATION=$bad`;
const r=await runSshScript(sh,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
