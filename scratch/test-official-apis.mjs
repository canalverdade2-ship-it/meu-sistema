import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
echo "=== TESTE API BANCO CENTRAL DO BRASIL (OFICIAL) ==="
# Dolar PTAX oficial direto do Banco Central (PTAX venda)
curl -s "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='09-02-2026'&\$top=1&\$format=json" | head -c 300
echo ""

echo "=== TESTE INMET (PREVISÃO DO TEMPO CAPITAIS) ==="
curl -s "https://apiprevmet3.inmet.gov.br/previsao/capitais" | head -c 300
echo ""
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
