import { runSshScript } from './ssh2-run.mjs';

const changelogEntry = `
## [2026-09-08 17:15 BRT] — AUDITORIA ADVERSARIAL, CORREÇÃO DE QUANTIZAÇÃO DO GUARDIÃO E TESTE DE ESTRESSE DE PONTA A PONTA
- **Status:** Revisão adversarial concluída com 100% de sucesso e persistência confirmada.
- **1. Correções de Alinhamento Online de Cgroups:**
  - \`gsa-tv-ffplayout\`: alinhado online com \`--cpus=1.5 --memory=3g\` (anteriormente mantinha residual de 3.0 cpus e 6 GB).
  - \`gsa-tv-encoder-engine\`: alinhado online com \`--memory=3g --memory-swap=3g\`.
  - \`gsa-tv-control-plane\` & \`gsa-tv-watchdog\`: alinhados online com \`--memory=1g --memory-swap=1g\`.
- **2. Correção de Falsos Positivos de FPS no Process Guardian:**
  - Identificada e corrigida a oscilação causada por quantização de segmentos discretos HLS (2.0s = 60 quadros).
  - Implementada janela mínima robusta de amostragem (>=60s) e compensação de segmento in-flight.
  - Reset automático de baseline em caso de reinício de sequência HLS.
  - Resultado: eliminação completa dos falsos alertas no log (\`/var/log/gsa-process-guardian.log\`), mantendo cálculo preciso em 30.0 fps.
- **3. Ampliação de Proteção a Serviços Vitais:**
  - Adicionados serviços ao \`PROTECTED_PATTERNS\` no guardião: \`n8n\`, \`evolution-api\`, \`gsa-auth-session\`, \`deno\`, \`storage\`, \`oracle-cloud-agent\`, \`agent-updater\`, \`auditd\`, \`rsyslog\`, \`chrony\`, \`dbus\`, \`polkit\`, \`fail2ban\`, rotinas de \`backup\`/compressão.
- **4. Testes Reais de Eliminação sob Carga (SIGTERM e SIGKILL):**
  - Executado teste adversarial no Núcleo 3 com processo de alto consumo (\`PID 1566917\`): detecção em tempo real e encerramento gracioso via SIGTERM verificado com sucesso.
  - Executado teste adversarial no Núcleo 3 com processo teimoso imune a SIGTERM (\`PID 1567016\`): detecção, escalonamento para SIGKILL e terminação forçada confirmada no kernel com sucesso.
  - Transmissão do YouTube e encoder RTMP permaneceram ininterruptos durante todos os testes.
`;

async function main() {
  const b64 = Buffer.from(changelogEntry).toString('base64');
  const script = `
    echo "${b64}" | base64 -d >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
    tail -n 35 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
