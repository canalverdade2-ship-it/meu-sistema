import { runSshScript } from './ssh2-run.mjs';

const programs = [
  'GSA Manhã News','GSA Meio Dia News','GSA News Noite','GSA News Especial','GSA Mercado','GSA Tempo','GSA Cidadania','GSA Business','GSA Tech','GSA Motor','GSA Agro','GSA Mundo','GSA Destinos','GSA Destinos do Mundo','GSA Bem Viver','GSA Sabor','GSA Em Fé','GSA Em Fé Reflexão','GSA Histórias da Bíblia','GSA Noite de Louvor','GSA Music','GSA Tá na Rede','GSA Tá na Rede Web','GSA Esportes','GSA Cinema','GSA Sessão Pipoca','GSA Desenhos Clássicos','GSA Doc','GSA Documentário Especial','GSA Planeta Terra','GSA Mistérios','GSA Motivação'
];

const inventoryRows = programs.map(p => `| ${p} | AUSENTE | AUSENTE | AUSENTE | AUSENTE | Produzir as quatro peças oficiais e submeter a QC |`).join('\n');
const castingRows = programs.map(p => `| ${p} | A definir conforme formato | A definir | A definir | A definir | A definir | A definir | Não aprovado |`).join('\n');

const inventory = `# GSA TV — Inventário Canônico de Identidades dos Programas

Data-base: 04/09/2026

Fonte canônica: grade semanal habilitada do Painel Master, consolidada em 32 identidades de marca.

## Regras

- Todo nome começa por **GSA**.
- **GSA Entrevista** está removido e não pode reaparecer.
- Quadros horários de GSA Em Fé não são logos independentes.
- Faixa 1 e Faixa 2 são variações de GSA Music, não programas distintos.
- Cada programa requer quatro peças MASTER Full HD próprias: abertura, “Estamos apresentando”, “Voltamos a apresentar” e encerramento.
- Arquivos e vinhetas existentes são somente testes/referências; nenhum é identidade oficial aprovada.
- A abertura e o encerramento do GSA News também precisam ser produzidos oficialmente.
- Programas com apresentação têm avatar, voz, figurino-base e cenário fixos por identidade aprovada.
- Cada apresentador possui voz própria e exclusiva; não se reutiliza automaticamente uma voz masculina e uma feminina em toda a grade.
- Avatares, vozes e cenários só se tornam oficiais após teste e aprovação.

## Inventário

| Programa | Abertura | Estamos apresentando | Voltamos a apresentar | Encerramento | Observação |
|---|---|---|---|---|---|
${inventoryRows}

## Totais

- Identidades canônicas: 32
- Masters necessários: 128
- Masters oficiais aprovados: 0
- Situação oficial: 128 masters pendentes.
- Nenhum teste existente pode ser promovido ou exibido como identidade oficial.
`;

const casting = `# GSA TV — Cadastro Mestre de Elenco, Vozes e Cenários

Data-base: 04/09/2026

## Regra editorial permanente

- Cada apresentador terá avatar exclusivo, voz própria e cenário-base fixo.
- Uma voz não será reutilizada como padrão automático em vários apresentadores.
- A voz será escolhida de acordo com função, idade percebida, ritmo, emoção e perfil editorial do programa.
- A aprovação exige teste de naturalidade, português brasileiro, nomes próprios, números, siglas, emoção e inteligibilidade.
- A identidade aprovada será registrada com o identificador real do provedor; descrições genéricas não bastam.
- Para o GSA News em produção: apresentador masculino usa **Holt** e apresentadora feminina usa **Nyla**, ambos nativos do Google Vids, com os avatares e o cenário fixos já determinados.
- Outros telejornais não herdam Holt/Nyla automaticamente; terão elenco e vozes próprias.
- Programas sem apresentador em tela podem usar locução editorial exclusiva, mas isso deve ser registrado separadamente de um apresentador.

## Cadastro canônico

| Programa | Função / quantidade | Nome artístico | Avatar oficial | Voz oficial | Provedor | Cenário-base | Estado |
|---|---|---|---|---|---|---|---|
${castingRows}

## GSA News — identidade já determinada

| Função | Avatar | Voz | Provedor | Cenário | Estado |
|---|---|---|---|---|---|
| Âncora masculino | Avatar masculino fixo aprovado no projeto Vids | Holt | Google Vids | Estúdio GSA News azul-marinho e dourado, bancada e posições fixas | Regra aprovada; confirmar identificador técnico do avatar |
| Âncora feminina | Avatar feminino fixo aprovado no projeto Vids | Nyla | Google Vids | Estúdio GSA News azul-marinho e dourado, bancada e posições fixas | Regra aprovada; confirmar identificador técnico do avatar |

## Critério de conclusão

Um elenco só será marcado **Aprovado** quando avatar, voz, cenário, função e amostra de áudio/vídeo estiverem identificados e validados. Até lá, permanece como candidato e não deve ser publicado como oficial.
`;

const note = `\n\n## 2026-09-04 — Cadastro mestre de vozes exclusivas e reparo da documentação\n\n- Confirmada a regra: cada apresentador de cada programa terá voz diferente, própria e permanente; não haverá apenas uma voz masculina e uma feminina repetidas em toda a grade.\n- Criado o cadastro mestre em /home/opc/gsa-ai/docs/GSA_TV_CASTING_MASTER_2026-09-04.md.\n- O cadastro separa apresentador em tela de locução editorial e proíbe promover candidatos antes de teste e aprovação.\n- GSA News permanece com Holt/Nyla nativos do Vids e avatares/cenário fixos; os identificadores técnicos exatos dos avatares ainda precisam ser confirmados.\n- Outros programas não herdam Holt/Nyla automaticamente.\n- Corrigida a tabela quebrada do inventário de identidades; agora as seis colunas e os quatro estados AUSENTE estão completos para os 32 programas.\n- Estado oficial preservado: 128 peças de identidade ainda pendentes e nenhuma promovida indevidamente.\n- Nenhuma modificação foi feita no encoder ou no sinal ao vivo nesta atualização documental.\n`;

const payload = Buffer.from(JSON.stringify({ inventory, casting, note }), 'utf8').toString('base64');
const script = `printf '%s' '${payload}' | base64 -d >/tmp/gsa-casting-payload.json\npython3 - <<'PY'\nimport json\nfrom pathlib import Path\ndata=json.loads(Path('/tmp/gsa-casting-payload.json').read_text(encoding='utf-8'))\nPath('/home/opc/gsa-ai/docs/GSA_PROGRAM_IDENTITY_MASTER_2026-09-04.md').write_text(data['inventory'],encoding='utf-8')\nPath('/home/opc/gsa-ai/docs/GSA_TV_CASTING_MASTER_2026-09-04.md').write_text(data['casting'],encoding='utf-8')\nwith Path('/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md').open('a',encoding='utf-8') as f:f.write(data['note'])\nPY\nrm -f /tmp/gsa-casting-payload.json\nwc -l /home/opc/gsa-ai/docs/GSA_PROGRAM_IDENTITY_MASTER_2026-09-04.md /home/opc/gsa-ai/docs/GSA_TV_CASTING_MASTER_2026-09-04.md\ntail -n 12 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`;

const result = await runSshScript(script, 60000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
