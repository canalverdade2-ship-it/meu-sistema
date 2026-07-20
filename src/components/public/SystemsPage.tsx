import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Code2,
  Database,
  Gauge,
  Headphones,
  Layers3,
  LockKeyhole,
  LogIn,
  Mail,
  MessageCircle,
  MonitorSmartphone,
  Rocket,
  Settings2,
  ShoppingCart,
  Smartphone,
  Store,
  Workflow,
} from 'lucide-react';
import { LogoGSA } from '../ui/LogoGSA';
import { SystemsBudgetModal } from './SystemsBudgetModal';

const WHATSAPP_NUMBER = '5511920857756';
const CONTACT_EMAIL = 'gsa.doc.adm@gmail.com';
const PAGE_TITLE = 'Criação de Sites, Aplicativos e Sistemas | GSA Soluções Digitais';
const PAGE_DESCRIPTION = 'Desenvolvimento de sites, lojas virtuais, aplicativos, sistemas web, portais e automações sob medida para empresas, MEIs e profissionais.';

interface SystemsPageProps {
  onBack: () => void;
  onLogin: () => void;
}

const solutions = [
  { icon: MonitorSmartphone, title: 'Sites institucionais', text: 'Presença profissional, responsiva e preparada para apresentar sua empresa e gerar contatos.' },
  { icon: Rocket, title: 'Landing pages', text: 'Páginas diretas para campanhas, lançamentos, captação de leads e divulgação de serviços.' },
  { icon: ShoppingCart, title: 'Lojas virtuais', text: 'Catálogo, pedidos, pagamentos e gestão de vendas em uma experiência organizada.' },
  { icon: Database, title: 'Sistemas web', text: 'Soluções sob medida para centralizar informações, processos, equipes e indicadores.' },
  { icon: Layers3, title: 'Portais de clientes', text: 'Áreas seguras para atendimento, documentos, solicitações, pagamentos e acompanhamento.' },
  { icon: Smartphone, title: 'Aplicativos', text: 'Experiências digitais adaptadas ao celular para clientes, equipes e operações.' },
  { icon: Bot, title: 'Automações', text: 'Redução de tarefas repetitivas com fluxos automáticos, notificações e integrações.' },
  { icon: Workflow, title: 'Integrações', text: 'Conexão entre sistemas, APIs, plataformas de pagamento, atendimento e ferramentas de gestão.' },
];

const processSteps = [
  { number: '01', title: 'Diagnóstico', text: 'Entendemos o objetivo, o público, o problema e o resultado esperado.' },
  { number: '02', title: 'Planejamento', text: 'Organizamos escopo, módulos, prioridades, regras e etapas de entrega.' },
  { number: '03', title: 'Design', text: 'Criamos uma experiência clara, profissional e adequada à identidade do projeto.' },
  { number: '04', title: 'Desenvolvimento', text: 'Construímos a solução com atenção à segurança, desempenho e manutenção.' },
  { number: '05', title: 'Testes e implantação', text: 'Validamos os fluxos principais antes da publicação e da liberação para uso.' },
  { number: '06', title: 'Suporte e evolução', text: 'Acompanhamos ajustes, melhorias e novas necessidades após a entrega.' },
];

const capabilities = [
  'Layout responsivo para celular, tablet e computador',
  'Painel administrativo e controle de permissões',
  'Banco de dados, relatórios e indicadores',
  'Integrações com APIs e serviços externos',
  'Notificações, automações e fluxos de atendimento',
  'Segurança, auditoria e acompanhamento técnico',
];

const solutionExamples = [
  { icon: Store, title: 'Operação comercial', text: 'Catálogo, pedidos, propostas, pagamentos, comissões e relacionamento com clientes.' },
  { icon: Settings2, title: 'Gestão interna', text: 'Cadastros, tarefas, documentos, aprovações, financeiro e relatórios em um só ambiente.' },
  { icon: Headphones, title: 'Atendimento e suporte', text: 'Solicitações, tickets, mensagens, anexos, notificações e histórico de interações.' },
  { icon: Gauge, title: 'Painéis e indicadores', text: 'Visão consolidada de resultados, pendências, desempenho e movimentações importantes.' },
];

const faqs = [
  { question: 'Quanto custa um site ou sistema?', answer: 'O valor depende do escopo, quantidade de páginas ou módulos, integrações e nível de personalização. Após entender a necessidade, a GSA prepara uma proposta adequada ao projeto.' },
  { question: 'Quanto tempo leva para desenvolver?', answer: 'O prazo varia conforme a complexidade e as etapas de aprovação. Projetos simples podem ser entregues em etapas menores; sistemas completos exigem planejamento, desenvolvimento e testes mais amplos.' },
  { question: 'A solução funciona no celular?', answer: 'Os projetos web são desenvolvidos com layout responsivo. Quando a necessidade exigir recursos próprios de aplicativo, essa opção é avaliada durante o diagnóstico.' },
  { question: 'Existe suporte depois da entrega?', answer: 'Sim. O suporte, a manutenção e a evolução podem fazer parte da proposta conforme a necessidade do projeto.' },
  { question: 'Posso integrar com outras plataformas?', answer: 'Sim, desde que a plataforma ofereça uma API ou outro meio seguro de integração. Essa viabilidade é confirmada durante a análise técnica.' },
  { question: 'Atendem empresas, MEIs e pessoas físicas?', answer: 'Sim. A GSA desenvolve soluções para empresas, MEIs, profissionais e pessoas que tenham um projeto digital bem definido.' },
];

function applyPageMetadata() {
  const previousTitle = document.title;
  document.title = PAGE_TITLE;

  const updates = [
    { selector: 'meta[name="description"]', attribute: 'content', value: PAGE_DESCRIPTION },
    { selector: 'meta[property="og:title"]', attribute: 'content', value: PAGE_TITLE },
    { selector: 'meta[property="og:description"]', attribute: 'content', value: PAGE_DESCRIPTION },
    { selector: 'meta[property="og:url"]', attribute: 'content', value: window.location.href },
    { selector: 'meta[property="og:image"]', attribute: 'content', value: `${window.location.origin}/logo.png` },
    { selector: 'meta[name="twitter:card"]', attribute: 'content', value: 'summary_large_image' },
    { selector: 'meta[name="twitter:title"]', attribute: 'content', value: PAGE_TITLE },
    { selector: 'meta[name="twitter:description"]', attribute: 'content', value: PAGE_DESCRIPTION },
  ];

  const managedElements: Array<{ element: HTMLMetaElement; previous: string | null; created: boolean }> = [];
  for (const update of updates) {
    let element = document.querySelector<HTMLMetaElement>(update.selector);
    const created = !element;
    if (!element) {
      element = document.createElement('meta');
      const nameMatch = update.selector.match(/meta\[name="([^"]+)"\]/);
      const propertyMatch = update.selector.match(/meta\[property="([^"]+)"\]/);
      if (nameMatch) element.setAttribute('name', nameMatch[1]);
      if (propertyMatch) element.setAttribute('property', propertyMatch[1]);
      element.dataset.gsaSystemsSeo = 'true';
      document.head.appendChild(element);
    }
    managedElements.push({ element, previous: element.getAttribute(update.attribute), created });
    element.setAttribute(update.attribute, update.value);
  }

  const previousCanonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const canonical = previousCanonical || document.createElement('link');
  const previousCanonicalHref = previousCanonical?.getAttribute('href') || null;
  if (!previousCanonical) {
    canonical.rel = 'canonical';
    canonical.dataset.gsaSystemsSeo = 'true';
    document.head.appendChild(canonical);
  }
  canonical.href = `${window.location.origin}/criacao-de-site-e-sistemas`;

  const structuredData = document.createElement('script');
  structuredData.type = 'application/ld+json';
  structuredData.dataset.gsaSystemsSeo = 'true';
  structuredData.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'GSA Soluções Digitais',
    url: `${window.location.origin}/criacao-de-site-e-sistemas`,
    email: CONTACT_EMAIL,
    telephone: '+55 11 92085-7756',
    areaServed: 'BR',
    serviceType: ['Criação de sites', 'Desenvolvimento de sistemas', 'Aplicativos', 'Lojas virtuais', 'Automações e integrações'],
  });
  document.head.appendChild(structuredData);

  return () => {
    document.title = previousTitle;
    for (const item of managedElements) {
      if (item.created) item.element.remove();
      else if (item.previous === null) item.element.removeAttribute('content');
      else item.element.setAttribute('content', item.previous);
    }
    if (!previousCanonical) canonical.remove();
    else if (previousCanonicalHref === null) canonical.removeAttribute('href');
    else canonical.setAttribute('href', previousCanonicalHref);
    structuredData.remove();
  };
}

export function SystemsPage({ onBack, onLogin }: SystemsPageProps) {
  const [budgetOpen, setBudgetOpen] = useState(false);

  useEffect(() => applyPageMetadata(), []);

  const openWhatsApp = () => {
    const message = 'Olá! Gostaria de falar sobre a criação de um site, aplicativo, sistema ou automação.';
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-neutral-950">
      <nav className="fixed inset-x-0 top-0 z-[90] border-b border-white/10 bg-[#080c12]/95 py-3 shadow-xl backdrop-blur-xl" aria-label="Navegação da página Sites e Sistemas">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={onBack} aria-label="Voltar para a página inicial" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]">
            <LogoGSA size="md" variant="light" />
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onBack} className="hidden items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white/70 hover:text-white sm:inline-flex">
              <ArrowLeft className="h-4 w-4" /> Início
            </button>
            <button type="button" onClick={onLogin} className="inline-flex items-center gap-2 rounded-lg border border-[#d8bd73]/50 bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#d8bd73] transition hover:bg-[#d8bd73]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]">
              <LogIn className="h-4 w-4" /> Login
            </button>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden bg-neutral-950 pt-24 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(214,178,94,0.17),transparent_34%),radial-gradient(circle_at_12%_70%,rgba(255,255,255,0.08),transparent_26%)]" />
          <div className="relative mx-auto grid min-h-[calc(100svh-6rem)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
            <div>
              <button type="button" onClick={onBack} className="mb-8 inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-bold text-white/80 transition hover:border-white/40 hover:text-white">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d6b25e]">Criação de sites e sistemas</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight sm:text-6xl lg:text-7xl">Transformamos ideias em soluções digitais profissionais</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">Sites, lojas virtuais, aplicativos, sistemas e automações sob medida para empresas, MEIs, profissionais e novos projetos.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => setBudgetOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d6b25e] px-7 py-4 font-black text-neutral-950 transition hover:bg-[#e1c374] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  Solicitar orçamento <ArrowRight className="h-5 w-5" />
                </button>
                <button type="button" onClick={openWhatsApp} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-7 py-4 font-black text-white transition hover:border-[#d6b25e]/70 hover:text-[#d6b25e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b25e]">
                  <MessageCircle className="h-5 w-5" /> Falar com especialista
                </button>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/65">
                {['Projeto sob medida', 'Layout responsivo', 'Suporte e evolução'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#d6b25e]" />{item}</span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
              <Code2 className="h-14 w-14 text-[#d6b25e]" />
              <h2 className="mt-6 text-2xl font-black">Tecnologia alinhada ao seu objetivo</h2>
              <p className="mt-3 text-sm leading-6 text-white/65">Cada projeto começa pela necessidade real. A solução é planejada para organizar processos, atender clientes, vender, automatizar tarefas ou acompanhar resultados.</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {['Planejamento claro', 'Segurança e permissões', 'Integrações', 'Evolução contínua'].map((item) => (
                  <div key={item} className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm font-bold text-white/80">{item}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6e2f]">O que desenvolvemos</p>
            <h2 className="mt-3 text-3xl font-black sm:text-5xl">Uma solução para cada necessidade digital</h2>
            <p className="mt-5 text-base leading-7 text-neutral-600">Do primeiro site ao sistema que sustenta uma operação inteira, o projeto é estruturado de acordo com o estágio e a realidade de cada cliente.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {solutions.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-950 text-[#d6b25e]"><Icon className="h-6 w-6" /></span>
                <h3 className="mt-5 text-lg font-black">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-neutral-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-neutral-950 py-20 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d6b25e]">Como funciona</p>
              <h2 className="mt-3 text-3xl font-black sm:text-5xl">Do diagnóstico à evolução do projeto</h2>
              <p className="mt-5 text-base leading-7 text-white/65">O desenvolvimento é organizado em etapas para reduzir dúvidas, alinhar expectativas e validar o que será entregue.</p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {processSteps.map((step) => (
                <article key={step.number} className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">
                  <span className="text-sm font-black text-[#d6b25e]">{step.number}</span>
                  <h3 className="mt-4 text-xl font-black">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/65">{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6e2f]">Entrega profissional</p>
            <h2 className="mt-3 text-3xl font-black sm:text-5xl">Estrutura para operar com clareza e segurança</h2>
            <p className="mt-5 text-base leading-7 text-neutral-600">A solução pode reunir desde uma apresentação institucional até fluxos completos de gestão, atendimento e relacionamento.</p>
            <ul className="mt-8 space-y-4">
              {capabilities.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-neutral-700"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#8a6e2f]" />{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-[#e9e2d2] p-7 sm:p-10">
            <LockKeyhole className="h-12 w-12 text-[#6f5723]" />
            <h3 className="mt-6 text-2xl font-black">Planejamento antes do código</h3>
            <p className="mt-4 text-sm leading-7 text-neutral-700">Antes de desenvolver, mapeamos o que o usuário precisa fazer, quais informações serão registradas, quem pode acessar cada área e como o processo deve funcionar. Isso evita telas desconectadas e retrabalho.</p>
            <div className="mt-8 rounded-2xl bg-white/70 p-5">
              <strong className="text-sm">O projeto pode incluir</strong>
              <p className="mt-2 text-sm leading-6 text-neutral-600">Regras de acesso, histórico de ações, notificações, documentos, pagamentos, integrações, relatórios e painéis personalizados.</p>
            </div>
          </div>
        </section>

        <section className="border-y border-neutral-200 bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6e2f]">Possibilidades</p>
              <h2 className="mt-3 text-3xl font-black sm:text-5xl">Soluções que podemos construir</h2>
              <p className="mt-5 text-base leading-7 text-neutral-600">Os exemplos abaixo demonstram tipos de operação que podem ser organizados em uma solução personalizada.</p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {solutionExamples.map(({ icon: Icon, title, text }) => (
                <article key={title} className="flex gap-5 rounded-2xl border border-neutral-200 p-6">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-[#d6b25e]"><Icon className="h-6 w-6" /></span>
                  <div><h3 className="text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-neutral-600">{text}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6e2f]">Dúvidas frequentes</p>
            <h2 className="mt-3 text-3xl font-black sm:text-5xl">Antes de iniciar seu projeto</h2>
          </div>
          <div className="mt-12 space-y-3">
            {faqs.map((item) => (
              <details key={item.question} className="group rounded-2xl border border-neutral-200 bg-white p-5 open:shadow-md">
                <summary className="cursor-pointer list-none pr-8 font-black marker:hidden">{item.question}</summary>
                <p className="mt-4 text-sm leading-7 text-neutral-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="bg-[#d6b25e] py-16 text-neutral-950">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-700">Vamos conversar</p>
              <h2 className="mt-3 text-3xl font-black sm:text-5xl">Conte o que você precisa construir</h2>
              <p className="mt-4 text-base leading-7 text-neutral-800">Envie sua necessidade e receba uma análise inicial para organizar o próximo passo do projeto.</p>
            </div>
            <button type="button" onClick={() => setBudgetOpen(true)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-neutral-950 px-7 py-4 font-black text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              Solicitar orçamento <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-neutral-950 py-10 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          <div><LogoGSA size="lg" variant="light" /><p className="mt-4 text-sm leading-6 text-white/55">Criação de sites, aplicativos, sistemas, lojas virtuais, automações e integrações.</p></div>
          <nav aria-label="Links da página"><h2 className="text-xs font-black uppercase tracking-widest text-white/35">Navegação</h2><div className="mt-4 grid gap-3 text-sm font-bold text-white/75"><button type="button" onClick={onBack} className="w-fit hover:text-[#d8bd73]">Página inicial</button><button type="button" onClick={() => setBudgetOpen(true)} className="w-fit hover:text-[#d8bd73]">Solicitar orçamento</button><button type="button" onClick={onLogin} className="w-fit hover:text-[#d8bd73]">Acessar o portal</button></div></nav>
          <div><h2 className="text-xs font-black uppercase tracking-widest text-white/35">Contato</h2><div className="mt-4 grid gap-3 text-sm font-bold text-white/75"><button type="button" onClick={openWhatsApp} className="flex w-fit items-center gap-2 hover:text-[#d8bd73]"><MessageCircle className="h-5 w-5" />WhatsApp</button><a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-2 hover:text-[#d8bd73]"><Mail className="h-5 w-5" />{CONTACT_EMAIL}</a></div></div>
        </div>
      </footer>

      <SystemsBudgetModal isOpen={budgetOpen} onClose={() => setBudgetOpen(false)} />
    </div>
  );
}
