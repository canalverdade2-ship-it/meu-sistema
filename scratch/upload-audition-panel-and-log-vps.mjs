import fs from 'node:fs';
import { Client } from 'ssh2';
import { readInfraKey, runSshScript } from './ssh2-run.mjs';

const local='assets/gsa-tv/voices/auditions-2026-09-05/PAINEL_AUDICAO.html';
const remote='/home/opc/gsa-ai/qc/fish-voices/auditions-2026-09-05/PAINEL_AUDICAO.html';
await new Promise((resolve,reject)=>{const c=new Client();c.on('ready',()=>c.sftp((e,s)=>{if(e)return reject(e);s.fastPut(local,remote,{mode:0o640},e=>{c.end();e?reject(e):resolve()})}));c.on('error',reject);c.connect({host:'147.15.43.141',port:22,username:'opc',privateKey:readInfraKey(),readyTimeout:15000})});

const sh=`python3 - <<'PY'
from pathlib import Path
p=Path('/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md')
s=p.read_text(encoding='utf-8')
marker='#### 2026-09-05 — CASTING DE VOZES FISH AUDIO: PRIMEIRAS 22 PROVAS'
entry='''

#### 2026-09-05 — CASTING DE VOZES FISH AUDIO: PRIMEIRAS 22 PROVAS

- O responsável confirmou que o plano/modelo **Fish Audio s2.1-pro-free está liberado e é ilimitado**, podendo ser utilizado livremente pela GSA TV.
- A API foi validada na prática: o modelo comercial s2-pro respondeu por saldo comercial insuficiente, enquanto o modelo autorizado s2.1-pro-free respondeu HTTP 200 e gerou áudio normalmente. São modalidades de acesso separadas.
- O catálogo da conta foi consultado pela API e retornou aproximadamente 680 candidatos em português.
- Foram descartadas da seleção vozes identificadas como imitações de celebridades, políticos, personagens protegidos, amostras sexualizadas ou perfis incompatíveis com a identidade editorial da emissora.
- Foram selecionadas 22 vozes preliminares distintas, uma para cada apresentador fora do GSA News, e geradas 22 provas contextuais específicas de programa.
- Resultado técnico: **22/22 provas geradas com sucesso**.
- Diretório de QC na VPS: /home/opc/gsa-ai/qc/fish-voices/auditions-2026-09-05/
- Catálogo consultado: /home/opc/gsa-ai/qc/fish-voices/candidate-catalog-2026-09-05.json
- Atribuição preliminar: /home/opc/gsa-ai/qc/fish-voices/provisional-assignment-2026-09-05.json
- Painel de audição: /home/opc/gsa-ai/qc/fish-voices/auditions-2026-09-05/PAINEL_AUDICAO.html
- As vozes ainda estão em estado **preliminar/para audição**; somente serão registradas como oficiais após aprovação.
- O GSA News continua fora deste casting: Marcelo Valença e Lívia Fontes permanecem com as vozes nativas Holt e Nyla do Google Vids.
- Nenhuma alteração foi feita no encoder, RTMP ou transmissão.
'''
if marker not in s:p.write_text(s.rstrip()+entry+'\\n',encoding='utf-8')
print('PANEL',Path('${remote}').exists())
print('CHANGELOG',marker in p.read_text(encoding='utf-8'))
print('MP3_COUNT',len(list(Path('/home/opc/gsa-ai/qc/fish-voices/auditions-2026-09-05').glob('*.mp3'))))
PY`;
const r=await runSshScript(sh,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
