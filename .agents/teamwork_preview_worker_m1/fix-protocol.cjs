const fs = require('fs');
let text = fs.readFileSync('src/components/public/ProtocolConsultPage.tsx', 'utf8');

const remainingMap = [
  [/Sess\uFFFD\uFFFDo de verifica\uFFFD\uFFFDo expirada/g, 'Sessão de verificação expirada'],
  [/Sess\uFFFD\uFFFD o de verifica\uFFFD\uFFFD o expirada/g, 'Sessão de verificação expirada'],
  [/Sess\uFFFDo de verifica\uFFFD\uFFFDo expirada/g, 'Sessão de verificação expirada'],
  [/Bot\uFFFDo de Abertura/g, 'Botão de Abertura'],
  [/Bot\uFFFD\uFFFDo de Abertura/g, 'Botão de Abertura'],
  [/Voc\uFFFDe contestar esta decis\uFFFDo apresentando uma justificativa e at\uFFFD 3 documentos comprobat\uFFFDrios/g, 'Você pode contestar esta decisão apresentando uma justificativa e até 3 documentos comprobatórios'],
  [/Voc\uFFFD pode contestar esta decis\uFFFDo apresentando uma justificativa e at\uFFFD 3 documentos comprobat\uFFFDrios/g, 'Você pode contestar esta decisão apresentando uma justificativa e até 3 documentos comprobatórios'],
  [/Voc\uFFFD pode contestar esta decis\uFFFD\uFFFDo apresentando uma justificativa e at\uFFFD 3 documentos comprobat\uFFFDrios/g, 'Você pode contestar esta decisão apresentando uma justificativa e até 3 documentos comprobatórios'],
  [/Parecer da Decis\uFFFDo:/g, 'Parecer da Decisão:'],
  [/Parecer da Decis\uFFFD\uFFFDo:/g, 'Parecer da Decisão:'],
  [/Sua contesta\uFFFD\uFFFDo foi aprovada pela diretoria\. A solicita\uFFFD\uFFFDo retornou para o fluxo de emiss\uFFFDo do benef\uFFFDcio\./g, 'Sua contestação foi aprovada pela diretoria. A solicitação retornou para o fluxo de emissão do benefício.'],
  [/Clique no bot\uFFFDo abaixo para abrir a p\uFFFDgina de ativa\uFFFD\uFFFDo do parceiro e usufruir de todas as condi\uFFFD\uFFFDes especiais\./g, 'Clique no botão abaixo para abrir a página de ativação do parceiro e usufruir de todas as condições especiais.'],
  [/Indicador de Conclus\uFFFDo \/ Em Andamento \/ Pendente/g, 'Indicador de Conclusão / Em Andamento / Pendente'],
  [/ETAPA 2: EMISS\uFFFDO \(EM ANDAMENTO - ANIMADO\)/g, 'ETAPA 2: EMISSÃO (EM ANDAMENTO - ANIMADO)'],
  [/2\. Emiss\uFFFDo/g, '2. Emissão'],
  [/Data de Conclus\uFFFDo:/g, 'Data de Conclusão:'],
  [/Insira o c\uFFFDdigo do protocolo recebido no momento do resgate para acompanhar a emiss\uFFFDo e o envio do link no WhatsApp\./g, 'Insira o código do protocolo recebido no momento do resgate para acompanhar a emissão e o envio do link no WhatsApp.'],
  [/Orienta\uFFFD\uFFFDo sobre recurso único/g, 'Orientação sobre recurso único'],
  [/Bot\uFFFDo para Adicionar Arquivo/g, 'Botão para Adicionar Arquivo'],
  [/Bot\uFFFD\uFFFDes de A\uFFFD\uFFFDo/g, 'Botões de Ação'],
  [/Bot\uFFFDes de A\uFFFDo/g, 'Botões de Ação'],
  [/Bot\uFFFDes de A\uFFFD\uFFFDo/g, 'Botões de Ação'],
];

for (const [pattern, replacement] of remainingMap) {
  text = text.replace(pattern, replacement);
}

fs.writeFileSync('src/components/public/ProtocolConsultPage.tsx', text, 'utf8');

const check = fs.readFileSync('src/components/public/ProtocolConsultPage.tsx', 'utf8');
let remaining = 0;
check.split('\n').forEach((l, i) => {
  if (l.includes('\uFFFD')) {
    console.log('Remaining at line ' + (i+1) + ': ' + l);
    remaining++;
  }
});
console.log('Total remaining issues:', remaining);
