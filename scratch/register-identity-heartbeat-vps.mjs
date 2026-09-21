import { runSshScript } from './ssh2-run.mjs';
const note = `
## 2026-09-07 — Continuidade automática da produção no Google Vids

- Criada continuidade periódica nesta tarefa para verificar a restauração da cota do Google Vids e retomar automaticamente a produção do checkpoint atual.
- Identificador: produ-o-identidades-gsa-tv; intervalo: 30 minutos; estado: ativo.
- A automação deve sempre reler este changelog e o documento mestre antes de agir, não promover peças ao ar e registrar somente avanços efetivamente realizados.
- Se a cota continuar indisponível, deve preservar o estado e tentar novamente na execução seguinte.
`;
const r = await runSshScript(`printf '%s' '${Buffer.from(note).toString('base64')}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo tail -n 9 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`, 30000);
process.stdout.write(r.stdout || '');
