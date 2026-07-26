import { useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  KeyRound,
  ShieldCheck,
  Truck,
  UsersRound,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { LogoGSA } from '../components/ui/LogoGSA';

interface RestrictedAccessHubPageProps {
  onBack: () => void;
  onProviderAccess: () => void;
  onCollaboratorAccess: () => void;
  onManagementAccess: () => void;
  onSupplierAccess: () => void;
}

const profiles = [
  {
    id: 'provider',
    eyebrow: 'Prestação de serviços',
    title: 'Prestador GSA',
    description: 'Demandas, agenda, documentos, benefícios e acompanhamento financeiro.',
    credential: 'Acesso com CPF ou CNPJ e PIN',
    icon: BriefcaseBusiness,
    accent: 'gold',
  },
  {
    id: 'collaborator',
    eyebrow: 'Equipe interna',
    title: 'Colaborador GSA',
    description: 'Acesso aos módulos administrativos autorizados para a sua função.',
    credential: 'Acesso com credencial de equipe',
    icon: UsersRound,
    accent: 'blue',
  },
  {
    id: 'management',
    eyebrow: 'Administração',
    title: 'Gestão GSA',
    description: 'Ambiente de gestão, supervisão operacional e administração do ecossistema.',
    credential: 'Acesso Master protegido',
    icon: KeyRound,
    accent: 'navy',
  },
  {
    id: 'supplier',
    eyebrow: 'Cadeia de suprimentos',
    title: 'Fornecedor GSA',
    description: 'Cotações, pedidos, entregas, documentos comerciais e relacionamento com compras.',
    credential: 'Acesso com CPF ou CNPJ e PIN',
    icon: Truck,
    accent: 'green',
  },
] as const;

export function RestrictedAccessHubPage({
  onBack,
  onProviderAccess,
  onCollaboratorAccess,
  onManagementAccess,
  onSupplierAccess,
}: RestrictedAccessHubPageProps) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;

    document.title = 'Acessos Restritos | GSA HUB';
    if (description) {
      description.content = 'Gateway seguro para prestadores, colaboradores, gestão e fornecedores da GSA HUB.';
    }

    return () => {
      document.title = previousTitle;
      if (description && previousDescription) description.content = previousDescription;
    };
  }, []);

  const handleProfile = (profileId: typeof profiles[number]['id']) => {
    if (profileId === 'provider') onProviderAccess();
    if (profileId === 'collaborator') onCollaboratorAccess();
    if (profileId === 'management') onManagementAccess();
    if (profileId === 'supplier') onSupplierAccess();
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#081321] text-white">
      <a
        href="#restricted-profiles"
        className="sr-only z-50 rounded-lg bg-white px-4 py-3 font-bold text-[#0b1828] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Ir para os perfis de acesso
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
            Voltar às áreas do cliente
          </button>
        </header>

        <section className="mx-auto w-full max-w-5xl pb-8 pt-12 text-center sm:pt-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d8bd73]/25 bg-[#d8bd73]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#e4c36f]">
            <ShieldCheck className="h-4 w-4" />
            Gateway institucional
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-3xl font-black leading-[1.06] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            Selecione o seu perfil de acesso.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/58 sm:text-base">
            Cada ambiente possui autenticação e permissões próprias. Escolha o perfil correspondente à sua relação com a GSA HUB para continuar com segurança.
          </p>
        </section>

        <section id="restricted-profiles" aria-labelledby="restricted-profiles-title" className="mx-auto w-full max-w-6xl">
          <h2 id="restricted-profiles-title" className="sr-only">Perfis de acesso restrito</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {profiles.map((profile, index) => {
              const Icon = profile.icon;
              const accentStyles = {
                gold: {
                  icon: 'border-[#d8bd73]/35 bg-[#d8bd73]/12 text-[#e4c36f]',
                  eyebrow: 'text-[#d8bd73]',
                  hover: 'hover:border-[#d8bd73]/55',
                },
                blue: {
                  icon: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
                  eyebrow: 'text-sky-300',
                  hover: 'hover:border-sky-400/45',
                },
                navy: {
                  icon: 'border-indigo-400/30 bg-indigo-400/10 text-indigo-300',
                  eyebrow: 'text-indigo-300',
                  hover: 'hover:border-indigo-400/45',
                },
                green: {
                  icon: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
                  eyebrow: 'text-emerald-300',
                  hover: 'hover:border-emerald-400/45',
                },
              }[profile.accent];

              return (
                <motion.button
                  key={profile.id}
                  type="button"
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: reduceMotion ? 0 : index * 0.05 }}
                  onClick={() => handleProfile(profile.id)}
                  className={`group relative min-h-[250px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 text-left shadow-[0_24px_60px_rgba(0,0,0,.18)] transition duration-200 hover:bg-white/[0.065] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73] focus-visible:ring-offset-2 focus-visible:ring-offset-[#081321] sm:p-7 ${accentStyles.hover}`}
                  aria-label={`Acessar como ${profile.title}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${accentStyles.icon}`}>
                      <Icon className="h-7 w-7" />
                    </span>
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/55 transition group-hover:border-[#d8bd73]/35 group-hover:text-[#e4c36f]">
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>

                  <p className={`mt-7 text-[10px] font-black uppercase tracking-[0.2em] ${accentStyles.eyebrow}`}>
                    {profile.eyebrow}
                  </p>
                  <h3 className="mt-2 text-2xl font-black tracking-[-0.025em] text-white">{profile.title}</h3>
                  <p className="mt-3 max-w-md text-sm leading-6 text-white/52">{profile.description}</p>

                  <span className="mt-6 inline-flex items-center gap-2 border-t border-white/10 pt-4 text-[11px] font-bold text-white/42">
                    <KeyRound className="h-3.5 w-3.5 text-[#c8a654]" />
                    {profile.credential}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>

        <section className="mx-auto mt-7 grid w-full max-w-6xl gap-4 rounded-2xl border border-white/10 bg-black/10 p-5 text-left sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#d8bd73]/25 bg-[#d8bd73]/10 text-[#e4c36f]">
            <Building2 className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-sm font-black text-white">Não encontrou o perfil correto?</h2>
            <p className="mt-1 text-xs leading-5 text-white/48">
              Clientes Pessoa Física e empresas clientes utilizam as áreas PF e PJ disponíveis na página anterior.
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-xs font-black text-white/70 transition hover:border-white/30 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]"
          >
            Ver áreas do cliente
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>

        <footer className="mt-auto flex flex-col items-center justify-between gap-3 border-t border-white/10 py-6 text-center text-[11px] text-white/35 sm:mt-10 sm:flex-row sm:text-left">
          <span>© {new Date().getFullYear()} GSA HUB. Ambientes institucionais protegidos.</span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#b88a35]" />
            O acesso é liberado somente após autenticação e validação do perfil.
          </span>
        </footer>
      </div>
    </main>
  );
}
