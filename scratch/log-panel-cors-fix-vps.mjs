import { runSshScript } from './ssh2-run.mjs';

const note = `
## 2026-09-07 05:08Z — Causa real do painel em Relay/Standby corrigida: CORS do endereço local

- Nova captura comprovou que o painel aberto em http://10.0.2.189:3000 continuava exibindo Relay/YouTube não confirmado e Sinal VPS em Standby.
- Diagnóstico confirmou que as duas funções dependem da API externa da VPS e falhavam juntas porque ALLOWED_ORIGINS não incluía a origem local usada pelo operador.
- Prova anterior à correção: preflight para Origin http://10.0.2.189:3000 retornava HTTP 403 com Origem não autorizada; a origem pública gsahub.com.br retornava 204.
- Adicionada autorização restrita e exata para http://10.0.2.189:3000, mantendo localhost, gsahub.com.br e www.gsahub.com.br.
- Control Plane foi recriado somente para carregar a variável de ambiente; encoder não foi reiniciado.
- Validação após correção: preflight da origem local retorna HTTP 204 e Access-Control-Allow-Origin correto.
- Outer RTMP foi preservado, exatamente 1 publicador continuou ativo e a sessão com YouTube não foi tocada.
- Com esta correção o painel local pode novamente obter snapshot ao vivo, token HLS e confirmação pública do evento correto soeRG2L70ys. Operador deve recarregar a página uma vez.
- Investigação dos estalos permanece separada; agora o HLS do painel volta a ser utilizável para a comparação auditiva solicitada.
`;
const payload = Buffer.from(note).toString('base64');
const result = await runSshScript(`printf '%s' '${payload}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo tail -n 17 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`, 30000);
process.stdout.write(result.stdout || '');
