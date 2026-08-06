import { motion } from 'framer-motion';
import {
  ArrowRight,
  BriefcaseBusiness,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Code2,
  HeartPulse,
  Layers3,
  Network,
  Palette,
  Search,
  ShieldCheck,
  ShoppingBag,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { PublicPage } from '../../../data/publicServiceCatalog';
import { navigate } from '../../../routing/navigationService';
import { routes } from '../../../routing/routeCatalog';
import { AdvertisingSlot } from '../../ads/AdvertisingSlot';

interface PublicHomeLandingProps {
  reduceMotion: boolean;
  setPublicPage: (page: PublicPage) => void;
  onGuestStore?: () => void;
}

interface HomeAction {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  action: () => void;
}

interface EcosystemArea extends HomeAction {
  number: string;
  linkLabel: string;
}

const reveal = (reduceMotion: boolean, delay = 0) => ({
  initial: reduceMotion ? false : { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: { duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export function PublicHomeLanding({ reduceMotion, setPublicPage, onGuestStore }: PublicHomeLandingProps) {
  const openStore = onGuestStore || (() => navigate(routes.marketplace.root()));

  const navigatorActions: HomeAction[] = [
    {
      eyebrow: 'Tecnologia',
      title: 'Criar um site, aplicativo ou sistema',
      description: 'Projetos digitais planejados para a realidade da sua operação.',
      icon: Code2,
      action: () => setPublicPage('systems'),
    },
    {
      eyebrow: 'Gestão',
      title: 'Contratar Serviços',
      description: 'Serviços e assinaturas para pessoas, MEIs e empresas.',
      icon: BriefcaseBusiness,
      action: () => setPublicPage('services'),
    },
    {
      eyebrow: 'GSA Store',
      title: 'Produtos e Soluções',
      description: 'Uma experiência comercial integrada ao ecossistema GSA.',
      icon: ShoppingBag,
      action: openStore,
    },
    {
      eyebrow: 'Jornada de Marca',
      title: 'Identidade & Web Design',
      description: 'Nome, identidade, presença digital, site e estrutura de marca conectados.',
      icon: Palette,
      action: () => navigate('/empresa-do-zero-ao-digital'),
    },
    {
      eyebrow: 'Utilidade pública',
      title: 'Serviços gratuitos',
      description: 'Calculadoras, simuladores e ferramentas para decisões do dia a dia.',
      icon: Calculator,
      action: () => setPublicPage('free-tools'),
    },
  ];

  const ecosystemAreas: EcosystemArea[] = [
    {
      number: '01',
      eyebrow: 'Tecnologia que resolve',
      title: 'Sites, sistemas e plataformas digitais',
      description: 'Do diagnóstico à evolução: sites institucionais, lojas virtuais, aplicativos, portais, integrações, automações e sistemas sob medida.',
      icon: Code2,
      linkLabel: 'Apresentar meu projeto',
      action: () => setPublicPage('systems'),
    },
    {
      number: '02',
      eyebrow: 'Cuidado e orientação',
      title: 'GSA Saúde',
      description: 'Uma jornada direta para solicitar cotações de soluções individuais, familiares, empresariais e odontológicas, sem catálogos confusos.',
      icon: HeartPulse,
      linkLabel: 'Solicitar uma cotação',
      action: () => navigate(routes.marketplace.saude.root()),
    },
    {
      number: '03',
      eyebrow: 'Proteção para cada fase',
      title: 'GSA Seguros',
      description: 'Solicitações de cotação para automóveis, residências, vida e empresas, com direcionamento claro desde a categoria escolhida.',
      icon: ShieldCheck,
      linkLabel: 'Encontrar uma proteção',
      action: () => navigate(routes.marketplace.seguros.root()),
    },
    {
      number: '04',
      eyebrow: 'Comércio conectado',
      title: 'GSA Store',
      description: 'Produtos, assinaturas e oportunidades comerciais reunidos em uma loja integrada aos demais ambientes da GSA Hub.',
      icon: ShoppingBag,
      linkLabel: 'Conhecer a GSA Store',
      action: openStore,
    },
    {
      number: '05',
      eyebrow: 'Estrutura para avançar',
      title: 'Serviços administrativos e assinaturas',
      description: 'Apoio organizado para demandas administrativas, empresariais, financeiras e operacionais de pessoas, MEIs e empresas.',
      icon: BriefcaseBusiness,
      linkLabel: 'Ver serviços disponíveis',
      action: () => setPublicPage('services'),
    },
    {
      number: '06',
      eyebrow: 'Da origem à presença digital',
      title: 'Empresa do Zero ao Digital',
      description: 'Nome, identidade, presença digital, site e estrutura de marca conectados em uma jornada completa e responsável.',
      icon: Palette,
      linkLabel: 'Conhecer a jornada',
      action: () => navigate('/empresa-do-zero-ao-digital'),
    },
  ];

  const accessPoints: HomeAction[] = [
    {
      eyebrow: 'Utilidade pública',
      title: 'Serviços gratuitos',
      description: 'Calculadoras, simuladores e ferramentas para decisões do dia a dia.',
      icon: Calculator,
      action: () => setPublicPage('free-tools'),
    },
    {
      eyebrow: 'Rede GSA',
      title: 'Nossos Parceiros',
      description: 'Conheça empresas e profissionais conectados ao ecossistema.',
      icon: Network,
      action: () => navigate(routes.public.partners()),
    },
    {
      eyebrow: 'Carreiras',
      title: 'Trabalhe conosco',
      description: 'Descubra oportunidades e acompanhe sua jornada profissional.',
      icon: UsersRound,
      action: () => navigate(routes.public.careers()),
    },
  ];

  return (
    <main className="overflow-hidden bg-[#f3f0e8]">
      <AdvertisingSlot placementCode="HOME_LIGHTBOX" variant="lightbox" />

      <section className="relative isolate min-h-[100svh] overflow-hidden bg-[#07111d] text-white">
        <img
          src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2200&q=82"
          srcSet="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=78 900w, https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1500&q=80 1500w, https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2200&q=82 2200w"
          sizes="100vw"
          alt="Arquitetura empresarial contemporânea"
          fetchPriority="high"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-30 grayscale"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(7,17,29,0.98)_0%,rgba(7,17,29,0.92)_45%,rgba(7,17,29,0.58)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,#d5b86b,transparent)] opacity-80" />
        <div className="pointer-events-none absolute -right-32 top-24 h-[36rem] w-[36rem] rounded-full border border-[#d5b86b]/15" />
        <div className="pointer-events-none absolute -right-8 top-56 h-[22rem] w-[22rem] rounded-full border border-white/10" />

        <div className="mx-auto flex min-h-[100svh] max-w-7xl flex-col px-5 pb-8 pt-32 sm:px-8 lg:px-10 lg:pt-40">
          <AdvertisingSlot placementCode="HOME_BANNER_TOP" variant="banner" className="mb-10 w-full max-w-5xl" />

          <div className="flex flex-1 items-center py-10 lg:py-16">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-5xl"
            >
              <div className="mb-8 flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.28em] text-[#d5b86b] sm:text-xs">
                <span className="h-px w-12 bg-[#d5b86b]" />
                GSA HUB - Soluções Digitais
              </div>

              <h1 className="max-w-[13ch] text-[clamp(3.1rem,8.2vw,7.8rem)] font-semibold leading-[0.9] tracking-[-0.065em] text-white">
                Muitas necessidades.
                <span className="mt-2 block font-serif font-normal italic tracking-[-0.045em] text-[#d9c27c]">
                  Uma estrutura para resolver.
                </span>
              </h1>

              <p className="mt-8 max-w-2xl text-base leading-8 text-white/72 sm:text-lg sm:leading-9">
                Tecnologia, serviços, saúde, seguros e comércio conectados em uma experiência criada para pessoas e empresas avançarem com clareza, segurança e organização.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => document.getElementById('gsa-navigator')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })}
                  className="inline-flex min-h-14 items-center justify-center gap-3 rounded-sm bg-[#d5b86b] px-7 text-sm font-black text-[#07111d] transition hover:bg-[#e2ca86] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111d]"
                >
                  Encontrar minha solução
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('ecossistema-gsa')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })}
                  className="inline-flex min-h-14 items-center justify-center gap-3 rounded-sm border border-white/28 bg-white/[0.04] px-7 text-sm font-black text-white transition hover:border-[#d5b86b]/70 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d5b86b]"
                >
                  Conhecer a GSA Hub
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </div>

          <div className="hidden border-y border-white/15 py-5 text-xs font-bold uppercase tracking-[0.18em] text-white/55 sm:grid sm:grid-cols-3">
            <div className="py-2 sm:border-r sm:border-white/15 sm:pr-6">Soluções para pessoas</div>
            <div className="py-2 sm:border-r sm:border-white/15 sm:px-6">Estrutura para empresas</div>
            <div className="py-2 sm:pl-6">Experiências conectadas</div>
          </div>
        </div>
      </section>

      <section id="gsa-navigator" className="relative z-10 border-b border-[#d8d0c2] bg-[#f3f0e8] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <motion.div {...reveal(reduceMotion)} className="grid gap-8 border-b border-[#cbc2b2] pb-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#8b6d2e]">GSA Navigator</p>
              <h2 className="mt-4 max-w-xl text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-[#0b1825] sm:text-6xl">
                O que você precisa resolver hoje?
              </h2>
            </div>
            <p className="max-w-xl text-base leading-8 text-[#5b6268] lg:justify-self-end">
              Você não precisa conhecer toda a estrutura da GSA para encontrar o caminho certo. Escolha uma necessidade e siga diretamente para a experiência correspondente.
            </p>
          </motion.div>

          <div className="mt-8 grid border-l border-t border-[#cfc6b7] md:grid-cols-2 xl:grid-cols-3">
            {navigatorActions.map(({ icon: Icon, eyebrow, title, description, action }, index) => (
              <motion.button
                key={title}
                {...reveal(reduceMotion, index * 0.04)}
                type="button"
                onClick={action}
                className="group min-h-64 border-b border-r border-[#cfc6b7] bg-[#f8f6f1] p-6 text-left transition duration-300 hover:bg-[#0c1c2b] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a9873c] sm:p-8"
              >
                <div className="flex items-start justify-between gap-5">
                  <span className="flex h-11 w-11 items-center justify-center border border-[#ad9256]/50 text-[#806329] transition group-hover:border-[#d5b86b]/60 group-hover:text-[#d5b86b]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <ArrowRight className="h-5 w-5 text-[#8b6d2e] transition duration-300 group-hover:translate-x-1 group-hover:text-[#d5b86b]" />
                </div>
                <p className="mt-8 text-[10px] font-black uppercase tracking-[0.22em] text-[#8b6d2e] group-hover:text-[#d5b86b]">{eyebrow}</p>
                <h3 className="mt-3 max-w-sm text-2xl font-semibold leading-tight tracking-[-0.025em] text-[#101c27] transition group-hover:text-white">{title}</h3>
                <p className="mt-4 max-w-sm text-sm leading-7 text-[#666b70] transition group-hover:text-white/65">{description}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      <AdvertisingSlot placementCode="HOME_INLINE_01" variant="inline" className="mx-auto my-10 max-w-5xl" />

      <section id="ecossistema-gsa" className="bg-[#091522] px-5 py-20 text-white sm:px-8 lg:px-10 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <motion.div {...reveal(reduceMotion)} className="grid gap-8 border-b border-white/15 pb-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#d5b86b]">Ecossistema GSA</p>
              <h2 className="mt-5 max-w-4xl text-4xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
                Uma marca central.
                <span className="block font-serif font-normal italic text-[#d9c27c]">Diferentes caminhos para avançar.</span>
              </h2>
            </div>
            <p className="max-w-xl text-base leading-8 text-white/62 lg:justify-self-end">
              Cada divisão possui uma função específica. Todas compartilham o mesmo compromisso com organização, atendimento responsável e integração entre experiência, tecnologia e operação.
            </p>
          </motion.div>

          <div className="mt-10 divide-y divide-white/15 border-y border-white/15">
            {ecosystemAreas.map(({ number, icon: Icon, eyebrow, title, description, linkLabel, action }, index) => (
              <motion.button
                key={title}
                {...reveal(reduceMotion, Math.min(index * 0.04, 0.2))}
                type="button"
                onClick={action}
                className="group grid w-full gap-6 py-8 text-left transition hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d5b86b] sm:px-5 lg:grid-cols-[90px_64px_0.85fr_1.15fr_auto] lg:items-center lg:gap-8 lg:py-10"
              >
                <span className="text-sm font-black tracking-[0.2em] text-[#d5b86b]/65">{number}</span>
                <span className="flex h-12 w-12 items-center justify-center border border-white/20 text-[#d5b86b] transition group-hover:border-[#d5b86b]/70">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d5b86b]">{eyebrow}</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-white sm:text-3xl">{title}</h3>
                </div>
                <p className="max-w-2xl text-sm leading-7 text-white/58 sm:text-base">{description}</p>
                <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-white/72 transition group-hover:text-[#d5b86b]">
                  {linkLabel}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#d8d0c2] bg-[#e9e4d8] px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <motion.div {...reveal(reduceMotion)} className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#806329]">O padrão GSA</p>
              <h2 className="mt-5 text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-[#0b1825] sm:text-6xl">
                A solução muda.
                <span className="block font-serif font-normal italic text-[#806329]">O padrão permanece.</span>
              </h2>
              <p className="mt-7 max-w-lg text-base leading-8 text-[#5e6468]">
                A GSA Hub foi estruturada para reduzir caminhos confusos e conectar cada necessidade a uma experiência clara, acompanhada e funcional.
              </p>
            </div>

            <div className="grid border-l border-t border-[#c8beac] sm:grid-cols-2">
              {[
                ['01', 'Entender', 'A necessidade é analisada antes de qualquer direcionamento.'],
                ['02', 'Orientar', 'O cliente encontra informações claras e o fluxo adequado.'],
                ['03', 'Executar', 'A solicitação é desenvolvida ou encaminhada com responsabilidade.'],
                ['04', 'Acompanhar', 'O relacionamento continua durante toda a jornada.'],
              ].map(([number, title, text]) => (
                <div key={title} className="min-h-56 border-b border-r border-[#c8beac] bg-[#f3f0e8]/60 p-7 sm:p-8">
                  <span className="text-xs font-black tracking-[0.18em] text-[#806329]">{number}</span>
                  <h3 className="mt-8 text-2xl font-semibold text-[#0b1825]">{title}</h3>
                  <p className="mt-4 text-sm leading-7 text-[#60666b]">{text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="bg-[#f7f4ed] px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <motion.div {...reveal(reduceMotion)} className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20">
            <div className="relative overflow-hidden bg-[#0d1b29] px-7 py-12 text-white sm:px-12 sm:py-16">
              <div className="absolute right-0 top-0 h-40 w-40 border-b border-l border-[#d5b86b]/25" />
              <Layers3 className="h-8 w-8 text-[#d5b86b]" />
              <blockquote className="mt-10 max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">
                “A GSA Hub nasceu para organizar soluções que normalmente estão dispersas.”
              </blockquote>
              <div className="mt-12 h-px w-24 bg-[#d5b86b]" />
              <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-[#d5b86b]">Getsêmani Soluções Administrativas</p>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#806329]">Origem, evolução e visão</p>
              <h2 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-[#0b1825] sm:text-6xl">Mais do que reunir serviços.</h2>
              <p className="mt-7 text-base leading-8 text-[#60666b]">
                A evolução para GSA Hub representa uma empresa com múltiplas frentes, conectadas por uma estrutura central e preparadas para crescer sem perder clareza, identidade e responsabilidade.
              </p>
              <ul className="mt-8 space-y-4">
                {['Soluções organizadas por necessidade', 'Experiências próprias para pessoas e empresas', 'Estrutura preparada para novas divisões da marca'].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm font-semibold text-[#28343e] sm:text-base">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#806329]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-y border-[#d8d0c2] bg-[#eee9de] px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <motion.div {...reveal(reduceMotion)} className="flex flex-col gap-6 border-b border-[#c8beac] pb-10 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#806329]">Outras portas de entrada</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-[#0b1825] sm:text-5xl">O ecossistema continua.</h2>
            </div>
            <p className="max-w-xl text-base leading-8 text-[#60666b]">Ferramentas, parcerias e oportunidades profissionais também fazem parte da experiência GSA.</p>
          </motion.div>

          <div className="mt-8 grid gap-px bg-[#c8beac] lg:grid-cols-3">
            {accessPoints.map(({ icon: Icon, eyebrow, title, description, action }, index) => (
              <motion.button
                key={title}
                {...reveal(reduceMotion, index * 0.06)}
                type="button"
                onClick={action}
                className="group min-h-72 bg-[#f7f4ed] p-8 text-left transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#806329]"
              >
                <div className="flex items-start justify-between">
                  <Icon className="h-7 w-7 text-[#806329]" />
                  <ArrowRight className="h-5 w-5 text-[#806329] transition group-hover:translate-x-1" />
                </div>
                <p className="mt-12 text-[10px] font-black uppercase tracking-[0.22em] text-[#806329]">{eyebrow}</p>
                <h3 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#0b1825]">{title}</h3>
                <p className="mt-4 max-w-sm text-sm leading-7 text-[#62686d]">{description}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#07111d] px-5 py-24 text-white sm:px-8 lg:px-10 lg:py-36">
        <div className="pointer-events-none absolute -bottom-56 -right-48 h-[38rem] w-[38rem] rounded-full border border-[#d5b86b]/15" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-[24rem] w-[24rem] rounded-full border border-white/10" />
        <div className="mx-auto max-w-7xl">
          <motion.div {...reveal(reduceMotion)} className="max-w-5xl">
            <div className="flex items-center gap-4 text-xs font-black uppercase tracking-[0.24em] text-[#d5b86b]">
              <span className="h-px w-12 bg-[#d5b86b]" />
              O próximo passo
            </div>
            <h2 className="mt-7 text-[clamp(3rem,7vw,6.8rem)] font-semibold leading-[0.92] tracking-[-0.06em]">
              Existe uma solução GSA para o que vem agora.
            </h2>
            <p className="mt-8 max-w-2xl text-base leading-8 text-white/65 sm:text-lg">
              Encontre o caminho certo dentro do ecossistema ou conheça todas as áreas que formam a GSA Hub.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => document.getElementById('gsa-navigator')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })}
                className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#d5b86b] px-7 text-sm font-black text-[#07111d] transition hover:bg-[#e2ca86] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Encontrar minha solução
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPublicPage('services')}
                className="inline-flex min-h-14 items-center justify-center gap-3 border border-white/25 px-7 text-sm font-black text-white transition hover:border-[#d5b86b]/70 hover:text-[#d5b86b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d5b86b]"
              >
                Explorar o ecossistema
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
