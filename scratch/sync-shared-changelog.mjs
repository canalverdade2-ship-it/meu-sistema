import { runSshScript } from './ssh2-run.mjs';
import fs from 'fs/promises';

async function main() {
  const newEntry = `
## [04/09/2026 08:55 - Separação do Encoder Engine 1.7.0, ZMQ Dinâmico e Desacoplamento RTMP]
- **Autor:** ChatGPT (07:40-08:36) + Antigravity (Validação e Auditoria 08:55)
- **Motivação:** Eliminar quedas de transmissão ao atualizar o painel ou recarregar gráficos no ar.
- **Arquitetura 1.7.0 Implantada:**
  - O encoder foi desacoplado do Control Plane e isolado no container permanente \`gsa-tv-encoder-engine\` (porta 9210).
  - O pipeline de saída foi dividido em duas camadas:
    1. **Transportador Externo (RTMP):** Conectado permanentemente ao YouTube (\`rtmp://a.rtmp.youtube.com/live2/...\`) escutando na porta UDP interna \`127.0.0.1:12345\`. O PID do transporte não muda ao reiniciar o painel ou trocar fontes.
    2. **Produtor Interno (FFmpeg):** Codifica a mídia ativa (\`media-gsa-agora-nature-narrated-v1\`), renderiza os 4 cards de dados em tempo real e injeta o stream MPEG-TS na porta UDP 12345.
- **Gráficos Dinâmicos via ZMQ:**
  - As atualizações de notícias, loterias, clima e mercados agora ocorrem em tempo real via socket ZMQ (\`tcp://127.0.0.1:5577\`).
  - 52 comandos de teste foram aceitos sem reiniciar o processo FFmpeg e sem perda de conexão com o YouTube.
- **Control Plane:** Promovido para \`gsa-tv/control-plane:1.7.0\`, operando estritamente como cliente de comandos (não cria nem mata mais instâncias do FFmpeg diretamente).
- **Estado Atual da Transmissão (Comprovado):**
  - Conexão RTMP: \`ESTABLISHED\` com YouTube na porta 1935 (Send-Q = 0).
  - Canal \`ch-main\`: \`online / running / media:media-gsa-agora-nature-narrated-v1 / sending\`.
  - Processo Transportador: PID 1480208 ativo.
  - Processo Produtor: PID 1480217 ativo.
- **Pendências Mapeadas:**
  1. Otimização do timeout do fallback automático no \`encoder-engine\` em caso de falha forçada do produtor.
  2. Publicação oficial da Grade 24 Horas com o master \`media-gsa-manha-news-2026-09-04-draft-qc-v1\` após aprovação.
`;

  // 1. Atualiza na VPS
  const script = `
cat << 'EOF' >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
${newEntry}
EOF
echo "Changelog atualizado na VPS com sucesso."
`;
  const res = await runSshScript(script);
  console.log(res.stdout);

  // 2. Salva localmente na raiz do projeto
  await fs.appendFile('GSA_TV_MEMORY_CHANGELOG.md', newEntry, 'utf8');
  console.log('Changelog atualizado localmente na raiz do projeto.');
}

main().catch(console.error);
