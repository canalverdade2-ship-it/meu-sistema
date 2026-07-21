import fs from 'node:fs';

function replaceExactly(path, before, after, label) {
  const content = fs.readFileSync(path, 'utf8');
  const count = content.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 bloco, encontrado ${count}`);
  fs.writeFileSync(path, content.replace(before, after));
}

const clientPath = 'src/components/auth/ClientAccessModal.tsx';
replaceExactly(
  clientPath,
`  const handleFirstAccess = async () => {
    if (!validDocumentLength() || phone.replace(/\\D/g, '').length < 10 || pin.length !== 4 || pinConfirm.length !== 4) {
      toast.error('Preencha documento, telefone e os quatro dígitos da senha.');
      return;
    }
    if (pin !== pinConfirm) {
      setPinError(true);
      setPinConfirm('');
      toast.error('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      const data = await sessionService.setPinAndLogin(cleanDocument(), phone.replace(/\\D/g, ''), pin, 'cliente');
      if (!data?.success) throw new Error('Dados de confirmação inválidos.');
      await logService.logAction({ ator_tipo: 'cliente', ator_id: data.id, ator_nome: data.nome, acao: 'LOGIN', detalhes: 'Primeiro acesso com criação de senha' });
      toast.success('Senha criada com sucesso.');
      onLoginClient(data.id);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível confirmar o primeiro acesso. Confira os dados informados.');
    } finally {
      setLoading(false);
    }
  };
`,
`  const handleFirstAccess = () => {
    setPhone('');
    setPin('');
    setPinConfirm('');
    changeMode('recovery');
    toast('Por segurança, o primeiro acesso exige o código enviado ao e-mail cadastrado.');
  };
`,
  'cliente: função de primeiro acesso',
);

replaceExactly(
  clientPath,
`            <button type="button" onClick={() => changeMode('first_access')} className="font-semibold text-[#8a651f] hover:underline">Já sou cliente, mas ainda não tenho senha</button>`,
`            <button type="button" onClick={handleFirstAccess} className="font-semibold text-[#8a651f] hover:underline">Primeiro acesso ou esqueci minha senha</button>`,
  'cliente: botão de primeiro acesso',
);

replaceExactly(
  clientPath,
`      {mode === 'first_access' && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">Use o documento e o mesmo telefone já cadastrados. A conta não será consultada nem identificada antes da confirmação completa.</div>
          <PersonSelector value={personType} onChange={(value) => { setPersonType(value); setDocumento(''); }} />
          <DocumentInput personType={personType} value={documento} onChange={setDocumento} />
          <label className="grid gap-2 text-sm font-medium text-neutral-600">Telefone cadastrado<input type="tel" name="first-access-phone" autoComplete="tel" value={phone} onChange={(event) => setPhone(maskPhone(event.target.value))} className="input-field" maxLength={15} /></label>
          <PinInput value={pin} onChange={(value) => { setPin(value); setPinError(false); }} error={pinError} disabled={loading} label="Nova senha" />
          <PinInput value={pinConfirm} onChange={(value) => { setPinConfirm(value); setPinError(false); }} error={pinError} disabled={loading} autoFocus={false} label="Confirmar senha" onEnter={handleFirstAccess} />
          <div className="flex gap-3"><button type="button" onClick={() => changeMode('login')} className="btn-secondary flex-1">Voltar</button><button type="button" onClick={handleFirstAccess} disabled={loading} className="btn-primary flex-1">{loading ? 'Confirmando...' : 'Criar senha'}</button></div>
        </div>
      )}
`,
`      {mode === 'first_access' && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><ShieldAlert className="mb-2 h-5 w-5" />O primeiro acesso não utiliza mais documento e telefone como única confirmação. Continue pela verificação do código enviado ao e-mail cadastrado.</div>
          <div className="flex gap-3"><button type="button" onClick={() => changeMode('login')} className="btn-secondary flex-1">Voltar</button><button type="button" onClick={() => changeMode('recovery')} className="btn-primary flex-1">Confirmar por e-mail</button></div>
        </div>
      )}
`,
  'cliente: painel de primeiro acesso',
);

const providerPath = 'src/components/auth/RestrictedAccessModal.tsx';
replaceExactly(
  providerPath,
`  const handleProviderFirstAccess = async () => {
    const cleanDocument = providerDocument.replace(/\\D/g, '');
    if (![11, 14].includes(cleanDocument.length) || providerPhone.replace(/\\D/g, '').length < 10 || providerPin.length !== 4 || providerPinConfirm.length !== 4) {
      toast.error('Preencha documento, telefone e senha.');
      return;
    }
    if (providerPin !== providerPinConfirm) {
      setPinError(true);
      setProviderPinConfirm('');
      toast.error('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      const data = await sessionService.setPinAndLogin(cleanDocument, providerPhone.replace(/\\D/g, ''), providerPin, 'prestador');
      if (!data?.success) throw new Error('Dados inválidos.');
      await logService.logAction({ ator_tipo: 'prestador', ator_id: data.id, ator_nome: data.nome, acao: 'LOGIN', detalhes: 'Primeiro acesso com criação de senha' });
      toast.success('Senha criada com sucesso.');
      onLoginPrestador(data.id);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível confirmar o primeiro acesso. Confira os dados informados.');
    } finally {
      setLoading(false);
    }
  };
`,
`  const handleProviderFirstAccess = () => {
    setProviderPhone('');
    setProviderPin('');
    setProviderPinConfirm('');
    toast('O primeiro acesso do prestador é liberado pelo suporte após a confirmação de identidade.');
  };
`,
  'prestador: função de primeiro acesso',
);

replaceExactly(
  providerPath,
`      {tab === 'prestador' && providerStage === 'first_access' && (
        <div role="tabpanel" id="restricted-panel-prestador" aria-labelledby="restricted-tab-prestador" className="space-y-5">
          <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900"><ShieldAlert className="mb-2 h-5 w-5" />Use o documento e o mesmo telefone já cadastrados.</div>
          <label className="grid gap-2 text-sm font-medium text-neutral-600">CPF ou CNPJ<input required name="provider-first-document" autoComplete="off" inputMode="numeric" value={providerDocument} onChange={(event) => setProviderDocument(event.target.value.replace(/\\D/g, '').length <= 11 ? maskCPF(event.target.value) : maskCNPJ(event.target.value))} className="input-field" /></label>
          <label className="grid gap-2 text-sm font-medium text-neutral-600">Telefone cadastrado<input required name="provider-phone" autoComplete="tel" type="tel" value={providerPhone} onChange={(event) => setProviderPhone(maskPhone(event.target.value))} className="input-field" maxLength={15} /></label>
          <PinInput value={providerPin} onChange={(value) => { setProviderPin(value); setPinError(false); }} error={pinError} disabled={loading} label="Nova senha" />
          <PinInput value={providerPinConfirm} onChange={(value) => { setProviderPinConfirm(value); setPinError(false); }} error={pinError} disabled={loading} autoFocus={false} label="Confirmar senha" onEnter={handleProviderFirstAccess} />
          <div className="flex gap-3"><button type="button" onClick={() => setProviderStage('document')} className="btn-secondary flex-1">Voltar</button><button type="button" onClick={handleProviderFirstAccess} disabled={loading} className="btn-primary flex-1">{loading ? 'Confirmando...' : 'Criar senha'}</button></div>
        </div>
      )}
`,
`      {tab === 'prestador' && providerStage === 'first_access' && (
        <div role="tabpanel" id="restricted-panel-prestador" aria-labelledby="restricted-tab-prestador" className="space-y-5">
          <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><ShieldAlert className="mb-2 h-5 w-5" />Por segurança, documento e telefone não criam mais a senha diretamente. Solicite ao suporte a liberação do primeiro acesso após a confirmação da identidade.</div>
          <div className="flex gap-3"><button type="button" onClick={() => setProviderStage('document')} className="btn-secondary flex-1">Voltar</button><button type="button" onClick={handleProviderFirstAccess} className="btn-primary flex-1">Como liberar</button></div>
        </div>
      )}
`,
  'prestador: painel de primeiro acesso',
);

console.log('Interface de primeiro acesso atualizada sem chamadas públicas de criação de PIN.');
