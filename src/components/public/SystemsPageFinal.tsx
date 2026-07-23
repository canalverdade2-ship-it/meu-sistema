import { useState } from 'react';
import {
  ArrowRight,
  Check,
  Code2,
  Gauge,
  Globe2,
  Headphones,
  Link2,
  MessageCircle,
  Rocket,
  Search,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { LogoGSA } from '../ui/LogoGSA';
import { navigate } from '../../routing/navigationService';
import { PublicHeader } from './final/PublicHeader';
import { BrandJourneyPage } from './BrandJourneyPage';
import { SystemsBudgetModal } from './SystemsBudgetModal';
import { PrivacyPolicyDialog } from './PrivacyPolicyDialog';

const WHATSAPP_NUMBER = '5511920857756';

interface SystemsPageFinalProps {
  onBack: () => void;
  onLogin: () => void;
}

interface SolutionItem {
  icon: LucideIcon;
  title: string;
  text: string;
  fit: string;
}

const solutions: SolutionItem[] = [
  {
    icon: Globe2,
    title: 'Sites institucionais',
    text: 'Apresentação profissional de empresas, serviços, produtos e projetos, com navegação clara e adaptação para celular.',
    fit: 'Presença digital, autoridade e geração de contatos.',
  },
  {
    icon: ShoppingCart,
    title: 'Lojas virtuais',
    text: 'Estrutura organizada para catálogo, pedidos, pagamentos e acompanhamento da operação comercial.',
    fit: 'Venda de produtos, serviços e assinaturas.',
  },
  {
    icon: Code2,
    title: 'Sistemas personalizados',
    text: 'Ambientes digitais criados para centralizar informações, regras, processos, usuários e rotinas da empresa.',
    fit: 'Gestão, operação e controle interno.',
  },
  {
    icon: Smartphone,
    title: 'Portais e aplicativos',
    text: 'Experiências digitais para clientes, equipes, parceiros ou prestadores acessarem serviços e informações com segurança.',
    fit: 'Atendimento, relacionamento e autosserviço.',
  },
  {
    icon: Workflow,
    title: 'Automações',
    text: 'Fluxos que reduzem tarefas repetitivas, organizam etapas e ajudam a equipe a trabalhar com mais consistência.',
    fit: 'Produtividade e padronização de processos.',
  },
  {
    icon: Link2,
    title: 'Integrações',
    text: 'Conexão entre plataformas, meios de pagamento, canais de atendimento e ferramentas já utilizadas pela empresa.',
    fit: 'Continuidade de dados e menos retrabalho.',
  },
];

const stages = [
  {
    number: '01',
    icon: Search,
    title: 'Diagnóstico e direção',
    text: 'Entendemos a necessidade, o público, os processos atuais e o resultado que a solução precisa entregar.',
  },
  {
    number: '02',
    icon: Code2,
    title: 'Desenvolvimento personalizado',
    text: 'Organizamos o escopo e construímos a solução com interface clara, regras consistentes e foco no uso real.',
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Entrega e evolução',
    text: 'Validamos os fluxos principais, implantamos o projeto e deixamos uma base preparada para melhorias futuras.',
  },
];

const foundations = [
  {
    icon: ShieldCheck,
    title: 'Estrutura segura e organizada',
    text: 'Permissões, informações e fluxos planejados de acordo com a necessidade do projeto.',
  },
  {
    icon: Gauge,
    title: 'Experiência clara em qualquer tela',
    text: 'Navegação responsiva, leitura objetiva e ações fáceis para clientes e equipes.',
  },
  {
    icon: Workflow,
    title: 'Processos pensados de ponta a ponta',
    text: 'Cada etapa é construída para reduzir dúvidas, retrabalho e caminhos desnecessários.',
  },
  {
    icon: Headphones,
    title: 'Acompanhamento durante o projeto',
    text: 'Comunicação organizada para definição do escopo, validações e evolução da solução.',
  },
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
    <div className="min-h-screen bg-[#f6f4ef] text-[#111820]">
      <PublicHeader currentPage="systems" onClientLogin={onLogin} />

      <main>
        <section className="border-b border-white/10 bg-[#07111d] pt-24 text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#d7b96e]">
                Criação de sites e sistemas
              </p>
              <h1 className="mt-4 text-4xl font-black leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-[3.5rem]">
                Soluções digitais profissionais para apresentar, organizar e evoluir sua empresa.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/68 sm:text-lg sm:leading-8">
                Desenvolvemos sites, lojas virtuais, portais, aplicativos, sistemas e automações sob medida para empresas, MEIs, profissionais e novos projetos.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setBudgetOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#d7b96e] px-6 py-3.5 text-sm font-black text-[#111820] transition hover:bg-[#e2c982] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Solicitar orçamento
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={openWhatsApp}
                  className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-white/22 px-6 py-3.5 text-sm font-black text-white transition hover:border-[#d7b96e] hover:text-[#e3cb8d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7b96e]"
                >
                  <MessageCircle className="h-4 w-4" />
                  Falar com especialista
                </button>
              </div>
            </div>

            <aside className="rounded-[10px] border border-white/12 bg-[#0c1825] p-5 sm:p-6 lg:p-7">
              <div className="flex items-center gap-3 border-b border-white/10 pb-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#d7b96e]/12 text-[#d7b96e]">
                  <Code2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d7b96e]">Projeto sob medida</p>
                  <h2 className="mt-1 text-lg font-black">Uma solução definida para sua realidade</h2>
                </div>
              </div>

              <p className="mt-5 text-sm leading-6 text-white/62">
                O projeto é planejado a partir do objetivo do negócio, sem obrigar sua empresa a se adaptar a uma estrutura genérica.
              </p>

              <ul className="mt-5 space-y-3" aria-label="Características do desenvolvimento sob medida">
                {[
                  'Escopo organizado antes do desenvolvimento',
                  'Experiência adaptada para celular e computador',
                  'Fluxos, acessos e informações definidos com clareza',
                  'Base preparada para manutenção e evolução',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm font-semibold leading-5 text-white/80">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#d7b96e]/35 text-[#d7b96e]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </section>

        <section className="border-b border-[#dfd9cf] bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-7 gap-y-2 px-4 py-4 text-xs font-bold text-neutral-600 sm:px-6 lg:px-8">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#80672c]">Projetos para</span>
            <span>Empresas</span>
            <span>MEIs</span>
            <span>Profissionais</span>
            <span>Novos negócios</span>
            <span>Equipes e operações</span>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#80672c]">Soluções digitais</p>
              <h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.025em] sm:text-4xl">
                O que podemos desenvolver para o seu projeto
              </h2>
              <p className="mt-5 text-sm leading-7 text-neutral-600 sm:text-base">
                Cada solução é construída para cumprir uma função clara: apresentar melhor, vender, atender, organizar processos ou conectar operações.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {solutions.map(({ icon: Icon, title, text, fit }) => (
                <article key={title} className="rounded-[10px] border border-[#ddd8ce] bg-white p-5 transition hover:border-[#c8b06e] sm:p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#0a1420] text-[#d7b96e]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-black text-[#111820]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">{text}</p>
                  <p className="mt-4 border-t border-[#ebe7df] pt-4 text-xs font-bold leading-5 text-[#6d5727]">
                    {fit}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-[#e1ddd4] bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#80672c]">Nosso processo</p>
              <h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.025em] sm:text-4xl">
                Da necessidade à solução implantada
              </h2>
              <p className="mt-4 text-sm leading-7 text-neutral-600 sm:text-base">
                Um caminho objetivo para reduzir dúvidas, organizar decisões e construir o projeto com consistência.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {stages.map(({ number, icon: Icon, title, text }) => (
                <article key={number} className="relative rounded-[10px] border border-[#ddd8ce] bg-[#f8f6f1] p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black tracking-[0.16em] text-[#80672c]">{number}</span>
                    <Icon className="h-5 w-5 text-[#80672c]" />
                  </div>
                  <h3 className="mt-8 text-xl font-black">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:px-8">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#80672c]">Qualidade do projeto</p>
            <h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.025em] sm:text-4xl">
              Uma entrega profissional também precisa funcionar bem no dia a dia
            </h2>
            <p className="mt-5 text-sm leading-7 text-neutral-600 sm:text-base">
              O visual é importante, mas a solução também precisa ser clara, segura, organizada e preparada para acompanhar a evolução da empresa.
            </p>
          </div>

          <div className="divide-y divide-[#e3ded5] border-y border-[#e3ded5]">
            {foundations.map(({ icon: Icon, title, text }) => (
              <article key={title} className="grid gap-3 py-5 sm:grid-cols-[44px_1fr] sm:gap-4 sm:py-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#d4c59d] bg-white text-[#80672c]">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-black sm:text-lg">{title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-neutral-600">{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-8 rounded-[10px] bg-[#0a1420] px-5 py-8 text-white sm:px-8 sm:py-10 lg:grid-cols-[1fr_auto] lg:px-10">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d7b96e]">Vamos conversar sobre o projeto</p>
              <h2 className="mt-3 text-2xl font-black leading-tight tracking-[-0.02em] sm:text-3xl">
                Transforme sua necessidade em uma solução digital clara e profissional.
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/62">
                Conte o que sua empresa precisa. A partir disso, organizamos a análise inicial e o próximo passo do atendimento.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <button
                type="button"
                onClick={() => setBudgetOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#d7b96e] px-6 py-3.5 text-sm font-black text-[#111820] transition hover:bg-[#e2c982] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Solicitar orçamento
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={openWhatsApp}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-white/20 px-6 py-3.5 text-sm font-black text-white transition hover:border-[#d7b96e] hover:text-[#e3cb8d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7b96e]"
              >
                <MessageCircle className="h-4 w-4" />
                Falar no WhatsApp
              </button>
            </div>
          </div>

          <div className="mx-auto mt-5 flex max-w-7xl flex-col gap-2 border-l-2 border-[#d7b96e] px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-neutral-600">
              Sua empresa ainda precisa de nome, identidade visual e presença digital completa?
            </p>
            <button
              type="button"
              onClick={() => navigate('/empresa-do-zero-ao-digital')}
              className="inline-flex items-center gap-1.5 text-sm font-black text-[#6d5727] hover:text-[#3e3016]"
            >
              Conhecer a jornada Empresa do Zero ao Digital
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#07111d] py-9 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <LogoGSA size="md" variant="light" />
            <p className="mt-3 text-sm text-white/50">Sites, sistemas e soluções digitais sob medida.</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-bold text-white/68">
            <button type="button" onClick={onBack} className="hover:text-[#d7b96e]">Início</button>
            <button type="button" onClick={() => navigate('/empresa-do-zero-ao-digital')} className="hover:text-[#d7b96e]">Empresa do Zero ao Digital</button>
            <button type="button" onClick={() => setPrivacyOpen(true)} className="hover:text-[#d7b96e]">Privacidade</button>
            <button type="button" onClick={openWhatsApp} className="hover:text-[#d7b96e]">Contato</button>
          </div>
        </div>
      </footer>

      <SystemsBudgetModal isOpen={budgetOpen} onClose={() => setBudgetOpen(false)} />
      <PrivacyPolicyDialog isOpen={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
  );
}
