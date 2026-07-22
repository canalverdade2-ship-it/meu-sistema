import { useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  BadgeDollarSign,
  CheckCircle2,
  ChevronRight,
  Link2,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LogoGSA } from '../../components/ui/LogoGSA';
import { PinInput } from '../../components/ui/PinInput';
import { logService } from '../../lib/logService';
import { sessionService } from '../../lib/sessionService';
import { supabase } from '../../lib/supabase';
import { maskCEP, maskCNPJ, maskCPF, maskPhone } from '../../lib/utils';
import { validarCNPJ, validarCPF, validarEmail } from '../../utils/cpfValidator';
import { consultarCEP } from '../../utils/viaCep';

type AccessMode = 'login' | 'register';
type LoginStage = 'document' | 'pin';

const EMPTY_REGISTRATION = {
  nome: '',
  documento: '',
  nome_divulgacao: '',
  email: '',
  telefone: '',
  pix_tipo: 'cpf_cnpj',
  pix_chave: '',
  cep: '',
  endereco: '',
  numero: '',
  bairro: '',
  cidade: '',
  estado: '',
  termos_aceitos: false,
};

const INPUT_CLASS =
  'mt-2 w-full rounded-xl border border-neutral-300 bg-neutral-50/50 px-4 py-3.5 text-neutral-900 placeholder-neutral-400 outline-none transition focus:border-[#7a5a1b] focus:bg-white focus:ring-2 focus:ring-[#7a5a1b]/15 font-medium';
const PRIMARY_CLASS =
  'w-full rounded-xl bg-[#111318] px-5 py-3.5 font-black text-white shadow-lg shadow-neutral-900/10 transition hover:bg-[#7a5a1b] disabled:cursor-not-allowed disabled:opacity-50';

interface AffiliateAccessPageProps {
  onLogin: (clientId?: string) => void;
  onBack: () => void;
  initialMode?: AccessMode;
}

function formatTaxDocument(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length <= 11 ? maskCPF(digits) : maskCNPJ(digits);
}

export function AffiliateAccessPage({ onLogin, onBack, initialMode = 'login' }: AffiliateAccessPageProps) {
  const [mode, setMode] = useState<AccessMode>(initialMode);
  const [stage, setStage] = useState<LoginStage>('document');
  const [documentInput, setDocumentInput] = useState('');
  const [pin, setPin] = useState('');
  const [form, setForm] = useState(EMPTY_REGISTRATION);
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [registered, setRegistered] = useState(false);

  const switchMode = (next: AccessMode) => {
    setMode(next);
    setStage('document');
    setPin('');
    setRegistered(false);
  };

  const updateForm = <K extends keyof typeof EMPTY_REGISTRATION>(field: K, value: (typeof EMPTY_REGISTRATION)[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleCepLookup = async (rawValue: string) => {
    const masked = maskCEP(rawValue);
    updateForm('cep', masked);

    const clean = rawValue.replace(/\D/g, '');
    if (clean.length === 8) {
      setLoadingCep(true);
      try {
        const data = await consultarCEP(clean);
        if (data) {
          setForm((current) => ({
            ...current,
            cep: masked,
            endereco: data.logradouro || current.endereco,
            bairro: data.bairro || current.bairro,
            cidade: data.localidade || current.cidade,
            estado: data.uf || current.state || current.estado,
          }));
          toast.success('Endereço localizado via CEP.');
        } else {
          toast.error('CEP não encontrado. Preencha o endereço manualmente.');
        }
      } catch {
        // quiet error
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const continueLogin = (event: FormEvent) => {
    event.preventDefault();
    const clean = documentInput.replace(/\D/g, '');
    const isEmail = validarEmail(documentInput.trim());

    if (!isEmail) {
      const validDoc = clean.length === 11 ? validarCPF(clean) : clean.length === 14 && validarCNPJ(clean);
      if (!validDoc) return toast.error('Informe um CPF, CNPJ ou e-mail válido.');
    }
    setStage('pin');
  };

  const login = async () => {
    if (pin.length !== 4 || loading) return;
    setLoading(true);
    try {
      const cleanDoc = documentInput.replace(/\D/g, '');
      const loginPayload = cleanDoc ? cleanDoc : documentInput.trim();
      const data = await sessionService.loginWithPin(loginPayload, pin, 'cliente');

      if (!data?.valid) {
        throw new Error(data?.error === 'blocked' ? 'Acesso temporariamente bloqueado.' : 'Documento, e-mail ou PIN incorreto.');
      }

      await logService.logAction({
        ator_tipo: 'cliente',
        ator_id: data.id,
        ator_nome: data.nome,
        acao: 'LOGIN_AFILIADO',
        detalhes: 'Acesso efetuado pelo Portal Exclusivo do Afiliado',
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
    const cleanDocument = form.documento.replace(/\D/g, '');
    const validDoc = cleanDocument.length === 11 ? validarCPF(cleanDocument) : cleanDocument.length === 14 && validarCNPJ(cleanDocument);

    if (!validDoc) return toast.error('Informe um CPF ou CNPJ válido.');
    if (!validarEmail(form.email)) return toast.error('Informe um e-mail válido.');
    if (!form.termos_aceitos) return toast.error('É necessário concordar com os termos do programa.');

    setLoading(true);
    try {
      const { error } = await supabase.rpc('gsa_public_register_affiliate', {
        p_payload: {
          ...form,
          documento: cleanDocument,
          telefone: form.telefone.replace(/\D/g, ''),
          cep: form.cep.replace(/\D/g, ''),
        },
      });

      if (error) throw error;
      setRegistered(true);
      setForm(EMPTY_REGISTRATION);
      toast.success('Perfil de afiliado registrado com sucesso!');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível enviar a solicitação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f5f0] text-neutral-900">
      <header className="border-b border-neutral-200/80 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <LogoGSA size="md" variant="dark" />
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700 shadow-sm transition hover:border-[#7a5a1b] hover:text-[#7a5a1b]"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para o programa
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
        <section className="rounded-[2rem] border border-[#d8bd73]/40 bg-white p-6 shadow-[0_16px_50px_rgba(0,0,0,0.05)] sm:p-8">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-6">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7a5a1b]">Portal Exclusivo</p>
              <h1 className="mt-1 font-serif text-2xl font-black text-neutral-950 sm:text-3xl">Área do Afiliado GSA</h1>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5eece] text-[#7a5a1b]">
              <BadgeDollarSign className="h-7 w-7" />
            </div>
          </div>

          <div className="mt-6 flex rounded-2xl bg-neutral-100 p-1.5 ring-1 ring-neutral-200/60">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 rounded-xl py-3 text-xs font-black uppercase tracking-wider transition ${mode === 'login' ? 'bg-[#7a5a1b] text-white shadow-md' : 'text-neutral-600 hover:text-neutral-900'}`}
            >
              Entrar no Portal
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 rounded-xl py-3 text-xs font-black uppercase tracking-wider transition ${mode === 'register' ? 'bg-[#7a5a1b] text-white shadow-md' : 'text-neutral-600 hover:text-neutral-900'}`}
            >
              Quero ser Afiliado
            </button>
          </div>

          {mode === 'login' && (
            <div className="mt-8">
              {stage === 'document' ? (
                <form onSubmit={continueLogin} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                      CPF, CNPJ ou E-mail cadastrado
                    </label>
                    <input
                      required
                      value={documentInput}
                      onChange={(e) => setDocumentInput(formatTaxDocument(e.target.value))}
                      placeholder="000.000.000-00 ou seu-email@dominio.com"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <button type="submit" className={PRIMARY_CLASS}>
                    Continuar <ChevronRight className="ml-1 inline h-4 w-4" />
                  </button>
                </form>
              ) : (
                <div className="space-y-6 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f5eece] text-[#7a5a1b]">
                    <LockKeyhole className="h-7 w-7" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-neutral-900">Informe seu PIN de 4 dígitos</h2>
                    <p className="mt-1 text-xs text-neutral-500">
                      Acesso para: <strong className="text-neutral-900">{documentInput}</strong>
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <PinInput value={pin} onChange={setPin} disabled={loading} onComplete={login} />
                  </div>

                  <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:justify-between">
                    <button
                      type="button"
                      onClick={() => setStage('document')}
                      className="text-xs font-bold text-neutral-500 hover:text-neutral-900 underline"
                    >
                      Alterar documento
                    </button>
                    <button
                      type="button"
                      onClick={login}
                      disabled={pin.length !== 4 || loading}
                      className="rounded-xl bg-[#7a5a1b] px-6 py-2.5 text-xs font-black text-white shadow-md disabled:opacity-50"
                    >
                      {loading ? 'Entrando...' : 'Confirmar Acesso'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'register' && registered && (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 text-emerald-900">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <h3 className="mt-4 text-xl font-black text-emerald-950">Cadastro de Afiliado Concluído!</h3>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                Seu perfil de afiliado está ativo. Você já pode fazer login utilizando seu CPF/CNPJ e o PIN da sua conta GSA para acompanhar suas comissões e gerar seus links exclusivos.
              </p>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-6 py-3 text-xs font-black text-white shadow-sm hover:bg-[#7a5a1b]"
              >
                Ir para Login de Afiliado <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {mode === 'register' && !registered && (
            <form onSubmit={register} className="mt-8 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome completo ou Razão Social">
                  <input
                    required
                    value={form.nome}
                    onChange={(e) => updateForm('nome', e.target.value)}
                    placeholder="Seu nome completo"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="CPF ou CNPJ">
                  <input
                    required
                    inputMode="numeric"
                    value={form.documento}
                    onChange={(e) => updateForm('documento', formatTaxDocument(e.target.value))}
                    placeholder="000.000.000-00"
                    className={INPUT_CLASS}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome de Divulgação / Canal">
                  <input
                    required
                    value={form.nome_divulgacao}
                    onChange={(e) => updateForm('nome_divulgacao', e.target.value)}
                    placeholder="Ex.: João Divulgações"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="E-mail principal">
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => updateForm('email', e.target.value)}
                    placeholder="seu-email@dominio.com"
                    className={INPUT_CLASS}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Telefone / WhatsApp">
                  <input
                    required
                    value={form.telefone}
                    onChange={(e) => updateForm('telefone', maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Chave PIX para recebimentos">
                  <input
                    required
                    value={form.pix_chave}
                    onChange={(e) => updateForm('pix_chave', e.target.value)}
                    placeholder="CPF, CNPJ, e-mail ou celular"
                    className={INPUT_CLASS}
                  />
                </Field>
              </div>

              <div className="border-t border-neutral-200/80 pt-5">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#7a5a1b]">
                  <MapPin className="h-4 w-4" /> Endereço Comercial
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-[140px_1fr_100px]">
                  <Field label={loadingCep ? 'CEP (buscando...)' : 'CEP'}>
                    <input
                      required
                      inputMode="numeric"
                      value={form.cep}
                      onChange={(e) => handleCepLookup(e.target.value)}
                      placeholder="00000-000"
                      className={INPUT_CLASS}
                    />
                  </Field>
                  <Field label="Rua / Avenida">
                    <input
                      required
                      value={form.endereco}
                      onChange={(e) => updateForm('endereco', e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </Field>
                  <Field label="Número">
                    <input
                      required
                      value={form.numero}
                      onChange={(e) => updateForm('numero', e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </Field>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <Field label="Bairro">
                    <input
                      required
                      value={form.bairro}
                      onChange={(e) => updateForm('bairro', e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </Field>
                  <Field label="Cidade">
                    <input
                      required
                      value={form.cidade}
                      onChange={(e) => updateForm('cidade', e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </Field>
                  <Field label="UF">
                    <input
                      required
                      value={form.estado}
                      onChange={(e) => updateForm('estado', e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="SP"
                      className={INPUT_CLASS}
                    />
                  </Field>
                </div>
              </div>

              <label className="flex items-start gap-3 pt-3 text-xs text-neutral-700 font-medium">
                <input
                  type="checkbox"
                  checked={form.termos_aceitos}
                  onChange={(e) => updateForm('termos_aceitos', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-[#7a5a1b] focus:ring-[#7a5a1b]"
                />
                <span>
                  Declaro que aceito as regras e os <strong className="text-neutral-900">Termos do Programa de Afiliados GSA</strong>.
                </span>
              </label>

              <button type="submit" disabled={loading} className={PRIMARY_CLASS}>
                {loading ? 'Cadastrando...' : 'Concluir Cadastro de Afiliado'}
              </button>
            </form>
          )}
        </section>

        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-[#d8bd73]/40 bg-gradient-to-br from-[#faf7f0] to-[#eee8d5] p-6 shadow-sm sm:p-8">
            <h2 className="font-serif text-2xl font-black text-neutral-950">Por que ser um Afiliado GSA?</h2>
            <p className="mt-2 text-xs leading-6 text-neutral-600 font-medium">
              Transforme a sua rede de contatos e audiência em receita recorrente indicando as melhores soluções corporativas do mercado.
            </p>

            <div className="mt-6 space-y-4">
              <BenefitItem
                icon={BadgeDollarSign}
                title="Comissões Atrativas"
                description="Ganhe até 5% sobre as vendas realizadas através do seu link exclusivo."
              />
              <BenefitItem
                icon={Link2}
                title="Links Rastreáveis"
                description="Gere links personalizados para cada serviço, produto ou pacote da plataforma."
              />
              <BenefitItem
                icon={Wallet}
                title="Saques Descomplicados via PIX"
                description="Receba suas comissões diretamente na sua conta PIX assim que liberadas."
              />
              <BenefitItem
                icon={ShieldCheck}
                title="Transparência Total"
                description="Acompanhe cliques, conversões e saldo em tempo real no seu painel."
              />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function BenefitItem({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3.5 rounded-2xl border border-[#d8bd73]/30 bg-white/90 p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f5eece] text-[#7a5a1b]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-sm font-black text-neutral-900">{title}</h3>
        <p className="mt-0.5 text-xs leading-5 text-neutral-600">{description}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
      {label}
      {children}
    </label>
  );
}
