import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { ArrowLeft, Building2, CheckCircle2, LockKeyhole, PackageCheck, ShieldCheck, Truck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LogoGSA } from '../../components/ui/LogoGSA';
import { PinInput } from '../../components/ui/PinInput';
import { logService } from '../../lib/logService';
import { sessionService } from '../../lib/sessionService';
import { supabase } from '../../lib/supabase';
import { maskCNPJ, maskCPF, maskPhone } from '../../lib/utils';
import { validarCNPJ, validarCPF, validarEmail } from '../../utils/cpfValidator';

type AccessMode = 'login' | 'register';
type LoginStage = 'document' | 'pin';

const EMPTY_SUPPLIER = {
  tipo_pessoa: 'pj' as 'pf' | 'pj', documento: '', razao_social: '', nome_fantasia: '',
  inscricao_estadual: '', responsavel_nome: '', email: '', telefone: '', cep: '',
  endereco: '', numero: '', bairro: '', cidade: '', estado: '', observacoes: '',
};

const INPUT_CLASS = 'mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const PRIMARY_CLASS = 'w-full rounded-xl bg-emerald-600 px-5 py-3 font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50';
const SECONDARY_CLASS = 'w-full rounded-xl border border-neutral-200 bg-white px-5 py-3 font-black text-neutral-700 transition hover:bg-neutral-50';

interface FornecedorAccessPageProps {
  onLogin: (supplierId: string) => void;
  onBack: () => void;
}

export function FornecedorAccessPage({ onLogin, onBack }: FornecedorAccessPageProps) {
  const [mode, setMode] = useState<AccessMode>('login');
  const [stage, setStage] = useState<LoginStage>('document');
  const [document, setDocument] = useState('');
  const [pin, setPin] = useState('');
  const [form, setForm] = useState(EMPTY_SUPPLIER);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const switchMode = (next: AccessMode) => {
    setMode(next);
    setStage('document');
    setPin('');
    setRegistered(false);
  };

  const continueLogin = (event: FormEvent) => {
    event.preventDefault();
    const clean = document.replace(/\D/g, '');
    const valid = clean.length === 11 ? validarCPF(clean) : clean.length === 14 && validarCNPJ(clean);
    if (!valid) return toast.error('Informe um CPF ou CNPJ válido.');
    setStage('pin');
  };

  const login = async () => {
    if (pin.length !== 4 || loading) return;
    setLoading(true);
    try {
      const data = await sessionService.loginWithPin(document.replace(/\D/g, ''), pin, 'fornecedor');
      if (!data?.valid) throw new Error(data?.error === 'blocked' ? 'Acesso temporariamente bloqueado.' : 'Documento, PIN ou cadastro inválido.');
      await logService.logAction({ ator_tipo: 'fornecedor', ator_id: data.id, ator_nome: data.nome, acao: 'LOGIN', detalhes: 'Acesso pela página exclusiva do fornecedor' });
      toast.success('Bem-vindo ao Portal do Fornecedor.');
      onLogin(data.id);
    } catch (error: any) {
      setPin('');
      toast.error(error?.message || 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  };

  const register = async (event: FormEvent) => {
    event.preventDefault();
    const cleanDocument = form.documento.replace(/\D/g, '');
    const validDocument = form.tipo_pessoa === 'pf' ? validarCPF(cleanDocument) : validarCNPJ(cleanDocument);
    if (!validDocument) return toast.error('Informe um CPF ou CNPJ válido.');
    if (!validarEmail(form.email)) return toast.error('Informe um e-mail válido.');
    setLoading(true);
    try {
      const { error } = await supabase.rpc('gsa_public_register_supplier', {
        p_payload: {
          ...form,
          documento: cleanDocument,
          telefone: form.telefone.replace(/\D/g, ''),
          cep: form.cep.replace(/\D/g, ''),
        },
      });
      if (error) throw error;
      setRegistered(true);
      setForm(EMPTY_SUPPLIER);
      toast.success('Pré-cadastro enviado para análise.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível enviar o cadastro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.24),transparent_38%),linear-gradient(145deg,#07120f,#101a18_55%,#090d0c)] p-12 lg:flex lg:flex-col lg:justify-between">
          <div><LogoGSA size="lg" variant="light" /><p className="mt-12 text-xs font-black uppercase tracking-[0.28em] text-emerald-300">GSA Produtos</p><h1 className="mt-4 max-w-xl text-5xl font-black leading-tight">Portal exclusivo para fornecedores</h1><p className="mt-5 max-w-xl text-base leading-8 text-white/60">Receba pedidos de compra, informe produtos entregues, envie notas fiscais e acompanhe a liberação dos pagamentos.</p></div>
          <div className="grid gap-3 sm:grid-cols-2"><Benefit icon={PackageCheck} text="Produtos aprovados pela GSA" /><Benefit icon={Truck} text="Pedidos e entregas rastreados" /><Benefit icon={ShieldCheck} text="Notas fiscais em ambiente seguro" /><Benefit icon={CheckCircle2} text="Estoque liberado após conferência" /></div>
        </section>

        <section className="flex min-h-screen items-center justify-center bg-[#f8f7f5] px-4 py-10 text-neutral-900 sm:px-8">
          <div className="w-full max-w-xl">
            <div className="mb-7 flex items-center justify-between"><button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-neutral-500 hover:bg-white"><ArrowLeft className="h-4 w-4" /> Voltar ao site</button><div className="lg:hidden"><LogoGSA size="md" variant="dark" /></div></div>
            <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-2xl shadow-neutral-900/10 sm:p-9">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800"><Building2 className="h-7 w-7" /></div>
              <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Acesso independente</p>
              <h2 className="mt-2 text-3xl font-black">{mode === 'login' ? 'Portal do Fornecedor' : 'Seja fornecedor da GSA'}</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">{mode === 'login' ? 'Entre com o documento cadastrado e o PIN liberado pela equipe GSA.' : 'Envie os dados da empresa. O acesso será liberado somente após análise.'}</p>

              <div className="mt-6 grid grid-cols-2 rounded-xl bg-neutral-100 p-1"><ModeButton active={mode === 'login'} onClick={() => switchMode('login')}>Entrar</ModeButton><ModeButton active={mode === 'register'} onClick={() => switchMode('register')}>Quero me cadastrar</ModeButton></div>

              {mode === 'login' && stage === 'document' && <form onSubmit={continueLogin} className="mt-7 space-y-5"><Field label="CPF ou CNPJ"><input required autoFocus inputMode="numeric" value={document} onChange={(event) => setDocument(event.target.value.replace(/\D/g, '').length <= 11 ? maskCPF(event.target.value) : maskCNPJ(event.target.value))} className={INPUT_CLASS} placeholder="Documento cadastrado" /></Field><button className={PRIMARY_CLASS}>Continuar</button></form>}

              {mode === 'login' && stage === 'pin' && <div className="mt-7 space-y-6"><div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900"><LockKeyhole className="mb-2 h-5 w-5" />Digite o PIN de quatro dígitos liberado após a aprovação cadastral.</div><PinInput value={pin} onChange={setPin} disabled={loading} onEnter={login} /><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => { setStage('document'); setPin(''); }} className={SECONDARY_CLASS}>Voltar</button><button type="button" disabled={loading || pin.length !== 4} onClick={() => void login()} className={PRIMARY_CLASS}>{loading ? 'Entrando...' : 'Acessar portal'}</button></div></div>}

              {mode === 'register' && registered && <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900"><CheckCircle2 className="h-8 w-8 text-emerald-600" /><h3 className="mt-3 text-lg font-black">Cadastro recebido</h3><p className="mt-2 text-sm leading-6">A equipe GSA analisará os dados. Depois da aprovação, você receberá o PIN para acessar esta página.</p><button type="button" onClick={() => switchMode('login')} className="mt-5 font-black text-emerald-800 underline">Voltar para o acesso</button></div>}

              {mode === 'register' && !registered && <form onSubmit={register} className="mt-7 space-y-4"><div className="grid grid-cols-2 rounded-xl bg-neutral-100 p-1"><ModeButton active={form.tipo_pessoa === 'pf'} onClick={() => setForm({ ...form, tipo_pessoa: 'pf', documento: '' })}>Pessoa física</ModeButton><ModeButton active={form.tipo_pessoa === 'pj'} onClick={() => setForm({ ...form, tipo_pessoa: 'pj', documento: '' })}>Pessoa jurídica</ModeButton></div><Field label={form.tipo_pessoa === 'pj' ? 'Razão social' : 'Nome completo'}><input required value={form.razao_social} onChange={(event) => setForm({ ...form, razao_social: event.target.value })} className={INPUT_CLASS} /></Field>{form.tipo_pessoa === 'pj' && <div className="grid gap-4 sm:grid-cols-2"><TextField label="Nome fantasia" value={form.nome_fantasia} onChange={(value) => setForm({ ...form, nome_fantasia: value })} /><TextField label="Inscrição estadual" value={form.inscricao_estadual} onChange={(value) => setForm({ ...form, inscricao_estadual: value })} /></div>}<div className="grid gap-4 sm:grid-cols-2"><TextField label={form.tipo_pessoa === 'pj' ? 'CNPJ' : 'CPF'} required inputMode="numeric" value={form.documento} onChange={(value) => setForm({ ...form, documento: form.tipo_pessoa === 'pf' ? maskCPF(value) : maskCNPJ(value) })} /><TextField label="Responsável" required value={form.responsavel_nome} onChange={(value) => setForm({ ...form, responsavel_nome: value })} /></div><div className="grid gap-4 sm:grid-cols-2"><TextField label="E-mail" type="email" required value={form.email} onChange={(value) => setForm({ ...form, email: value })} /><TextField label="Telefone" required value={form.telefone} onChange={(value) => setForm({ ...form, telefone: maskPhone(value) })} /></div><div className="grid gap-4 sm:grid-cols-[110px_1fr_90px]"><TextField label="CEP" value={form.cep} onChange={(value) => setForm({ ...form, cep: value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9) })} /><TextField label="Endereço" value={form.endereco} onChange={(value) => setForm({ ...form, endereco: value })} /><TextField label="Número" value={form.numero} onChange={(value) => setForm({ ...form, numero: value })} /></div><div className="grid gap-4 sm:grid-cols-3"><TextField label="Bairro" value={form.bairro} onChange={(value) => setForm({ ...form, bairro: value })} /><TextField label="Cidade" value={form.cidade} onChange={(value) => setForm({ ...form, cidade: value })} /><TextField label="UF" value={form.estado} onChange={(value) => setForm({ ...form, estado: value.toUpperCase().slice(0, 2) })} /></div><button disabled={loading} className={PRIMARY_CLASS}>{loading ? 'Enviando...' : 'Enviar para análise'}</button></form>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Benefit({ icon: Icon, text }: { icon: typeof Truck; text: string }) { return <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-white/75"><Icon className="h-5 w-5 shrink-0 text-emerald-300" />{text}</div>; }
function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-lg px-3 py-2.5 text-sm font-black ${active ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500'}`}>{children}</button>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-sm font-bold text-neutral-700">{label}{children}</label>; }
function TextField({ label, value, onChange, type = 'text', required = false, inputMode }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'] }) { return <Field label={label}><input required={required} type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} className={INPUT_CLASS} /></Field>; }
