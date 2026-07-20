import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Code2,
  Headphones,
  LogIn,
  Mail,
  MessageCircle,
  PackageCheck,
  ShoppingBag,
  Smartphone,
  Store,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LogoGSA } from '../ui/LogoGSA';
import { AccessibleDialog } from '../ui/AccessibleDialog';
import { supabase } from '../../lib/supabase';
import { maskPhone } from '../../lib/utils';
import type { Audience, IconItem, PublicPage, ServicePackage } from '../../data/publicServiceCatalog';

const WHATSAPP_NUMBER = '5511920857756';
const CONTACT_EMAIL = 'gsa.doc.adm@gmail.com';

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
  const reduceMotion = useReducedMotion();
  const [showIntro, setShowIntro] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);
  const [requestPackage, setRequestPackage] = useState<ServicePackage | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);

  const filteredPackages = useMemo(
    () => servicePackages.filter((item) => item.audience === publicAudience),
    [publicAudience, servicePackages],
  );

  useEffect(() => {
    if (reduceMotion || window.innerWidth >= 768 || localStorage.getItem('gsa_intro_seen')) return;
    setShowIntro(true);
    const timer = window.setTimeout(() => {
      setShowIntro(false);
      localStorage.setItem('gsa_intro_seen', 'true');
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [publicPage, reduceMotion]);

  const dismissIntro = () => {
    setShowIntro(false);
    localStorage.setItem('gsa_intro_seen', 'true');
  };

  const openWhatsApp = (message: string) => {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const requestViaPortal = (servicePackage: ServicePackage) => {
    localStorage.setItem('gsa_pending_service_request', JSON.stringify({
      title: servicePackage.title,
      description: servicePackage.description,
      services: servicePackage.services,
      source: 'public_services',
      createdAt: new Date().toISOString(),
    }));
    setRequestPackage(null);
    setSelectedPackage(null);
    onClientLogin();
  };

  const nav = (
    <nav className={`fixed inset-x-0 top-0 z-[90] border-b transition-all ${isScrolled || publicPage !== 'home' ? 'border-white/10 bg-[#080c12]/95 py-3 shadow-xl backdrop-blur-xl' : 'border-transparent bg-transparent py-5'}`} aria-label="Navegação principal">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={() => setPublicPage('home')} aria-label="Ir para a página inicial" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]">
          <LogoGSA size="md" variant="light" />
        </button>
        <button type="button" onClick={onClientLogin} className="inline-flex items-center gap-2 rounded-lg border border-[#d8bd73]/50 bg-white/5 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-[#d8bd73] transition hover:bg-[#d8bd73]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]">
          <LogIn className="h-4 w-4" /> Login
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-neutral-950">
      <AccessibleDialog
        isOpen={showIntro}
        onClose={dismissIntro}
        ariaLabel="Introdução GSA"
        zIndexClassName="z-[100]"
        overlayClassName="items-center justify-center bg-[#050608] px-6 text-center md:hidden"
        panelClassName="max-w-lg bg-transparent text-center text-white shadow-none"
      >
        <LogoGSA size="xl" variant="light" />
        <h1 className="mt-6 text-5xl font-serif tracking-[0.14em] text-[#d8bd73]">GSA HUB</h1>
        <p className="mt-3 text-sm uppercase tracking-[0.24em] text-white/65">Soluções Digitais</p>
        <button type="button" data-dialog-autofocus onClick={dismissIntro} className="mt-10 rounded-full border border-white/25 px-5 py-2 text-sm font-bold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]">Pular introdução</button>
      </AccessibleDialog>

      {nav}
      {publicPage === 'home' && (
        <main>
          <section className="relative min-h-[100svh] overflow-hidden bg-neutral-950 pt-24 text-white">
            <img src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=2200&q=85" alt="Ambiente corporativo da GSA" className="absolute inset-0 h-full w-full object-cover opacity-45" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,6,8,0.96)_0%,rgba(5,6,8,0.78)_44%,rgba(5,6,8,0.52)_100%)]" />
            <div className="relative mx-auto flex min-h-[calc(100svh-6rem)] max-w-7xl flex-col items-center justify-center px-4 pb-16 text-center sm:px-6 lg:px-8">
              <motion.div initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-4xl">
                <h1 className="text-5xl font-serif font-medium tracking-[0.12em] sm:text-7xl lg:text-8xl">
                  <span className="bg-gradient-to-r from-[#d8bd73] via-white to-[#d8bd73] bg-clip-text text-transparent">GSA HUB</span>
                </h1>
                <p className="mt-4 text-base font-medium uppercase tracking-[0.2em] text-[#d8bd73]/85 sm:text-2xl">Soluções Digitais</p>
                <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">Serviços administrativos, marketplace e tecnologia reunidos em uma experiência segura e conectada.</p>
              </motion.div>

              <div className="mt-12 grid w-full max-w-5xl gap-4 sm:grid-cols-3">
                {[
                  { icon: BriefcaseBusiness, title: 'Serviços e Assinaturas', text: 'Serviços, pacotes e planos recorrentes.', action: () => setPublicPage('services') },
                  { icon: ShoppingBag, title: 'Marketplace GSA', text: 'Produtos selecionados e compras.', action: onGuestStore || (() => undefined) },
                  { icon: Code2, title: 'Sites e Sistemas', text: 'Sites, sistemas e automações.', action: () => setPublicPage('systems') },
                ].map(({ icon: Icon, title, text, action }) => (
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
      )}

      {publicPage === 'services' && (
        <main className="min-h-screen bg-[#f4f1ea] pt-28">
          <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
            <button type="button" onClick={() => setPublicPage('home')} className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-bold"><ArrowLeft className="h-4 w-4" />Voltar</button>
            <div className="mt-10 grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6e2f]">Catálogo GSA</p>
                <h1 className="mt-3 text-4xl font-black">Serviços e assinaturas para cada fase</h1>
                <p className="mt-4 text-base leading-7 text-neutral-600">Escolha seu perfil, conheça os pacotes e solicite atendimento pelo canal mais conveniente.</p>
                <div className="mt-7 flex gap-2 rounded-xl bg-neutral-950 p-1 text-white">
                  <button type="button" onClick={() => setPublicAudience('PF')} aria-pressed={publicAudience === 'PF'} className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold ${publicAudience === 'PF' ? 'bg-white text-neutral-950' : 'text-white/70'}`}><Users className="mr-2 inline h-4 w-4" />Pessoa física</button>
                  <button type="button" onClick={() => setPublicAudience('PJ')} aria-pressed={publicAudience === 'PJ'} className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold ${publicAudience === 'PJ' ? 'bg-white text-neutral-950' : 'text-white/70'}`}><BriefcaseBusiness className="mr-2 inline h-4 w-4" />Empresas</button>
                </div>
                <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  {[...publicServices, ...publicProducts].slice(0, 4).map(({ icon: Icon, title, text }) => <div key={title} className="rounded-xl border border-neutral-200 bg-white p-4"><Icon className="h-5 w-5 text-[#8a6e2f]" /><strong className="mt-3 block">{title}</strong><p className="mt-1 text-xs leading-5 text-neutral-600">{text}</p></div>)}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {filteredPackages.map((item) => (
                  <article key={item.title} className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6e2f]">{item.subtitle}</p>
                    <h2 className="mt-3 text-2xl font-black">{item.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-neutral-600">{item.description}</p>
                    <ul className="mt-5 space-y-2 text-sm text-neutral-700">{item.services.slice(0, 3).map((service) => <li key={service.name} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6e2f]" />{service.name}</li>)}</ul>
                    <button type="button" onClick={() => setSelectedPackage(item)} className="mt-6 inline-flex items-center gap-2 font-bold text-[#142030]">Ver detalhes <ArrowRight className="h-4 w-4" /></button>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </main>
      )}

      {publicPage === 'systems' && (
        <main className="min-h-screen bg-neutral-950 pt-24 text-white">
          <section className="mx-auto grid min-h-[calc(100svh-6rem)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <button type="button" onClick={() => setPublicPage('home')} className="mb-10 inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-bold text-white/80"><ArrowLeft className="h-4 w-4" />Voltar</button>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d6b25e]">Projeto digital</p>
              <h1 className="mt-4 text-4xl font-black leading-tight sm:text-6xl">Criação de sites, aplicativos e sistemas</h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-white/65">Soluções sob medida para vender, organizar processos e acompanhar resultados.</p>
              <button type="button" onClick={() => setBudgetOpen(true)} className="mt-9 inline-flex items-center gap-2 rounded-lg bg-[#d6b25e] px-7 py-4 font-black text-neutral-950">Solicitar orçamento <ArrowRight className="h-5 w-5" /></button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
              <Code2 className="h-14 w-14 text-[#d6b25e]" />
              <h2 className="mt-6 text-2xl font-black">Desenvolvimento especializado</h2>
              <ul className="mt-6 space-y-4 text-white/75">
                {['Sites institucionais e landing pages', 'Sistemas web sob medida', 'Portais e lojas virtuais', 'Aplicativos e automações'].map((item) => <li key={item} className="flex gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-[#d6b25e]" />{item}</li>)}
              </ul>
              <button type="button" onClick={() => openWhatsApp('Olá! Gostaria de atendimento sobre criação de site ou sistema.')} className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#d6b25e]"><MessageCircle className="h-5 w-5" />Falar pelo WhatsApp</button>
            </div>
          </section>
        </main>
      )}

      <footer className="border-t border-white/10 bg-neutral-950 py-10 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          <div><LogoGSA size="lg" variant="light" /><p className="mt-4 text-sm leading-6 text-white/55">Serviços, assinaturas, produtos e tecnologia em um único hub.</p></div>
          <nav aria-label="Links do rodapé"><h2 className="text-xs font-black uppercase tracking-widest text-white/35">Ambientes</h2><div className="mt-4 grid gap-3 text-sm font-bold text-white/75"><button type="button" onClick={() => setPublicPage('services')} className="w-fit hover:text-[#d8bd73]">Serviços e Assinaturas</button><button type="button" onClick={onGuestStore} className="w-fit hover:text-[#d8bd73]">Marketplace</button><button type="button" onClick={() => setPublicPage('systems')} className="w-fit hover:text-[#d8bd73]">Sites e Sistemas</button><button type="button" onClick={onAdminLogin} className="w-fit hover:text-[#d8bd73]">Acesso restrito</button></div></nav>
          <div><h2 className="text-xs font-black uppercase tracking-widest text-white/35">Contato</h2><div className="mt-4 grid gap-3 text-sm font-bold text-white/75"><a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-[#d8bd73]"><MessageCircle className="h-5 w-5" />WhatsApp</a><a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-2 hover:text-[#d8bd73]"><Mail className="h-5 w-5" />{CONTACT_EMAIL}</a></div></div>
        </div>
      </footer>

      <ServiceDetailsModal selectedPackage={selectedPackage} onClose={() => setSelectedPackage(null)} onInterest={(item) => { setSelectedPackage(null); setRequestPackage(item); }} />
      <RequestChannelModal selectedPackage={requestPackage} onClose={() => setRequestPackage(null)} onWhatsApp={(item) => { setRequestPackage(null); openWhatsApp(`Olá! Gostaria de atendimento sobre o pacote ${item.title}.`); }} onEmail={(item) => { window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Atendimento - ${item.title}`)}&body=${encodeURIComponent(item.description)}`; }} onPortal={requestViaPortal} />
      <SystemsBudgetModal isOpen={budgetOpen} onClose={() => setBudgetOpen(false)} />
    </div>
  );
}

function ServiceDetailsModal({ selectedPackage, onClose, onInterest }: { selectedPackage: ServicePackage | null; onClose: () => void; onInterest: (item: ServicePackage) => void }) {
  return (
    <AccessibleDialog
      isOpen={Boolean(selectedPackage)}
      onClose={onClose}
      ariaLabel={selectedPackage ? `Detalhes do pacote ${selectedPackage.title}` : 'Detalhes do pacote'}
      panelClassName="max-w-4xl rounded-2xl bg-white p-6 shadow-2xl"
    >
      {selectedPackage && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-widest text-[#8a6e2f]">{selectedPackage.subtitle}</p><h2 className="mt-2 text-3xl font-black">{selectedPackage.title}</h2><p className="mt-3 text-sm leading-6 text-neutral-600">{selectedPackage.description}</p></div>
            <button type="button" onClick={onClose} data-dialog-autofocus aria-label="Fechar detalhes" className="rounded-lg bg-neutral-100 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f]"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">{selectedPackage.services.map((service) => <div key={service.name} className="rounded-xl bg-neutral-50 p-4"><strong>{service.name}</strong><p className="mt-2 text-sm leading-6 text-neutral-600">{service.desc}</p></div>)}</div>
          <button type="button" onClick={() => onInterest(selectedPackage)} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 py-4 font-black text-white">Tenho interesse <ArrowRight className="h-4 w-4" /></button>
        </>
      )}
    </AccessibleDialog>
  );
}

function RequestChannelModal({ selectedPackage, onClose, onWhatsApp, onEmail, onPortal }: { selectedPackage: ServicePackage | null; onClose: () => void; onWhatsApp: (item: ServicePackage) => void; onEmail: (item: ServicePackage) => void; onPortal: (item: ServicePackage) => void }) {
  return (
    <AccessibleDialog isOpen={Boolean(selectedPackage)} onClose={onClose} ariaLabel="Escolher canal de atendimento" panelClassName="max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
      {selectedPackage && (
        <>
          <div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-[#8a6e2f]">Solicitar atendimento</p><h2 className="mt-2 text-2xl font-black">{selectedPackage.title}</h2></div><button type="button" onClick={onClose} data-dialog-autofocus aria-label="Fechar canais de atendimento" className="rounded-lg bg-neutral-100 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f]"><X className="h-5 w-5" /></button></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3"><ChannelButton icon={MessageCircle} title="WhatsApp" onClick={() => onWhatsApp(selectedPackage)} /><ChannelButton icon={Mail} title="E-mail" onClick={() => onEmail(selectedPackage)} /><ChannelButton icon={LogIn} title="Portal" onClick={() => onPortal(selectedPackage)} /></div>
        </>
      )}
    </AccessibleDialog>
  );
}

function ChannelButton({ icon: Icon, title, onClick }: { icon: typeof MessageCircle; title: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-xl border border-neutral-200 p-5 text-left transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f]"><Icon className="h-6 w-6 text-[#8a6e2f]" /><strong className="mt-4 block">{title}</strong></button>;
}

function SystemsBudgetModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', tipo: '', solicitacao: '' });
  const [submitting, setSubmitting] = useState(false);
  const update = (field: keyof typeof form, value: string) => setForm((previous) => ({ ...previous, [field]: value }));
  const closeSafely = () => { if (!submitting) onClose(); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.nome.trim() || !form.email.trim() || !form.telefone.trim() || !form.tipo || !form.solicitacao.trim()) return toast.error('Preencha todos os campos.');
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('gsa_public_create_enterprise_budget', { p_payload: { ...form, nome: form.nome.trim(), email: form.email.trim(), telefone: form.telefone.replace(/\D/g, ''), solicitacao: form.solicitacao.trim() } });
      if (error) throw error;
      toast.success('Solicitação enviada. A GSA retornará pelo contato informado.');
      setForm({ nome: '', email: '', telefone: '', tipo: '', solicitacao: '' });
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível enviar a solicitação.');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <AccessibleDialog isOpen={isOpen} onClose={closeSafely} closeOnBackdrop={!submitting} ariaLabel="Solicitar orçamento de sistema" panelClassName="max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-[#8a6e2f]">Solicitar orçamento</p><h2 className="mt-2 text-2xl font-black">Criação de site ou sistema</h2></div><button type="button" onClick={closeSafely} aria-label="Fechar orçamento" className="rounded-lg bg-neutral-100 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f]"><X className="h-5 w-5" /></button></div>
        <div className="grid gap-4 sm:grid-cols-2"><input required data-dialog-autofocus value={form.nome} onChange={(event) => update('nome', event.target.value)} placeholder="Nome" className="input-field" /><input required type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="E-mail" className="input-field" /></div>
        <div className="grid gap-4 sm:grid-cols-2"><input required value={form.telefone} onChange={(event) => update('telefone', maskPhone(event.target.value))} placeholder="Telefone" className="input-field" /><select required value={form.tipo} onChange={(event) => update('tipo', event.target.value)} className="input-field"><option value="">Tipo de projeto</option><option value="site">Site</option><option value="loja">Loja virtual</option><option value="sistema">Sistema web</option><option value="aplicativo">Aplicativo</option><option value="automacao">Automação</option></select></div>
        <textarea required rows={5} value={form.solicitacao} onChange={(event) => update('solicitacao', event.target.value)} placeholder="Descreva sua necessidade" className="input-field resize-none" />
        <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Enviando...' : 'Enviar solicitação'}</button>
      </form>
    </AccessibleDialog>
  );
}
