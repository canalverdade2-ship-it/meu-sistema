import type React from 'react';
import { useEffect, useState } from 'react';
import { Copy, Loader2, Lock, ShieldAlert, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import { PinInput } from '../ui/PinInput';
import { sessionService } from '../../lib/sessionService';
import { logService } from '../../lib/logService';
import { supabase } from '../../lib/supabase';
import { copyToClipboard, formatCurrency, maskCNPJ, maskCPF, maskPhone } from '../../lib/utils';
import { validarCNPJ, validarCPF, validarEmail } from '../../utils/cpfValidator';
import { consultarCEP } from '../../utils/viaCep';
import { usePublicRegistrationSettings } from '../../hooks/usePublicRegistrationSettings';

export type ClientAccessMode = 'login' | 'first_access' | 'recovery' | 'register';

type PersonType = 'pf' | 'pj';
type RegisterStage = 'voucher' | 'confirm' | 'form';

interface ClientAccessModalProps {
  isOpen: boolean;
  initialMode?: ClientAccessMode;
  onClose: () => void;
  onLoginClient: (id: string, isRecovery?: boolean) => void;
}

const emptyRegistration = {
  nome: '',
  email: '',
  telefone: '',
  cep: '',
  numero: '',
  endereco: '',
  bairro: '',
  cidade: '',
  estado: '',
  observacoes: '',
  data_cadastro: new Date().toISOString().split('T')[0],
};

export function ClientAccessModal({ isOpen, initialMode = 'login', onClose, onLoginClient }: ClientAccessModalProps) {
  const [mode, setMode] = useState<ClientAccessMode>(initialMode);
  const [personType, setPersonType] = useState<PersonType>('pf');
  const [documento, setDocumento] = useState('');
  const [loginStage, setLoginStage] = useState<'document' | 'pin'>('document');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryStage, setRecoveryStage] = useState<'request' | 'code'>('request');
  const [recoveryId, setRecoveryId] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [pinError, setPinError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registerStage, setRegisterStage] = useState<RegisterStage>('voucher');
  const [voucherTab, setVoucherTab] = useState<'com-indicacao' | 'sem-indicacao'>('com-indicacao');
  const [voucherInput, setVoucherInput] = useState('');
  const [referralInfo, setReferralInfo] = useState<any>(null);
  const [registrationData, setRegistrationData] = useState(emptyRegistration);
  const { settings, loading: settingsLoading } = usePublicRegistrationSettings(isOpen && mode === 'register');

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setLoginStage('document');
    setPin('');
    setPinConfirm('');
    setPhone('');
    setRecoveryEmail('');
    setRecoveryStage('request');
    setRecoveryId('');
    setRecoveryCode('');
    setAttemptsLeft(null);
    setPinError(false);
    setRegisterStage('voucher');
    setVoucherInput('');
    setReferralInfo(null);
  }, [initialMode, isOpen]);

  const cleanDocument = () => documento.replace(/\D/g, '');
  const validDocumentLength = () => cleanDocument().length === (personType === 'pf' ? 11 : 14);

  const changeMode = (nextMode: ClientAccessMode) => {
    setMode(nextMode);
    setLoginStage('document');
    setPin('');
    setPinConfirm('');
    setPhone('');
    setRecoveryStage('request');
    setRecoveryId('');
    setRecoveryCode('');
    setPinError(false);
    setAttemptsLeft(null);
  };

  const handleDocumentContinue = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validDocumentLength()) {
      toast.error(`Informe um ${personType === 'pf' ? 'CPF' : 'CNPJ'} válido.`);
      return;
    }
    // Não consultamos a existência da conta antes da autenticação.
    setLoginStage('pin');
  };

  const handleLogin = async () => {
    if (pin.length !== 4 || loading) return;
    setLoading(true);
    setPinError(false);
    try {
      const data = await sessionService.loginWithPin(cleanDocument(), pin, 'cliente');
      if (data?.valid) {
        await logService.logAction({ ator_tipo: 'cliente', ator_id: data.id, ator_nome: data.nome, acao: 'LOGIN', detalhes: 'Acesso via portal principal' });
        toast.success('Login realizado com sucesso.');
        onLoginClient(data.id);
        return;
      }
      setPinError(true);
      setPin('');
      setAttemptsLeft(typeof data?.attempts_left === 'number' ? data.attempts_left : null);
      toast.error(data?.error === 'blocked' ? 'Acesso temporariamente bloqueado. Entre em contato com o suporte.' : 'Documento ou senha inválidos.');
    } catch (error: any) {
      setPinError(true);
      setPin('');
      toast.error(error?.message || 'Documento ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  };

  const handleFirstAccess = async () => {
    if (!validDocumentLength() || phone.replace(/\D/g, '').length < 10 || pin.length !== 4 || pinConfirm.length !== 4) {
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
      const data = await sessionService.setPinAndLogin(cleanDocument(), phone.replace(/\D/g, ''), pin, 'cliente');
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

  const handleRecovery = async () => {
    if (!validDocumentLength() || !validarEmail(recoveryEmail)) {
      toast.error('Informe documento e e-mail válidos.');
      return;
    }
    setLoading(true);
    try {
      const data = await sessionService.requestClientRecovery(cleanDocument(), recoveryEmail.trim().toLowerCase());
      if (!data?.success || !data?.recovery_id) throw new Error('Não foi possível iniciar a recuperação.');
      setRecoveryId(data.recovery_id);
      setRecoveryStage('code');
      setRecoveryCode('');
      toast.success('Enviamos um código de confirmação para o e-mail cadastrado.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível iniciar a recuperação.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryCode = async () => {
    if (!recoveryId || recoveryCode.length !== 6 || loading) {
      toast.error('Informe o código de seis dígitos enviado ao seu e-mail.');
      return;
    }

    setLoading(true);
    try {
      const email = recoveryEmail.trim().toLowerCase();
      const { error: otpError } = await supabase.auth.verifyOtp({
        email,
        token: recoveryCode,
        type: 'email',
      });
      if (otpError) throw new Error('Código inválido ou expirado.');

      const data = await sessionService.completeClientRecovery(recoveryId);
      if (!data?.success) throw new Error('Não foi possível concluir a recuperação.');

      toast.success('Identidade confirmada. Crie sua nova senha.');
      onLoginClient(data.id, true);
    } catch (error: any) {
      await supabase.auth.signOut({ scope: 'local' });
      setRecoveryCode('');
      toast.error(error?.message || 'Não foi possível confirmar o código.');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateVoucher = async () => {
    if (!voucherInput.trim()) {
      toast.error(voucherTab === 'com-indicacao' ? 'Informe o celular usado na indicação.' : 'Informe o código de cadastro.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('gsa_public_lookup_referral', { p_token: voucherInput.trim() });
      if (error || !data?.valid) throw new Error(data?.error || 'Indicação inválida.');
      const fullReferral = {
        ...data,
        id: data.indicacao_id || null,
        isDefaultCode: data.kind === 'default',
      };
      setReferralInfo(fullReferral);
      setRegistrationData((previous) => ({
        ...previous,
        nome: fullReferral.indicado_nome || '',
        telefone: fullReferral.whatsapp_indicado ? maskPhone(fullReferral.whatsapp_indicado) : '',
      }));
      setRegisterStage(fullReferral.isDefaultCode ? 'form' : 'confirm');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível validar a indicação.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanDoc = cleanDocument();
    const cleanPhone = registrationData.telefone.replace(/\D/g, '');
    if (personType === 'pf' ? !validarCPF(cleanDoc) : !validarCNPJ(cleanDoc)) {
      toast.error(`${personType === 'pf' ? 'CPF' : 'CNPJ'} inválido.`);
      return;
    }
    if (!validarEmail(registrationData.email) || cleanPhone.length !== 11) {
      toast.error('Informe e-mail e telefone válidos.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('gsa_public_register_client', {
        p_referral_token: voucherInput.trim(),
        p_payload: {
          ...registrationData,
          telefone: cleanPhone,
          cep: registrationData.cep.replace(/\D/g, ''),
          tipo_pessoa: personType,
          [personType === 'pf' ? 'cpf' : 'cnpj']: cleanDoc,
        },
      });
      if (error) throw error;
      toast.success(data?.status === 'pendente' ? 'Cadastro enviado. Aguarde a aprovação administrativa.' : 'Cadastro realizado. Você já pode entrar.');
      setRegistrationData(emptyRegistration);
      setDocumento('');
      setVoucherInput('');
      changeMode('login');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível concluir o cadastro.');
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'login'
    ? (loginStage === 'document' ? 'Área do Cliente' : 'Digite sua senha')
    : mode === 'first_access'
      ? 'Primeiro acesso de cliente cadastrado'
      : mode === 'recovery'
        ? 'Recuperar senha'
        : registerStage === 'voucher'
          ? 'Criar novo cadastro'
          : registerStage === 'confirm'
            ? 'Confirmar indicação'
            : 'Dados do cadastro';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      {mode === 'login' && loginStage === 'document' && (
        <form onSubmit={handleDocumentContinue} className="space-y-5">
          <PersonSelector value={personType} onChange={(value) => { setPersonType(value); setDocumento(''); }} />
          <DocumentInput personType={personType} value={documento} onChange={setDocumento} />
          <button type="submit" disabled={loading} className="btn-primary w-full">Continuar</button>
          <div className="grid gap-2 border-t border-neutral-100 pt-4 text-center text-sm">
            <button type="button" onClick={() => changeMode('first_access')} className="font-semibold text-[#8a651f] hover:underline">Já sou cliente, mas ainda não tenho senha</button>
            <button type="button" onClick={() => changeMode('register')} className="font-semibold text-[#142030] hover:underline">Criar um novo cadastro</button>
          </div>
        </form>
      )}

      {mode === 'login' && loginStage === 'pin' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#142030]/5"><Lock className="h-8 w-8 text-[#142030]" /></div>
            <p className="text-sm text-neutral-600">Digite sua senha numérica de quatro dígitos.</p>
          </div>
          <PinInput value={pin} onChange={(value) => { setPin(value); setPinError(false); }} error={pinError} disabled={loading} onEnter={handleLogin} />
          {attemptsLeft !== null && attemptsLeft <= 2 && <p className="text-center text-xs font-semibold text-red-600">{attemptsLeft} tentativa(s) restante(s).</p>}
          <div className="text-center"><button type="button" onClick={() => changeMode('recovery')} className="text-sm font-semibold text-[#142030] hover:underline">Esqueci minha senha</button></div>
          <div className="flex gap-3">
            <button type="button" onClick={() => { setLoginStage('document'); setPin(''); }} className="btn-secondary flex-1">Voltar</button>
            <button type="button" onClick={handleLogin} disabled={loading || pin.length !== 4} className="btn-primary flex-1">{loading ? 'Verificando...' : 'Acessar'}</button>
          </div>
        </div>
      )}

      {mode === 'first_access' && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">Use o documento e o mesmo telefone já cadastrados. A conta não será consultada nem identificada antes da confirmação completa.</div>
          <PersonSelector value={personType} onChange={(value) => { setPersonType(value); setDocumento(''); }} />
          <DocumentInput personType={personType} value={documento} onChange={setDocumento} />
          <input type="tel" value={phone} onChange={(event) => setPhone(maskPhone(event.target.value))} placeholder="Telefone cadastrado" className="input-field" maxLength={15} />
          <PinInput value={pin} onChange={(value) => { setPin(value); setPinError(false); }} error={pinError} disabled={loading} label="Nova senha" />
          <PinInput value={pinConfirm} onChange={(value) => { setPinConfirm(value); setPinError(false); }} error={pinError} disabled={loading} autoFocus={false} label="Confirmar senha" onEnter={handleFirstAccess} />
          <div className="flex gap-3"><button type="button" onClick={() => changeMode('login')} className="btn-secondary flex-1">Voltar</button><button type="button" onClick={handleFirstAccess} disabled={loading} className="btn-primary flex-1">{loading ? 'Confirmando...' : 'Criar senha'}</button></div>
        </div>
      )}

      {mode === 'recovery' && (
        <div className="space-y-5">
          {recoveryStage === 'request' ? (
            <>
              <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><ShieldAlert className="mb-2 h-5 w-5" />A redefinição só será liberada depois da confirmação do código enviado ao e-mail cadastrado.</div>
              <PersonSelector value={personType} onChange={(value) => { setPersonType(value); setDocumento(''); }} />
              <DocumentInput personType={personType} value={documento} onChange={setDocumento} />
              <input type="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} placeholder="E-mail cadastrado" className="input-field" />
              <div className="flex gap-3"><button type="button" onClick={() => changeMode('login')} className="btn-secondary flex-1">Voltar</button><button type="button" onClick={handleRecovery} disabled={loading} className="btn-primary flex-1">{loading ? 'Enviando...' : 'Enviar código'}</button></div>
            </>
          ) : (
            <>
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900"><ShieldAlert className="mb-2 h-5 w-5" />Digite o código de seis dígitos enviado para <strong>{recoveryEmail}</strong>. Ele expira em poucos minutos e só pode ser usado uma vez.</div>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={(event) => { if (event.key === 'Enter') void handleRecoveryCode(); }} placeholder="000000" className="input-field text-center text-2xl font-mono tracking-[0.45em]" maxLength={6} autoFocus />
              <div className="flex gap-3"><button type="button" onClick={() => { setRecoveryStage('request'); setRecoveryCode(''); }} className="btn-secondary flex-1">Reenviar</button><button type="button" onClick={handleRecoveryCode} disabled={loading || recoveryCode.length !== 6} className="btn-primary flex-1">{loading ? 'Confirmando...' : 'Confirmar código'}</button></div>
            </>
          )}
        </div>
      )}

      {mode === 'register' && registerStage === 'voucher' && (
        <div className="space-y-5">
          <div className="flex gap-2 rounded-lg bg-neutral-100 p-1">
            <button type="button" onClick={() => { setVoucherTab('com-indicacao'); setVoucherInput(''); }} className={`flex-1 rounded-md py-2 text-sm ${voucherTab === 'com-indicacao' ? 'bg-white shadow' : 'text-neutral-500'}`}>Com indicação</button>
            <button type="button" onClick={() => { setVoucherTab('sem-indicacao'); setVoucherInput(''); }} className={`flex-1 rounded-md py-2 text-sm ${voucherTab === 'sem-indicacao' ? 'bg-white shadow' : 'text-neutral-500'}`}>Sem indicação</button>
          </div>
          {voucherTab === 'sem-indicacao' && (
            <div className="rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-900">
              {settingsLoading ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Carregando...</span> : settings.ativo ? (
                <>
                  <p>Use o código público abaixo. Ele será validado pelo servidor antes do cadastro.</p>
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-white p-3"><strong className="font-mono">{settings.codigo}</strong><button type="button" onClick={async () => { if (await copyToClipboard(settings.codigo)) toast.success('Código copiado.'); }} className="flex items-center gap-1 text-xs font-bold"><Copy className="h-4 w-4" />Copiar</button></div>
                  <p className="mt-3 text-xs">Bônus após aprovação: {settings.tipo === 'pontos' ? `${settings.valor} pontos` : formatCurrency(settings.valor)}.</p>
                </>
              ) : <p>O cadastro sem indicação está temporariamente indisponível.</p>}
            </div>
          )}
          <input type="text" inputMode={voucherTab === 'com-indicacao' ? 'numeric' : 'text'} value={voucherInput} onChange={(event) => setVoucherInput(voucherTab === 'com-indicacao' ? maskPhone(event.target.value) : event.target.value)} placeholder={voucherTab === 'com-indicacao' ? 'Celular usado na indicação' : 'Código público'} className="input-field" disabled={voucherTab === 'sem-indicacao' && !settings.ativo} />
          <div className="flex gap-3"><button type="button" onClick={() => changeMode('login')} className="btn-secondary flex-1">Voltar</button><button type="button" onClick={handleValidateVoucher} disabled={loading || (voucherTab === 'sem-indicacao' && !settings.ativo)} className="btn-primary flex-1">{loading ? 'Validando...' : 'Validar'}</button></div>
        </div>
      )}

      {mode === 'register' && registerStage === 'confirm' && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-neutral-50 p-5"><p className="text-xs uppercase tracking-widest text-neutral-400">Indicação encontrada</p><p className="mt-2 font-bold">{referralInfo?.indicador?.nome || 'Indicador cadastrado'}</p></div>
          <p className="text-sm text-neutral-600">Confirma que esta é a indicação correta?</p>
          <div className="flex gap-3"><button type="button" onClick={() => setRegisterStage('voucher')} className="btn-secondary flex-1">Não</button><button type="button" onClick={() => setRegisterStage('form')} className="btn-primary flex-1">Sim, continuar</button></div>
        </div>
      )}

      {mode === 'register' && registerStage === 'form' && (
        <form onSubmit={handleRegister} className="space-y-4">
          <PersonSelector value={personType} onChange={(value) => { setPersonType(value); setDocumento(''); }} />
          <DocumentInput personType={personType} value={documento} onChange={setDocumento} validate />
          <input required value={registrationData.nome} onChange={(event) => setRegistrationData({ ...registrationData, nome: event.target.value })} placeholder={personType === 'pf' ? 'Nome completo' : 'Razão social'} className="input-field" />
          <div className="grid gap-4 sm:grid-cols-2"><input type="email" required value={registrationData.email} onChange={(event) => setRegistrationData({ ...registrationData, email: event.target.value })} placeholder="E-mail" className="input-field" /><input required value={registrationData.telefone} onChange={(event) => setRegistrationData({ ...registrationData, telefone: maskPhone(event.target.value) })} placeholder="Telefone" className="input-field" maxLength={15} /></div>
          <div className="grid grid-cols-[1fr_120px] gap-4"><input required value={registrationData.cep} onChange={async (event) => { let value = event.target.value.replace(/\D/g, ''); if (value.length > 5) value = value.replace(/^(\d{5})(\d)/, '$1-$2'); setRegistrationData((previous) => ({ ...previous, cep: value })); const raw = value.replace(/\D/g, ''); if (raw.length === 8) { const address = await consultarCEP(raw); if (address) setRegistrationData((previous) => ({ ...previous, endereco: address.logradouro, bairro: address.bairro, cidade: address.localidade, estado: address.uf })); } }} placeholder="CEP" className="input-field" maxLength={9} /><input required value={registrationData.numero} onChange={(event) => setRegistrationData({ ...registrationData, numero: event.target.value })} placeholder="Número" className="input-field" /></div>
          <input required value={registrationData.endereco} onChange={(event) => setRegistrationData({ ...registrationData, endereco: event.target.value })} placeholder="Endereço" className="input-field" />
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_90px]"><input required value={registrationData.bairro} onChange={(event) => setRegistrationData({ ...registrationData, bairro: event.target.value })} placeholder="Bairro" className="input-field" /><input required value={registrationData.cidade} onChange={(event) => setRegistrationData({ ...registrationData, cidade: event.target.value })} placeholder="Cidade" className="input-field" /><input required maxLength={2} value={registrationData.estado} onChange={(event) => setRegistrationData({ ...registrationData, estado: event.target.value.toUpperCase() })} placeholder="UF" className="input-field" /></div>
          <textarea rows={2} value={registrationData.observacoes} onChange={(event) => setRegistrationData({ ...registrationData, observacoes: event.target.value })} placeholder="Observações" className="input-field resize-none" />
          <div className="flex gap-3"><button type="button" onClick={() => setRegisterStage(referralInfo?.isDefaultCode ? 'voucher' : 'confirm')} className="btn-secondary flex-1">Voltar</button><button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Enviando...' : 'Finalizar cadastro'}</button></div>
        </form>
      )}
    </Modal>
  );
}

function PersonSelector({ value, onChange }: { value: PersonType; onChange: (value: PersonType) => void }) {
  return <div className="flex gap-2 rounded-lg bg-neutral-100 p-1"><button type="button" onClick={() => onChange('pf')} className={`flex-1 rounded-md py-2 text-sm ${value === 'pf' ? 'bg-white shadow' : 'text-neutral-500'}`}>CPF</button><button type="button" onClick={() => onChange('pj')} className={`flex-1 rounded-md py-2 text-sm ${value === 'pj' ? 'bg-white shadow' : 'text-neutral-500'}`}>CNPJ</button></div>;
}

function DocumentInput({ personType, value, onChange, validate = false }: { personType: PersonType; value: string; onChange: (value: string) => void; validate?: boolean }) {
  return <div><label className="mb-2 block text-sm font-medium text-neutral-600">{personType === 'pf' ? 'CPF' : 'CNPJ'}</label><input type="text" inputMode="numeric" required value={value} onChange={(event) => onChange(personType === 'pf' ? maskCPF(event.target.value) : maskCNPJ(event.target.value))} onBlur={() => { if (!validate) return; const clean = value.replace(/\D/g, ''); if (clean && (personType === 'pf' ? !validarCPF(clean) : !validarCNPJ(clean))) { toast.error(`${personType === 'pf' ? 'CPF' : 'CNPJ'} inválido.`); onChange(''); } }} placeholder={personType === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'} className="input-field" /></div>;
}