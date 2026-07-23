import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Globe2,
  Instagram,
  LayoutTemplate,
  Lightbulb,
  LogIn,
  Megaphone,
  MessageCircle,
  Palette,
  PenTool,
  Rocket,
  Share2,
  ShoppingBag,
  Target,
  Users,
} from 'lucide-react';
import { LogoGSA } from '../ui/LogoGSA';
import { PublicHeader } from './final/PublicHeader';
import { SystemsBudgetModal } from './SystemsBudgetModal';
import { PrivacyPolicyDialog } from './PrivacyPolicyDialog';

const WHATSAPP_NUMBER = '5511920857756';
const PAGE_TITLE = 'Empresa do Zero ao Digital | Marca, Site e Redes Sociais | GSA HUB';
const PAGE_DESCRIPTION = 'Criação de nome, logo, identidade visual, site, redes sociais, conteúdo e estratégia digital para transformar uma ideia em uma presença profissional pronta para crescer.';

interface BrandJourneyPageProps {
  onBack: () => void;
  onSystems: () => void;
  onLogin: () => void;
}

const journey = [
  { number: '01', icon: Lightbulb, title: 'Ideia e posicionamento', text: 'Organizamos a proposta do negócio, o público, o diferencial e a mensagem que a empresa precisa transmitir.' },
  { number: '02', icon: PenTool, title: 'Nome e identidade', text: 'Desenvolvemos nome fantasia, logo, paleta, tipografia e uma linguagem visual coerente com o posicionamento.' },
  { number: '03', icon: Globe2, title: 'Presença digital', text: 'Criamos site, landing page, loja, aplicativo ou sistema para apresentar, atender e organizar a operação.' },
  { number: '04', icon: Instagram, title: 'Redes sociais', text: 'Estruturamos Instagram, Facebook e TikTok com perfis, capas, biografias e identidade visual padronizada.' },
  { number: '05', icon: Share2, title: 'Conteúdo e social media', text: 'Planejamos posts, carrosséis, stories, vídeos curtos, legendas e calendário de publicações.' },
  { number: '06', icon: Target, title: 'Campanhas e oportunidades', text: 'Conectamos conteúdo, páginas e atendimento para gerar contatos, acompanhar métricas e melhorar conversões.' },
];

const services = [
  { icon: Lightbulb, title: 'Criação de nome', text: 'Nome fantasia, conceito, personalidade e direcionamento inicial da marca.' },
  { icon: Palette, title: 'Logo e identidade visual', text: 'Logo, versões, cores, tipografia, aplicações e padronização visual.' },
  { icon: LayoutTemplate, title: 'Materiais da empresa', text: 'Cartão digital, assinatura de e-mail, apresentações, catálogos e peças institucionais.' },
  { icon: Globe2, title: 'Sites e landing pages', text: 'Estrutura profissional para apresentar serviços, captar contatos e fortalecer credibilidade.' },
  { icon: ShoppingBag, title: 'Loja, aplicativo e sistema', text: 'Tecnologia para vender, atender, automatizar processos e acompanhar a operação.' },
  { icon: Instagram, title: 'Estruturação de redes sociais', text: 'Perfis, biografias, capas, destaques e organização visual para Instagram, Facebook e TikTok.' },
  { icon: Share2, title: 'Social media e conteúdo', text: 'Planejamento editorial, posts, carrosséis, stories, reels, vídeos curtos e legendas.' },
  { icon: Megaphone, title: 'Estratégia digital', text: 'Campanhas, páginas de conversão, integração com WhatsApp e acompanhamento de desempenho.' },
];

const packages = [
  {
    eyebrow: 'Começar com força',
    title: 'Marca Essencial',
    description: 'Para quem ainda precisa transformar uma ideia em uma marca reconhecível e profissional.',
    items: ['Análise inicial do negócio', 'Nome e posicionamento', 'Logo e identidade visual', 'Kit básico de aplicações'],
  },
  {
    eyebrow: 'Entrar no digital',
    title: 'Presença Profissional',
    description: 'Para empresas que precisam apresentar seus serviços, gerar contatos e organizar seus canais.',
    items: ['Identidade visual', 'Site ou landing page', 'Configuração das redes sociais', 'Conteúdo inicial de lançamento'],
  },
  {
    eyebrow: 'Jornada completa',
    title: 'Do Zero ao Digital',
    description: 'Uma construção integrada da marca aos canais de divulgação e atendimento ao cliente.',
    items: ['Nome, logo e identidade', 'Site, loja ou solução digital', 'Redes sociais e social media', 'Campanhas, métricas e evolução'],
    featured: true,
  },
];

const outcomes = [
  { icon: Users, title: 'Uma marca que o cliente reconhece', text: 'Todos os pontos de contato seguem a mesma identidade e a mesma mensagem.' },
  { icon: MessageCircle, title: 'Canais preparados para atender', text: 'Site, redes sociais e WhatsApp trabalham juntos para facilitar o contato.' },
  { icon: BarChart3, title: 'Decisões com acompanhamento', text: 'A estratégia pode evoluir com base em métricas, comportamento e oportunidades.' },
  { icon: Rocket, title: 'Estrutura pronta para crescer', text: 'A empresa começa organizada e pode adicionar novas campanhas, páginas e automações.' },
];

const faqs = [
  ['Posso contratar somente a criação do logo?', 'Sim. Os serviços podem ser contratados individualmente ou dentro de uma jornada mais completa.'],
  ['A GSA também pode sugerir o nome da empresa?', 'Sim. O desenvolvimento do nome considera proposta do negócio, público, posicionamento e possibilidades de comunicação. A disponibilidade jurídica e de domínio deve ser confirmada nas etapas próprias.'],
  ['Vocês criam e publicam conteúdo nas redes sociais?', 'O projeto pode incluir planejamento, criação de peças, legendas, calendário e gestão de publicações, conforme o pacote contratado.'],
  ['É possível incluir site, loja virtual ou aplicativo?', 'Sim. Quando o projeto exige tecnologia, a jornada é conectada à área especializada de Sites e Sistemas da GSA HUB.'],
  ['Vocês garantem aumento de vendas?', 'Nenhuma empresa séria pode garantir vendas. A GSA estrutura marca, presença, campanhas e canais para ampliar oportunidades e melhorar a capacidade de conversão.'],
];

function applyBrandMetadata() {
  const previousTitle = document.title;
  document.title = PAGE_TITLE;

  const entries = [
    ['meta[name="description"]', 'name', 'description', PAGE_DESCRIPTION],
    ['meta[property="og:title"]', 'property', 'og:title', PAGE_TITLE],
    ['meta[property="og:description"]', 'property', 'og:description', PAGE_DESCRIPTION],
    ['meta[property="og:url"]', 'property', 'og:url', `${window.location.origin}/empresa-do-zero-ao-digital`],
    ['meta[name="twitter:title"]', 'name', 'twitter:title', PAGE_TITLE],
    ['meta[name="twitter:description"]', 'name', 'twitter:description', PAGE_DESCRIPTION],
  ] as const;

  const managed: Array<{ element: HTMLMetaElement; previous: string | null; created: boolean }> = [];
  for (const [selector, attribute, key, value] of entries) {
    let element = document.querySelector<HTMLMetaElement>(selector);
    const created = !element;
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, key);
      document.head.appendChild(element);
    }
    managed.push({ element, previous: element.getAttribute('content'), created });
    element.setAttribute('content', value);
  }

  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]') || document.createElement('link');
  const canonicalCreated = !canonical.parentNode;
  const previousCanonical = canonical.getAttribute('href');
  canonical.rel = 'canonical';
  canonical.href = `${window.location.origin}/empresa-do-zero-ao-digital`;
  if (canonicalCreated) document.head.appendChild(canonical);

  const structuredData = document.createElement('script');
  structuredData.type = 'application/ld+json';
  structuredData.dataset.gsaBrandJourney = 'true';
  structuredData.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'GSA HUB - Empresa do Zero ao Digital',
    description: PAGE_DESCRIPTION,
    url: `${window.location.origin}/empresa-do-zero-ao-digital`,
    areaServed: 'BR',
    serviceType: ['Criação de nome', 'Criação de logo', 'Identidade visual', 'Sites e sistemas', 'Redes sociais', 'Social media', 'Estratégia digital'],
  });
  document.head.appendChild(structuredData);

  return () => {
    document.title = previousTitle;
    for (const item of managed) {
      if (item.created) item.element.remove();
      else if (item.previous === null) item.element.removeAttribute('content');
      else item.element.setAttribute('content', item.previous);
    }
    if (canonicalCreated) canonical.remove();
    else if (previousCanonical === null) canonical.removeAttribute('href');
    else canonical.setAttribute('href', previousCanonical);
    structuredData.remove();
  };
}

export function BrandJourneyPage({ onBack, onSystems, onLogin }: BrandJourneyPageProps) {
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => applyBrandMetadata(), []);

  const openWhatsApp = () => {
    const message = 'Olá! Gostaria de desenvolver minha empresa do zero ao digital, incluindo marca, presença online e redes sociais.';
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#f6f1e7] text-neutral-950">
      <PublicHeader currentPage="brand-journey" onClientLogin={onLogin} />

      <main>
        <section className="relative overflow-hidden bg-[#080a10] pt-24 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_22%,rgba(229,194,105,0.24),transparent_30%),radial-gradient(circle_at_15%_72%,rgba(121,88,255,0.18),transparent_28%),linear-gradient(140deg,#080a10_0%,#111421_55%,#080a10_100%)]" />
          <div className="absolute -right-24 top-28 h-72 w-72 rounded-full border border-[#e4c777]/15" />
          <div className="absolute -right-8 top-44 h-44 w-44 rounded-full border border-white/10" />

          <div className="relative mx-auto grid min-h-[calc(100svh-6rem)] max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
            <div>
              <h1 className="max-w-4xl text-4xl font-black leading-[1.04] sm:text-6xl lg:text-7xl">
                Da primeira ideia a uma marca pronta para <span className="text-[#e4c777]">ser vista, lembrada e escolhida.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">
                A GSA HUB pode construir nome, logo, identidade visual, site, redes sociais, conteúdo e estratégia digital em uma jornada integrada.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => setBudgetOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e4c777] px-7 py-4 font-black text-neutral-950 transition hover:bg-[#f0d993] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  Quero construir minha marca <ArrowRight className="h-5 w-5" />
                </button>
                <button type="button" onClick={openWhatsApp} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-7 py-4 font-black text-white transition hover:border-[#e4c777]/70 hover:text-[#e4c777] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4c777]">
                  <MessageCircle className="h-5 w-5" /> Falar com especialista
                </button>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/65">
                {['Serviços por etapa', 'Jornada completa', 'Estratégia integrada'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#e4c777]" />{item}</span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-[#e4c777]/20 via-transparent to-violet-500/15 blur-2xl" />
              <div className="relative rounded-[2.25rem] border border-white/12 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e4c777]">Uma única jornada</p>
                <h2 className="mt-4 text-3xl font-black">Você não precisa coordenar cinco fornecedores diferentes.</h2>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {[
                    ['Nome', 'Posicionamento'],
                    ['Logo', 'Identidade visual'],
                    ['Site', 'Tecnologia'],
                    ['Redes', 'Conteúdo'],
                    ['Campanhas', 'Conversão'],
                    ['Evolução', 'Acompanhamento'],
                  ].map(([title, text]) => (
                    <div key={title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <strong className="block text-[#e4c777]">{title}</strong>
                      <span className="mt-1 block text-sm text-white/60">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#806322]">A jornada completa</p>
            <h2 className="mt-3 text-3xl font-black sm:text-5xl">Cada etapa prepara a próxima</h2>
            <p className="mt-5 text-base leading-7 text-neutral-600">Em vez de criar peças isoladas, conectamos marca, tecnologia, conteúdo e atendimento para construir uma presença coerente.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {journey.map(({ number, icon: Icon, title, text }) => (
              <article key={number} className="group rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-[#806322]">{number}</span>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-950 text-[#e4c777]"><Icon className="h-6 w-6" /></span>
                </div>
                <h3 className="mt-6 text-xl font-black">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-neutral-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-neutral-950 py-20 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#e4c777]">Serviços disponíveis</p>
              <h2 className="mt-3 text-3xl font-black sm:text-5xl">Contrate uma etapa ou construa tudo com a GSA</h2>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {services.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 transition hover:border-[#e4c777]/45 hover:bg-white/[0.08]">
                  <Icon className="h-8 w-8 text-[#e4c777]" />
                  <h3 className="mt-5 text-lg font-black">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/60">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#806322]">Formas de começar</p>
            <h2 className="mt-3 text-3xl font-black sm:text-5xl">Uma solução para o estágio atual da sua empresa</h2>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {packages.map((item) => (
              <article key={item.title} className={`relative flex flex-col rounded-[2rem] border p-7 ${item.featured ? 'border-[#e4c777] bg-neutral-950 text-white shadow-2xl' : 'border-neutral-200 bg-white'}`}>
                {item.featured && <span className="absolute right-5 top-5 rounded-full bg-[#e4c777] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-950">Mais completo</span>}
                <p className={`text-xs font-black uppercase tracking-[0.18em] ${item.featured ? 'text-[#e4c777]' : 'text-[#806322]'}`}>{item.eyebrow}</p>
                <h3 className="mt-4 text-3xl font-black">{item.title}</h3>
                <p className={`mt-4 text-sm leading-6 ${item.featured ? 'text-white/65' : 'text-neutral-600'}`}>{item.description}</p>
                <ul className="mt-7 space-y-4">
                  {item.items.map((line) => <li key={line} className="flex gap-3 text-sm"><CheckCircle2 className={`h-5 w-5 shrink-0 ${item.featured ? 'text-[#e4c777]' : 'text-[#806322]'}`} />{line}</li>)}
                </ul>
                <button type="button" onClick={() => setBudgetOpen(true)} className={`mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-4 font-black ${item.featured ? 'bg-[#e4c777] text-neutral-950' : 'bg-neutral-950 text-white'}`}>
                  Solicitar análise <ChevronRight className="h-5 w-5" />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-neutral-200 bg-white py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#806322]">Do visual à operação</p>
              <h2 className="mt-3 text-3xl font-black sm:text-5xl">Quando a marca precisa de tecnologia, conectamos com Sites e Sistemas</h2>
              <p className="mt-5 text-base leading-7 text-neutral-600">A mesma jornada pode incluir site institucional, landing page, loja virtual, aplicativo, portal, sistema de gestão, automações e integrações.</p>
              <button type="button" onClick={onSystems} className="mt-8 inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-6 py-4 font-black transition hover:border-neutral-950">
                Conhecer Sites e Sistemas <ArrowRight className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {outcomes.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-3xl bg-[#f3eddf] p-6">
                  <Icon className="h-8 w-8 text-[#806322]" />
                  <h3 className="mt-5 text-lg font-black">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#806322]">Dúvidas frequentes</p>
            <h2 className="mt-3 text-3xl font-black sm:text-5xl">Antes de construir sua presença digital</h2>
          </div>
          <div className="mt-12 space-y-3">
            {faqs.map(([question, answer]) => (
              <details key={question} className="rounded-2xl border border-neutral-200 bg-white p-5 open:shadow-md">
                <summary className="cursor-pointer list-none pr-8 font-black marker:hidden">{question}</summary>
                <p className="mt-4 text-sm leading-7 text-neutral-600">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#e4c777] py-16 text-neutral-950">
          <div className="absolute -right-16 -top-20 h-60 w-60 rounded-full border-[30px] border-white/20" />
          <div className="relative mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-700">Comece pela sua ideia</p>
              <h2 className="mt-3 text-3xl font-black sm:text-5xl">Conte onde sua empresa está hoje. A GSA organiza o próximo passo.</h2>
              <p className="mt-4 text-base leading-7 text-neutral-800">Você pode solicitar uma etapa específica ou uma análise para a jornada completa.</p>
            </div>
            <button type="button" onClick={() => setBudgetOpen(true)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-neutral-950 px-7 py-4 font-black text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              Solicitar orçamento <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </section>
      </main>

      <footer className="bg-neutral-950 py-10 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div><LogoGSA size="md" variant="light" /><p className="mt-3 text-sm text-white/55">Marca, presença digital, tecnologia e conteúdo conectados.</p></div>
          <div className="flex flex-wrap gap-5 text-sm font-bold text-white/75">
            <button type="button" onClick={onBack} className="hover:text-[#e4c777]">Início</button>
            <button type="button" onClick={onSystems} className="hover:text-[#e4c777]">Sites e Sistemas</button>
            <button type="button" onClick={() => setPrivacyOpen(true)} className="hover:text-[#e4c777]">Privacidade</button>
            <button type="button" onClick={openWhatsApp} className="hover:text-[#e4c777]">Contato</button>
          </div>
        </div>
      </footer>

      <SystemsBudgetModal isOpen={budgetOpen} onClose={() => setBudgetOpen(false)} />
      <PrivacyPolicyDialog isOpen={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
  );
}
