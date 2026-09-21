import { runSshScript } from './ssh2-run.mjs';
const entry = `

## 2026-09-07 03:09Z — GSA News completo colocado no ar para teste comparativo de áudio
- Autorização expressa do responsável: substituir temporariamente a chamada pelo telejornal completo mais recente disponível para testar o áudio da transmissão.
- Mídia selecionada: \`media-gsa-news-2026-09-01-broadcast-v4-final\`, título \`GSA News — 01/09/2026 — Broadcast V4 animado (cortes rápidos)\`.
- Critério: é a edição completa aprovada mais recente, com 1.487,588 s (aprox. 24 min 48 s). A mídia de 02/09 tem apenas 180 s e não foi tratada como edição completa.
- Gate antes da tomada: \`ready | approved | rights_ok=true\`; arquivo 1920x1080, 30 fps, H.264 + AAC 48 kHz estéreo.
- Job \`media_take\`: \`5ef23ff6-535b-4a6f-b8a7-bb5433e0528e\`, concluído com sucesso às 03:08:47Z.
- Estado confirmado: \`online | running | media:media-gsa-news-2026-09-01-broadcast-v4-final | sending\`, sem \`last_error\`.
- O PID do transportador externo permaneceu \`18\` antes e depois da troca; somente o producer foi substituído. Portanto não houve novo handshake/restart do publicador RTMP.
- Contagem confirmada após a tomada: exatamente 1 publicador RTMP no Encoder Engine.
- Captura de 30 s do HLS final concluída sem warnings de corrupção/timestamps; áudio PCM analisado com -19,3 LUFS integrado, pico verdadeiro aproximado de -1,0 dBFS e RMS -22,22 dBFS.
- O GSA News permanece no ar para avaliação auditiva do responsável no retorno público do YouTube.
`;
const encoded=Buffer.from(entry).toString('base64');
const result=await runSshScript(`set -eu
printf '%s' '${encoded}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
tail -n 15 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`,30000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
