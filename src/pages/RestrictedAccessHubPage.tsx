import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  UserCog,
  UsersRound,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { LogoGSA } from '../components/ui/LogoGSA';
import { logService } from '../lib/logService';
import { sessionService } from '../lib/sessionService';

export type RestrictedAccessRole = 'colaborador' | 'gestao';

interface RestrictedAccessHubPageProps {
  initialRole?: RestrictedAccessRole;
  onBack: () => void;
  onLoginAdmin: (details: {
    type: 'admin' | 'colaborador';
    id?: string;
    nome?: string;
    modulos?: string[];
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
      if (role === 'gestao') {
        const data = await sessionService.loginAdmin(code.trim());
        if (!data?.valid) throw new Error('Código Master inválido.');
        await logService.logAction({
          ator_tipo: 'admin',
          acao: 'LOGIN',
          detalhes: 'Acesso Master pela página exclusiva da Área Restrita',
        });
        toast.success('Acesso à Gestão autorizado.');
        onLoginAdmin({ type: 'admin' });
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
    <main className="relative min-h-screen overflow-hidden bg-[#07111f] text-white">
      <a
        href="#restricted-login"
        className="sr-only z-50 rounded-lg bg-white px-4 py-3 font-bold text-[#0b1828] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Ir para o acesso
      </a>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(216,189,115,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(216,189,115,.08)_1px,transparent_1px)] [background-size:44px_44px]"
      />
      <div aria-hidden="true" className="pointer-events-none absolute -left-44 top-20 h-[30rem] w-[30rem] rounded-full bg-[#254a73]/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-44 bottom-0 h-[32rem] w-[32rem] rounded-full bg-[#a87c2b]/12 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1360px] flex-col px-4 py-5 sm:px-7 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <LogoGSA size="sm" variant="light" showText />
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-bold text-white/75 transition hover:border-white/30 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar às áreas de acesso
          </button>
        </header>

        <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[0.88fr_1.12fr] lg:gap-14 lg:py-14">
          <section>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d8bd73]/25 bg-[#d8bd73]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#e4c36f]">
              <ShieldCheck className="h-4 w-4" />
              Ambiente institucional protegido
            </span>
            <h1 className="mt-7 max-w-xl text-4xl font-black leading-[1.04] tracking-[-0.045em] sm:text-5xl xl:text-6xl">
              Área Restrita GSA.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/60 sm:text-base">
              Este ambiente é exclusivo para profissionais da estrutura interna da GSA HUB. Selecione seu perfil e utilize a credencial fornecida pela administração.
            </p>

            <div className="mt-9 grid gap-4 sm:grid-cols-2">
              {([
                ['colaborador', roleContent.colaborador],
                ['gestao', roleContent.gestao],
              ] as const).map(([roleId, content]) => {
                const Icon = content.icon;
                const isActive = role === roleId;
                return (
                  <button
                    key={roleId}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => selectRole(roleId)}
                    className={`min-h-[190px] rounded-[1.5rem] border p-5 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73] ${
                      isActive
                        ? 'border-[#d8bd73]/65 bg-white/[0.09] shadow-[0_22px_55px_rgba(0,0,0,.2)]'
                        : 'border-white/10 bg-white/[0.035] hover:border-white/25 hover:bg-white/[0.055]'
                    }`}
                  >
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                      isActive
                        ? 'border-[#d8bd73]/40 bg-[#d8bd73]/12 text-[#e4c36f]'
                        : 'border-white/10 bg-white/5 text-white/55'
                    }`}>
                      <Icon className="h-6 w-6" />
                    </span>
                    <p className={`mt-5 text-[10px] font-black uppercase tracking-[0.18em] ${
                      isActive ? 'text-[#d8bd73]' : 'text-white/40'
                    }`}>
                      {content.eyebrow}
                    </p>
                    <h2 className="mt-2 text-xl font-black text-white">{content.title}</h2>
                    <p className="mt-2 text-xs leading-5 text-white/50">{content.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-7 flex items-start gap-3 border-t border-white/10 pt-6 text-xs leading-5 text-white/42">
              <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-[#d8bd73]" />
              <span>Prestadores e fornecedores possuem áreas próprias e não utilizam este acesso restrito.</span>
            </div>
          </section>

          <motion.section
            id="restricted-login"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#f8fafc] text-[#0b1828] shadow-[0_32px_90px_rgba(0,0,0,.35)]"
          >
            <div className="border-b border-[#e0e6eb] bg-white px-6 py-7 sm:px-9">
              <div className="flex items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#0b1828] text-[#e4c36f]">
                  <SelectedIcon className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a742b]">{selected.eyebrow}</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">{selected.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#687684]">{selected.description}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleLogin} className="px-6 py-8 sm:px-9 sm:py-10">
              <label htmlFor={`restricted-code-${role}`} className="block text-sm font-black text-[#344154]">
                {selected.label}
              </label>
              <p className="mt-2 text-xs leading-5 text-[#71808e]">
                Digite a credencial individual recebida da administração da GSA.
              </p>

              <div className="relative mt-4">
                <input
                  key={role}
                  id={`restricted-code-${role}`}
                  name="access-code"
                  type={showCode ? 'text' : 'password'}
                  autoComplete="current-password"
                  inputMode="numeric"
                  required
                  autoFocus
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Digite sua credencial"
                  className="min-h-16 w-full rounded-xl border border-[#d3dbe2] bg-white px-4 pr-14 text-center font-mono text-xl font-black tracking-[0.3em] text-[#0b1828] outline-none transition placeholder:text-sm placeholder:font-semibold placeholder:tracking-normal placeholder:text-[#9aa5b1] focus:border-[#9a742b] focus:ring-4 focus:ring-[#d8bd73]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowCode((current) => !current)}
                  aria-label={showCode ? 'Ocultar credencial' : 'Mostrar credencial'}
                  className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[#71808e] transition hover:bg-[#eef2f5] hover:text-[#0b1828] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a742b]"
                >
                  {showCode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0b1828] px-5 text-sm font-black text-white shadow-[0_12px_30px_rgba(11,24,40,.18)] transition hover:bg-[#142a43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a742b] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {loading ? 'Autorizando acesso...' : selected.button}
              </button>

              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#d9c38c] bg-[#fbf7ea] p-4 text-xs leading-5 text-[#665126]">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#9a742b]" />
                <span>O perfil e os módulos autorizados são confirmados pelo servidor antes da abertura do painel.</span>
              </div>
            </form>
          </motion.section>
        </div>

        <footer className="flex flex-col items-center justify-between gap-3 border-t border-white/10 py-5 text-center text-[11px] text-white/35 sm:flex-row sm:text-left">
          <span>© {new Date().getFullYear()} GSA HUB. Uso exclusivo da estrutura interna.</span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#b88a35]" />
            Nenhuma informação administrativa é exibida antes da autenticação.
          </span>
        </footer>
      </div>
    </main>
  );
}
