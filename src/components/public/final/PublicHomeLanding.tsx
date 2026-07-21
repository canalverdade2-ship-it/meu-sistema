import { motion } from 'framer-motion';
import { ArrowRight, BriefcaseBusiness, Code2, Palette, ShoppingBag } from 'lucide-react';
import type { PublicPage } from '../../../data/publicServiceCatalog';
import { navigate } from '../../../routing/navigationService';

interface PublicHomeLandingProps {
  reduceMotion: boolean;
  setPublicPage: (page: PublicPage) => void;
  onGuestStore?: () => void;
}

export function PublicHomeLanding({ reduceMotion, setPublicPage, onGuestStore }: PublicHomeLandingProps) {
  const cards = [
    { icon: BriefcaseBusiness, title: 'Serviços e Assinaturas', text: 'Serviços, pacotes e planos recorrentes.', action: () => setPublicPage('services') },
    { icon: ShoppingBag, title: 'Marketplace GSA', text: 'Produtos selecionados e compras.', action: onGuestStore || (() => undefined) },
    { icon: Code2, title: 'Sites e Sistemas', text: 'Sites, sistemas e automações.', action: () => setPublicPage('systems') },
    { icon: Palette, title: 'Empresa do Zero ao Digital', text: 'Nome, marca, site, redes sociais e conteúdo.', action: () => navigate('/empresa-do-zero-ao-digital') },
  ];

  return (
    <main>
      <section className="relative min-h-[100svh] overflow-hidden bg-neutral-950 pt-24 text-white">
        <img
          src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=76"
          srcSet="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=768&q=72 768w, https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1280&q=74 1280w, https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1920&q=76 1920w"
          sizes="100vw"
          alt="Ambiente corporativo da GSA"
          fetchPriority="high"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,6,8,0.96)_0%,rgba(5,6,8,0.78)_44%,rgba(5,6,8,0.52)_100%)]" />
        <div className="relative mx-auto flex min-h-[calc(100svh-6rem)] max-w-7xl flex-col items-center justify-center px-4 pb-16 text-center sm:px-6 lg:px-8">
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-4xl">
            <h1 className="text-5xl font-serif font-medium tracking-[0.12em] sm:text-7xl lg:text-8xl"><span className="bg-gradient-to-r from-[#d8bd73] via-white to-[#d8bd73] bg-clip-text text-transparent">GSA HUB</span></h1>
            <p className="mt-4 text-base font-medium uppercase tracking-[0.2em] text-[#d8bd73]/85 sm:text-2xl">Soluções Digitais</p>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">Serviços administrativos, marketplace, tecnologia e construção de marcas reunidos em uma experiência segura e conectada.</p>
          </motion.div>

          <div className="mt-12 grid w-full max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(({ icon: Icon, title, text, action }) => (
              <button key={title} type="button" onClick={action} className="group flex items-center gap-4 rounded-xl border border-white/15 bg-white/[0.09] p-5 text-left backdrop-blur-xl transition hover:border-[#d8bd73]/70 hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#d8bd73]"><Icon className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1"><strong className="block text-base font-black sm:text-lg">{title}</strong><span className="mt-1 block text-xs text-white/70 sm:text-sm">{text}</span></span>
                <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
