import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BriefcaseBusiness,
  Calculator,
  ChevronRight,
  Code2,
  HeartPulse,
  Network,
  Palette,
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
  initial: reduceMotion ? false : { opacity: 0, y: 48 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: { duration: 0.85, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export function PublicHomeLanding({ reduceMotion, setPublicPage, onGuestStore }: PublicHomeLandingProps) {
  const openStore = onGuestStore || (() => navigate(routes.marketplace.root()));

  useEffect(() => {
    const sections = document.querySelectorAll('#ecossistema-gsa, #sobre-gsa, #rede-gsa, #contato-gsa');
    const visibleSections = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visibleSections.add(entry.target);
        else visibleSections.delete(entry.target);
      });
      document.body.classList.toggle('gsa-protection-in-view', visibleSections.size > 0);
    }, { threshold: 0 });
    sections.forEach(section => observer.observe(section));
    return () => {
      observer.disconnect();
      document.body.classList.remove('gsa-protection-in-view');
    };
  }, []);


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
      description: 'Explore produtos, assinaturas e ofertas na GSA Store.',
      icon: ShoppingBag,
      action: openStore,
    },
    {
      eyebrow: 'Jornada de Marca',
      title: 'Identidade e Web Design',
      description: 'Nome, identidade, presença digital, site e estrutura de marca conectados.',
      icon: Palette,
      action: () => navigate('/identidade-e-web-design'),
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
      eyebrow: 'Cuidado e orientação',
      title: 'GSA Saúde',
      description: 'Solicite cotações de planos individuais, familiares, empresariais e odontológicos.',
      icon: HeartPulse,
      linkLabel: 'Solicitar uma cotação',
      action: () => navigate(routes.marketplace.saude.root()),
    },
    {
      number: '02',
      eyebrow: 'Proteção para cada fase',
      title: 'GSA Seguros',
      description: 'Solicite cotações de seguros para automóveis, residências, vida e empresas.',
      icon: ShieldCheck,
      linkLabel: 'Encontrar uma proteção',
      action: () => navigate(routes.marketplace.seguros.root()),
    },
  ];

  const accessPoints: HomeAction[] = [
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

      <section className="gsa-home-hero relative isolate flex min-h-screen flex-col justify-center overflow-hidden bg-[#07111d] text-white" style={{ minHeight: '100vh' }}>
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

        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 pb-20 pt-32 sm:px-8 lg:px-10 lg:pt-36 xl:pb-28">
          <AdvertisingSlot placementCode="HOME_BANNER_TOP" variant="banner" className="mb-10 w-full max-w-5xl shrink-0" />

          <div className="flex flex-1 flex-col justify-center py-4 lg:py-6">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 48 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-5xl"
            >
              <div className="mb-5 flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.28em] text-[#d5b86b] sm:text-xs">
                <span className="h-px w-12 bg-[#d5b86b]" />
                GSA HUB - Soluções Digitais
              </div>

              <h1 className="max-w-[20ch] text-[clamp(2.35rem,5.5vw,4.75rem)] font-semibold leading-[1.04] tracking-[-0.045em] text-white">
                Muitas necessidades.
                <span className="mt-2 block font-serif font-normal italic tracking-[-0.045em] text-[#d9c27c]">
                  Uma estrutura para resolver.
                </span>
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-white/80 sm:text-lg sm:leading-8">
                Crie seu site, contrate serviços e encontre soluções de saúde, seguros e compras em um só lugar. Para pessoas, MEIs e empresas.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => document.getElementById('gsa-navigator')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })}
                  className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg bg-[#dfc47c] px-5 text-base font-black text-[#07111d] transition hover:bg-[#e2ca86] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111d]"
                >
                  Encontrar minha solução
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a href="https://wa.me/5511920857756" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-14 items-center justify-center gap-3 rounded-sm border border-white/30 px-7 text-sm font-bold text-white transition hover:border-[#d5b86b] focus-visible:ring-2 focus-visible:ring-[#d5b86b]">
                  Falar com a GSA
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>
            </motion.div>
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
              Escolha o que você precisa e veja os serviços disponíveis. Para saúde e seguros, confira as opções logo abaixo.
            </p>
          </motion.div>

          <div className="mt-8 grid border-l border-t border-[#cfc6b7] md:grid-cols-2 xl:grid-cols-3">
            {navigatorActions.map(({ icon: Icon, eyebrow, title, description, action }, index) => (
              <motion.button
                key={title}
                {...reveal(reduceMotion, index * 0.25)}
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

      <section id="ecossistema-gsa" className="bg-[#091522] px-5 py-12 text-white sm:px-8 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <motion.div {...reveal(reduceMotion)} className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#dec680]">Saúde e seguros</p>
              <h2 className="mt-5 text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[1.12] tracking-[-0.035em]">
                Cuidado e proteção.
                <span className="mt-3 block font-serif font-normal italic text-[#e2cb8b]">Para você e sua empresa.</span>
              </h2>
            </div>
            <p className="max-w-xl text-base leading-7 text-[#c8d2df] lg:pb-1 lg:text-lg">
              Escolha a área e solicite sua cotação. Encontre opções para cuidar de quem importa e proteger suas conquistas.
            </p>
          </motion.div>

          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:mt-10">
            {ecosystemAreas.map(({ icon: Icon, eyebrow, title, description, linkLabel, action }, index) => (
              <motion.article
                key={title}
                {...reveal(reduceMotion, index * 0.25)}
                className="group relative overflow-hidden flex min-w-0 flex-col rounded-2xl border border-[#526276] bg-[#14283b] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.15)] transition-colors duration-300 hover:border-[#718297] sm:p-8"
              >
                <div className="pointer-events-none absolute bottom-0 right-0 h-12 w-12 border-l border-t border-white/10 opacity-30 transition-all duration-500 ease-out group-hover:h-full group-hover:w-full group-hover:border-transparent group-hover:bg-white/[0.03] group-hover:opacity-100" />
                <div className="relative z-10 flex items-center gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#d5b86b]/40 bg-[#d5b86b]/10 text-[#e2cb8b] transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110 group-hover:-rotate-6 group-hover:rounded-full group-hover:bg-[#d5b86b]/20">
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase leading-5 tracking-[0.12em] text-[#e2cb8b] transition-transform duration-400 group-hover:translate-x-1">{eyebrow}</p>
                    <h3 className="mt-1 text-2xl font-semibold leading-tight tracking-[-0.02em] text-white sm:text-3xl">{title}</h3>
                  </div>
                </div>
                <p className="relative z-10 mb-7 mt-6 text-base leading-7 text-[#d4deea]">{description}</p>
                <button type="button" onClick={action} aria-label={`${linkLabel} — ${title}`} className="mt-auto inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-[#dfc47c] px-4 py-3 text-base font-bold leading-6 text-[#091522] transition-colors hover:bg-[#eed69a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#14283b]">
                  {linkLabel}
                  <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
                </button>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section id="sobre-gsa" className="bg-[#f3f0e8] px-5 py-12 sm:px-8 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <motion.div {...reveal(reduceMotion)} className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#806329]">Sobre a GSA</p>
              <h2 className="mt-5 text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[1.12] tracking-[-0.035em] text-[#0b1825]">
                Soluções conectadas.
                <span className="mt-3 block font-serif font-normal italic text-[#806329]">Atendimento em etapas.</span>
              </h2>
              <p className="mt-6 max-w-lg text-base leading-7 text-[#46525e]">
                Da Getsêmani Soluções Administrativas à GSA Hub: tecnologia, serviços, saúde, seguros e comércio reunidos para pessoas e empresas.
              </p>
              <p className="mt-4 text-base font-semibold leading-7 text-[#182b3c]">Veja como funciona o atendimento.</p>
            </div>
            <ol className="grid list-none gap-4 sm:grid-cols-2 sm:gap-5">
              {[
                ['01', 'Entender', 'Você conta o que precisa. A necessidade é analisada antes do direcionamento.'],
                ['02', 'Orientar', 'Apresentamos as informações e o caminho adequado para sua solicitação.'],
                ['03', 'Executar', 'A solicitação é desenvolvida ou encaminhada para a área responsável.'],
                ['04', 'Acompanhar', 'O atendimento continua durante as etapas da sua solicitação.'],
              ].map(([number, title, text], index) => (
                <motion.li key={title} {...reveal(reduceMotion, index * 0.25)} className="rounded-2xl border border-[#d4cbbb] bg-white p-6 shadow-[0_6px_22px_rgba(11,24,37,0.04)]">
                  <div className="flex items-center gap-4">
                    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#102638] text-sm font-bold text-[#e2cb8b]">{number}</span>
                    <h3 className="text-xl font-semibold text-[#0b1825]">{title}</h3>
                  </div>
                  <p className="mt-4 text-base leading-7 text-[#46525e]">{text}</p>
                </motion.li>
              ))}
            </ol>
          </motion.div>
        </div>
      </section>

      <section id="rede-gsa" className="border-t border-[#d8d0c2] bg-[#e8e3d8] px-5 py-12 sm:px-8 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <motion.div {...reveal(reduceMotion)} className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#806329]">Outras portas de entrada</p>
              <h2 className="mt-4 text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.12] tracking-[-0.035em] text-[#0b1825]">Faça parte da GSA.</h2>
            </div>
            <p className="max-w-xl text-base leading-8 text-[#60666b]">Conheça nossa rede de parceiros e as oportunidades profissionais.</p>
          </motion.div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {accessPoints.map(({ icon: Icon, eyebrow, title, description, action }, index) => (
              <motion.button
                key={title}
                {...reveal(reduceMotion, index * 0.25)}
                type="button"
                onClick={action}
                className="group relative overflow-hidden rounded-2xl border border-[#d4cbbb] bg-white p-6 text-left shadow-sm transition duration-300 hover:border-[#806329] hover:bg-[#fcfaf5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#806329] sm:p-8"
              >
                <div className="pointer-events-none absolute bottom-0 right-0 h-12 w-12 border-l border-t border-[#806329]/10 opacity-30 transition-all duration-500 ease-out group-hover:h-full group-hover:w-full group-hover:border-transparent group-hover:bg-[#806329]/[0.02] group-hover:opacity-100" />
                <div className="relative z-10 flex items-start justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#102638] text-[#e2cb8b] transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110 group-hover:-rotate-6 group-hover:rounded-full group-hover:bg-[#102638]/90"><Icon className="h-6 w-6" aria-hidden="true" /></span>
                  <ArrowRight className="h-5 w-5 text-[#806329] transition group-hover:translate-x-1" />
                </div>
                <p className="relative z-10 mt-6 text-xs font-black uppercase tracking-[0.22em] text-[#806329] transition-transform duration-400 group-hover:translate-x-1">{eyebrow}</p>
                <h3 className="relative z-10 mt-3 text-2xl font-semibold tracking-[-0.02em] text-[#0b1825]">{title}</h3>
                <p className="relative z-10 mt-3 max-w-lg text-base leading-7 text-[#46525e]">{description}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      <section id="contato-gsa" className="relative overflow-hidden bg-[#07111d] px-5 py-12 text-white sm:px-8 lg:px-10 lg:py-20">
        <div className="pointer-events-none absolute -bottom-56 -right-48 h-[38rem] w-[38rem] rounded-full border border-[#d5b86b]/15" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-[24rem] w-[24rem] rounded-full border border-white/10" />
        <div className="mx-auto max-w-7xl">
          <motion.div {...reveal(reduceMotion)} className="max-w-5xl rounded-2xl border border-[#526276] bg-[#14283b] p-6 sm:p-10">
            <div className="flex items-center gap-4 text-xs font-black uppercase tracking-[0.24em] text-[#d5b86b]">
              <span className="h-px w-12 bg-[#d5b86b]" />
              O próximo passo
            </div>
            <h2 className="mt-5 text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[1.14] tracking-[-0.035em]">
              Vamos conversar sobre o que você precisa?
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#d4deea] sm:text-lg">
              Fale com a equipe pelo WhatsApp ou envie um e-mail para esclarecer dúvidas e encontrar o serviço adequado.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href="https://wa.me/5511920857756" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg bg-[#dfc47c] px-5 text-base font-bold text-[#07111d] hover:bg-[#e2ca86] focus-visible:ring-2 focus-visible:ring-white">Falar com a GSA <ArrowRight className="h-4 w-4" /></a>
              <a href="mailto:gsa.doc.adm@gmail.com" className="inline-flex min-h-14 items-center justify-center rounded-lg border border-[#718297] px-3 text-sm break-all font-semibold text-white hover:border-[#d5b86b] focus-visible:ring-2 focus-visible:ring-[#d5b86b]">gsa.doc.adm@gmail.com</a>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
