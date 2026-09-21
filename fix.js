
const fs = require('fs');
['server_webhook_vps_live.cjs', 'server_webhook.cjs'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    /case 'IDENTIFIED':\s*case 'AWAITING_ACTION':\s*\{\s*callGeminiProtocolNLU\(text, \(errNlu, nlu\) => \{/,
    \case 'IDENTIFIED':
    case 'AWAITING_ACTION': {
      let _overridenText = text;
      const _t = (text || '').trim();
      if (_t === '1') _overridenText = 'alterar';
      else if (_t === '2') _overridenText = 'cancelar';
      else if (_t === '3') _overridenText = 'consultar';
      
      callGeminiProtocolNLU(_overridenText, (errNlu, nlu) => {\
  );
  fs.writeFileSync(file, content);
});
console.log('Fixed IDENTIFIED cases.');

