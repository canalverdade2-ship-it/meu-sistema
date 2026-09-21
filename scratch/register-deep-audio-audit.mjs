import { runSshScript } from './ssh2-run.mjs';
const entry = `

## 2026-09-07 03:21Z — Auditoria profunda dos estalos: transporte íntegro; hipótese anterior corrigida
- Auditoria realizada com o GSA News completo no ar, sem restart, troca de mídia ou alteração de configuração.
- Cadeia ativa confirmada: arquivo AAC 48 kHz -> producer FFmpeg (AAC 192 kb/s, 48 kHz, \`aresample async=1\` + limiter) -> tee MPEG-TS/HLS -> outer FFmpeg persistente com \`-c copy\` -> FLV/RTMP -> YouTube.
- Control Plane, Watchdog e Encoder Engine permaneceram saudáveis; transportador PID 18, producer PID 46870, lock saudável, HLS fresco e exatamente 1 publicador RTMP.
- Captura externa direta do retorno público do YouTube foi finalmente concluída no evento correto \`soeRG2L70ys\`, sem depender da sessão da VPS.
- Áudio público nativo: AAC-LC, 44,1 kHz, estéreo, aproximadamente 128 kb/s. Em 20,0156 s foram auditados 862 pacotes; maior erro entre PTS esperado e real: aproximadamente 0,001 ms; nenhum gap superior a 0,1 ms.
- Portanto não há perda, buraco ou descontinuidade de timestamps no áudio entregue pelo YouTube nessa amostra.
- Uma captura pública de 45 s apresentou -19,2 LUFS e true peak -4,5 dBFS, sem clipping.
- O trecho público foi alinhado por envelope com o arquivo-fonte (correlação 0,9736). Os maiores transientes aparecem nos mesmos pontos do original; no recorte alinhado de 20 s, o original teve salto máximo 0,5446 e 760 eventos >0,30, enquanto o retorno público teve salto máximo 0,4727 e 414 eventos >0,30.
- O YouTube não criou novos saltos nessa passagem: os transientes do retorno são os mesmos do conteúdo e foram atenuados pela transcodificação.
- Comparação independente fonte x HLS no mesmo trecho também coincidiu: fonte salto máximo 0,2601, HLS 0,2594; ambos com apenas 2 eventos >0,25 e zero >0,30. Isso confirma que producer/HLS preservam o áudio.
- Rede física \`enp0s6\`: zero RX errors, RX dropped, TX errors e TX dropped. Socket RTMP atual: 44,39 GB enviados, apenas 10,6 KB retransmitidos acumulados, 14 retransmissões em toda a sessão e \`retrans:0\` no instante da coleta; sem limitação de janela.
- Logs do Engine desde a tomada do GSA News: nenhum erro de áudio, timestamp, DTS/PTS, fila, corrupção ou buffer.
- Recursos: 16 GiB disponíveis; encoder usando cerca de 186% de CPU em 4 vCPUs, sem evidência de saturação que interrompa o sinal.
- Correção da conclusão provisória anterior: os dados não sustentam falha no transporte RTMP nem na transcodificação do YouTube. O retorno codificado é contínuo e corresponde ao arquivo-fonte.
- Hipótese remanescente mais provável para o estalo percebido: etapa de reprodução do cliente (aplicativo/navegador/TV/telefone, saída de áudio ou conexão local) ou percepção de transientes já existentes no conteúdo após o processamento do aparelho. Deve ser testado simultaneamente em outro dispositivo/rede antes de alterar o encoder.
- Nenhuma correção foi aplicada nesta auditoria porque não foi demonstrado defeito no encoder/RTMP; alterar o caminho neste ponto introduziria risco sem causa comprovada.
`;
const encoded=Buffer.from(entry).toString('base64');
const result=await runSshScript(`set -eu
printf '%s' '${encoded}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
tail -n 22 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`,30000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
