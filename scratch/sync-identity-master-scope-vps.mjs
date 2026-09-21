import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const doc = fs.readFileSync('production/gsa-tv-identities/PRODUCTION_MASTER_25_PROGRAMS.md');
const note = `
## 2026-09-07 — Escopo de identidade corrigido para 125 masters

- A relação aprovada contém cinco entregáveis independentes por programa: abertura, Estamos apresentando, Voltamos a apresentar, encerramento e cenário oficial em vídeo com o avatar correspondente.
- O escopo correto é de 125 masters: 25 programas × 5 vídeos de 10 segundos.
- O cenário com avatar não será considerado entregue apenas por aparecer dentro de outra vinheta.
- O documento mestre de produção foi corrigido para refletir este escopo integral.
`;
const result = await runSshScript(`set -e
printf '%s' '${doc.toString('base64')}' | base64 -d | sudo tee /home/opc/gsa-ai/docs/production/GSA_TV_PRODUCTION_MASTER_25_PROGRAMS_2026-09-07.md >/dev/null
printf '%s' '${Buffer.from(note).toString('base64')}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo stat -c '%y %s %n' /home/opc/gsa-ai/docs/production/GSA_TV_PRODUCTION_MASTER_25_PROGRAMS_2026-09-07.md
sudo tail -n 10 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`, 30000);
process.stdout.write(result.stdout || '');
