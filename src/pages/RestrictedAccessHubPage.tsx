import { useEffect, useState, type FormEvent } from 'react';
import {
  Eye,
  Tv2,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  UserCog,
  UsersRound,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  InstitutionalAccessHero,
  InstitutionalAccessLayout,
} from '../components/public/InstitutionalAccessLayout';
import { logService } from '../lib/logService';
import { sessionService } from '../lib/sessionService';

export type RestrictedAccessRole = 'colaborador' | 'gestao' | 'gsatv';

interface RestrictedAccessHubPageProps {
  initialRole?: RestrictedAccessRole;
  onBack: () => void;
  onLoginAdmin: (details: {
    type: 'admin' | 'colaborador';
    id?: string;
    nome?: string;
    modulos?: string[];
    isGsaTv?: boolean;
  }) => void;
}

const roleContent = {
  colaborador: {
    eyebrow: 'Equipe interna',
    title: 'Colaborador GSA',
    description: 'Acesse somente os módulos administrativos autorizados para sua função.',
    label: 'Credencial de colaborador',
    button: 'Entrar como colaborador',
    icon: UsersRound,
  },
  gestao: {
    eyebrow: 'Administração',
    title: 'Gestão GSA',
    description: 'Acesso Master ao ambiente de gestão, supervisão e administração do ecossistema.',
    label: 'Código Master',
    button: 'Entrar na gestão',
    icon: UserCog,
  },
  gsatv: {
    eyebrow: 'Transmissão',
    title: 'GSA TV',
    description: 'Acesso Master à emissora, operações e controle de mídia.',
    label: 'Código Master',
    button: 'Entrar na GSA TV',
    icon: Tv2,
  },
} as const;

export function RestrictedAccessHubPage({
  initialRole = 'colaborador',
  onBack,
  onLoginAdmin,
}: RestrictedAccessHubPageProps) {
  const reduceMotion = useReducedMotion();
  const [role, setRole] = useState<RestrictedAccessRole>(initialRole);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    setRole(initialRole);
    setCode('');
    setShowCode(false);
  }, [initialRole]);

  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;

    document.title = 'Área Restrita | GSA HUB';
    if (description) {
      description.content = 'Acesso institucional exclusivo para Gestão e Colaboradores autorizados da GSA HUB.';
    }

    return () => {
      document.title = previousTitle;
      if (description && previousDescription) description.content = previousDescription;
    };
  }, []);

  const selectRole = (nextRole: RestrictedAccessRole) => {
    setRole(nextRole);
    setCode('');
    setShowCode(false);
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim() || loading) {
      toast.error('Informe sua credencial de acesso.');
      return;
    }

    setLoading(true);
    try {
      if (role === 'gestao' || role === 'gsatv') {
        const data = await sessionService.loginAdmin(code.trim());
        if (!data?.valid) throw new Error('Código Master inválido.');
        await logService.logAction({
          ator_tipo: 'admin',
          acao: 'LOGIN',
          detalhes: role === 'gsatv' ? 'Acesso Master à GSA TV pela Área Restrita' : 'Acesso Master pela página exclusiva da Área Restrita',
        });
        toast.success(role === 'gsatv' ? 'Acesso à GSA TV autorizado.' : 'Acesso à Gestão autorizado.');
        if (role === 'gsatv') {
          const params = new URLSearchParams(window.location.search);
          if (!params.get('returnTo')) {
            window.history.replaceState({}, '', `${window.location.pathname}?returnTo=${encodeURIComponent('/admin/gsa-tv')}`);
          }
        }
        onLoginAdmin({ type: 'admin', isGsaTv: role === 'gsatv' });
        return;
      }

      const data = await sessionService.loginColaborador(code.trim());
      if (!data?.valid) throw new Error('Credencial inválida ou colaborador inativo.');
      await logService.logAction({
        ator_tipo: 'colaborador',
        ator_id: data.id,
        ator_nome: data.nome,
        acao: 'LOGIN',
        detalhes: 'Acesso de colaborador pela página exclusiva da Área Restrita',
      });
      toast.success('Acesso de colaborador autorizado.');
      onLoginAdmin({
        type: 'colaborador',
        id: data.id,
        nome: data.nome,
        modulos: data.modulos || [],
      });
    } catch (error: any) {
      setCode('');
      toast.error(error?.message || 'Não foi possível autorizar o acesso.');
    } finally {
      setLoading(false);
    }
  };

  const selected = roleContent[role];
  const SelectedIcon = selected.icon;

  return (
    <InstitutionalAccessLayout
      onBack={onBack}
      backLabel="Voltar aos acessos"
      skipTarget="restricted-login"
      footerNote="Uso exclusivo da estrutura interna"
    >
      <InstitutionalAccessHero
        eyebrow="GSA HUB · Equipe interna"
        title="Área Restrita GSA"
        description="Ambiente exclusivo para profissionais da estrutura interna. Selecione o seu perfil e informe a credencial fornecida pela administração."
        aside={(
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#d5b86b]" />
            <p>
              <strong className="font-semibold text-white">Acesso protegido.</strong>{' '}
              O perfil e os módulos autorizados são validados antes da abertura do painel.
            </p>
          </div>
        )}
      />

      <section
        id="restricted-login"
        tabIndex={-1}
        className="px-5 py-12 focus:outline-none sm:px-8 lg:px-10 lg:py-16"
      >
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid gap-5 border-b border-[#cbc2b2] pb-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#806329]">Identificação de acesso</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#0b1825] sm:text-4xl">
                Selecione o seu perfil
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[#60666b] lg:justify-self-end">
              Utilize somente a credencial vinculada à sua função. Prestadores e fornecedores possuem portais próprios.
            </p>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:gap-12">
            <div>
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                {([
                  ['colaborador', roleContent.colaborador],
                  ['gestao', roleContent.gestao],
                  ['gsatv', roleContent.gsatv],
                ] as const).map(([roleId, content]) => {
                  const Icon = content.icon;
                  const isActive = role === roleId;

                  return (
                    <button
                      key={roleId}
                      type="button"
                      aria-pressed={isActive}
                      aria-controls="restricted-credential-form"
                      onClick={() => selectRole(roleId)}
                      className={`group relative flex min-h-[140px] flex-col justify-between overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a651f] sm:p-6 ${
                        isActive
                          ? 'border-transparent bg-[#0b1522] text-white shadow-xl shadow-[#0b1522]/10 scale-[1.02]'
                          : 'border-[#e2e7eb] bg-white text-[#344154] hover:border-[#d8bd73]/50 hover:bg-[#fffcf5] hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-5">
                        <span className={`flex h-12 w-12 items-center justify-center rounded-xl border transition-colors ${
                          isActive
                            ? 'border-[#d8bd73]/30 bg-[#d8bd73]/10 text-[#edcf83]'
                            : 'border-[#e2e7eb] bg-[#f8f9fa] text-[#71808e] group-hover:border-[#d8bd73]/30 group-hover:bg-[#d8bd73]/10 group-hover:text-[#8a651f]'
                        }`}>
                          <Icon className="h-6 w-6" />
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${
                          isActive ? 'text-[#d5b86b]' : 'text-[#9aa4af] group-hover:text-[#8a651f]'
                        }`}>
                          {isActive ? 'Selecionado' : content.eyebrow}
                        </span>
                      </div>
                      <div>
                        <h3 className={`mt-5 text-lg font-black transition-colors ${isActive ? 'text-white' : 'text-[#0b1522]'}`}>{content.title}</h3>
                        <p className={`mt-2 text-xs leading-5 transition-colors ${isActive ? 'text-white/60' : 'text-[#71808e]'}`}>
                          {content.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex items-start gap-3 border-l-2 border-[#a9873c] pl-4 text-xs leading-6 text-[#60666b]">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#806329]" />
                <span>A credencial é pessoal e não deve ser compartilhada.</span>
              </div>
            </div>

            <motion.section
              key={role} // forçar re-render na animação quando trocar perfil
              initial={reduceMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col overflow-hidden rounded-[2rem] border border-[#e2e7eb] bg-[#fbfcfd] shadow-2xl shadow-black/5"
            >
              <div className="border-b border-[#e2e7eb] bg-white px-6 py-6 sm:px-10 sm:py-8">
                <div className="flex items-start gap-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#d8bd73]/35 bg-[#fff9ea] text-[#8a651f]">
                    <SelectedIcon className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8a651f]">{selected.eyebrow}</p>
                    <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-[#0b1522] sm:text-3xl">{selected.title}</h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-[#71808e]">{selected.description}</p>
                  </div>
                </div>
              </div>

              <form id="restricted-credential-form" onSubmit={handleLogin} className="flex flex-1 flex-col">
                <div className="flex-1 px-6 py-8 sm:px-10">
                  <label htmlFor={`restricted-code-${role}`} className="grid gap-2 text-sm font-bold text-[#344154]">
                    {selected.label}
                    <p className="text-xs font-normal leading-5 text-[#71808e]">
                      Digite a credencial individual recebida da administração da GSA.
                    </p>
                  </label>

                  <div className="relative mt-5">
                    <input
                      key={role}
                      id={`restricted-code-${role}`}
                      name="access-code"
                      type={showCode ? 'text' : 'password'}
                      autoComplete="current-password"
                      inputMode="numeric"
                      required
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      placeholder="Digite sua credencial"
                      className="min-h-16 w-full rounded-xl border border-[#d7dde3] bg-white px-5 pr-14 text-center font-mono text-xl tracking-[0.24em] text-[#0b1522] outline-none transition placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-[#9aa4af] focus:border-[#8a651f] focus:ring-4 focus:ring-[#d8bd73]/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCode((current) => !current)}
                      aria-label={showCode ? 'Ocultar credencial' : 'Mostrar credencial'}
                      className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-lg text-[#9aa4af] transition hover:bg-[#f1f3f5] hover:text-[#0b1522] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a651f]"
                    >
                      {showCode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !code.trim()}
                    className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0b1522] px-5 text-sm font-black text-white transition hover:bg-[#14263a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a651f] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4 text-[#d5b86b]" />}
                    {loading ? 'Autorizando acesso...' : selected.button}
                  </button>
                </div>

                <div className="flex items-start gap-3 border-t border-[#e2e7eb] bg-[#f4f6f8] px-6 py-5 text-xs leading-5 text-[#71808e] sm:px-10">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#8a651f]" />
                  <span>Nenhuma informação administrativa é exibida antes da autenticação. Sessão criptografada ponta a ponta.</span>
                </div>
              </form>
            </motion.section>
          </div>
        </div>
      </section>
    </InstitutionalAccessLayout>
  );
}
