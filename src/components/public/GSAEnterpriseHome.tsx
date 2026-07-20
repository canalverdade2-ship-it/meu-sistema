import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import type { ComponentType } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Code2,
  FileCheck,
  Headphones,
  Layers3,
  Lock,
  LogIn,
  Mail,
  MessageCircle,
  PackageCheck,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,

  X,
  Star,
  Shield,
  Zap,
  CheckCircle2,
  ChevronRight,
  Activity,
  Target,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { LogoGSA } from '../ui/LogoGSA';
import { supabase } from '../../lib/supabase';
import { maskPhone } from '../../lib/utils';
import { toast } from 'react-hot-toast';

type Audience = 'PF' | 'PJ';
type PublicPage = 'home' | 'services' | 'systems';
const WHATSAPP_NUMBER = '5511920857756';
const CONTACT_EMAIL = 'gsa.doc.adm@gmail.com';

interface IconItem {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}

interface ServicePackage {
  audience: Audience;
  title: string;
  subtitle: string;
  description: string;
  services: Array<string | { name: string; desc: string }>;
}

interface GSAEnterpriseHomeProps {
  publicPage: PublicPage;
  setPublicPage: (page: PublicPage) => void;
  publicAudience: Audience;
  setPublicAudience: (audience: Audience) => void;
  servicePackages: ServicePackage[];
  publicProducts: IconItem[];
  publicServices: IconItem[];
  onGuestStore?: () => void;
  onClientLogin: () => void;
  onAdminLogin: () => void;
}

const audienceCopy = {
  PF: {
    label: 'Pessoa fisica',
    title: 'Servicos para voce',
    text: 'Previdencia, MEI, veiculos, CNH, direitos PcD, imposto de renda, contratos, CPF, FGTS e organizacao financeira.',
  },
  PJ: {
    label: 'Empresas',
    title: 'Servicos para empresas',
    text: 'BPO financeiro, faturamento, cobranca, compras, controladoria, beneficios, comissoes, reembolsos e compliance fiscal.',
  },
};

export function GSAEnterpriseHome({
  publicPage,
  setPublicPage,
  publicAudience,
  setPublicAudience,
  servicePackages,
  publicProducts,
  publicServices,
  onGuestStore,
  onClientLogin,
  onAdminLogin,
}: GSAEnterpriseHomeProps) {
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('gsa_intro_seen');
    }
    return true;
  });
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);
  const [requestChoicePackage, setRequestChoicePackage] = useState<ServicePackage | null>(null);
  const [isSystemsBudgetOpen, setIsSystemsBudgetOpen] = useState(false);
  const filteredServicePackages = servicePackages.filter(pkg => pkg.audience === publicAudience);
  const getServiceName = (service: string | { name: string; desc: string }) => typeof service === 'string' ? service : service.name;
  const getServiceDesc = (service: string | { name: string; desc: string }) => typeof service === 'string' ? '' : service.desc;
  const openWhatsApp = (message: string) => {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };
  const openSystemsWhatsApp = () => {
    openWhatsApp('Ola! Gostaria de solicitar atendimento sobre criacao de site e desenvolvimento de sistemas.');
  };
  const openServiceWhatsApp = (pkg: ServicePackage) => {
    openWhatsApp(`Ola! Gostaria de atendimento sobre o pacote ${pkg.title}. Tenho interesse em entender as opcoes de servico avulso, pacote ou assinatura recorrente.`);
  };
  const openServiceEmail = (pkg: ServicePackage) => {
    const subject = `Solicitação de Atendimento - ${pkg.title}`;
    const body = `Olá! Gostaria de atendimento sobre o pacote: ${pkg.title}.\n\nDescrição: ${pkg.description}\n\nTenho interesse em entender as opções de serviço avulso, pacote ou assinatura recorrente.`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  const requestServiceViaPortal = (pkg: ServicePackage) => {
    const details = pkg.services.map(service => `- ${getServiceName(service)}${getServiceDesc(service) ? `: ${getServiceDesc(service)}` : ''}`).join('\n');
    localStorage.setItem('gsa_pending_service_request', JSON.stringify({
      title: pkg.title,
      description: `Tenho interesse no pacote ${pkg.title}.\n\n${pkg.description}\n\nServicos de interesse:\n${details}`,
      source: 'public_services',
      createdAt: new Date().toISOString()
    }));
    setRequestChoicePackage(null);
    setSelectedPackage(null);
    onClientLogin();
  };

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [publicPage]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setShowIntro(false);
      sessionStorage.setItem('gsa_intro_seen', 'true');
      return;
    }
    
    if (showIntro) {
      const timer = setTimeout(() => {
        setShowIntro(false);
        sessionStorage.setItem('gsa_intro_seen', 'true');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [showIntro]);

  const isHome = publicPage === 'home';
  const navBg = isHome 
    ? (isScrolled ? 'bg-[#080c12]/90 backdrop-blur-xl border-b border-white/10 shadow-2xl' : 'bg-transparent border-b border-transparent')
    : 'bg-[#080c12]/95 backdrop-blur-xl border-b border-white/10';
  const nav = (
    <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${navBg} ${isScrolled ? 'py-3' : 'py-5'}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button onClick={() => setPublicPage('home')} className="flex items-center group">
          <LogoGSA size="md" variant={isHome ? "light" : "light"} />
        </button>

        <div className="flex items-center gap-3">
          <button onClick={onClientLogin} className="group relative inline-flex items-center justify-center overflow-hidden rounded-lg border border-[#d8bd73]/40 bg-white/5 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-[#d8bd73] backdrop-blur-sm transition-all hover:scale-105 hover:border-[#d8bd73] hover:bg-[#d8bd73]/10 hover:shadow-[0_0_15px_rgba(216,189,115,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080c12]">
            <span className="relative flex items-center gap-2">
              <LogIn className="h-4 w-4" />
              Login
            </span>
          </button>
        </div>
      </div>
    </nav>
  );

  if (publicPage === 'systems') {
    return (
      <div className="min-h-screen bg-[#f5f6f4] text-neutral-950">
        {nav}
        <main className="pt-[72px]">
          <section className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-neutral-950 text-white py-14 flex flex-col justify-center">
            <div className="absolute inset-0">
               <img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=2200&q=80" alt="Code Background" className="h-full w-full object-cover opacity-20" />
               <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent" />
            </div>
            <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
              <button onClick={() => setPublicPage('home')} className="mb-12 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/15 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Voltar para Home
              </button>

              <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-[#d6b25e]">Projeto digital</p>
                  <h2 className="mt-4 text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">Criação de Sites, Apps e Sistemas</h2>
                  <p className="mt-6 max-w-xl text-lg leading-8 text-white/60">
                    Construímos soluções digitais sob medida com design premium e tecnologia de ponta. De landing pages focadas em conversão a aplicativos mobile e sistemas web complexos.
                  </p>
                  <div className="mt-10">
                    <button onClick={() => setIsSystemsBudgetOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#d6b25e] px-8 py-4 text-base font-black text-neutral-950 hover:bg-[#c4a04d] transition-all hover:scale-105 shadow-[0_0_20px_rgba(214,178,94,0.3)]">
                      Solicitar orçamento
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </div>
                </motion.div>
                
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative mt-12 lg:mt-0">
                   <div className="absolute inset-0 bg-gradient-to-tr from-[#d6b25e]/30 to-transparent blur-3xl rounded-full" />
                   <div className="relative rounded-2xl border border-white/10 bg-white/5 p-10 backdrop-blur-xl shadow-2xl">
                      <Code2 className="w-16 h-16 text-[#d6b25e] mb-8" />
                      <h3 className="text-2xl font-black text-white mb-6">Desenvolvimento Especializado</h3>
                      <ul className="space-y-5 text-white/75 text-lg font-medium">
                         <li className="flex items-center gap-4"><CheckCircle2 className="w-6 h-6 text-[#d6b25e]" /> Sites Institucionais Premium</li>
                         <li className="flex items-center gap-4"><CheckCircle2 className="w-6 h-6 text-[#d6b25e]" /> Landing Pages de Alta Conversão</li>
                         <li className="flex items-center gap-4"><CheckCircle2 className="w-6 h-6 text-[#d6b25e]" /> Sistemas Web Sob Medida</li>
                         <li className="flex items-center gap-4"><CheckCircle2 className="w-6 h-6 text-[#d6b25e]" /> Portais e Lojas Virtuais</li>
                         <li className="flex items-center gap-4"><CheckCircle2 className="w-6 h-6 text-[#d6b25e]" /> Aplicativos Mobile</li>
                      </ul>
                   </div>
                </motion.div>
              </div>
            </div>
          </section>

          <section className="bg-white py-14">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-8">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6e2f]">O que pode ser criado</p>
                <h2 className="mt-2 text-3xl font-black text-neutral-950">Solucoes digitais para vender, operar e acompanhar</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[
                  { icon: Store, title: 'Lojas e vitrines digitais', text: 'Catalogo de produtos, servicos, ofertas, carrinho, orcamentos e fluxo de contratacao.' },
                  { icon: Users, title: 'Portais de clientes', text: 'Area logada para pedidos, documentos, faturas, chamados, historico e beneficios.' },
                  { icon: BriefcaseBusiness, title: 'Sistemas de gestao', text: 'Painel administrativo para controlar clientes, prestadores, vendas, financeiro e atendimento.' },
                  { icon: Layers3, title: 'Automacoes de processos', text: 'Fluxos digitais para reduzir retrabalho, organizar tarefas e padronizar atendimento.' },
                  { icon: Headphones, title: 'Suporte e relacionamento', text: 'Ambientes para chamados, conversas, status, notificacoes e acompanhamento.' },
                  { icon: Smartphone, title: 'Aplicativos Mobile', text: 'Desenvolvimento de aplicativos nativos e hibridos para iOS e Android com alto desempenho e usabilidade.' },
                ].map(({ icon: Icon, title, text }) => (
                  <article key={title} className="rounded-lg border border-neutral-200 bg-[#fafafa] p-6">
                    <Icon className="h-7 w-7 text-neutral-950" />
                    <h3 className="mt-5 text-xl font-black text-neutral-950">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-neutral-600">{text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-[#f5f6f4] py-14">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6e2f]">Como funciona</p>
                  <h2 className="mt-2 text-3xl font-black text-neutral-950">Do planejamento ao sistema funcionando</h2>
                  <p className="mt-4 text-sm leading-7 text-neutral-600">
                    A pagina apresenta sua capacidade de desenvolver sistemas de verdade, com estrategia, telas, fluxo de usuario e estrutura pronta para crescer.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ['01', 'Diagnostico', 'Mapeamento da ideia, publico, dores e fluxo de trabalho.'],
                    ['02', 'Arquitetura', 'Organizacao das telas, modulos, regras e dados principais.'],
                    ['03', 'Desenvolvimento', 'Criacao da plataforma, integracoes e painel de gestao.'],
                    ['04', 'Evolucao', 'Ajustes, novas funcoes, melhoria de experiencia e escala.'],
                  ].map(([step, title, text]) => (
                    <article key={step} className="rounded-lg border border-neutral-200 bg-white p-5">
                      <span className="text-sm font-black text-[#8a6e2f]">{step}</span>
                      <h3 className="mt-3 text-lg font-black text-neutral-950">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-neutral-600">{text}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-neutral-950 py-14 text-white">
            <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d6b25e]">Projeto digital</p>
                <h2 className="mt-2 text-3xl font-black">Quer divulgar ou contratar um sistema?</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
                  Nossa equipe esta pronta para entender a sua necessidade e construir a solucao digital ideal para o seu negocio.
                </p>
              </div>
              <button onClick={() => setIsSystemsBudgetOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#d6b25e] px-5 py-4 text-sm font-black text-neutral-950">
                Solicitar orcamento
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        </main>
        <SystemsBudgetModal isOpen={isSystemsBudgetOpen} onClose={() => setIsSystemsBudgetOpen(false)} />
      </div>
    );
  }


  if (publicPage === 'services') {
    return (
      <div className="min-h-screen bg-[#f5f6f4] text-neutral-950">
        {nav}
        <main className="pt-[72px]">
          <section className="border-b border-neutral-200 bg-neutral-950 text-white">
            <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
              <button onClick={() => setPublicPage('home')} className="mb-8 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/15">
                <ArrowLeft className="h-4 w-4" />
                Voltar para Home
              </button>

              <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d6b25e]">Servicos e Assinaturas</p>
                  <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Catalogo exclusivo de servicos e pacotes GSA</h1>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/10 p-1">
                  <button onClick={() => setPublicAudience('PF')} className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-black transition-all ${publicAudience === 'PF' ? 'bg-white text-neutral-950' : 'text-white/70 hover:text-white'}`}>
                    <Users className="h-4 w-4" />
                    Pessoa fisica
                  </button>
                  <button onClick={() => setPublicAudience('PJ')} className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-black transition-all ${publicAudience === 'PJ' ? 'bg-white text-neutral-950' : 'text-white/70 hover:text-white'}`}>
                    <BriefcaseBusiness className="h-4 w-4" />
                    Empresas
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="py-12">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-8 hidden lg:grid gap-6 rounded-lg border border-neutral-200 bg-white p-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6e2f]">{audienceCopy[publicAudience].label}</p>
                  <h2 className="mt-2 text-3xl font-black text-neutral-950">{audienceCopy[publicAudience].title}</h2>
                </div>
                <p className="text-sm leading-7 text-neutral-600">{audienceCopy[publicAudience].text}</p>
              </div>

              <div className="mb-8 hidden gap-3 lg:grid lg:grid-cols-3">
                {[
                  ['Servico avulso', 'Contratacao pontual para resolver uma necessidade especifica.'],
                  ['Pacote de servicos', 'Conjunto de entregas agrupadas para um objetivo maior.'],
                  ['Assinatura recorrente', 'Acompanhamento continuo para rotinas mensais e suporte permanente.'],
                ].map(([title, text]) => (
                  <article key={title} className="rounded-lg border border-neutral-200 bg-white p-5">
                    <h3 className="text-sm font-black text-neutral-950">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">{text}</p>
                  </article>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredServicePackages.map((pkg, index) => (
                  <article
                    key={pkg.title}
                    onClick={() => setSelectedPackage(pkg)}
                    className="flex min-h-[320px] cursor-pointer flex-col rounded-lg border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg"
                  >
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-950 text-sm font-black text-white">{String(index + 1).padStart(2, '0')}</span>
                      <span className="rounded-md bg-[#f0eadb] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6e2f]">{pkg.audience}</span>
                    </div>
                    {pkg.audience === 'PF' ? (
                      <h3 className="mt-2 text-2xl font-black leading-tight text-neutral-950">{pkg.subtitle}</h3>
                    ) : (
                      <>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8a6e2f]">{pkg.subtitle}</p>
                        <h3 className="mt-2 text-2xl font-black leading-tight text-neutral-950">{pkg.title}</h3>
                      </>
                    )}
                    <p className="mt-4 hidden md:block text-sm leading-6 text-neutral-600">{pkg.description}</p>
                    <div className="mt-5 grid gap-2">
                      {pkg.services.map(service => (
                        <div key={getServiceName(service)} className="flex items-center gap-2 text-xs font-bold text-neutral-700">
                          <FileCheck className="h-4 w-4 text-[#8a6e2f]" />
                          {getServiceName(service)}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedPackage(pkg);
                      }}
                      className="mt-auto inline-flex w-fit items-center gap-2 pt-6 text-sm font-black text-neutral-950 hover:text-[#8a6e2f]"
                    >
                      Ver detalhes
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </section>

        </main>
        <ServiceDetailsModal
          selectedPackage={selectedPackage}
          onClose={() => setSelectedPackage(null)}
          onInterest={(pkg) => {
            setSelectedPackage(null);
            setRequestChoicePackage(pkg);
          }}
          getServiceName={getServiceName}
          getServiceDesc={getServiceDesc}
        />
        <RequestChannelModal
          selectedPackage={requestChoicePackage}
          onClose={() => setRequestChoicePackage(null)}
          onWhatsApp={(pkg) => {
            setRequestChoicePackage(null);
            openServiceWhatsApp(pkg);
          }}
          onEmail={(pkg) => {
            setRequestChoicePackage(null);
            openServiceEmail(pkg);
          }}
          onPortal={requestServiceViaPortal}
        />
        <SystemsBudgetModal isOpen={isSystemsBudgetOpen} onClose={() => setIsSystemsBudgetOpen(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-neutral-950">
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(10px)' }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050608] md:hidden"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="flex flex-col items-center"
            >
              <div className="mb-8 flex justify-center text-[#d8bd73] drop-shadow-[0_0_35px_rgba(216,189,115,0.6)] [&>div>div:first-child]:!w-[280px] [&>div>div:first-child]:!h-[280px] sm:[&>div>div:first-child]:!w-[420px] sm:[&>div>div:first-child]:!h-[420px]">
                <LogoGSA size="xl" />
              </div>
              <motion.h1 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="text-6xl sm:text-8xl lg:text-[10rem] font-serif font-medium tracking-[0.2em] bg-gradient-to-r from-[#d8bd73] via-white to-[#d8bd73] bg-[length:200%_auto] bg-clip-text text-transparent"
              >
                GSA HUB
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.8 }}
                className="mt-4 text-lg sm:text-2xl tracking-[0.3em] font-medium uppercase text-[#d8bd73]/80 whitespace-nowrap"
              >
                Soluções Digitais
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {nav}
      <main>
        <section className="relative min-h-[100svh] overflow-hidden bg-neutral-950 pt-24 text-white">
          <div className="absolute inset-0">
            <img
              src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=2200&q=85"
              alt="Ambiente corporativo premium GSA"
              className="h-full w-full object-cover opacity-48"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,6,8,0.96)_0%,rgba(5,6,8,0.78)_44%,rgba(5,6,8,0.52)_100%)]" />
          </div>

          <div className="relative mx-auto flex min-h-[calc(100svh-6rem)] max-w-7xl flex-col items-center justify-center text-center px-4 pb-16 pt-10 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center max-w-4xl"
            >

              <h1 className="flex items-center justify-center gap-4 text-5xl font-serif font-medium leading-tight tracking-[0.15em] sm:text-7xl lg:text-8xl pb-2">
                <motion.span 
                  animate={{ 
                    y: [0, -8, 0],
                    filter: [
                      "drop-shadow(0px 0px 0px rgba(216,189,115,0))", 
                      "drop-shadow(0px 12px 24px rgba(216,189,115,0.35))", 
                      "drop-shadow(0px 0px 0px rgba(216,189,115,0))"
                    ]
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="bg-gradient-to-r from-[#d8bd73] via-white to-[#d8bd73] bg-[length:200%_auto] bg-clip-text text-transparent"
                >
                  GSA
                </motion.span>
                <motion.span 
                  animate={{ 
                    y: [0, 8, 0],
                    filter: [
                      "drop-shadow(0px 0px 0px rgba(216,189,115,0))", 
                      "drop-shadow(0px -12px 24px rgba(216,189,115,0.35))", 
                      "drop-shadow(0px 0px 0px rgba(216,189,115,0))"
                    ]
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="bg-gradient-to-r from-[#d8bd73] via-white to-[#d8bd73] bg-[length:200%_auto] bg-clip-text text-transparent"
                >
                  HUB
                </motion.span>
              </h1>
              <motion.h2 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="mt-2 mb-2 text-lg sm:text-2xl tracking-[0.3em] font-medium uppercase text-[#d8bd73]/80 whitespace-nowrap"
              >
                Soluções Digitais
              </motion.h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">
                Conheça nosso catálogo de serviços exclusivos
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="mt-12 w-full max-w-5xl grid gap-4 sm:grid-cols-3"
            >
              {[
                { icon: BriefcaseBusiness, title: 'Servicos e Assinaturas', text: 'Servicos, pacotes e assinaturas.', action: () => setPublicPage('services') },
                { icon: ShoppingBag, title: 'Marketplace GSA', text: 'Produtos selecionados e compras.', action: onGuestStore || (() => undefined) },
                { icon: Code2, title: 'Criação de Sites e Sistemas', text: 'Sites, sistemas e automações.', action: () => setPublicPage('systems') },
              ].map(({ icon: Icon, title, text, action }) => (
                <button
                  key={title}
                  onClick={action}
                  className="group relative flex w-full items-center gap-4 overflow-hidden rounded-xl border border-white/14 bg-white/[0.09] p-5 text-left backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:border-[#d8bd73]/60 hover:bg-white/[0.14] sm:p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050608]"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-[#d8bd73]">
                    <Icon className="h-6 w-6" />
                  </div>
                  
                  <div className="flex-1">
                    <h2 className="text-base font-black text-white sm:text-lg">{title}</h2>
                    <p className="mt-1 text-xs leading-snug text-white/70 sm:text-sm">{text}</p>
                  </div>

                  <div 
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-all duration-300 group-hover:bg-[#d8bd73]/20 group-hover:text-[#d8bd73] shadow-[0_0_15px_rgba(255,255,255,0.1)] group-hover:shadow-[0_0_15px_rgba(216,189,115,0.4)] group-hover:translate-x-1"
                  >
                    <ArrowRight className="h-5 w-5 transition-transform duration-300" />
                  </div>
                </button>
              ))}
            </motion.div>
          </div>
        </section>




      </main>

      <footer className="border-t border-white/10 bg-neutral-950 pt-14 pb-8 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_0.9fr_1fr]">
            <div>
              <LogoGSA size="xl" variant="light" />
              <p className="mt-6 max-w-md text-sm leading-7 text-white/58">
                Produtos, servicos, assinaturas e tecnologia em uma experiencia digital privada, elegante e conectada.
              </p>
            </div>
            <div>
              <h4 className="mb-5 text-xs font-black uppercase tracking-[0.22em] text-white/35">Ambientes</h4>
              <ul className="space-y-3 text-sm font-bold text-white/75">
                <li><button onClick={() => setPublicPage('services')} className="hover:text-[#d8bd73]">Servicos e Assinaturas</button></li>
                <li><button onClick={onGuestStore} className="hover:text-[#d8bd73]">Loja GSA Store</button></li>
                <li><button onClick={() => setPublicPage('systems')} className="hover:text-[#d8bd73]">Criacao de Site e Sistemas</button></li>
                <li><button onClick={onClientLogin} className="hover:text-[#d8bd73]">Login</button></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-5 text-xs font-black uppercase tracking-[0.22em] text-white/35">Contato</h4>
              <div className="space-y-3">
                <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Ola! Vim pelo site da GSA e gostaria de atendimento.')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm font-bold text-white/75 hover:text-[#d8bd73]">
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp
                </a>
                <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-3 text-sm font-bold text-white/75 hover:text-[#d8bd73]">
                  <Mail className="h-5 w-5" />
                  {CONTACT_EMAIL}
                </a>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-7 sm:flex-row">
            <p className="text-xs font-semibold text-white/35">
              © {new Date().getFullYear()} GSA Enterprise Hub. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ServiceDetailsModal({
  selectedPackage,
  onClose,
  onInterest,
  getServiceName,
  getServiceDesc,
}: {
  selectedPackage: ServicePackage | null;
  onClose: () => void;
  onInterest: (pkg: ServicePackage) => void;
  getServiceName: (service: string | { name: string; desc: string }) => string;
  getServiceDesc: (service: string | { name: string; desc: string }) => string;
}) {
  return (
    <AnimatePresence>
      {selectedPackage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="mx-auto my-6 max-w-5xl overflow-hidden rounded-lg bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-neutral-950 p-6 text-white md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`font-black uppercase text-[#d6b25e] ${selectedPackage.audience === 'PF' ? 'text-2xl tracking-[0.05em] mb-4 lg:mb-0 lg:text-xs lg:tracking-[0.22em]' : 'text-xs tracking-[0.22em]'}`}>{selectedPackage.subtitle}</p>
                  <h2 className={`mt-3 text-3xl font-black leading-tight md:text-4xl ${selectedPackage.audience === 'PF' ? 'hidden lg:block' : ''}`}>{selectedPackage.title}</h2>
                  <p className={`mt-4 max-w-3xl text-sm leading-7 text-white/65 ${selectedPackage.audience === 'PF' ? 'hidden lg:block' : ''}`}>{selectedPackage.description}</p>
                </div>
                <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/15">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[1.25fr_0.75fr]">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6e2f]">Detalhes do pacote</p>
                <div className="mt-5 grid gap-3">
                  {selectedPackage.services.map((service, index) => (
                    <article key={`${getServiceName(service)}-${index}`} className="rounded-lg border border-neutral-200 bg-[#fafafa] p-5">
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-950 text-xs font-black text-white">{String(index + 1).padStart(2, '0')}</span>
                        <div>
                          <h3 className="text-base font-black text-neutral-950">{getServiceName(service)}</h3>
                          {getServiceDesc(service) ? (
                            <p className="mt-2 text-sm leading-6 text-neutral-600">{getServiceDesc(service)}</p>
                          ) : (
                            <p className="mt-2 text-sm leading-6 text-neutral-600">Servico incluso neste pacote, com atendimento direcionado conforme a necessidade do cliente.</p>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <aside className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
                <div className={selectedPackage.audience === 'PF' ? 'hidden lg:block' : 'block'}>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6e2f]">Formas de contratacao</p>
                  <div className="mt-4 grid gap-3">
                    {[
                      ['Servico avulso', 'Escolha somente uma entrega especifica.'],
                      ['Pacote completo', 'Contrate o conjunto de solucoes do pacote.'],
                      ['Assinatura recorrente', 'Mantenha acompanhamento mensal e suporte continuo.'],
                    ].map(([title, text]) => (
                      <div key={title} className="rounded-lg bg-[#f5f6f4] p-4">
                        <h4 className="text-sm font-black text-neutral-950">{title}</h4>
                        <p className="mt-1 text-xs leading-5 text-neutral-600">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => onInterest(selectedPackage)}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-5 py-4 text-sm font-black text-white ${selectedPackage.audience === 'PF' ? 'mt-0 lg:mt-5' : 'mt-5'}`}
                >
                  Tenho interesse
                  <ArrowRight className="h-4 w-4" />
                </button>
              </aside>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RequestChannelModal({
  selectedPackage,
  onClose,
  onWhatsApp,
  onEmail,
  onPortal,
}: {
  selectedPackage: ServicePackage | null;
  onClose: () => void;
  onWhatsApp: (pkg: ServicePackage) => void;
  onEmail: (pkg: ServicePackage) => void;
  onPortal: (pkg: ServicePackage) => void;
}) {
  return (
    <AnimatePresence>
      {selectedPackage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6e2f]">Solicitar atendimento</p>
                <h3 className="mt-2 text-2xl font-black text-neutral-950">{selectedPackage.title}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-600">Escolha como deseja continuar sua solicitação.</p>
              </div>
              <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 hover:bg-neutral-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-3">
              <button onClick={() => onWhatsApp(selectedPackage)} className="rounded-xl bg-neutral-950 p-4 text-left text-white transition-all hover:bg-black">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  <p className="font-black">Solicitar via WhatsApp</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-white/65">Abre uma conversa com a GSA com o pacote selecionado.</p>
              </button>
              <button onClick={() => onEmail(selectedPackage)} className="rounded-xl border border-neutral-200 bg-white p-4 text-left text-neutral-950 transition-all hover:bg-neutral-50">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-neutral-500" />
                  <p className="font-black">Solicitar via E-mail</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-neutral-600">Abre seu gerenciador de e-mail com as informações do pacote.</p>
              </button>
              <button onClick={() => onPortal(selectedPackage)} className="rounded-xl border border-neutral-200 bg-white p-4 text-left text-neutral-950 transition-all hover:bg-neutral-50">
                <div className="flex items-center gap-2">
                  <LogIn className="h-5 w-5 text-neutral-500" />
                  <p className="font-black">Solicitar pelo Portal</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-neutral-600">Acesse ou cadastre-se para abrir um orçamento já preenchido.</p>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SystemsBudgetModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    nome: '',
    telefone: '',
    tipo: '',
    solicitacao: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'tipo' ? { solicitacao: '' } : {}),
    }));
  };

  const resetForm = () => {
    setForm({
      nome: '',
      email: '',
      telefone: '',
      tipo: '',
      solicitacao: '',
    });
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };


  const handleSubmit = async () => {
    if (!form.nome.trim()) return toast.error('Informe seu nome.');
    if (!form.email.trim()) return toast.error('Informe seu e-mail.');
    if (!form.telefone.trim()) return toast.error('Informe seu telefone.');
    if (!form.tipo) return toast.error('Selecione o tipo de projeto.');
    if (!form.solicitacao.trim()) return toast.error('Descreva sua solicitação.');

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc('gsa_public_create_enterprise_budget', {
        p_payload: {
          nome: form.nome.trim(),
          email: form.email.trim(),
          telefone: form.telefone.replace(/\D/g, ''),
          tipo: form.tipo,
          solicitacao: form.solicitacao.trim()
        }
      });
      if (error) throw error;

      toast.success('Solicitação enviada! A GSA retornará pelo contato informado.');
      resetForm();
      onClose();
    } catch (error: any) {
      console.error('Erro ao criar orçamento público de sistemas:', error);
      toast.error(error?.message || 'Não foi possível enviar a solicitação agora.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="mx-auto my-6 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6e2f]">Solicitar orçamento</p>
                <h3 className="mt-2 text-2xl font-black text-neutral-950">Criação de site ou sistema</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-600">Preencha seus dados para o administrativo analisar e retornar pelo contato informado.</p>
              </div>
              <button onClick={handleClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 hover:bg-neutral-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-widest text-neutral-500">Nome</span>
                  <input value={form.nome} onChange={(event) => updateField('nome', event.target.value)} className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold text-neutral-950 outline-none focus:border-[#d6b25e] focus:bg-white" />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-widest text-neutral-500">E-mail</span>
                  <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold text-neutral-950 outline-none focus:border-[#d6b25e] focus:bg-white" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-widest text-neutral-500">Telefone</span>
                  <input inputMode="numeric" value={form.telefone} onChange={(event) => updateField('telefone', maskPhone(event.target.value))} maxLength={15} className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold text-neutral-950 outline-none focus:border-[#d6b25e] focus:bg-white" />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-widest text-neutral-500">Tipo de projeto</span>
                  <select value={form.tipo} onChange={(event) => updateField('tipo', event.target.value)} className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold text-neutral-950 outline-none focus:border-[#d6b25e] focus:bg-white">
                    <option value="">Selecione</option>
                    <option value="Lojas e vitrines digitais">Lojas e vitrines digitais</option>
                    <option value="Portais de clientes">Portais de clientes</option>
                    <option value="Sistemas de gestão">Sistemas de gestão</option>
                    <option value="Automações de processos">Automações de processos</option>
                    <option value="Suporte e relacionamento">Suporte e relacionamento</option>
                    <option value="Aplicativos Mobile">Aplicativos Mobile</option>
                  </select>
                </label>
              </div>

              {form.tipo && (
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-widest text-neutral-500">
                    Solicitação para {form.tipo}
                  </span>
                  <textarea
                    value={form.solicitacao}
                    onChange={(event) => updateField('solicitacao', event.target.value)}
                    rows={5}
                    placeholder="Descreva os módulos, usuários, processos e objetivo do seu projeto."
                    className="resize-y rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold leading-6 text-neutral-950 outline-none focus:border-[#d6b25e] focus:bg-white"
                  />
                </label>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
              <button onClick={handleClose} disabled={isSubmitting} className="rounded-xl border border-neutral-200 px-5 py-3 text-sm font-black text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleSubmit} disabled={isSubmitting} className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-black text-white hover:bg-black disabled:opacity-50">
                {isSubmitting ? 'Enviando...' : 'Confirmar solicitação'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
