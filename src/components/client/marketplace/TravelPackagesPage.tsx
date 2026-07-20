import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowLeft, ArrowRight, Plane, MapPin, Globe, Luggage, Clock, Sparkles, MessageCircle, Mail, ShoppingBag } from 'lucide-react';
import { LogoGSA } from '../../ui/LogoGSA';
import { navigate } from '../../../routing/navigationService';
import { routes } from '../../../routing/routeCatalog';

interface TravelPackagesPageProps {
  onBack: () => void;
  isPublic?: boolean;
}

const categories = [
  {
    icon: MapPin,
    title: 'Destinos Nacionais',
    sub: 'Praias, serras, resorts e muito mais pelo Brasil',
    gradient: 'from-[#1a1a2e] via-[#16213e] to-[#0f3460]',
    accentColor: '#4dc9f6',
    iconBg: 'bg-[#4dc9f6]',
  },
  {
    icon: Globe,
    title: 'Destinos Internacionais',
    sub: 'Américas, Europa, Ásia e Oceania com condições especiais',
    gradient: 'from-[#0c2340] via-[#0e3a5c] to-[#134e78]',
    accentColor: '#38bdf8',
    iconBg: 'bg-[#38bdf8]',
  },
  {
    icon: Luggage,
    title: 'Excursões Exclusivas',
    sub: 'Roteiros curados e guias especializados para membros',
    gradient: 'from-[#0c1821] via-[#1b3a4b] to-[#065a82]',
    accentColor: '#7dd3fc',
    iconBg: 'bg-[#7dd3fc]',
  },
];

const WHATSAPP_NUMBER = '5511920857756';
const CONTACT_EMAIL = 'gsa.doc.adm@gmail.com';

export function TravelPackagesPage({ onBack, isPublic = false }: TravelPackagesPageProps) {
  const headerRef = useRef(null);
  const headerInView = useInView(headerRef, { once: true });

  return (
    <div className="bg-[#f4f1ea]">
      {/* ─── TELA PRINCIPAL (100dvh) ──────────────── */}
      <div className="min-h-[100dvh] flex flex-col">

      {/* ─── NAVBAR ────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-black/[0.06] bg-[#f4f1ea]/80 backdrop-blur-xl shrink-0">
        <div className="max-w-7xl mx-auto px-5 flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-[#1a1a1a] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="h-5 w-px bg-black/10" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a1a1a]">
                <Plane className="h-4 w-4 text-[#4dc9f6]" />
              </div>
              <span className="text-sm font-black tracking-tight text-[#1a1a1a]">
                Pacotes de Viagem
              </span>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex flex-col justify-start sm:justify-center">
        {/* ─── HERO SECTION ────────────────────── */}
        <section className="relative overflow-hidden bg-[#0a0a0a] shrink-0">
          <div className="absolute inset-0">
            <img
              src="https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=2200&q=80"
              alt=""
              className="h-full w-full object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/85 to-[#0a0a0a]/60" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
          </div>

          <div className="relative max-w-7xl mx-auto px-5 pt-6 pb-8 md:pt-12 md:pb-14">
            <motion.div
              ref={headerRef}
              initial={{ opacity: 0, y: 30 }}
              animate={headerInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-3xl"
            >
              <div className="mb-4 sm:mb-6 inline-flex flex-col w-full">
                <h1
                  className="text-5xl sm:text-7xl md:text-8xl tracking-widest leading-[0.95] mb-1.5 sm:mb-2"
                  style={{ fontFamily: '"Cinzel", serif', fontWeight: 700 }}
                >
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4dc9f6] via-[#7dd3fc] to-[#38bdf8]">
                    GSA HUB
                  </span>
                </h1>
                <h1 className="text-4xl sm:text-6xl md:text-8xl font-black text-white tracking-tighter leading-[0.95] flex items-center gap-3 sm:gap-6">
                  <span>Pacotes de Viagem</span>
                  <Plane className="h-8 w-8 sm:h-12 sm:w-12 md:h-20 md:w-20 text-[#4dc9f6]" strokeWidth={1.5} />
                </h1>
                <div className="flex items-center gap-3 w-full mt-3 sm:mt-4">
                  <div className="h-[2px] flex-1 bg-gradient-to-r from-[#4dc9f6] to-[#4dc9f6]/20" />
                  <div className="h-2 w-2 rounded-full bg-[#4dc9f6] shrink-0" />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── BADGE EM IMPLANTAÇÃO ─────────────── */}
        <div className="max-w-7xl mx-auto px-5 pt-5 pb-2 w-full shrink-0">
          <div className="flex items-center gap-3 mb-3 sm:mb-5">
            <h2 className="text-xl sm:text-3xl font-black text-[#1a1a1a] tracking-tight">
              Explore nossos destinos:
            </h2>
          </div>
        </div>

      {/* ─── CATEGORY CARDS ───────────────────── */}
        <div className="max-w-7xl mx-auto px-5 pb-4 sm:pb-16 w-full flex-1 flex flex-col justify-between">
          <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-3 md:grid-rows-1 gap-3 sm:gap-5 flex-1">
            {categories.map((cat, i) => {
              const CatIcon = cat.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full"
                >
                  <div
                    className={`group/card relative w-full h-full overflow-hidden rounded-[1.25rem] sm:rounded-[2rem] transition-all duration-500 hover:-translate-y-1 sm:hover:-translate-y-3 bg-gradient-to-br ${cat.gradient} p-3.5 sm:p-10 flex flex-col justify-between cursor-default`}
                    style={{
                      boxShadow: `0 8px 20px -8px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.12), inset 0 2px 15px rgba(255,255,255,0.05)`,
                    }}
                  >
                    {/* Glow effect that reacts to hover */}
                    <div 
                      className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-700 pointer-events-none"
                      style={{ boxShadow: `inset 0 0 60px ${cat.accentColor}25` }}
                    />

                    {/* Textura de fundo sutil (glass noise) */}
                    <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
                      
                    {/* Brilho decorativo - glows */}
                    <div className="absolute -top-12 -right-12 sm:-top-24 sm:-right-24 w-32 h-32 sm:w-64 sm:h-64 rounded-full opacity-15 sm:opacity-20 blur-[2rem] sm:blur-[4rem] transition-all duration-700 group-hover/card:opacity-25 sm:group-hover/card:opacity-40 group-hover/card:scale-125" style={{ background: cat.accentColor }} />
                    <div className="absolute -bottom-12 -left-12 sm:-bottom-24 sm:-left-24 w-28 h-28 sm:w-56 sm:h-56 rounded-full opacity-5 sm:opacity-10 blur-[2rem] sm:blur-[4rem] transition-all duration-700 group-hover/card:opacity-15 sm:group-hover/card:opacity-30 group-hover/card:scale-110" style={{ background: cat.accentColor }} />
             
                    {/* Conteúdo do Card */}
                    <div className="w-full relative z-10 flex flex-col h-full justify-between min-h-0 sm:min-h-[220px]">
                      {/* Ícone à esquerda (mobile flex-row) / Ícone topo (desktop sm:flex-col) */}
                      <div className="relative flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-8 justify-between sm:justify-start w-full">
                        {/* Ícone com fundo próprio e borda com brilho */}
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 sm:relative sm:top-0 sm:translate-y-0 flex-shrink-0 flex h-14 w-14 sm:h-20 sm:w-20 items-center justify-center rounded-xl sm:rounded-[1.25rem] bg-white/5 backdrop-blur-xl border border-white/20 transition-all duration-500 group-hover/card:scale-110 group-hover/card:rotate-[6deg] group-hover/card:border-white/40 group-hover/card:bg-white/10"
                          style={{ boxShadow: `0 4px 15px ${cat.accentColor}25, inset 0 0 0 1px rgba(255,255,255,0.15)` }}
                        >
                          <style dangerouslySetInnerHTML={{__html: `
                            @keyframes pinBounce {
                              0%, 100% { transform: translateY(0); }
                              50% { transform: translateY(-5px); }
                            }
                            @keyframes wobble {
                              0%, 100% { transform: rotate(0deg); }
                              25% { transform: rotate(8deg); }
                              75% { transform: rotate(-8deg); }
                            }
                          `}} />
                          <CatIcon 
                            className={`h-8 w-8 sm:h-10 sm:w-10 transition-colors duration-500 ${
                              i === 0 ? 'animate-[pinBounce_2s_ease-in-out_infinite]' :
                              i === 1 ? 'animate-[spin_8s_linear_infinite]' :
                              i === 2 ? 'animate-[wobble_2.5s_ease-in-out_infinite]' : ''
                            }`} 
                            style={{ color: cat.accentColor }} 
                            strokeWidth={1.8} 
                          />
                        </div>

                        {/* Textos: Escrita à esquerda no mobile (alinhado à esquerda) */}
                        <div className="flex flex-col gap-0.5 sm:gap-3 text-left w-full pl-[72px] sm:pl-0">
                          <h2 className="text-xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-[1.2] sm:leading-[1.1] sm:drop-shadow-md">
                            {cat.title}
                          </h2>
                          <p className="text-xs sm:text-base text-white/70 leading-relaxed sm:drop-shadow-md font-medium mt-1">
                            {cat.sub}
                          </p>
                        </div>
                      </div>

                      {/* Base: Botão CTA "Acesse" sutil */}
                      <div className="mt-2 sm:mt-8 flex justify-end">
                        <div 
                          className="group/btn relative inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 sm:px-5 sm:py-2.5 overflow-hidden transition-all duration-500 hover:scale-[1.03]"
                          style={{
                            backgroundColor: cat.accentColor,
                            boxShadow: `0 4px 12px -6px ${cat.accentColor}, inset 0 -1px 3px rgba(0,0,0,0.15), inset 0 1px 3px rgba(255,255,255,0.25)`,
                          }}
                        >
                          {/* Faixa de luz */}
                          <div 
                            className="absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] transition-transform duration-700 ease-in-out group-hover/btn:translate-x-[150%]" 
                          />
                          
                          <span className="relative z-10 text-[9px] sm:text-xs font-black uppercase tracking-[0.1em] text-[#1a1a1a]">
                            Acesse
                          </span>
                          
                          <div className="relative z-10 flex h-3.5 w-3.5 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-black/10 backdrop-blur-md">
                            <ArrowRight className="h-1.5 w-1.5 sm:h-2.5 sm:w-2.5 text-[#1a1a1a]" strokeWidth={3.5} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
      </div>

      {/* ─── FOOTER ────────────────────────────── */}
      {isPublic ? (
        <footer className="border-t border-white/10 bg-[#0a0a0a] min-h-[100dvh] sm:min-h-0 flex flex-col justify-center sm:justify-start text-white py-14">
          <div className="max-w-7xl mx-auto px-5">
            <div className="grid gap-10 lg:grid-cols-[1.4fr_0.9fr_1fr] text-left">
              <div>
                <LogoGSA size="xl" variant="light" />
                <p className="mt-6 max-w-md text-sm leading-7 text-white/60">
                  Produtos, serviços, assinaturas e tecnologia em uma experiência digital privada, elegante e conectada.
                </p>
              </div>
              <div>
                <h4 className="mb-5 text-xs font-black uppercase tracking-[0.22em] text-white/40">Ambientes</h4>
                <ul className="space-y-3 text-sm font-bold text-white/70">
                  <li><button onClick={() => navigate(routes.public.services())} className="hover:text-[#d8bd73] transition-colors">Serviços e Assinaturas</button></li>
                  <li><button onClick={() => navigate(routes.marketplace.store.root())} className="hover:text-[#d8bd73] transition-colors">Loja GSA Store</button></li>
                  <li><button onClick={() => navigate(routes.public.systems())} className="hover:text-[#d8bd73] transition-colors">Criação de Site e Sistemas</button></li>
                  <li><button onClick={() => navigate(routes.login.root())} className="hover:text-[#d8bd73] transition-colors">Login</button></li>
                </ul>
              </div>
              <div>
                <h4 className="mb-5 text-xs font-black uppercase tracking-[0.22em] text-white/40">Contato</h4>
                <div className="space-y-3">
                  <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Olá! Vim pelo site da GSA e gostaria de atendimento.')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm font-bold text-white/70 hover:text-[#d8bd73] transition-colors">
                    <MessageCircle className="h-5 w-5" />
                    WhatsApp
                  </a>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-3 text-sm font-bold text-white/70 hover:text-[#d8bd73] transition-colors">
                    <Mail className="h-5 w-5" />
                    {CONTACT_EMAIL}
                  </a>
                </div>
              </div>
            </div>
            <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-7 sm:flex-row text-xs font-semibold text-white/40">
              <p>
                © {new Date().getFullYear()} GSA Enterprise Hub. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </footer>
      ) : (
        <footer className="border-t border-black/[0.06] bg-white/40 py-10">
          <div className="max-w-7xl mx-auto px-5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1a1a1a]">
                  <ShoppingBag className="h-3.5 w-3.5 text-[#d8bd73]" />
                </div>
                <span className="text-xs font-black tracking-tight text-neutral-400 uppercase">GSA HUB · Marketplace</span>
              </div>
              <p className="text-[11px] text-neutral-400 font-medium">
                © {new Date().getFullYear()} Grupo GSA · Soluções Digitais. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
