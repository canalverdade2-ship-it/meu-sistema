import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckSquare,
  Compass,
  FileText,
  HelpCircle,
  MapPin,
  Plane,
  RefreshCcw,
  Ticket,
  Users,
} from 'lucide-react';
import { navigate } from '../../../../routing/navigationService';
import { routes } from '../../../../routing/routeCatalog';

interface TravelHubMenuProps {
  clientId?: string;
  onBackToMarketplace: () => void;
  onRequireAuth: () => void;
}

const DISCOVERY = [
  {
    id: 'nacional',
    eyebrow: 'Brasil',
    title: 'Destinos nacionais',
    description: 'Praias, capitais, serras e experiências dentro do país.',
    image: '/images/marketplace/submodules/travel/explorar-pacotes.jpg',
    path: routes.marketplace.travelPackages.ofertasNacionais(),
  },
  {
    id: 'internacional',
    eyebrow: 'Exterior',
    title: 'Destinos internacionais',
    description: 'Roteiros e pacotes para viajar além das fronteiras.',
    image: '/images/marketplace/submodules/travel/minhas-viagens.jpg',
    path: routes.marketplace.travelPackages.ofertasInternacionais(),
  },
  {
    id: 'excursoes',
    eyebrow: 'Em grupo',
    title: 'Excursões selecionadas',
    description: 'Datas, roteiros e experiências organizadas para grupos.',
    image: '/images/marketplace/submodules/travel/vouchers-comprovantes.jpg',
    path: routes.marketplace.travelPackages.ofertasExcursoes(),
  },
] as const;

const JOURNEY = [
  { id: 'viagens', title: 'Minhas viagens', description: 'Reservas, emissões e andamento da jornada.', icon: Plane, path: routes.marketplace.travelPackages.minhasViagens() },
  { id: 'propostas', title: 'Minhas propostas', description: 'Compare as opções preparadas pela equipe GSA.', icon: CheckSquare, path: routes.marketplace.travelPackages.minhasPropostas() },
  { id: 'documentos', title: 'Passageiros e documentos', description: 'Dados necessários para emissão e embarque.', icon: Users, path: routes.marketplace.travelPackages.documentos() },
  { id: 'vouchers', title: 'Vouchers e comprovantes', description: 'Bilhetes, reservas e confirmações da viagem.', icon: Ticket, path: routes.marketplace.travelPackages.minhasViagens() },
  { id: 'cancelamentos', title: 'Cancelamentos e reembolsos', description: 'Solicitações, prazos e devoluções.', icon: RefreshCcw, path: routes.marketplace.travelPackages.cancelamentos() },
] as const;

export function TravelHubMenu({ clientId, onBackToMarketplace, onRequireAuth }: TravelHubMenuProps) {
  const openProtected = (path: string) => {
    if (!clientId) {
      onRequireAuth();
      return;
    }
    navigate(path);
  };

  return (
    <div className="min-h-[100dvh] bg-[#eef4f4] text-[#10252f]">
      <nav className="sticky top-0 z-50 border-b border-[#cad9da] bg-[#f6fbfb]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <div className="flex items-center gap-4">
            <button type="button" onClick={onBackToMarketplace} className="flex items-center gap-2 text-sm font-bold text-[#617579] hover:text-[#10252f]"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Marketplace</span></button>
            <div className="h-5 w-px bg-[#cad9da]" />
            <button type="button" onClick={() => navigate(routes.marketplace.travelPackages.root())} className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0d4660] text-[#7dd3fc]"><Plane className="h-4 w-4" /></span><span><span className="block text-[9px] font-black uppercase tracking-[0.18em] text-[#63808a]">GSA HUB</span><strong className="block text-sm">Viagens</strong></span></button>
          </div>
          {clientId ? <button type="button" onClick={() => navigate(routes.client.dashboard())} className="rounded-full border border-[#bfcfd1] bg-white px-4 py-2 text-sm font-black">Portal do Cliente</button> : <button type="button" onClick={onRequireAuth} className="rounded-full bg-[#0d4660] px-5 py-2.5 text-sm font-black text-white">Entrar</button>}
        </div>
      </nav>

      <main>
        <section className="relative isolate overflow-hidden bg-[#062b3d] text-white">
          <img src="/images/marketplace/submodules/travel/explorar-pacotes.jpg" alt="Destino litorâneo para planejamento de viagem" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-45" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(6,43,61,0.98)_0%,rgba(6,43,61,0.88)_50%,rgba(6,43,61,0.36)_100%)]" />
          <div className="mx-auto max-w-7xl px-5 py-16 sm:py-24 lg:py-28">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#7dd3fc]">Destinos e experiências</p>
              <h1 className="mt-5 text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-7xl">Para onde você quer ir?</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/65 sm:text-lg">Descubra opções por tipo de viagem ou solicite um roteiro construído para suas datas, orçamento e preferências.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => navigate(routes.marketplace.travelPackages.ofertas())} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-lg bg-[#7dd3fc] px-6 text-sm font-black text-[#062b3d]">Explorar ofertas <Compass className="h-4 w-4" /></button>
                <button type="button" onClick={() => navigate(routes.marketplace.travelPackages.orcamento())} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/[0.07] px-6 text-sm font-black text-white">Montar minha viagem <FileText className="h-4 w-4" /></button>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-xs font-bold text-white/55"><span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-[#7dd3fc]" />Nacional e internacional</span><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#7dd3fc]" />Datas flexíveis ou definidas</span><span className="inline-flex items-center gap-2"><HelpCircle className="h-4 w-4 text-[#7dd3fc]" />Orientação da equipe GSA</span></div>
            </motion.div>
          </div>
        </section>

        <section className="py-14 sm:py-18">
          <div className="mx-auto max-w-7xl px-5">
            <div className="flex flex-col gap-4 border-b border-[#cbd9da] pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#1a738d]">Descoberta</p><h2 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Escolha o tipo de experiência</h2></div><p className="max-w-md text-sm leading-6 text-[#66787b]">A vitrine muda conforme o destino, sem transformar a viagem em um painel de módulos.</p></div>
            <div className="mt-6 grid gap-5 lg:grid-cols-3">
              {DISCOVERY.map((item, index) => <motion.button key={item.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }} type="button" onClick={() => navigate(item.path)} className="group relative min-h-[360px] overflow-hidden rounded-2xl text-left text-white shadow-xl"><img src={item.image} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#041b27] via-[#062b3d]/45 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-6"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7dd3fc]">{item.eyebrow}</span><h3 className="mt-3 text-2xl font-black">{item.title}</h3><p className="mt-3 text-sm leading-6 text-white/65">{item.description}</p><span className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.09em]">Ver destinos <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></div></motion.button>)}
            </div>
          </div>
        </section>

        <section className="border-y border-[#cbd9da] bg-white py-14 sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 lg:grid-cols-[0.72fr_1.28fr]">
            <div className="rounded-2xl bg-[#0d4660] p-7 text-white sm:p-8"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7dd3fc]">Viagem personalizada</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Não encontrou a combinação ideal?</h2><p className="mt-4 text-sm leading-7 text-white/60">Informe destino, período, passageiros e preferências. A equipe prepara opções para comparação.</p><button type="button" onClick={() => navigate(routes.marketplace.travelPackages.orcamento())} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#7dd3fc] px-5 text-sm font-black text-[#062b3d]">Solicitar orçamento <ArrowRight className="h-4 w-4" /></button></div>

            <div>
              <div className="flex items-end justify-between border-b border-[#d4dfe0] pb-5"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1a738d]">Minha jornada</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">{clientId ? 'Acompanhe o que já está em andamento' : 'Entre para acompanhar sua viagem'}</h2></div></div>
              {clientId ? <div className="divide-y divide-[#d7e0e1] border-b border-[#d7e0e1]">{JOURNEY.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => openProtected(item.path)} className="group grid w-full grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-4 py-4 text-left"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#cbd9da] bg-[#f3f8f8] text-[#1a738d]"><Icon className="h-4 w-4" /></span><span><strong className="block text-sm">{item.title}</strong><span className="mt-1 block text-xs leading-5 text-[#6a797c]">{item.description}</span></span><ArrowRight className="h-4 w-4 text-[#1a738d] transition group-hover:translate-x-1" /></button>; })}</div> : <div className="mt-6 rounded-2xl border border-dashed border-[#bfd0d2] bg-[#f3f8f8] p-8 text-center"><Plane className="mx-auto h-8 w-8 text-[#1a738d]" /><h3 className="mt-4 text-lg font-black">Sua jornada fica protegida no Portal do Cliente</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#6a797c]">Reservas, propostas, documentos, vouchers e solicitações aparecem após a autenticação.</p><button type="button" onClick={onRequireAuth} className="mt-6 rounded-lg bg-[#0d4660] px-6 py-3 text-sm font-black text-white">Entrar para acompanhar</button></div>}
            </div>
          </div>
        </section>

        <section className="py-12"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1a738d]">Atendimento em viagem</p><h2 className="mt-2 text-2xl font-black">Precisa falar com a equipe GSA Viagens?</h2></div><button type="button" onClick={() => navigate(routes.marketplace.travelPackages.suporte())} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#abc3c6] bg-white px-6 text-sm font-black text-[#0d4660]">Abrir suporte <HelpCircle className="h-4 w-4" /></button></div></section>
      </main>
    </div>
  );
}
