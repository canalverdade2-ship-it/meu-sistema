import { runSshScript } from './ssh2-run.mjs';

const note = `
## 2026-09-07 03:38Z — Correção controlada de microestalos: retirada da compensação assíncrona

- Operador confirmou que os estalos persistiam mesmo com o retorno do painel isolado; hipótese de áudio simultâneo descartada.
- Revisão da cadeia encontrou ainda ativo no produtor o filtro aresample com async=1. Como a fonte atual contém áudio e vídeo no mesmo arquivo/relógio, essa compensação é desnecessária e poderia inserir ou remover microamostras para perseguir o clock, produzindo clicks sem perda de pacotes.
- Processo residual de auditoria que consumia cerca de 97% de um núcleo já havia sido removido antes desta alteração.
- Control Plane atualizado de 1.8.2 para 1.8.3. Filtro anterior: aresample=48000:async=1:min_hard_comp=0.100:first_pts=0 + alimiter. Novo filtro: aresample=48000:first_pts=0 + o mesmo alimiter broadcast.
- Backups datados do app.js e compose.yml foram preservados antes da implantação.
- O mesmo GSA News aprovado foi reaplicado por media_take para ativar o novo filtro. Job 58c23c20-7149-4e76-8ccf-1d54ce9ff8da concluído.
- Validação de continuidade: outer RTMP permaneceu PID 18 antes/depois; producer interno passou ao PID 53122; exatamente 1 publicador; canal online/running/sending; HLS fresco; nenhum erro recente de timestamp, corrupção, fila ou descarte.
- A sessão RTMP com o YouTube não foi recriada e nenhum segundo encoder foi aberto.
- Pendente confirmação auditiva do operador no retorno público após a latência normal do YouTube.
`;

const payload = Buffer.from(note, 'utf8').toString('base64');
const result = await runSshScript(`printf '%s' '${payload}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo tail -n 22 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`, 30000);
process.stdout.write(result.stdout || '');
