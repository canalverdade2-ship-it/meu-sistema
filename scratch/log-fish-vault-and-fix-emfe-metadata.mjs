import {runSshScript} from './ssh2-run.mjs';
const note=String.raw`

## 2026-09-04 — Fish Audio desbloqueado e integrado ao cofre

- O responsável forneceu uma nova chave de API Fish Audio.
- A chave foi armazenada exclusivamente em /home/opc/gsa-ai/secrets/fish-production.enc.json, com AES-256-GCM e permissão 0600; o valor não foi escrito neste changelog.
- Teste mínimo de autenticação na API Fish Audio retornou HTTP 200.
- O worker /opt/gsa-tv/ai-worker/ai_worker.mjs foi alterado para descriptografar a chave do cofre em memória durante a inicialização.
- O serviço gsa-ai-producer foi reiniciado e permaneceu active.
- Foram removidos tokens Fish antigos escritos diretamente nos scripts locais e na VPS; auditoria final encontrou zero arquivos com prefixo de chave em texto aberto nas áreas verificadas.
- A busca de modelos esclareceu que Holt e Nyla usados na edição inaugural são vozes do Google Vids. Modelos públicos da Fish com nomes semelhantes não são equivalentes e não serão usados como se fossem os mesmos apresentadores.
- Para Fish Audio permanecem configurados no worker os IDs internos já adotados para locutor de chamadas, âncora masculino e âncora feminina; novos clones só poderão receber nomes oficiais depois de validação auditiva.

## 2026-09-04 — Correção de metadados técnicos do master GSA Em Fé

- O arquivo físico ativo foi confirmado como 1920x1080, 30 fps, H.264, vídeo aproximadamente 4.003 kbps e áudio AAC estéreo 48 kHz aproximadamente 193 kbps.
- Os metadados da linha media-gsa-em-fe-15h-10min foram alinhados ao arquivo físico, sem trocar a mídia em exibição e sem reiniciar o encoder.
- A classificação editorial do master permanece reprovada para substituição futura; a correção de metadados não significa aprovação artística.
`;
const n64=Buffer.from(note).toString('base64');
const sh=String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 -qAt -F '|' -c "update public.gsa_tv_media_items set video_width=1920,video_height=1080,video_fps=30,video_bitrate_kbps=4003,audio_codec='aac',audio_sample_rate=48000,audio_channels=2,audio_bitrate_kbps=193,updated_at=now() where id='media-gsa-em-fe-15h-10min' returning id,video_width,video_height,video_fps,video_bitrate_kbps,audio_bitrate_kbps;"
printf '%s' '${n64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
tail -n 28 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`;
const r=await runSshScript(sh,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
