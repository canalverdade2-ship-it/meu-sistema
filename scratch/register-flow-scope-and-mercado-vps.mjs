import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';
const doc=fs.readFileSync('production/gsa-tv-identities/PRODUCTION_MASTER_25_PROGRAMS.md');
const note=`
## 2026-09-07 — Produção migrada ao Google Flow e escopo reduzido para abertura/encerramento

- Nova decisão expressa: nesta etapa produzir somente abertura oficial e encerramento oficial dos 25 programas, total de 50 peças.
- Suspensos nesta etapa: Estamos apresentando, Voltamos a apresentar e cenário com avatar.
- Configuração obrigatória fornecida em captura: Vídeo, 16:9, x1, Veo 3.1 Lite, 8 segundos, 10 créditos por geração.
- O master de entrega permanece em 10 segundos; a base de 8 segundos será finalizada com 2 segundos de assinatura/revelação do logo no acabamento, conform 1080p30 H.264 AAC-LC 48 kHz estéreo.
- Regra reforçada: cada geração deve receber o logo oficial aprovado do respectivo programa como elemento no Google Flow.
- Direção: aberturas e encerramentos com linguagem e acabamento de grandes emissoras, sem copiar identidades de terceiros e preservando universo próprio para cada atração.
- Projeto Flow iniciado: GSA Mercado — Identidade Oficial — Flow — 2026-09-07, URL https://flow.google.com/project/5bab07f8-bed9-43e6-aae8-d05f735e4e0c.
- Saldo observado antes do lote: 1.050 créditos. O modo aprovado custa 10 créditos por geração.
- GSA Mercado: logo oficial enviado ao Flow como elemento; candidatos de abertura e encerramento com logo foram gerados. Permanecem candidatos até revisão integral, exportação, acabamento e QC.
- As gerações anteriores sem logo e a tentativa de continuidade não pertencem ao pacote oficial e não devem ser promovidas.
`;
const r=await runSshScript(`set -e
printf '%s' '${doc.toString('base64')}' | base64 -d | sudo tee /home/opc/gsa-ai/docs/production/GSA_TV_PRODUCTION_MASTER_25_PROGRAMS_2026-09-07.md >/dev/null
printf '%s' '${Buffer.from(note).toString('base64')}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo tail -n 16 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`,30000);
process.stdout.write(r.stdout||'');
