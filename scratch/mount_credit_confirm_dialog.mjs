import fs from 'node:fs';
const file = 'C:/Users/Adriano Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)/src/components/client/ClientMeuCredito.tsx';
let text = fs.readFileSync(file, 'utf8');
const oldText = '  return (\r\n    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">\r\n      {isEmAndamento && (';
const newText = '  return (\r\n    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">\r\n      <ConfirmDialog {...confirmHook} />\r\n      {isEmAndamento && (';
if (!text.includes(oldText)) throw new Error('Main return anchor not found');
text = text.replace(oldText, newText);
fs.writeFileSync(file, text, 'utf8');
console.log('CONFIRM_DIALOG_MOUNTED_MAIN_RETURN');