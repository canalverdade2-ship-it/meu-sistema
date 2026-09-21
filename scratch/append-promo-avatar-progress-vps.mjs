import { runSshScript } from './ssh2-run.mjs';

const entry = `

## 2026-09-06 — Continuidade da chamada oficial e avatar institucional

- A chamada oficial da grade permanece em produção no projeto Google Vids \`GSA TV — Chamada Oficial da Grade de Programação\`.
- A base visual avançou com cenas 100% em vídeo em movimento para abertura institucional, jornalismo, mercado/negócios, tecnologia, agronegócio, música/internet e esportes.
- Foram usados vídeos licenciados do banco integrado do Google Vids (Getty Images) nos temas em que a geração por IA foi recusada pelo filtro do serviço.
- O projeto está salvo no Drive e possui neste checkpoint 6 cenas e aproximadamente 2min15s de material bruto; ainda exige montagem final, logos animados, nomes, locução oficial, avatares aprovados, trilha, transições e revisão antes de ser declarado concluído.
- Regra preservada: a chamada final não pode usar fotografias ou quadros estáticos como conteúdo editorial; imagens de programa e identidade entram como grafismo animado sobre vídeo.
- Nova frente aprovada pelo usuário: criar avatar oficial do próprio Adriano para apresentações institucionais e comerciais da GSA TV.
- O avatar pessoal deverá ser fiel à aparência real, ter uso institucional/comercial e não será criado a partir de aparência inventada. Antes da geração, deve existir fotografia frontal adequada ou referência já aprovada nos ativos da GSA.
`;

const payload = Buffer.from(entry, 'utf8').toString('base64');
const result = await runSshScript(`set -eu
printf '%s' '${payload}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo tail -n 24 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
