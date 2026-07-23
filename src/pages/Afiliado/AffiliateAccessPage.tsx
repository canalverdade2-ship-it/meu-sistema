import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  BadgeDollarSign,
  CheckCircle2,
  ChevronRight,
  Link2,
  LockKeyhole,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LogoGSA } from '../../components/ui/LogoGSA';
import { PinInput } from '../../components/ui/PinInput';
import { joinAffiliate } from '../../features/affiliates/service';
import { logService } from '../../lib/logService';
import { sessionService } from '../../lib/sessionService';
import { maskCNPJ, maskCPF, maskPhone } from '../../lib/utils';
import { validarCNPJ, validarCPF, validarEmail } from '../../utils/cpfValidator';

type AccessMode = 'login' | 'register';
type LoginStage = 'document' | 'pin';
type PixType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

interface AffiliateAccessPageProps {
  onLogin: (clientId?: string) => void;
  onBack: () => void;
  initialMode?: AccessMode;
}

const EMPTY_REGISTRATION = {
  nome: '',
  documento: '',
  nome_divulgacao: '',
  email: '',
  telefone: '',
  pix_tipo: 'cpf' as PixType,
  pix_chave: '',
  pin: '',
  termos_aceitos: false,
};

const INPUT_CLASS = 'mt-2 w-full rounded-xl border border-neutral-300 bg-neutral-50/50 px-4 py-3.5 font-medium text-neutral-900 outline-none transition focus:border-[#7a5a1b] focus:bg-white focus:ring-2 focus:ring-[#7a5a1b]/15';
const PRIMARY_CLASS = 'w-full rounded-xl bg-[#111318] px-5 py-3.5 font-black text-white shadow-lg transition hover:bg-[#7a5a1b] disabled:cursor-not-allowed disabled:opacity-50';

function formatTaxDocument(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length <= 11 ? maskCPF(digits) : maskCNPJ(digits.slice(0, 14));
}

function validateDocument(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 ? validarCPF(digits) : digits.length === 14 && validarCNPJ(digits);
}

export function AffiliateAccessPage({ onLogin, onBack, initialMode = 'login' }: AffiliateAccessPageProps) {
  const [mode, setMode] = useState<AccessMode>(initialMode);
  const [stage, setStage] = useState<LoginStage>('document');
  const [documentInput, setDocumentInput] = useState('');
  const [pin, setPin] = useState('');
  const [form, setForm] = useState(EMPTY_REGISTRATION);
  const [loading, setLoading] = useState(false);

  const switchMode = (next: AccessMode) => {
    setMode(next);
    setStage('document');
    setPin('');
  };

  const updateForm = <K extends keyof typeof EMPTY_REGISTRATION>(field: K, value: (typeof EMPTY_REGISTRATION)[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const continueLogin = (event: FormEvent) => {
    event.preventDefault();
    if (!validateDocument(documentInput)) {
      toast.error('Informe o CPF ou CNPJ cadastrado na sua conta GSA.');
      return;
    }
    setStage('pin');
  };

  const authenticate = async (document: string, accessPin: string) => {
    const cleanDocument = document.replace(/\D/g, '');
    const data = await sessionService.loginWithPin(cleanDocument, accessPin, 'cliente');
    if (!data?.valid) {
      throw new Error(data?.error === 'blocked' ? 'Acesso temporariamente bloqueado.' : 'Documento ou PIN incorreto.');
    }
    return data;
  };

  const login = async () => {
    if (pin.length !== 4 || loading) return;
    setLoading(true);
    try {
      const data = await authenticate(documentInput, pin);
      await logService.logAction({
        ator_tipo: 'cliente',
        ator_id: data.id,
        ator_nome: data.nome,
        acao: 'LOGIN_AFILIADO',
        detalhes: 'Acesso efetuado pelo Portal do Afiliado',
      });
      toast.success('Bem-vindo ao Portal do Afiliado GSA!');
      onLogin(data.id);
    } catch (error: any) {
      setPin('');
      toast.error(error?.message || 'Não foi possível entrar no portal.');
    } finally {
      setLoading(false);
    }
  };

  const register = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateDocument(form.documento)) return toast.error('Informe um CPF ou CNPJ válido.');
    if (!validarEmail(form.email)) return toast.error('Informe um e-mail válido.');
    if (form.nome.trim().length < 3 || form.nome_divulgacao.trim().length < 3) return toast.error('Preencha seu nome e o nome de divulgação.');
    if (form.telefone.replace(/\D/g, '').length < 10) return toast.error('Informe um telefone válido.');
    if (form.pix_chave.trim().length < 3) return toast.error('Informe sua chave PIX.');
    if (!/^\d{4}$/.test(form.pin)) return toast.error('Informe o PIN de 4 dígitos da sua conta GSA.');
    if (!form.termos_aceitos) return toast.error('É necessário concordar com os termos do programa.');

    setLoading(true);
    try {
      const data = await authenticate(form.documento, form.pin);
      await joinAffiliate({
        nomeDivulgacao: form.nome_divulgacao.trim(),
        pixTipo: form.pix_tipo,
        pixChave: form.pix_chave.trim(),
        termosVersao: '2026-07-22',
      });
      await logService.logAction({
        ator_tipo: 'cliente',
        ator_id: data.id,
        ator_nome: data.nome,
        acao: 'ATIVAR_AFILIADO',
        detalhes: 'Perfil ativado após autenticação pelo Portal do Afiliado',
      });
      toast.success('Perfil de afiliado ativado com segurança!');
      onLogin(data.id);
    } catch (error: any) {
      await sessionService.endSession().catch(() => undefined);
      toast.error(error?.message || 'Não foi possível ativar o perfil de afiliado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f5f0] text-neutral-900">
      <header className="border-b border-neutral-200/80 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <LogoGSA size="md" variant="dark" />
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700 transition hover:border-[#7a5a1b] hover:text-[#7a5a1b]">
            <ArrowLeft className="h-4 w-4" /> Voltar para o programa
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
        <section className="rounded-[2rem] border border-[#d8bd73]/40 bg-white p-6 shadow-[0_16px_50px_rgba(0,0,0,0.05)] sm:p-8">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-6">
            <div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7a5a1b]">Portal Exclusivo</p><h1 className="mt-1 font-serif text-2xl font-black text-neutral-950 sm:text-3xl">Área do Afiliado GSA</h1></div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5eece] text-[#7a5a1b]"><BadgeDollarSign className="h-7 w-7" /></div>
          </div>

          <div className="mt-6 flex rounded-2xl bg-neutral-100 p-1.5 ring-1 ring-neutral-200/60">
            <button type="button" onClick={() => switchMode('login')} className={`flex-1 rounded-xl py-3 text-xs font-black uppercase tracking-wider transition ${mode === 'login' ? 'bg-[#7a5a1b] text-white shadow-md' : 'text-neutral-600 hover:text-neutral-900'}`}>Entrar no Portal</button>
            <button type="button" onClick={() => switchMode('register')} className={`flex-1 rounded-xl py-3 text-xs font-black uppercase tracking-wider transition ${mode === 'register' ? 'bg-[#7a5a1b] text-white shadow-md' : 'text-neutral-600 hover:text-neutral-900'}`}>Ativar Perfil</button>
          </div>

          {mode === 'login' && <div className="mt-8">{stage === 'document' ? (
            <form onSubmit={continueLogin} className="space-y-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">CPF ou CNPJ da conta GSA<input required value={documentInput} onChange={(event) => setDocumentInput(formatTaxDocument(event.target.value))} placeholder="000.000.000-00" className={INPUT_CLASS} /></label>
              <button type="submit" className={PRIMARY_CLASS}>Continuar <ChevronRight className="ml-1 inline h-4 w-4" /></button>
            </form>
          ) : (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f5eece] text-[#7a5a1b]"><LockKeyhole className="h-7 w-7" /></div>
              <div><h2 className="text-lg font-black text-neutral-900">Informe seu PIN de 4 dígitos</h2><p className="mt-1 text-xs text-neutral-500">Acesso para: <strong className="text-neutral-900">{documentInput}</strong></p></div>
              <div className="flex justify-center"><PinInput value={pin} onChange={setPin} disabled={loading} onComplete={login} /></div>
              <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:justify-between"><button type="button" onClick={() => setStage('document')} className="text-xs font-bold text-neutral-500 underline hover:text-neutral-900">Alterar documento</button><button type="button" onClick={login} disabled={pin.length !== 4 || loading} className="rounded-xl bg-[#7a5a1b] px-6 py-2.5 text-xs font-black text-white shadow-md disabled:opacity-50">{loading ? 'Entrando...' : 'Confirmar acesso'}</button></div>
            </div>
          )}</div>}

          {mode === 'register' && (
            <form onSubmit={register} className="mt-8 space-y-5">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-800">Por segurança, a ativação confirma o CPF/CNPJ e o PIN da sua conta GSA antes de cadastrar a chave PIX.</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">Nome completo<input required value={form.nome} onChange={(event) => updateForm('nome', event.target.value)} className={INPUT_CLASS} /></label>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">Nome de divulgação<input required value={form.nome_divulgacao} onChange={(event) => updateForm('nome_divulgacao', event.target.value)} className={INPUT_CLASS} /></label>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">CPF ou CNPJ<input required value={form.documento} onChange={(event) => updateForm('documento', formatTaxDocument(event.target.value))} className={INPUT_CLASS} /></label>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">PIN da conta<input required inputMode="numeric" maxLength={4} value={form.pin} onChange={(event) => updateForm('pin', event.target.value.replace(/\D/g, '').slice(0, 4))} className={INPUT_CLASS} /></label>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">E-mail da conta<input required type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} className={INPUT_CLASS} /></label>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">Telefone<input required value={form.telefone} onChange={(event) => updateForm('telefone', maskPhone(event.target.value))} className={INPUT_CLASS} /></label>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">Tipo de chave PIX<select value={form.pix_tipo} onChange={(event) => updateForm('pix_tipo', event.target.value as PixType)} className={INPUT_CLASS}><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">E-mail</option><option value="telefone">Telefone</option><option value="aleatoria">Aleatória</option></select></label>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">Chave PIX<input required value={form.pix_chave} onChange={(event) => updateForm('pix_chave', event.target.value)} className={INPUT_CLASS} /></label>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700"><input type="checkbox" checked={form.termos_aceitos} onChange={(event) => updateForm('termos_aceitos', event.target.checked)} className="mt-1 h-4 w-4" /><span>Concordo com as regras de atribuição, carência, estorno e pagamento das comissões.</span></label>
              <button type="submit" disabled={loading} className={PRIMARY_CLASS}>{loading ? 'Autenticando e ativando...' : 'Autenticar e ativar perfil'}</button>
            </form>
          )}
        </section>

        <aside className="space-y-4">{[
          { icon: Link2, title: 'Links validados', text: 'Cada link possui código próprio e destino permitido pelo programa.' },
          { icon: Wallet, title: 'Comissões protegidas', text: 'Percentual, base de cálculo e carência ficam registrados na venda.' },
          { icon: ShieldCheck, title: 'Saques seguros', text: 'Solicitações PIX são idempotentes e passam por decisão administrativa.' },
        ].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"><Icon className="h-7 w-7 text-[#7a5a1b]" /><h2 className="mt-4 text-lg font-black">{title}</h2><p className="mt-2 text-sm leading-6 text-neutral-600">{text}</p></div>)}</aside>
      </div>
    </main>
  );
}
