# Padrão institucional de arquivos — GSA HUB

## Objetivo

Todos os arquivos gerados pelo sistema devem parecer uma extensão natural da experiência institucional do GSA HUB. A qualidade não se limita à resolução: inclui estrutura, legibilidade, integridade dos dados, impressão, metadados, nomenclatura, segurança e previsibilidade operacional.

## Planilhas Excel

As exportações destinadas à análise humana devem usar `.xlsx` real. CSV permanece aceito somente como formato técnico de integração, quando houver exigência explícita do sistema destinatário.

Requisitos mínimos:

- identidade GSA HUB em azul-marinho, marfim e dourado controlado;
- título, subtítulo, data e hora de emissão, período, origem e filtros aplicados;
- indicadores de resumo distribuídos em faixas mescladas, sem sobreposição ou células espremidas;
- números inteiros sem casas decimais artificiais;
- cabeçalho congelado e filtro automático;
- larguras de coluna compatíveis com o conteúdo;
- quebra de texto e alinhamento por tipo de dado;
- formatos nativos para moeda BRL, números, percentuais, datas e horários;
- linhas alternadas, bordas discretas e impressão em A4;
- repetição do cabeçalho em páginas impressas;
- cabeçalho e rodapé com identificação e paginação;
- neutralização de conteúdo textual que possa ser interpretado como fórmula;
- nomes de arquivos consistentes, sem caracteres inválidos e com data de emissão.

## Documentos PDF

Requisitos mínimos:

- geração real em PDF, sem usar a caixa de impressão do navegador como gerador;
- metadados de título, assunto, autor, criador e palavras-chave;
- cabeçalho institucional e linha de assinatura visual dourada;
- data e hora de emissão, período, filtros e origem;
- tabelas estruturadas com cabeçalho repetido e quebra automática de páginas;
- orientação retrato ou paisagem conforme a quantidade de colunas;
- rodapé de classificação, paginação e margens seguras;
- compressão habilitada e uso apenas das fontes necessárias;
- valores, percentuais e datas apresentados em padrão brasileiro;
- conteúdo completo, não limitado à paginação visual da tela.

## Integridade funcional

A padronização de arquivos não pode alterar:

- consultas e dados de origem;
- cálculos e totalizadores;
- filtros selecionados;
- permissões, autenticação, RLS ou visibilidade;
- regras de negócio e estados dos módulos;
- armazenamento local ou remoto definido pelo fluxo existente.

## Validação obrigatória

Antes da integração, cada frente deve comprovar:

1. arquivo vazio bloqueado com mensagem clara;
2. arquivo com uma linha válido;
3. arquivo extenso com múltiplas páginas válido;
4. acentos, caracteres especiais e textos longos preservados;
5. moeda, datas, percentuais e números corretos;
6. cabeçalho, rodapé, paginação e filtros presentes;
7. abertura em leitores comuns de PDF e Excel;
8. TypeScript e build sem regressão causada pela frente;
9. ausência de `window.print()` como mecanismo de PDF;
10. ausência de CSV como relatório humano principal;
11. revisão visual renderizada sem cortes, sobreposições ou pontuação numérica residual.

## Evidência desta implementação

A amostra automatizada final foi gerada e reaberta em navegador real. A planilha apresentou cartões de resumo separados, inteiro sem pontuação residual, moeda, percentual, data e hora formatados, cabeçalho congelado, filtro automático e fórmula textual neutralizada. O PDF apresentou duas páginas, cabeçalho e rodapé repetidos, paginação, tabela sem cortes e metadados institucionais.
