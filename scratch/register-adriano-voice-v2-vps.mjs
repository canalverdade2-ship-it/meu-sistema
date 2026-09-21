import { runSshScript } from './ssh2-run.mjs';

const entry = `\n\n## 2026-09-06 — Voz institucional de Adriano Farias: revisão natural v2\n\n- O usuário avaliou a primeira amostra como um pouco robótica; ela não foi oficializada.\n- Foi criada uma segunda clonagem privada no Fish Audio usando três amostras naturais de aproximadamente 25 segundos, extraídas da gravação original autorizada pelo próprio usuário.\n- Nesta revisão foi aplicado apenas tratamento técnico mínimo (filtro subsônico e limitador de segurança), sem normalização agressiva e com o aprimoramento automático desativado.\n- Modelo privado v2: f9b0947fc7c74ed0b33bd6350873fe09 (estado: trained).\n- Amostra de audição: assets/gsa-tv/avatars/adriano-farias/voice/adriano-farias-voice-qc-v2-natural.mp3.\n- Estado: aguardando aprovação auditiva; não considerar voz oficial antes da aprovação expressa.\n- Regra mantida: uso restrito ao avatar institucional/comercial de Adriano Farias e somente em conteúdos autorizados da GSA TV.\n`;

const payload = Buffer.from(entry, 'utf8').toString('base64');
const result = await runSshScript(`set -eu
printf '%s' '${payload}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo tail -n 12 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`, 120000);
process.stdout.write(result.stdout);
