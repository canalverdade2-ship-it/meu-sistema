import { motion } from 'framer-motion';
import { ArrowRight, BriefcaseBusiness, Calculator, Code2, Palette, ShoppingBag } from 'lucide-react';
import type { PublicPage } from '../../../data/publicServiceCatalog';
import { navigate } from '../../../routing/navigationService';
import { AdvertisingSlot } from '../../ads/AdvertisingSlot';

interface PublicHomeLandingProps {
  reduceMotion: boolean;
  setPublicPage: (page: PublicPage) => void;
  onGuestStore?: () => void;
}

export function PublicHomeLanding({ reduceMotion, setPublicPage, onGuestStore }: PublicHomeLandingProps) {
  const cards = [
    {
      icon: BriefcaseBusiness,
      title: 'Serviços e Assinaturas',
      subtitle: 'Gestão & Soluções',
      text: 'Pacotes completos, assessoria corporativa e planos recorrentes sob medida.',
      badge: 'Soluções GSA',
      action: () => setPublicPage('services'),
    },
    {
      icon: ShoppingBag,
      title: 'Marketplace GSA',
      subtitle: 'Loja & Produtos',
      text: 'Produtos físicos e digitais selecionados com compra segura e entrega ágil.',
      badge: 'Marketplace',
      action: onGuestStore || (() => undefined),
    },
    {
      icon: Code2,
      title: 'Sites e Sistemas',
      subtitle: 'Tecnologia & Softwares',
      text: 'Desenvolvimento de sistemas web, landing pages de alta conversão e automações.',
      badge: 'Tecnologia',
      action: () => setPublicPage('systems'),
    },
    {
      icon: Palette,
      title: 'Construção de Marca',
      subtitle: 'Branding & Estrutura',
      text: 'Construção completa da sua marca: registro, site, identidade visual e redes sociais.',
      badge: 'Aceleração',
      action: () => navigate('/empresa-do-zero-ao-digital'),
    },
    {
      icon: Calculator,
      title: 'Serviços Gratuitos',
      subtitle: 'Utilitários & Simulações',
      text: 'Cálculos trabalhistas, previdenciários e consultas imediatas para o seu dia a dia.',
      badge: '100% Gratuito',
      action: () => setPublicPage('free-tools'),
    },
  ];

  return (
    <main>
      <AdvertisingSlot placementCode="HOME_LIGHTBOX" variant="lightbox" />
      <section className="relative min-h-[100svh] overflow-hidden bg-[#050608] pt-24 text-white">
        <div className="pointer-events-none absolute -top-40 left-1/2 -z-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-br from-[#d8bd73]/15 via-amber-600/5 to-transparent blur-[140px]" />
        <img
          src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=76"
          srcSet="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=768&q=72 768w, https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1280&q=74 1280w, https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1920&q=76 1920w"
          sizes="100vw"
          alt="Ambiente corporativo da GSA"
          fetchPriority="high"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050608]/90 via-[#050608]/80 to-[#050608]" />

        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-6rem)] max-w-7xl flex-col items-center justify-center px-4 pb-20 pt-8 text-center sm:px-6 lg:px-8">
          <AdvertisingSlot placementCode="HOME_BANNER_TOP" variant="banner" className="mb-8 w-full max-w-5xl text-left" />

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl"
          >
            <h1 className="text-5xl font-serif font-medium tracking-[0.1em] sm:text-7xl lg:text-8xl">
              <span className="bg-gradient-to-r from-[#d8bd73] via-amber-100 to-[#d8bd73] bg-clip-text text-transparent drop-shadow-sm">
                GSA HUB
              </span>
            </h1>
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.3em] text-[#d8bd73]/90 sm:text-xl">
              Soluções Digitais
            </p>
          </motion.div>

          <div className="mt-14 flex w-full max-w-6xl flex-wrap justify-center gap-6">
            {cards.map(({ icon: Icon, title, subtitle, text, action }, index) => (
              <motion.button
                key={title}
                initial={reduceMotion ? false : { opacity: 0, y: 32, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.6,
                  delay: reduceMotion ? 0 : index * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                whileHover={reduceMotion ? {} : { y: -7, scale: 1.01, transition: { duration: 0.25, ease: 'easeOut' } }}
                whileTap={reduceMotion ? {} : { scale: 0.97 }}
                type="button"
                onClick={action}
                className="group relative flex w-full flex-col justify-between overflow-hidden rounded-2xl border border-white/18 bg-gradient-to-b from-[#1b1d24]/90 via-[#14161c]/80 to-[#0e1014]/95 p-6 text-left backdrop-blur-xl transition-all duration-300 hover:border-[#d8bd73]/80 hover:bg-[#222530]/95 hover:shadow-[0_20px_50px_rgba(216,189,115,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73] sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
              >
                {/* Top border gold beam effect */}
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#d8bd73]/0 to-transparent transition-all duration-500 group-hover:via-[#d8bd73]" />

                {/* Inner radial spotlight glow on hover */}
                <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[#d8bd73]/0 blur-2xl transition-all duration-500 group-hover:bg-[#d8bd73]/15 group-hover:scale-150" />

                <div className="relative z-10">
                  <div className="flex items-center gap-4 sm:gap-5">
                    <span className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl border border-[#d8bd73]/30 bg-gradient-to-br from-[#d8bd73]/25 via-[#d8bd73]/12 to-transparent text-[#d8bd73] shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6 group-hover:border-[#d8bd73]/70 group-hover:ring-4 group-hover:ring-[#d8bd73]/15">
                      <Icon className="h-7 w-7 sm:h-8 sm:w-8 transition-transform duration-300 group-hover:scale-105" />
                    </span>
                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                      <h3 className="text-xl sm:text-2xl font-black leading-tight text-white transition-all duration-300 group-hover:text-[#e6ce8b] group-hover:drop-shadow-[0_2px_10px_rgba(216,189,115,0.3)]">
                        {title}
                      </h3>
                      <p className="mt-0.5 text-xs sm:text-sm font-bold text-[#e1c77f] transition-colors duration-200 group-hover:text-[#edd999]">
                        {subtitle}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs leading-relaxed text-neutral-300 transition-colors duration-200 group-hover:text-white sm:text-sm">
                    {text}
                  </p>
                </div>

                <div className="relative z-10 mt-6 flex items-center justify-end border-t border-white/10 pt-4">
                  <div className="inline-flex items-center gap-2.5 rounded-xl border border-[#d8bd73]/30 bg-gradient-to-r from-[#d8bd73]/15 to-[#d8bd73]/5 px-4 py-2 text-xs font-black uppercase tracking-wider text-[#e6ce8b] backdrop-blur-md transition-all duration-300 group-hover:border-[#d8bd73] group-hover:bg-gradient-to-r group-hover:from-[#d8bd73] group-hover:to-[#f0d88a] group-hover:text-neutral-950 group-hover:shadow-[0_4px_20px_rgba(216,189,115,0.35)]">
                    <span>Acessar</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>
      <AdvertisingSlot placementCode="HOME_INLINE_01" variant="inline" className="mx-auto my-10 max-w-5xl" />
    </main>
  );
}
