import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Code2, LogIn, MessageCircle, Palette } from 'lucide-react';
import { LogoGSA } from '../ui/LogoGSA';
import { navigate } from '../../routing/navigationService';
import { BrandJourneyPage } from './BrandJourneyPage';
import { SystemsBudgetModal } from './SystemsBudgetModal';
import { PrivacyPolicyDialog } from './PrivacyPolicyDialog';

const WHATSAPP_NUMBER = '5511920857756';

interface SystemsPageFinalProps {
  onBack: () => void;
  onLogin: () => void;
}

const solutions = [
  ['Sites institucionais', 'Presença profissional, responsiva e preparada para apresentar sua empresa e gerar contatos.'],
  ['Lojas virtuais', 'Catálogo, pedidos, pagamentos e gestão de vendas em uma experiência organizada.'],
  ['Sistemas web', 'Soluções sob medida para centralizar informações, processos, equipes e indicadores.'],
  ['Portais e aplicativos', 'Áreas seguras e experiências digitais adaptadas ao celular para clientes e equipes.'],
  ['Automações', 'Redução de tarefas repetitivas com fluxos automáticos, notificações e integrações.'],
  ['Integrações', 'Conexão segura entre APIs, plataformas de pagamento, atendimento e ferramentas de gestão.'],
];

const steps = [
  ['01', 'Diagnóstico', 'Entendemos o objetivo, o público, o problema e o resultado esperado.'],
  ['02', 'Planejamento', 'Organizamos escopo, módulos, prioridades, regras e etapas de entrega.'],
  ['03', 'Desenvolvimento', 'Construímos a solução com atenção à segurança, desempenho e manutenção.'],
  ['04', 'Testes e implantação', 'Validamos os fluxos principais antes da liberação para uso.'],
];

export function SystemsPageFinal({ onBack, onLogin }: SystemsPageFinalProps) {
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const isBrandJourney = window.location.pathname.replace(/\/+$/, '') === '/empresa-do-zero-ao-digital';

  if (isBrandJourney) {
    return (
      <BrandJourneyPage
        onBack={() => navigate('/')}
        onSystems={() => navigate('/criacao-de-site-e-sistemas')}
        onLogin={onLogin}
      />
    );
  }

  const openWhatsApp = () => {
    const message = 'Olá! Gostaria de falar sobre a criação de um site, aplicativo, sistema ou automação.';
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-neutral-950">
      <nav className="fixed inset-x-0 top-0 z-[90] border-b border-white/10 bg-[#080c12]/95 py-3 shadow-xl backdrop-blur-xl" aria-label="Navegação da página Sites e Sistemas">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={onBack} aria-label="Voltar para a página inicial" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]"><LogoGSA size="md" variant="light" /></button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onBack} className="hidden items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white/70 hover:text-white sm:inline-flex"><ArrowLeft className="h-4 w-4" /> Início</button>
            <button type="button" onClick={onLogin} className="inline-flex items-center gap-2 rounded-lg border border-[#d8bd73]/50 bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#d8bd73] transition hover:bg-[#d8bd73]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]"><LogIn className="h-4 w-4" /> Login</button>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden bg-neutral-950 pt-24 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(214,178,94,0.17),transparent_34%),radial-gradient(circle_at_12%_70%,rgba(255,255,255,0.08),transparent_26%)]" />
          <div className="relative mx-auto grid min-h-[calc(100svh-6rem)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d6b25e]">Criação de sites e sistemas</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight sm:text-6xl lg:text-7xl">Transformamos ideias em soluções digitais profissionais</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">Sites, lojas virtuais, aplicativos, sistemas e automações sob medida para empresas, MEIs, profissionais e novos projetos.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => setBudgetOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d6b25e] px-7 py-4 font-black text-neutral-950 transition hover:bg-[#e1c374] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Solicitar orçamento <ArrowRight className="h-5 w-5" /></button>
                <button type="button" onClick={openWhatsApp} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-7 py-4 font-black text-white transition hover:border-[#d6b25e]/70 hover:text-[#d6b25e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b25e]"><MessageCircle className="h-5 w-5" /> Falar com especialista</button>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 backdrop-blur-xl">
              <Code2 className="h-14 w-14 text-[#d6b25e]" />
              <h2 className="mt-6 text-2xl font-black">Projeto sob medida</h2>
              <ul className="mt-6 space-y-4 text-white/75">
                {['Layout responsivo', 'Controle de permissões', 'Banco de dados e indicadores', 'Integrações seguras', 'Suporte e evolução'].map((item) => <li key={item} className="flex gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-[#d6b25e]" />{item}</li>)}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6e2f]">Soluções</p>
          <h2 className="mt-3 text-4xl font-black">O que podemos desenvolver</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {solutions.map(([title, text]) => <article key={title} className="rounded-2xl border border-neutral-200 bg-white p-6"><h3 className="text-xl font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-neutral-600">{text}</p></article>)}
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6e2f]">Processo</p>
            <h2 className="mt-3 text-4xl font-black">Da ideia à implantação</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-4">
              {steps.map(([number, title, text]) => <article key={number} className="rounded-2xl bg-neutral-50 p-6"><span className="text-sm font-black text-[#8a6e2f]">{number}</span><h3 className="mt-4 text-xl font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-neutral-600">{text}</p></article>)}
            </div>
          </div>
        </section>

        <section className="overflow-hidden bg-[#e4c777] py-16 text-neutral-950">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8">
            <div>
              <div className="flex items-center gap-3 text-[#6f5723]"><Palette className="h-7 w-7" /></div>
              <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-neutral-700">Antes da tecnologia</p>
              <h2 className="mt-3 max-w-4xl text-3xl font-black sm:text-5xl">Sua empresa ainda precisa de nome, logo, identidade e redes sociais?</h2>
              <p className="mt-5 max-w-3xl text-base leading-7 text-neutral-800">Conheça a jornada Empresa do Zero ao Digital: uma solução integrada para construir marca, site, conteúdo, canais de atendimento e presença nas redes sociais.</p>
            </div>
            <button type="button" onClick={() => navigate('/empresa-do-zero-ao-digital')} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-7 py-4 font-black text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              Conhecer a jornada completa <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </section>
      </main>

      <footer className="bg-neutral-950 py-10 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div><LogoGSA size="md" variant="light" /><p className="mt-3 text-sm text-white/55">Soluções digitais sob medida.</p></div>
          <div className="flex flex-wrap gap-5 text-sm font-bold text-white/75"><button type="button" onClick={onBack} className="hover:text-[#d8bd73]">Início</button><button type="button" onClick={() => navigate('/empresa-do-zero-ao-digital')} className="hover:text-[#d8bd73]">Marca e presença digital</button><button type="button" onClick={() => setPrivacyOpen(true)} className="hover:text-[#d8bd73]">Privacidade</button><button type="button" onClick={openWhatsApp} className="hover:text-[#d8bd73]">Contato</button></div>
        </div>
      </footer>

      <SystemsBudgetModal isOpen={budgetOpen} onClose={() => setBudgetOpen(false)} />
      <PrivacyPolicyDialog isOpen={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
  );
}
