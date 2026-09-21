import fs from 'node:fs';
const root='C:/Users/Adriano Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)/src/components/client/';
const patches={
'ClientMeuCredito.tsx':[
['O administrador terá até 72 horas para aprovar ou recusar a liberação.','O sistema terá até 72 horas para aprovar ou recusar a liberação.'],
['somente ficará disponível depois da aprovação administrativa.','somente ficará disponível depois da aprovação do sistema.'],
['Aguarde enquanto o administrador carrega o contrato de crédito para sua assinatura.','Aguarde enquanto o sistema prepara o contrato de crédito para sua assinatura.'],
['A liberação depende de aprovação administrativa, com prazo de análise de até 72 horas.','A liberação depende de aprovação do sistema, com prazo de análise de até 72 horas.']
],
'ClientEmprestimos.tsx':[
['Ele entrará em análise pelo administrador.','Ele entrará em análise pelo sistema.'],
['O administrador retornará em até 5 dias úteis com o valor final com desconto.','O sistema retornará em até 5 dias úteis com o valor final com desconto.'],
['até a conclusão da alteração pelos administradores.','até a conclusão da alteração pelo sistema.']
],
'ClientPremios.tsx':[
['Nossa equipe administrativa receberá seu pedido de resgate imediatamente.','O sistema receberá seu pedido de resgate imediatamente.'],
['Nossa equipe administrativa está processando seu resgate.','O sistema está processando seu resgate.']
]};patches['ClientPontos.tsx']=[['Aguardando Aprovação Administrativa','Aguardando Aprovação do Sistema']];
patches['CreditDisputeModal.tsx']=[['Decisão administrativa','Decisão do sistema']];
patches['StoreHub.tsx']=[['A equipe administrativa da GSA está cadastrando o endereço de postagem','O sistema da GSA está cadastrando o endereço de postagem']];
patches['financeiro/ExtratoList.tsx']=[['Aguardando Aprovação Administrativa','Aguardando Aprovação do Sistema']];
patches['marketplace/classifieds/ClassifiedDetailPage.tsx']=[['até a liberação administrativa.','até a liberação do sistema.']];
for(const [rel,repls] of Object.entries(patches)){
 const file=root+rel; let text=fs.readFileSync(file,'utf8');
 for(const [a,b] of repls){ if(!text.includes(a)) throw new Error(`${rel}: trecho não encontrado: ${a}`); text=text.replace(a,b); }
 fs.writeFileSync(file,text,'utf8'); console.log(`OK ${rel}`);
}
