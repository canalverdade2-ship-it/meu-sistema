import { runSshScript } from './ssh2-run.mjs';

const note = `
## 2026-09-07 — CHECKPOINT CONSOLIDADO ATÉ ESTE MOMENTO

### Estado operacional confirmado
- GSA News completo permanece selecionado no ar: media-gsa-news-2026-09-01-broadcast-v4-final.
- Canal: online / desired running / signal sending.
- Encoder Engine mantém arquitetura separada: outer RTMP persistente + producer substituível.
- Existe exatamente 1 publicador RTMP para a chave do YouTube; nenhuma duplicidade foi encontrada nesta etapa.
- Evento público atual correto: soeRG2L70ys — GSA TV - AO VIVO.

### Investigação dos estalos de áudio
- Operador confirmou estalos tanto na chamada quanto no GSA News, embora os arquivos originais estejam limpos.
- Processo diagnóstico residual que consumia aproximadamente 97% de um núcleo foi identificado e encerrado de forma direcionada, sem tocar no encoder.
- Hipótese de compensação assíncrona descartada após teste: async=1 foi removido na versão 1.8.3 e os estalos permaneceram.
- Foi implantado teste de isolamento mais forte na versão 1.8.4: áudio AAC-LC original, 48 kHz, estéreo, aproximadamente 194 kb/s, passa com -c:a copy, sem decodificação, resample, limiter, filtro ou recodificação no producer.
- Producer ativo foi validado contendo -c:a copy; outer RTMP permaneceu o mesmo; HLS fresco; nenhum erro recente de timestamp, corrupção, fila ou descarte.
- Mesmo com bitstream passthrough, o operador confirmou que os estalos continuam. Logo, processamento de áudio do producer está descartado como causa.
- Próxima comparação obrigatória: ouvir separadamente o HLS do painel Master e o retorno público do YouTube. Se o HLS estiver limpo e apenas o YouTube estalar, investigar remux MPEG-TS/FLV, ingest e reprodução. Se ambos estalarem, investigar o trecho anterior à divisão/empacotamento.
- Não declarar o problema de áudio resolvido até confirmação auditiva expressa do operador.

### Correções do painel Master
- Configuração do canal ainda apontava para o vídeo antigo e indisponível RqX4IJXdbGQ; corrigida para o evento público atual soeRG2L70ys.
- O painel local em http://10.0.2.189:3000 não estava autorizado pela política CORS da API da VPS.
- Antes da correção, o preflight dessa origem retornava HTTP 403 Origem não autorizada, causando simultaneamente “Relay enviando — YouTube não confirmado” e “Sinal VPS em Standby”.
- A origem exata http://10.0.2.189:3000 foi adicionada a ALLOWED_ORIGINS; após a correção o preflight retorna HTTP 204 com Access-Control-Allow-Origin correto.
- Apenas o Control Plane foi recriado para carregar a permissão. Encoder, outer RTMP e sessão do YouTube foram preservados; continuou exatamente 1 publicador.
- Operador deve recarregar completamente o painel para renovar o estado e solicitar novo token HLS.

### Versões e rastreabilidade
- Control Plane ativo: gsa-tv/control-plane:1.8.4.
- Backups datados foram preservados antes das alterações 1.8.3 e 1.8.4.
- Este arquivo /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md continua sendo o registro canônico obrigatório de todas as alterações futuras.
`;

const payload = Buffer.from(note, 'utf8').toString('base64');
const result = await runSshScript(`printf '%s' '${payload}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo stat -c 'updated=%y bytes=%s' /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
sudo tail -n 48 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`, 30000);
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
