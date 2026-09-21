import { runSshScript } from './ssh2-run.mjs';

const note = `
## 2026-09-07 — Auditoria: painel Master x YouTube e processo diagnóstico residual

- Investigada a hipótese de que o áudio estivesse estalando devido ao sinal ser exibido simultaneamente no painel Master e no YouTube.
- Arquitetura confirmada: existe um único processo produtor/codificador. A saída tee entrega o mesmo sinal codificado para (1) o pipe MPEG-TS do único publicador RTMP persistente e (2) o HLS local /runtime/hls/program.m3u8 consumido pelo painel.
- O painel é leitor do retorno HLS; não existe um segundo encoder nem um segundo publicador RTMP criado para a tela do painel. Portanto, a exibição do painel não divide potência nem altera os pacotes enviados ao YouTube.
- Observação operacional: se o áudio do painel e o áudio do YouTube estiverem audíveis simultaneamente no mesmo aparelho ou em aparelhos próximos, os retornos com atrasos diferentes podem se sobrepor e soar metálicos, com eco ou aparentes estalos. Teste correto: deixar somente um deles audível.
- Achado desta verificação: permaneceu órfão um processo temporário da auditoria anterior decodificando continuamente o áudio do arquivo GSA News para PCM. Ele consumia aproximadamente 97% de um núcleo e não fazia parte da transmissão.
- Os PIDs 3985077 e 3985120 foram conferidos pela linha de comando e encerrados de forma direcionada. Nenhum processo de transmissão foi reiniciado.
- Após a remoção permanecem somente: produtor FFmpeg principal, publicador RTMP persistente único e ffplayout. Encoder externo/PID RTMP foi preservado.
- A remoção do processo diagnóstico devolveu folga de CPU, mas a confirmação perceptiva do estalo deve ser feita ouvindo apenas o YouTube, com o retorno do painel completamente mudo/fechado.
`;

const payload = Buffer.from(note, 'utf8').toString('base64');
const result = await runSshScript(`printf '%s' '${payload}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo tail -n 28 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`, 30000);

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
