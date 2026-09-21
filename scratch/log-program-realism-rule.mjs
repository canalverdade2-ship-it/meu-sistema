import { runSshScript } from './ssh2-run.mjs';
const remote=String.raw`cat >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md <<'EOF'

## 2026-09-04 — Regra permanente de realismo e impacto audiovisual
- Todo programa novo deve buscar o máximo de realismo audiovisual compatível com sua identidade editorial.
- É proibido entregar programa baseado apenas em voz seca e imagem estática.
- A produção deve incluir, conforme o formato: trilha de fundo licenciada, cama musical sob locução, stings, transições, ambiência, imagens ou vídeos em movimento e desenho sonoro coerente.
- O volume da trilha deve preservar a inteligibilidade da voz e não competir com a locução.
- É proibido reutilizar imagens de reportagens ou de outros programas sem relação direta com o conteúdo atual.
- Cada programa deve usar ativos próprios e coerentes com sua identidade; GSA Em Fé não deve reutilizar imagens do GSA News e vice-versa.
- A regra foi determinada expressamente pelo responsável pelo canal nesta conversa.
EOF
tail -n 14 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`;
const r=await runSshScript(remote,30000);process.stdout.write(r.stdout);
