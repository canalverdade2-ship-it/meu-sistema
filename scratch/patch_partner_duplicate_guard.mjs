import fs from 'node:fs';
import path from 'node:path';

const root = String.raw`C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`;
const servicePath = path.join(root, 'src/features/partners/service.ts');
const modalPath = path.join(root, 'src/components/public/PartnerBenefitRedeemModal.tsx');
let text = fs.readFileSync(servicePath, 'utf8');

let pattern = /\n  \/\/ 1\. Checar duplicidade caso não seja forçado \(override\)[\s\S]*?\n  const rpcParams/;
let replacement = `
  const duplicateJustification = payload.justificativaDuplicidade?.trim() || '';
  const isDuplicateOverride = Boolean(payload.forceOverride && duplicateJustification);
  if (payload.forceOverride && !duplicateJustification) {
    throw new Error('Informe uma justificativa para solicitar o benefício novamente.');
  }

  const rpcParams`;
if (!pattern.test(text)) throw new Error('precheck marker not found');
text = text.replace(pattern, replacement);
pattern = /  let \{ data, error \} = await supabase\.rpc\('gsa_public_resgatar_beneficio_parceiro', rpcParams\);[\s\S]*?\n  if \(error\) \{/;
replacement = `  if (isDuplicateOverride) {
    rpcParams.p_justificativa = duplicateJustification;
  }

  const rpcName = isDuplicateOverride
    ? 'gsa_public_resgatar_beneficio_parceiro_em_analise'
    : 'gsa_public_resgatar_beneficio_parceiro';

  let { data, error } = await supabase.rpc(rpcName, rpcParams);

  // Compatibilidade apenas para instalações antigas da RPC normal.
  if (!isDuplicateOverride && error && error.message &&
      (error.message.includes('p_email') || error.code === 'PGRST202' || error.message.includes('parameters'))) {
    delete rpcParams.p_email;
    const retry = await supabase.rpc('gsa_public_resgatar_beneficio_parceiro', rpcParams);
    data = retry.data;
    error = retry.error;
  }

  if (error) {`;
if (!pattern.test(text)) throw new Error('rpc marker not found');
text = text.replace(pattern, replacement);
pattern = /\n  \/\/ 2\. Se for um override de duplicidade, marcamos o registro para análise[\s\S]*?\n  const partnerName/;
if (!pattern.test(text)) throw new Error('direct update marker not found');
text = text.replace(pattern, '\n  const partnerName');

const whatsappMarker = `  if (isDelay24h) {
    // 1. Envia notificação de WhatsApp para o cliente informando o prazo de 24h de forma limpa e agradável`;
const whatsappReplacement = `  if (result?.status === 'analise') {
    // Duplicidade justificada: aguarda decisão administrativa antes de enviar mensagem de liberação.
  } else if (isDelay24h) {
    // 1. Envia notificação de WhatsApp para o cliente informando o prazo de 24h de forma limpa e agradável`;
if (!text.includes(whatsappMarker)) throw new Error('WhatsApp guard marker not found');
text = text.replace(whatsappMarker, whatsappReplacement);
fs.writeFileSync(servicePath, text, 'utf8');

let mtext = fs.readFileSync(modalPath, 'utf8');
const toastMarker = `toast.success('Benefício registrado com sucesso!', { duration: 4000 });`;
if (!mtext.includes(toastMarker)) throw new Error('success toast marker not found');
mtext = mtext.replace(toastMarker, `toast.success(res?.status === 'analise' ? 'Solicitação enviada para análise!' : 'Benefício registrado com sucesso!', { duration: 4000 });`);
const errorMarker = `      setRegisteredData({
        nome: trimmedNome,
        email: trimmedEmail,
        telefone: telefone.trim()
      });
      setShowSuccessPopup(true);
      toast.success('Solicitação registrada com sucesso!', { duration: 4000 });`;
const errorReplacement = `      setShowSuccessPopup(false);
      toast.error(err?.message || 'Não foi possível registrar a solicitação. Tente novamente.');`;
if (!mtext.includes(errorMarker)) throw new Error('error handler marker not found');
mtext = mtext.replace(errorMarker, errorReplacement);

mtext = mtext.replace('<span>Solicitação Confirmada</span>', `<span>{redemptionResult?.status === 'analise' ? 'Solicitação em Análise' : 'Solicitação Confirmada'}</span>`);
mtext = mtext.replace('              Benefício Solicitado!', `              {redemptionResult?.status === 'analise' ? 'Novo Resgate em Análise' : 'Benefício Solicitado!'}`);
mtext = mtext.replace(
  '                  Seu link de ativação exclusivo será gerado e enviado diretamente no seu WhatsApp.',
  `                  {redemptionResult?.status === 'analise'\n                    ? 'Sua justificativa foi registrada. O benefício só será liberado após análise administrativa.'\n                    : 'Seu link de ativação exclusivo será gerado e enviado diretamente no seu WhatsApp.'}`,
);
mtext = mtext.replace('                      2. Emissão', `                      {redemptionResult?.status === 'analise' ? '2. Análise' : '2. Emissão'}`);
fs.writeFileSync(modalPath, mtext, 'utf8');

for (const file of [servicePath, modalPath]) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('\uFFFD')) throw new Error(`replacement char found in ${file}`);
}
console.log('PATCH_OK');
