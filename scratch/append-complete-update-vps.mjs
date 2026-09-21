import { runSshScript } from './ssh2-run.mjs';

const entry = `

## 2026-09-06 08:40 BRT — ATUALIZAÇÃO CONSOLIDADA ATÉ ESTE SEGUNDO

### Retificação obrigatória do registro de 08:31

- A interpretação inicial de que o usuário queria retirar o selo AO VIVO estava incorreta. O usuário se referia à faixa preta inferior, não ao selo vermelho pequeno.
- O selo vermelho AO VIVO foi imediatamente restaurado para \`enabled=true\` e deve continuar disponível conforme a operação aprovada.
- A imagem real do HLS foi capturada e confirmou o defeito: a faixa inferior exibia o texto administrativo \`Selo AO VIVO (Abaixo do Logo)\`, enquanto o selo vermelho correto também aparecia sob a mosca.
- Causa raiz: a camada especial \`preset=live_badge\` estava sendo processada duas vezes — pelo renderizador dedicado do selo e também pelo caminho genérico de \`lower_third\`.
- Correção estrutural aplicada no Control Plane \`1.8.2\`: camadas \`lower_third\` com \`preset=live_badge\` são ignoradas exclusivamente no renderizador genérico, preservando a renderização dedicada do selo.
- Validação visual posterior: a faixa preta inferior desapareceu e o selo vermelho AO VIVO permaneceu corretamente abaixo da mosca GSA TV.
- O job \`graphics_reload\` concluiu com sucesso. O produtor interno foi recriado para aplicar o grafo corrigido, mas o transportador RTMP externo permaneceu no mesmo PID 18.
- Pós-correção: Engine saudável, HLS fresco, sem fallback, lock saudável e exatamente um publicador RTMP.

### Migração e estabilidade aplicadas nesta etapa

- Encoder Engine promovido para \`gsa-tv/encoder-engine:1.2.0\`, com serialização de operações, health real do transportador/produtor/HLS, reconciliação do advisory lock e proteção contra publicador duplicado.
- Watchdog promovido para \`gsa-tv/watchdog:1.3.0\`, observando o HLS final, conteúdo real em execução, jobs abandonados e idade das amostras.
- Control Plane promovido sucessivamente para \`1.8.0\`, \`1.8.1\` e agora \`1.8.2\`.
- Control Plane: tomada de mídia exige \`ready + approved + rights_ok\`, valida SHA-256, aplica lease/TTL e não restaura \`media:\` transitório após reinício.
- Compilador de grade corrigido em \`1.8.1\` para fracionar filler técnico em blocos reais de aproximadamente 600 segundos, sem declarar um arquivo curto como conteúdo contínuo de várias horas.
- Grade recompilada com 36 blocos editoriais/dia e 148 itens técnicos/dia, preservando horários e nomes oficiais.
- Frontend: comandos da mesa agora aguardam o resultado terminal real do job e não exibem sucesso sintético/otimista.
- Painel: diferencia corretamente relay enviando de YouTube publicamente confirmado; o status AO VIVO depende da confirmação pública.
- Contratos automatizados: 68 verificações aprovadas. Build do frontend concluído anteriormente sem erro e servidor local do painel permanece ativo na porta 3000.

### Segurança, backup e operação

- Portas públicas desnecessárias removidas do firewall; permanecem 80/tcp, 443/tcp e 8080/tcp.
- Chaves TLS protegidas com modo 0600; segredos do ffplayout protegidos com modo 0440 e grupos dos containers correspondentes.
- Rotação futura dos logs do Encoder Engine configurada em 10 MB, máximo de 5 arquivos.
- Script de backup integral substituído por versão atômica com banco PostgreSQL, SQLite, Control Plane, Encoder Engine, Watchdog e estado do encoder, seguida de teste de restauração e integridade.
- Execuções antigas órfãs de backup foram reconciliadas como falhas auditadas.
- O novo backup integral iniciado às 11:11 UTC ainda está em execução neste checkpoint devido ao volume do cache de mídia; não deve ser declarado concluído antes do estado \`restored_test\`.
- Alertas permanecem habilitados, mas sem destinatário WhatsApp configurado; notificações externas dependem do número aprovado pelo usuário.
- Existem blocos futuros publicados sem mídia editorial vinculada; a continuidade técnica evita tela preta, mas a produção/vinculação dos episódios reais continua necessária.

### Chamada oficial da grade no Google Vids

- Projeto criado com o nome \`GSA TV — Chamada Oficial da Grade de Programação\`.
- Formato definido: horizontal 16:9, 1080p30, linguagem de chamada televisiva profissional.
- Programas, apresentadores, nomes artísticos, avatares, vozes, cenários e sinopses existentes são 100% aprovados e devem ser usados sem renomear, reinterpretar ou criar variações.
- Regra absoluta: a chamada será composta 100% por vídeos em movimento. Fotografias, imagens estáticas e slides estáticos são proibidos.
- Logos, nomes e textos serão grafismos animados sobre vídeo; apresentadores aparecerão em vídeo com seus avatares, vozes e cenários oficiais.
- Estrutura editorial prevista: abertura institucional; núcleo News; informação/economia/cidadania/tecnologia; agro/mundo/destinos/bem-estar/culinária; fé; entretenimento/internet/esportes/cinema/família; encerramento institucional.
- A criação permanece em andamento; nenhum vídeo final foi declarado concluído ou colocado no ar neste checkpoint.
`;

const payload = Buffer.from(entry, 'utf8').toString('base64');
const result = await runSshScript(`set -eu
printf '%s' '${payload}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo tail -n 88 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
