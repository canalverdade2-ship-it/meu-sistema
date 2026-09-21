from pathlib import Path
import re

root = Path(r"C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)")
service = root / "src/features/partners/service.ts"
modal = root / "src/components/public/PartnerBenefitRedeemModal.tsx"

text = service.read_text(encoding="utf-8")

pattern = re.compile(r"\n  // 1\. Checar duplicidade caso não seja forçado \(override\).*?\n  const rpcParams", re.S)
replacement = """
  const duplicateJustification = payload.justificativaDuplicidade?.trim() || '';
  const isDuplicateOverride = Boolean(payload.forceOverride && duplicateJustification);
  if (payload.forceOverride && !duplicateJustification) {
    throw new Error('Informe uma justificativa para solicitar o benefício novamente.');
  }

  const rpcParams"""
text, count = pattern.subn(replacement, text, count=1)
assert count == 1, f"precheck replacement count={count}"
pattern = re.compile(
    r"  let \{ data, error \} = await supabase\.rpc\('gsa_public_resgatar_beneficio_parceiro', rpcParams\);.*?\n  if \(error\) \{",
    re.S,
)
replacement = """  if (isDuplicateOverride) {
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

  if (error) {"""
text, count = pattern.subn(replacement, text, count=1)
assert count == 1, f"rpc replacement count={count}"
pattern = re.compile(
    r"\n  // 2\. Se for um override de duplicidade, marcamos o registro para análise.*?\n  const partnerName",
    re.S,
)
text, count = pattern.subn("\n  const partnerName", text, count=1)
assert count == 1, f"direct update removal count={count}"

old = """  if (isDelay24h) {
    // 1. Envia notificação de WhatsApp para o cliente informando o prazo de 24h de forma limpa e agradável"""
new = """  if (result?.status === 'analise') {
    // Duplicidade justificada: aguarda decisão administrativa antes de enviar mensagem de liberação.
  } else if (isDelay24h) {
    // 1. Envia notificação de WhatsApp para o cliente informando o prazo de 24h de forma limpa e agradável"""
assert text.count(old) == 1, "analysis WhatsApp guard marker not found"
text = text.replace(old, new, 1)

service.write_text(text, encoding="utf-8")

mtext = modal.read_text(encoding="utf-8")
mtext = mtext.replace(
    "toast.success('Benefício registrado com sucesso!', { duration: 4000 });",
    "toast.success(res?.status === 'analise' ? 'Solicitação enviada para análise!' : 'Benefício registrado com sucesso!', { duration: 4000 });",
    1,
)
old = """      setRegisteredData({
        nome: trimmedNome,
        email: trimmedEmail,
        telefone: telefone.trim()
      });
      setShowSuccessPopup(true);
      toast.success('Solicitação registrada com sucesso!', { duration: 4000 });"""
new = """      setShowSuccessPopup(false);
      toast.error(err?.message || 'Não foi possível registrar a solicitação. Tente novamente.');"""
assert mtext.count(old) == 1, "non-duplicate error handler marker not found"
mtext = mtext.replace(old, new, 1)

mtext = mtext.replace(
    '<span>Solicitação Confirmada</span>',
    "<span>{redemptionResult?.status === 'analise' ? 'Solicitação em Análise' : 'Solicitação Confirmada'}</span>",
    1,
)
mtext = mtext.replace(
    '              Benefício Solicitado!',
    "              {redemptionResult?.status === 'analise' ? 'Novo Resgate em Análise' : 'Benefício Solicitado!'}",
    1,
)
mtext = mtext.replace(
    '                  Seu link de ativação exclusivo será gerado e enviado diretamente no seu WhatsApp.',
    "                  {redemptionResult?.status === 'analise'\n                    ? 'Sua justificativa foi registrada. O benefício só será liberado após análise administrativa.'\n                    : 'Seu link de ativação exclusivo será gerado e enviado diretamente no seu WhatsApp.'}",
    1,
)
mtext = mtext.replace(
    '                      2. Emissão',
    "                      {redemptionResult?.status === 'analise' ? '2. Análise' : '2. Emissão'}",
    1,
)

modal.write_text(mtext, encoding="utf-8")

for path in (service, modal):
    content = path.read_text(encoding="utf-8")
    assert '\ufffd' not in content, f"replacement char found in {path.name}"

print('PATCH_OK')
