import { runSshScript } from './ssh2-run.mjs';
const remote=String.raw`cat >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md <<'EOF'

## 2026-09-04 — Abertura e encerramento próprios para toda a grade
- Cada programa da grade deve possuir abertura e encerramento oficiais próprios, coerentes com sua identidade editorial.
- Os masters devem ser produzidos em Full HD, com trilha e desenho sonoro próprios, versões limpas e ativos reutilizáveis da identidade fixa.
- Não reutilizar uma vinheta genérica entre programas distintos.
- Antes da produção em lote, inventariar a grade completa e identificar masters existentes, faltantes ou reprovados.
- Determinação expressa do responsável pelo canal nesta conversa.
EOF`;
const r=await runSshScript(remote,30000);process.stdout.write(r.stdout);
