import { runSshScript } from './ssh2-run.mjs';
const note = `
## 2026-09-07 — Google Vids: teste manual de cinco tentativas consecutivas

- Por solicitação expressa do responsável, foram executadas cinco tentativas consecutivas de geração no projeto GSA Mercado — Pacote Oficial de Identidade — 2026-09-07.
- Em todas as cinco, o Vids exibiu inicialmente “Dando vida à sua ideia! Isso leva cerca de 50 segundos.” e, logo depois, recusou a geração com “Você atingiu seu limite para gerar conteúdo no Vids.”
- Resultado: 0 de 5 gerações concluídas; o limite permaneceu ativo.
- Nenhuma peça incompleta foi adicionada, exportada ou levada ao ar.
`;
const r = await runSshScript(`set -e
printf '%s' '${Buffer.from(note).toString('base64')}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo tail -n 9 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`,30000);
process.stdout.write(r.stdout||'');
