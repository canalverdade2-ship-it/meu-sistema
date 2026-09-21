import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const doc = fs.readFileSync('production/gsa-tv-identities/PRODUCTION_MASTER_25_PROGRAMS.md');
const note = `
## 2026-09-07 — Produção imediata dos 100 vídeos de identidade iniciada

- Autorização expressa do responsável: iniciar imediatamente e prosseguir até concluir os quatro vídeos oficiais de todos os 25 programas.
- Entregáveis por programa: abertura oficial, Estamos apresentando, Voltamos a apresentar, encerramento oficial e consolidação do cenário final em vídeo com o avatar correspondente.
- Regra reforçada: cada programa deve ter identidade própria. É proibido aplicar um template visual, cenário, paleta complementar, ritmo, trilha ou metáfora genérica a toda a grade.
- Referência de qualidade: linguagem e disciplina visual de grandes emissoras, sem copiar marcas, logos, grafismos protegidos ou identidades de terceiros.
- Padrão comum da GSA TV: acabamento premium, área segura, logo oficial íntegro, tipografia legível, movimento real, assinatura sonora e QC integral.
- Especificação final obrigatória: 10,000 s por peça; 1920x1080; 30 fps; H.264; AAC-LC 48 kHz estéreo; sem black frames, clicks/pops, marca de terceiros ou recorte de logo.
- Mapa mestre exclusivo dos 25 universos criativos criado em /home/opc/gsa-ai/docs/production/GSA_TV_PRODUCTION_MASTER_25_PROGRAMS_2026-09-07.md.
- Primeiro lote iniciado no Google Vids: GSA Mercado — Pacote Oficial de Identidade — 2026-09-07; primeiro plano de abertura em geração pelo Omni, sem texto/logo gerado, reservando área segura para aplicação do logo oficial.
- Nenhuma peça será marcada como concluída antes de exportação, conform técnico, QC visual/auditivo e registro canônico.
`;
const d64 = doc.toString('base64');
const n64 = Buffer.from(note).toString('base64');
const result = await runSshScript(`set -e
sudo mkdir -p /home/opc/gsa-ai/docs/production
printf '%s' '${d64}' | base64 -d | sudo tee /home/opc/gsa-ai/docs/production/GSA_TV_PRODUCTION_MASTER_25_PROGRAMS_2026-09-07.md >/dev/null
printf '%s' '${n64}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo stat -c '%y %s %n' /home/opc/gsa-ai/docs/production/GSA_TV_PRODUCTION_MASTER_25_PROGRAMS_2026-09-07.md /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
sudo tail -n 18 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`, 30000);
process.stdout.write(result.stdout || '');
