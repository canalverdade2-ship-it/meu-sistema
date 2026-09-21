import { runSshScript } from './ssh2-run.mjs';

const changelogEntry = `

## [2026-09-08 16:55 BRT] — IMPLANTAÇÃO DA BLINDAGEM DE HARDWARE, ISOLAMENTO FÍSICO DA TRANSMISSÃO E PROCESS GUARDIAN (ZERO DOWNTIME)
- **Status:** Concluído com sucesso de ponta a ponta sem interrupção do sinal no YouTube (zero downtime).
- **1. Aplicação Online de Cgroups e Isolamento Físico de CPU (Núcleos 0, 1, 2 vs Núcleo 3):**
  - \`gsa-tv-encoder-engine\`: fixado com prioridade máxima nos núcleos 0, 1 e 2 (\`cpuset: "0,1,2"\`, \`cpu_shares: 2048\`, \`mem_reservation: 1g\`, \`mem_limit: 3g\`, \`oom_score_adj: -1000\`).
  - \`gsa-tv-ffplayout\`: fixado nos núcleos 0 e 1 (\`cpuset: "0,1"\`, \`cpus: 1.5\`, \`cpu_shares: 1024\`, \`mem_reservation: 1g\`, \`mem_limit: 3g\`, \`oom_score_adj: -900\`).
  - \`gsa-tv-control-plane\` e \`gsa-tv-watchdog\`: fixados nos núcleos 0, 1 e 2 (\`cpuset: "0,1,2"\`, \`cpu_shares: 512\`, \`mem_reservation: 256m\`, \`mem_limit: 1g\`).
  - \`gsa-ai-browser\`: confinado estritamente ao núcleo 3 (\`cpuset: "3"\`, \`cpus: 1.0\`, \`cpu_shares: 128\`, \`mem_limit: 3.5g\`, \`oom_score_adj: +500\`).
  - \`gsa-shopee-browser\`: confinado estritamente ao núcleo 3 (\`cpuset: "3"\`, \`cpus: 0.8\`, \`cpu_shares: 128\`).
  - Efeito comprovado: os navegadores não conseguem mais disputar ciclos com a transcodificação da TV nos núcleos 0, 1 e 2.
- **2. Persistência nos Arquivos Compose:**
  - Atualizados e validados com \`docker compose config\`:
    * \`/opt/gsa-tv/encoder-engine/compose.yml\`
    * \`/opt/gsa-tv/compose/compose.yml\`
    * \`/opt/gsa-tv/control-plane/compose.yml\`
    * \`/opt/gsa-tv/watchdog/compose.yml\`
    * \`/home/opc/gsa-ai/compose.yml\`
- **3. Saneamento do Chromium:**
  - Todas as abas órfãs e acumuladas via CDP (\`http://127.0.0.1:9228\`) foram encerradas.
  - Processos renderers zumbis eliminados.
  - Injetadas flags de otimização de CPU no script \`/home/opc/gsa-ai/start.sh\`: \`--disable-software-rasterizer\`, \`--renderer-process-limit=2\`.
  - Imagem reconstruída e contêiner reiniciado no núcleo 3 com limites ativos.
- **4. Process Guardian Ativo:**
  - Criado executável \`/opt/gsa-tv/bin/gsa-process-guardian.sh\` (\`chmod +x\`).
  - Criado serviço \`/etc/systemd/system/gsa-process-guardian.service\` e timer \`/etc/systemd/system/gsa-process-guardian.timer\`.
  - Timer habilitado e ativo a cada 30 segundos (\`systemctl status gsa-process-guardian.timer\`).
  - Monitora o núcleo 3 e processos do Chromium; se mantiverem >80% de CPU por >3 minutos consecutivos, encerra graciosamente (SIGTERM) e forçado (SIGKILL).
  - Monitora a saúde e cadência do encoder da TV e registra em \`/var/log/gsa-process-guardian.log\`.
- **5. Provas Técnicas:**
  - Transmissão ao vivo 100% no ar durante todo o processo (PID do encoder mantido intacto).
  - Conexão RTMP com o YouTube (\`rtmp://a.rtmp.youtube.com/live2/...\`) estabelecida e contínua.
  - Status do encoder reporta \`hls_fresh: true\`, \`desired: running\`, \`lock_healthy: true\`.
`;

const b64 = Buffer.from(changelogEntry, 'utf8').toString('base64');
const script = `
echo "${b64}" | base64 -d >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
tail -n 45 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`;

const res = await runSshScript(script);
console.log(res.stdout);
