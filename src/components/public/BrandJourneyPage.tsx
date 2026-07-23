import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Check,
  Compass,
  FileText,
  Globe2,
  Instagram,
  LayoutTemplate,
  Lightbulb,
  MessageCircle,
  Palette,
  PenTool,
  Rocket,
  Share2,
  ShieldCheck,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { LogoGSA } from '../ui/LogoGSA';
import { PublicHeader } from './final/PublicHeader';
import { SystemsBudgetModal } from './SystemsBudgetModal';
import { PrivacyPolicyDialog } from './PrivacyPolicyDialog';
import {
  BrandExamplesDialog,
  type BrandExampleCategory,
} from './BrandExamplesDialog';

const WHATSAPP_NUMBER = '5511920857756';
const PAGE_TITLE = 'Empresa do Zero ao Digital | Marca, Site e Redes Sociais | GSA HUB';
const PAGE_DESCRIPTION = 'Criação de nome, logo, identidade visual, site, redes sociais, conteúdo e estratégia digital para transformar uma ideia em uma presença profissional pronta para crescer.';

interface BrandJourneyPageProps {
  onBack: () => void;
  onSystems: () => void;
  onLogin: () => void;
}

interface BrandService {
  id: BrandExampleCategory;
  icon: LucideIcon;
  title: string;
  text: string;
  fit: string;
}

const services: BrandService[] = [
  {
    id: 'naming',
    icon: PenTool,
    title: 'Nome e posicionamento',
    text: 'Definição do conceito, personalidade, público, proposta de valor e direção verbal da marca.',
    fit: 'Para ideias, novos negócios e marcas que precisam reposicionar sua comunicação.',
  },
  {
    id: 'identity',
    icon: Palette,
    title: 'Logo e identidade visual',
    text: 'Criação do símbolo, tipografia, paleta, versões e regras visuais para manter consistência.',
    fit: 'Para empresas que precisam transmitir confiança e ser reconhecidas com facilidade.',
  },
  {
    id: 'materials',
    icon: FileText,
    title: 'Materiais da empresa',
    text: 'Aplicações institucionais e comerciais para apresentar a marca de forma organizada ao cliente.',
    fit: 'Para propostas, catálogos, apresentações, documentos e canais de atendimento.',
  },
  {
    id: 'social',
    icon: Instagram,
    title: 'Estruturação de redes sociais',
    text: 'Organização de perfil, biografia, capas, destaques e padrão visual para os canais sociais.',
    fit: 'Para iniciar ou profissionalizar Instagram, Facebook, TikTok e outros canais.',
  },
  {
    id: 'content',
    icon: Share2,
    title: 'Conteúdo e campanhas',
    text: 'Planejamento de temas, posts, carrosséis, vídeos curtos, legendas e ações comerciais.',
    fit: 'Para manter presença, gerar autoridade e criar oportunidades de relacionamento e venda.',
  },
  {
    id: 'digital',
    icon: LayoutTemplate,
    title: 'Presença digital integrada',
    text: 'Conexão da identidade com site, landing page, redes sociais, WhatsApp e canais de atendimento.',
    fit: 'Para empresas que querem sair do conceito e entrar no digital com uma estrutura completa.',
  },
];

const stages = [
  {
    number: '01',
    icon: Compass,
    title: 'Diagnóstico e posicionamento',
    text: 'Entendemos a ideia, o mercado, o público, os diferenciais e a percepção que a empresa precisa construir.',
  },
  {
    number: '02',
    icon: PenTool,
    title: 'Construção da identidade',
    text: 'Organizamos nome, mensagem, logo, cores, tipografia e o sistema visual que representa a marca.',
  },
  {
    number: '03',
    icon: Globe2,
    title: 'Aplicações e presença digital',
    text: 'Levamos a identidade para materiais, site, redes sociais, conteúdo e canais de atendimento.',
  },
  {
    number: '04',
    icon: Rocket,
    title: 'Lançamento e evolução',
    text: 'Preparamos os canais para apresentação ao público e deixamos uma base organizada para novas campanhas.',
  },
];

const foundations = [
  {
    icon: ShieldCheck,
    title: 'Coerência em todos os pontos de contato',
    text: 'Logo, documentos, site, redes sociais e atendimento seguem a mesma direção visual e verbal.',
  },
  {
    icon: Users,
    title: 'Percepção profissional para o cliente',
    text: 'A marca apresenta com clareza quem é, o que oferece e por que merece confiança.',
  },
  {
    icon: Target,
    title: 'Comunicação voltada ao público certo',
    text: 'As escolhas são orientadas pelo posicionamento e pelo perfil de cliente que a empresa deseja alcançar.',
  },
  {
    icon: BarChart3,
    title: 'Estrutura preparada para crescer',
    text: 'A identidade pode evoluir para campanhas, novos materiais, páginas, produtos e canais sem perder consistência.',
  },
];

const packages = [
  {
    eyebrow: 'Primeiro passo',
    title: 'Marca Essencial',
    description: 'Para quem precisa transformar uma ideia em uma identidade clara e pronta para ser apresentada.',
    items: ['Diagnóstico inicial', 'Nome ou posicionamento', 'Logo e identidade visual', 'Kit básico de aplicações'],
  },
  {
    eyebrow: 'Entrada no digital',
    title: 'Presença Profissional',
    description: 'Para empresas que precisam alinhar a marca e organizar os principais canais de contato.',
    items: ['Identidade visual', 'Materiais essenciais', 'Estrutura das redes sociais', 'Site ou landing page'],
  },
  {
    eyebrow: 'Jornada integrada',
    title: 'Empresa do Zero ao Digital',
    description: 'Construção coordenada da marca, presença digital, conteúdo e canais de atendimento.',
    items: ['Posicionamento e identidade', 'Materiais e canais digitais', 'Site, loja ou solução digital', 'Conteúdo inicial e lançamento'],
    featured: true,
  },
];

const faqs = [
  ['Posso contratar somente a criação do logo?', 'Sim. Os serviços podem ser contratados individualmente ou dentro de uma construção mais completa da marca.'],
  ['A GSA também desenvolve o nome da empresa?', 'Sim. O trabalho pode incluir direção de nome, conceito, personalidade e posicionamento. A disponibilidade jurídica, de domínio e de registro deve ser validada nos órgãos e plataformas responsáveis.'],
  ['Os modelos exibidos são projetos reais?', 'São referências demonstrativas de estrutura e direção visual. Cada projeto é desenvolvido de forma própria, de acordo com o negócio e o posicionamento do cliente.'],
  ['É possível incluir site, loja, aplicativo ou sistema?', 'Sim. A construção da marca pode ser conectada à área de Sites e Sistemas para formar uma presença digital completa.'],
  ['Vocês também criam conteúdo para redes sociais?', 'O projeto pode incluir planejamento editorial, peças, carrosséis, stories, vídeos curtos, legendas e calendário de publicações.'],
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
  const [selectedExample, setSelectedExample] = useState<BrandExampleCategory | null>(null);

  useEffect(() => applyBrandMetadata(), []);

  const openWhatsApp = () => {
    const message = 'Olá! Gostaria de desenvolver minha marca e organizar minha presença digital.';
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#f6f4ef] text-[#111820]">
      <PublicHeader currentPage="brand-journey" onClientLogin={onLogin} />

      <main>
        <section className="border-b border-white/10 bg-[#07111d] pt-24 text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)] lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#d7b96e]">
                Construção de marca e presença digital
              </p>
              <h1 className="mt-4 text-4xl font-black leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-[3.5rem]">
                Construa uma marca profissional, coerente e pronta para crescer.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/68 sm:text-lg sm:leading-8">
                Organizamos posicionamento, nome, logo, identidade visual, materiais, redes sociais, conteúdo e presença digital em uma construção conectada.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setBudgetOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#d7b96e] px-6 py-3.5 text-sm font-black text-[#111820] transition hover:bg-[#e2c982] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Solicitar análise
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
                  <Lightbulb className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d7b96e]">Da ideia à presença profissional</p>
                  <h2 className="mt-1 text-lg font-black">Uma direção única para todos os canais</h2>
                </div>
              </div>

              <p className="mt-5 text-sm leading-6 text-white/62">
                A marca não termina no logo. Ela precisa funcionar na apresentação, no atendimento, no site, nas redes e na comunicação diária.
              </p>

              <ul className="mt-5 space-y-3" aria-label="Elementos da construção de marca">
                {[
                  'Posicionamento antes das escolhas visuais',
                  'Identidade preparada para diferentes aplicações',
                  'Canais organizados com a mesma linguagem',
                  'Base visual pronta para campanhas e crescimento',
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
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#80672c]">Indicado para</span>
            <span>Novos negócios</span>
            <span>Empresas em reposicionamento</span>
            <span>Profissionais</span>
            <span>Marcas sem padrão visual</span>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#80672c]">Construção da marca</p>
              <h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.025em] sm:text-4xl">
                O que podemos desenvolver para sua empresa
              </h2>
              <p className="mt-5 text-sm leading-7 text-neutral-600 sm:text-base">
                Cada etapa cumpre uma função: definir direção, gerar reconhecimento, organizar apresentação ou conectar a marca aos canais digitais.
              </p>
              <p className="mt-4 text-xs font-bold leading-5 text-[#80672c]">
                Selecione uma categoria para visualizar modelos demonstrativos.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {services.map(({ id, icon: Icon, title, text, fit }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedExample(id)}
                  aria-label={`Ver modelos de ${title}`}
                  className="group rounded-[10px] border border-[#ddd8ce] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#c8b06e] hover:shadow-[0_12px_28px_rgba(16,24,32,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80672c] focus-visible:ring-offset-2 sm:p-6"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#0a1420] text-[#d7b96e] transition group-hover:bg-[#132434]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-black text-[#111820]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">{text}</p>
                  <p className="mt-4 border-t border-[#ebe7df] pt-4 text-xs font-bold leading-5 text-[#6d5727]">
                    {fit}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#80672c]">
                    Ver modelos
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-[#e1ddd4] bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#80672c]">Nosso processo</p>
              <h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.025em] sm:text-4xl">
                Uma construção organizada, da estratégia à aplicação
              </h2>
              <p className="mt-4 text-sm leading-7 text-neutral-600 sm:text-base">
                O projeto avança em etapas para que as escolhas visuais tenham direção e funcionem nos canais reais da empresa.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {stages.map(({ number, icon: Icon, title, text }) => (
                <article key={number} className="rounded-[10px] border border-[#ddd8ce] bg-[#f8f6f1] p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black tracking-[0.16em] text-[#80672c]">{number}</span>
                    <Icon className="h-5 w-5 text-[#80672c]" />
                  </div>
                  <h3 className="mt-8 text-lg font-black">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:px-8">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#80672c]">Marca aplicada de verdade</p>
            <h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.025em] sm:text-4xl">
              Uma identidade profissional precisa funcionar além do arquivo do logo
            </h2>
            <p className="mt-5 text-sm leading-7 text-neutral-600 sm:text-base">
              A entrega ganha valor quando a marca é compreendida pelo cliente, pode ser aplicada com consistência e ajuda a empresa a se comunicar melhor.
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

        <section className="border-y border-[#e1ddd4] bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#80672c]">Formas de começar</p>
              <h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.025em] sm:text-4xl">
                Uma solução para o estágio atual da sua empresa
              </h2>
              <p className="mt-4 text-sm leading-7 text-neutral-600 sm:text-base">
                É possível contratar uma etapa específica ou organizar uma jornada completa de construção e entrada no digital.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {packages.map((item) => (
                <article
                  key={item.title}
                  className={`flex flex-col rounded-[10px] border p-6 ${item.featured ? 'border-[#b99a4d] bg-[#0a1420] text-white' : 'border-[#ddd8ce] bg-[#f8f6f1]'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${item.featured ? 'text-[#d7b96e]' : 'text-[#80672c]'}`}>
                      {item.eyebrow}
                    </p>
                    {item.featured && (
                      <span className="rounded-full border border-[#d7b96e]/35 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-[#d7b96e]">
                        Mais completo
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 text-2xl font-black">{item.title}</h3>
                  <p className={`mt-3 text-sm leading-6 ${item.featured ? 'text-white/62' : 'text-neutral-600'}`}>{item.description}</p>
                  <ul className="mt-6 space-y-3">
                    {item.items.map((line) => (
                      <li key={line} className={`flex items-start gap-2.5 text-sm font-semibold leading-5 ${item.featured ? 'text-white/82' : 'text-neutral-700'}`}>
                        <Check className={`mt-0.5 h-4 w-4 shrink-0 ${item.featured ? 'text-[#d7b96e]' : 'text-[#80672c]'}`} strokeWidth={3} />
                        {line}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setBudgetOpen(true)}
                    className={`mt-7 inline-flex items-center justify-center gap-2 rounded-[10px] px-5 py-3.5 text-sm font-black ${item.featured ? 'bg-[#d7b96e] text-[#111820]' : 'bg-[#0a1420] text-white'}`}
                  >
                    Solicitar análise
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div className="max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#80672c]">Marca conectada à tecnologia</p>
            <h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.025em] sm:text-4xl">
              Quando a presença digital precisa avançar, conectamos com Sites e Sistemas
            </h2>
            <p className="mt-5 text-sm leading-7 text-neutral-600 sm:text-base">
              A mesma construção pode incluir site institucional, landing page, loja virtual, aplicativo, portal, sistema, automações e integrações.
            </p>
          </div>
          <button
            type="button"
            onClick={onSystems}
            className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#cfc7b9] bg-white px-6 py-3.5 text-sm font-black text-[#111820] transition hover:border-[#80672c]"
          >
            Conhecer Sites e Sistemas
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>

        <section className="border-t border-[#e1ddd4] bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#80672c]">Dúvidas frequentes</p>
              <h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.025em] sm:text-4xl">
                Antes de iniciar a construção da marca
              </h2>
            </div>
            <div className="mt-9 divide-y divide-[#e3ded5] border-y border-[#e3ded5]">
              {faqs.map(([question, answer]) => (
                <details key={question} className="group py-5">
                  <summary className="cursor-pointer list-none pr-8 text-sm font-black marker:hidden sm:text-base">
                    {question}
                  </summary>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-8 rounded-[10px] bg-[#0a1420] px-5 py-8 text-white sm:px-8 sm:py-10 lg:grid-cols-[1fr_auto] lg:px-10">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d7b96e]">Comece pela realidade da sua empresa</p>
              <h2 className="mt-3 text-2xl font-black leading-tight tracking-[-0.02em] sm:text-3xl">
                Conte onde sua marca está hoje. A GSA organiza o próximo passo.
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/62">
                Você pode solicitar somente uma etapa ou uma análise completa de posicionamento, identidade e presença digital.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <button
                type="button"
                onClick={() => setBudgetOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#d7b96e] px-6 py-3.5 text-sm font-black text-[#111820] transition hover:bg-[#e2c982]"
              >
                Solicitar análise
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={openWhatsApp}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-white/20 px-6 py-3.5 text-sm font-black text-white transition hover:border-[#d7b96e] hover:text-[#e3cb8d]"
              >
                <MessageCircle className="h-4 w-4" />
                Falar no WhatsApp
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#07111d] py-9 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <LogoGSA size="md" variant="light" />
            <p className="mt-3 text-sm text-white/50">Marca, presença digital e tecnologia conectadas.</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-bold text-white/68">
            <button type="button" onClick={onBack} className="hover:text-[#d7b96e]">Início</button>
            <button type="button" onClick={onSystems} className="hover:text-[#d7b96e]">Sites e Sistemas</button>
            <button type="button" onClick={() => setPrivacyOpen(true)} className="hover:text-[#d7b96e]">Privacidade</button>
            <button type="button" onClick={openWhatsApp} className="hover:text-[#d7b96e]">Contato</button>
          </div>
        </div>
      </footer>

      <BrandExamplesDialog
        category={selectedExample}
        onClose={() => setSelectedExample(null)}
        onRequestBudget={() => setBudgetOpen(true)}
      />
      <SystemsBudgetModal isOpen={budgetOpen} onClose={() => setBudgetOpen(false)} />
      <PrivacyPolicyDialog isOpen={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
  );
}
