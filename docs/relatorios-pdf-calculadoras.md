# Relatórios PDF das Calculadoras Públicas

As seis calculadoras públicas permitem gerar um relatório nos modos Free e Pro.

## Comportamento

- O relatório Free contém somente os campos e resultados simples disponíveis na consulta gratuita.
- O relatório Pro contém os dados informados, a memória detalhada, critérios, pendências e documentos aplicáveis à ferramenta.
- O PDF é montado no navegador com jsPDF.
- O arquivo é convertido em um Blob temporário e baixado no dispositivo.
- A URL temporária é revogada após o download.
- Nenhum PDF ou dado do relatório é enviado ao Supabase, a uma Edge Function ou a outro servidor.
- Nenhum arquivo é salvo no banco, Storage, localStorage ou sessionStorage.
- Um novo relatório somente é criado quando a pessoa clicar novamente em **Gerar relatório PDF**.

## Calculadoras atendidas

1. Rescisão trabalhista.
2. Aposentadoria pelo INSS.
3. Férias.
4. 13º salário.
5. Benefícios do INSS.
6. BPC / LOAS.

## Validação

O teste `scripts/check-free-tools-pdf-contracts.ts` valida a assinatura do arquivo PDF, a existência de páginas, a geração de conteúdo e a ausência de chamadas de persistência ou envio no gerador.
