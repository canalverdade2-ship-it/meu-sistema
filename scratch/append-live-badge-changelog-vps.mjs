import { runSshScript } from './ssh2-run.mjs';

const entry = `

## 2026-09-06 08:31 BRT — Correção de regressão do selo AO VIVO

- Sintoma informado: a faixa/selo \`AO VIVO\` voltou a aparecer sobre a transmissão sem solicitação atual.
- Causa confirmada: o registro persistente \`70faed0c-f6b5-4b01-b80f-493bdbda6708\` em \`gsa_tv_graphics\` permanecia com \`enabled=true\`; uma recarga de gráficos reaplicou o elemento residual da migração.
- Correção aplicada: o selo foi persistido como \`enabled=false\` e foi executado um job \`graphics_reload\`, concluído com sucesso.
- Continuidade preservada: o encoder externo permaneceu no mesmo PID 18 durante a correção; nenhum restart do transporte RTMP foi realizado.
- Verificação pós-correção: engine saudável, HLS fresco, sem fallback, lock saudável e exatamente um processo publicador RTMP.
- Regra operacional reafirmada: o selo AO VIVO deve permanecer desligado por padrão e só pode ser ativado mediante comando manual explícito no painel.

## 2026-09-06 — Regra da chamada oficial da grade

- Programas, nomes artísticos, avatares, vozes e sinopses existentes são considerados 100% aprovados e canônicos.
- A chamada da grade oficial deve usar exclusivamente vídeos em movimento; fotografias e imagens estáticas são proibidas.
- Logos, nomes dos programas e demais textos podem aparecer somente como grafismos animados sobre imagens em movimento.
- Os apresentadores devem aparecer em vídeo, preservando avatar, voz, identidade e cenário oficial aprovados para cada programa.
`;

const payload = Buffer.from(entry, 'utf8').toString('base64');
const result = await runSshScript(`set -eu
printf '%s' '${payload}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo tail -n 32 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
