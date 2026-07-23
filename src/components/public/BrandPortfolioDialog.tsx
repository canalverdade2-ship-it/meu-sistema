import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Instagram,
  LayoutTemplate,
  Palette,
  PenTool,
  Share2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AccessibleDialog } from '../ui/AccessibleDialog';

export type BrandExampleCategory =
  | 'naming'
  | 'identity'
  | 'materials'
  | 'social'
  | 'content'
  | 'digital';

type PreviewVariant = 'wordmark' | 'identity' | 'materials' | 'social' | 'campaign' | 'digital';

interface PortfolioModel {
  name: string;
  direction: string;
  audience: string;
  description: string;
  outcomes: string[];
  variant: PreviewVariant;
  signature: string;
}

interface PortfolioCategory {
  label: string;
  title: string;
  introduction: string;
  icon: LucideIcon;
  models: PortfolioModel[];
}

const portfolio: Record<BrandExampleCategory, PortfolioCategory> = {
  naming: {
    label: 'Nome e posicionamento',
    title: 'Direções para uma marca fácil de compreender e lembrar',
    introduction: 'O nome é apresentado junto com personalidade, mensagem e possibilidades de assinatura para que a escolha tenha contexto estratégico.',
    icon: PenTool,
    models: [
      {
        name: 'Direção institucional',
        direction: 'Clareza e confiança',
        audience: 'Empresas e serviços profissionais',
        description: 'Uma construção objetiva, segura e diretamente relacionada à atuação da empresa.',
        outcomes: ['Conceito central', 'Tom de voz profissional', 'Assinaturas possíveis'],
        variant: 'wordmark',
        signature: 'Estrutura que transmite segurança desde o nome.',
      },
      {
        name: 'Direção autoral',
        direction: 'Proximidade e autoridade',
        audience: 'Especialistas e marcas pessoais',
        description: 'Uma marca que transforma experiência, especialidade e presença pessoal em posicionamento reconhecível.',
        outcomes: ['Marca pessoal', 'Especialidade em destaque', 'Linguagem de autoridade'],
        variant: 'wordmark',
        signature: 'A pessoa se torna parte estratégica da marca.',
      },
      {
        name: 'Direção contemporânea',
        direction: 'Memorização e versatilidade',
        audience: 'Novos negócios e produtos',
        description: 'Uma direção curta e flexível, preparada para funcionar em canais digitais e futuras extensões.',
        outcomes: ['Nome memorável', 'Personalidade própria', 'Uso digital facilitado'],
        variant: 'wordmark',
        signature: 'Uma base simples para uma marca que pode crescer.',
      },
    ],
  },
  identity: {
    label: 'Logo e identidade visual',
    title: 'Sistemas visuais para diferentes percepções de marca',
    introduction: 'Cada proposta combina símbolo, tipografia, cor e ritmo visual para criar uma percepção coerente com o posicionamento.',
    icon: Palette,
    models: [
      {
        name: 'Identidade corporativa',
        direction: 'Sobriedade e organização',
        audience: 'Empresas, consultorias e serviços',
        description: 'Uma linguagem visual estruturada para documentos, apresentações, site e comunicação institucional.',
        outcomes: ['Logo e versões', 'Paleta institucional', 'Sistema tipográfico'],
        variant: 'identity',
        signature: 'Consistência visual para ambientes profissionais.',
      },
      {
        name: 'Identidade premium',
        direction: 'Exclusividade e refinamento',
        audience: 'Marcas de alto valor percebido',
        description: 'Poucos elementos, contraste controlado e aplicações seletivas para transmitir cuidado e distinção.',
        outcomes: ['Símbolo marcante', 'Paleta refinada', 'Aplicações de alto impacto'],
        variant: 'identity',
        signature: 'Menos elementos, mais presença.',
      },
      {
        name: 'Identidade próxima',
        direction: 'Acolhimento e acessibilidade',
        audience: 'Comércio, saúde e atendimento',
        description: 'Uma linguagem legível e humana, fácil de reconhecer e de aplicar na comunicação cotidiana.',
        outcomes: ['Leitura rápida', 'Cores funcionais', 'Uso simples pela equipe'],
        variant: 'identity',
        signature: 'Uma marca que aproxima sem perder profissionalismo.',
      },
    ],
  },
  materials: {
    label: 'Materiais da empresa',
    title: 'Aplicações que transformam a identidade em ferramenta comercial',
    introduction: 'A marca passa a funcionar em propostas, apresentações, documentos e materiais usados pela equipe no relacionamento com o cliente.',
    icon: FileText,
    models: [
      {
        name: 'Kit comercial',
        direction: 'Apresentar e vender',
        audience: 'Equipes comerciais e prestadores',
        description: 'Um conjunto para organizar proposta, apresentação institucional, catálogo e oferta de serviços.',
        outcomes: ['Apresentação institucional', 'Proposta comercial', 'Catálogo de serviços'],
        variant: 'materials',
        signature: 'Mais clareza para apresentar valor ao cliente.',
      },
      {
        name: 'Kit de atendimento',
        direction: 'Padronizar contatos',
        audience: 'Empresas com relacionamento frequente',
        description: 'Peças para assinatura de e-mail, cartão digital, WhatsApp, formulários e documentos recorrentes.',
        outcomes: ['Cartão digital', 'Assinatura de e-mail', 'Modelos de documentos'],
        variant: 'materials',
        signature: 'A mesma marca em cada conversa.',
      },
      {
        name: 'Kit institucional',
        direction: 'Organizar a operação',
        audience: 'Equipes e ambientes corporativos',
        description: 'Aplicações internas e externas para manter a identidade uniforme em diferentes situações.',
        outcomes: ['Papelaria básica', 'Capas e documentos', 'Guia rápido de uso'],
        variant: 'materials',
        signature: 'Uma identidade que a equipe consegue aplicar.',
      },
    ],
  },
  social: {
    label: 'Redes sociais',
    title: 'Perfis que parecem parte da marca, não páginas improvisadas',
    introduction: 'A identidade é adaptada para biografia, destaques, capas, feed e formatos que ajudam o público a compreender a empresa.',
    icon: Instagram,
    models: [
      {
        name: 'Perfil institucional',
        direction: 'Autoridade e confiança',
        audience: 'Empresas e serviços',
        description: 'Uma presença sóbria com informações claras, prova de experiência e caminhos de contato bem definidos.',
        outcomes: ['Biografia estratégica', 'Destaques organizados', 'Padrão visual do feed'],
        variant: 'social',
        signature: 'O perfil apresenta a empresa antes da conversa.',
      },
      {
        name: 'Perfil comercial',
        direction: 'Oferta e oportunidade',
        audience: 'Produtos, lojas e campanhas',
        description: 'Uma estrutura que combina vitrine, benefícios, ofertas e chamadas de ação sem perder identidade.',
        outcomes: ['Vitrine de soluções', 'Campanhas visuais', 'Contato em destaque'],
        variant: 'social',
        signature: 'Uma presença preparada para apresentar e converter.',
      },
      {
        name: 'Perfil de especialista',
        direction: 'Conhecimento e proximidade',
        audience: 'Profissionais e marcas pessoais',
        description: 'Conteúdo, apresentação e provas organizados para fortalecer autoridade e relacionamento.',
        outcomes: ['Conteúdo educativo', 'Posicionamento pessoal', 'Provas e resultados'],
        variant: 'social',
        signature: 'Autoridade construída com consistência.',
      },
    ],
  },
  content: {
    label: 'Conteúdo e campanhas',
    title: 'Linhas editoriais para comunicar com intenção',
    introduction: 'O conteúdo passa a cumprir papéis definidos: educar, apresentar, gerar confiança, criar desejo ou conduzir uma ação.',
    icon: Share2,
    models: [
      {
        name: 'Conteúdo de autoridade',
        direction: 'Ensinar e posicionar',
        audience: 'Especialistas e empresas',
        description: 'Publicações educativas que explicam temas, demonstram experiência e fortalecem a percepção de domínio.',
        outcomes: ['Linha editorial', 'Carrosséis educativos', 'Vídeos explicativos'],
        variant: 'campaign',
        signature: 'Conhecimento transformado em confiança.',
      },
      {
        name: 'Conteúdo comercial',
        direction: 'Apresentar e vender',
        audience: 'Produtos e serviços',
        description: 'Peças que explicam benefícios, respondem dúvidas e conduzem o público para atendimento ou compra.',
        outcomes: ['Campanhas de oferta', 'Provas e benefícios', 'Chamadas para ação'],
        variant: 'campaign',
        signature: 'Comunicação comercial sem parecer improvisada.',
      },
      {
        name: 'Campanha de lançamento',
        direction: 'Criar expectativa e ação',
        audience: 'Novas marcas, produtos e serviços',
        description: 'Uma sequência coordenada de apresentação, antecipação, lançamento e continuidade.',
        outcomes: ['Pré-lançamento', 'Peças principais', 'Página e atendimento conectados'],
        variant: 'campaign',
        signature: 'Uma entrada no mercado com direção.',
      },
    ],
  },
  digital: {
    label: 'Presença digital integrada',
    title: 'Uma experiência contínua entre marca, canais e atendimento',
    introduction: 'A identidade é conectada ao site, redes sociais, WhatsApp e demais pontos de contato para que o cliente reconheça a mesma empresa em todos eles.',
    icon: LayoutTemplate,
    models: [
      {
        name: 'Presença institucional',
        direction: 'Apresentar e gerar confiança',
        audience: 'Empresas e serviços',
        description: 'Site, redes e atendimento com a mesma linguagem para explicar a empresa e facilitar o contato.',
        outcomes: ['Site institucional', 'Redes padronizadas', 'WhatsApp organizado'],
        variant: 'digital',
        signature: 'Uma empresa reconhecível em qualquer canal.',
      },
      {
        name: 'Presença comercial',
        direction: 'Atrair e converter',
        audience: 'Produtos, campanhas e serviços',
        description: 'Landing page, campanha e atendimento conectados para reduzir rupturas no caminho do cliente.',
        outcomes: ['Página comercial', 'Campanha integrada', 'Fluxo de atendimento'],
        variant: 'digital',
        signature: 'Da descoberta à conversa sem perder contexto.',
      },
      {
        name: 'Ecossistema da marca',
        direction: 'Operar e crescer',
        audience: 'Empresas com múltiplos canais',
        description: 'Identidade aplicada em site, portal, conteúdos, materiais e rotinas internas de comunicação.',
        outcomes: ['Sistema visual amplo', 'Canais conectados', 'Base para expansão'],
        variant: 'digital',
        signature: 'Uma marca preparada para evoluir com a empresa.',
      },
    ],
  },
};

interface BrandPortfolioDialogProps {
  category: BrandExampleCategory | null;
  onClose: () => void;
  onRequestBudget: () => void;
}

export function BrandExamplesDialog({ category, onClose, onRequestBudget }: BrandPortfolioDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const data = category ? portfolio[category] : null;

  useEffect(() => {
    setSelectedIndex(0);
  }, [category]);

  const model = useMemo(() => data?.models[selectedIndex] || null, [data, selectedIndex]);
  const Icon = data?.icon;

  const changeModel = (nextIndex: number) => {
    if (!data) return;
    const normalized = (nextIndex + data.models.length) % data.models.length;
    setSelectedIndex(normalized);
  };

  return (
    <AccessibleDialog
      isOpen={Boolean(category)}
      onClose={onClose}
      ariaLabel={data ? `Galeria de referências de ${data.label}` : 'Galeria de referências de marca'}
      overlayClassName="items-center justify-center overflow-y-auto bg-[#17120e]/88 p-3 backdrop-blur-sm sm:p-6"
      panelClassName="max-h-[92dvh] max-w-6xl overflow-hidden border border-[#8f806d] bg-[#efe8dc] shadow-[0_32px_100px_rgba(0,0,0,0.58)]"
    >
      {data && model && Icon && (
        <div className="flex max-h-[92dvh] min-h-0 flex-col lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="shrink-0 bg-[#211a14] p-5 text-white sm:p-6 lg:flex lg:min-h-0 lg:flex-col lg:p-8">
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-11 w-11 items-center justify-center border border-[#c8a96c]/45 text-[#d8bb7a]">
                <Icon className="h-5 w-5" />
              </span>
              <button
                type="button"
                onClick={onClose}
                data-dialog-autofocus
                aria-label="Fechar galeria"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bb7a]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 lg:mt-10">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#c8a96c]">{data.label}</p>
              <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight">{data.title}</h2>
              <p className="mt-4 text-xs leading-6 text-white/55">{data.introduction}</p>
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:mt-10 lg:flex-col lg:overflow-visible">
              {data.models.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  className={`shrink-0 border px-3 py-2.5 text-left transition lg:w-full lg:px-4 lg:py-3 ${index === selectedIndex ? 'border-[#c8a96c] bg-[#c8a96c] text-[#211a14]' : 'border-white/12 text-white/60 hover:border-white/30 hover:text-white'}`}
                >
                  <span className="text-[9px] font-black tracking-[0.14em]">0{index + 1}</span>
                  <span className="ml-3 text-xs font-black">{item.name}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onRequestBudget();
              }}
              className="mt-5 hidden items-center justify-center gap-2 border border-[#c8a96c] px-5 py-3 text-sm font-black text-[#d8bb7a] transition hover:bg-[#c8a96c] hover:text-[#211a14] lg:mt-auto lg:inline-flex"
            >
              Solicitar análise
              <ArrowRight className="h-4 w-4" />
            </button>
          </aside>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="p-4 sm:p-6 lg:p-8">
              <PortfolioPreview variant={model.variant} signature={model.signature} />

              <div className="mt-6 grid gap-6 border-t border-[#c7b9a6] pt-6 lg:grid-cols-[1fr_0.8fr]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="border border-[#b6a58e] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#70542c]">{model.direction}</span>
                    <span className="text-[10px] font-bold text-[#8a7b68]">{model.audience}</span>
                  </div>
                  <h3 className="mt-4 font-serif text-4xl font-semibold leading-tight text-[#211a14]">{model.name}</h3>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-[#675d52]">{model.description}</p>
                </div>

                <div className="border-l-0 border-[#c7b9a6] lg:border-l lg:pl-6">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7b5d31]">O que esta direção pode incluir</p>
                  <ul className="mt-4 space-y-3">
                    {model.outcomes.map((outcome) => (
                      <li key={outcome} className="flex items-start gap-2.5 text-sm font-semibold text-[#40372f]">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7b5d31]" strokeWidth={3} />
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <footer className="sticky bottom-0 border-t border-[#c7b9a6] bg-[#f7f2e9]/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => changeModel(selectedIndex - 1)} className="inline-flex h-10 w-10 items-center justify-center border border-[#aa9982] text-[#211a14] hover:border-[#211a14]" aria-label="Modelo anterior">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <p className="hidden text-center text-xs text-[#7e705e] sm:block">Referência conceitual. Cada projeto recebe uma direção própria.</p>
                <button type="button" onClick={() => changeModel(selectedIndex + 1)} className="inline-flex h-10 w-10 items-center justify-center border border-[#aa9982] text-[#211a14] hover:border-[#211a14]" aria-label="Próximo modelo">
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequestBudget();
                  }}
                  className="ml-auto inline-flex items-center justify-center gap-2 bg-[#211a14] px-4 py-3 text-xs font-black text-white lg:hidden"
                >
                  Solicitar análise
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </AccessibleDialog>
  );
}

function PortfolioPreview({ variant, signature }: { variant: PreviewVariant; signature: string }) {
  return (
    <div className="overflow-hidden border border-[#b9ab98] bg-[#f8f4ed]">
      <div className="flex items-center justify-between border-b border-[#cec3b4] bg-[#e6ddcf] px-4 py-2.5">
        <span className="text-[8px] font-black uppercase tracking-[0.18em] text-[#75644f]">Estudo visual demonstrativo</span>
        <span className="font-serif text-xs italic text-[#75644f]">{signature}</span>
      </div>
      <div className="aspect-[16/10] min-h-[250px] sm:min-h-[330px]">
        {variant === 'wordmark' && <WordmarkScene />}
        {variant === 'identity' && <IdentityScene />}
        {variant === 'materials' && <MaterialsScene />}
        {variant === 'social' && <SocialScene />}
        {variant === 'campaign' && <CampaignScene />}
        {variant === 'digital' && <DigitalScene />}
      </div>
    </div>
  );
}

function WordmarkScene() {
  return (
    <div className="grid h-full grid-cols-[1.1fr_0.9fr]">
      <div className="flex flex-col justify-between bg-[#211a14] p-7 text-white sm:p-10">
        <div>
          <span className="block h-1 w-12 bg-[#c8a96c]" />
          <p className="mt-7 font-serif text-5xl sm:text-7xl">NÁCAR</p>
          <p className="mt-2 text-[9px] font-black uppercase tracking-[0.28em] text-[#d7bd84]">Clareza que permanece</p>
        </div>
        <p className="max-w-xs text-xs leading-5 text-white/45">Conceito, personalidade, assinatura e possibilidades de extensão.</p>
      </div>
      <div className="grid grid-rows-3 gap-3 bg-[#dfd2bf] p-5 sm:p-8">
        {['NÁCAR', 'NÁCAR ESTÚDIO', 'NÁCAR CONSULTORIA'].map((name, index) => (
          <div key={name} className="flex items-center justify-between border border-[#aa9678] bg-[#f7f2e9] px-4">
            <span className={`font-serif ${index === 0 ? 'text-2xl' : 'text-lg'}`}>{name}</span>
            <span className="text-[8px] font-black uppercase tracking-wider text-[#8a765b]">0{index + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IdentityScene() {
  return (
    <div className="grid h-full grid-cols-[0.9fr_1.1fr] gap-4 bg-[#eee6da] p-5 sm:p-8">
      <div className="flex items-center justify-center bg-[#211a14]">
        <div className="flex h-28 w-28 items-center justify-center rounded-full border border-[#c8a96c] font-serif text-5xl text-[#d8bb7a]">A</div>
      </div>
      <div className="grid grid-rows-[0.75fr_1.25fr] gap-4">
        <div className="grid grid-cols-4 gap-3">
          <span className="bg-[#211a14]" />
          <span className="bg-[#8f6749]" />
          <span className="bg-[#c8a96c]" />
          <span className="border border-[#cabda9] bg-[#f8f4ed]" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5">
            <p className="font-serif text-3xl">Aurea</p>
            <span className="mt-3 block h-1.5 w-4/5 bg-[#d8d0c5]" />
            <span className="mt-2 block h-1.5 w-full bg-[#e7e1d9]" />
          </div>
          <div className="flex flex-col justify-between bg-[#c8a96c] p-5">
            <span className="text-[8px] font-black uppercase tracking-wider">Aplicação</span>
            <p className="font-serif text-2xl leading-tight">Forma com intenção.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MaterialsScene() {
  return (
    <div className="relative h-full overflow-hidden bg-[#d8c7aa] p-6 sm:p-10">
      <div className="absolute left-[8%] top-[12%] h-[68%] w-[42%] -rotate-3 border border-[#a38d69] bg-white p-5 shadow-xl">
        <span className="block h-2 w-14 bg-[#211a14]" />
        <p className="mt-6 font-serif text-3xl">Proposta comercial</p>
        <span className="mt-5 block h-1.5 w-full bg-[#ded7cc]" />
        <span className="mt-2 block h-1.5 w-4/5 bg-[#e9e4dc]" />
        <div className="mt-8 h-20 bg-[#211a14]" />
      </div>
      <div className="absolute bottom-[10%] right-[9%] h-[54%] w-[44%] rotate-3 border border-[#a38d69] bg-[#211a14] p-5 text-white shadow-xl">
        <span className="text-[8px] font-black uppercase tracking-wider text-[#c8a96c]">Apresentação</span>
        <p className="mt-6 font-serif text-3xl">Sua marca em cada detalhe.</p>
        <div className="mt-8 grid grid-cols-3 gap-2">
          <span className="h-12 bg-white/10" />
          <span className="h-12 bg-[#c8a96c]" />
          <span className="h-12 bg-white/10" />
        </div>
      </div>
    </div>
  );
}

function SocialScene() {
  return (
    <div className="grid h-full grid-cols-[0.7fr_1.3fr] gap-5 bg-[#e7ded1] p-5 sm:p-8">
      <div className="flex flex-col border border-[#bba98f] bg-white p-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-[#211a14]" />
        <span className="mx-auto mt-3 h-2 w-24 bg-[#d2c8ba]" />
        <span className="mx-auto mt-2 h-1.5 w-32 bg-[#e4ddd3]" />
        <div className="mt-5 grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((item) => <span key={item} className="aspect-square rounded-full border border-[#bba98f]" />)}
        </div>
        <div className="mt-5 h-8 bg-[#211a14]" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className={`${item === 1 || item === 4 ? 'bg-[#c8a96c]' : item === 2 ? 'bg-[#8f6749]' : 'bg-[#211a14]'} p-3 text-white`}>
            <span className="block h-1.5 w-8 bg-white/70" />
            <span className="mt-4 block h-2 w-4/5 bg-white/85" />
            <span className="mt-2 block h-1 w-full bg-white/30" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CampaignScene() {
  return (
    <div className="grid h-full grid-cols-3 bg-[#211a14] p-5 sm:p-8">
      {[
        ['01', 'DESCOBRIR', '#c8a96c'],
        ['02', 'COMPREENDER', '#8f6749'],
        ['03', 'ESCOLHER', '#efe8dc'],
      ].map(([number, title, color], index) => (
        <div key={number} className="flex flex-col justify-between border-r border-white/15 p-4 last:border-0 sm:p-6" style={{ backgroundColor: index === 2 ? color : 'transparent' }}>
          <span className={`text-[10px] font-black tracking-[0.18em] ${index === 2 ? 'text-[#211a14]' : 'text-[#c8a96c]'}`}>{number}</span>
          <div>
            <p className={`font-serif text-2xl sm:text-4xl ${index === 2 ? 'text-[#211a14]' : 'text-white'}`}>{title}</p>
            <span className={`mt-4 block h-1.5 w-4/5 ${index === 2 ? 'bg-[#8f806d]' : 'bg-white/25'}`} />
            <span className={`mt-2 block h-1.5 w-full ${index === 2 ? 'bg-[#c8bba8]' : 'bg-white/15'}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DigitalScene() {
  return (
    <div className="grid h-full grid-cols-[1.15fr_0.85fr] gap-5 bg-[#ddd2c2] p-5 sm:p-8">
      <div className="overflow-hidden border border-[#a89578] bg-white">
        <div className="flex h-7 items-center gap-1.5 border-b border-[#ddd4c8] bg-[#f4efe7] px-3">
          <span className="h-1.5 w-1.5 rounded-full bg-[#bbb0a1]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#bbb0a1]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#bbb0a1]" />
        </div>
        <div className="grid h-[calc(100%-1.75rem)] grid-rows-[1.2fr_0.8fr]">
          <div className="bg-[#211a14] p-6 text-white">
            <span className="block h-1 w-10 bg-[#c8a96c]" />
            <p className="mt-5 font-serif text-4xl">Uma presença que parece inteira.</p>
            <span className="mt-5 block h-7 w-28 bg-[#c8a96c]" />
          </div>
          <div className="grid grid-cols-3 gap-3 p-4">
            {[0, 1, 2].map((item) => <div key={item} className="border border-[#ddd4c8] p-3"><span className="block h-4 w-4 bg-[#8f6749]" /><span className="mt-3 block h-1.5 w-full bg-[#d7d0c7]" /></div>)}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center">
        <div className="h-[88%] w-[72%] rounded-[20px] border-4 border-[#211a14] bg-white p-3 shadow-xl">
          <div className="mx-auto h-1.5 w-12 rounded bg-[#d6cec2]" />
          <div className="mt-4 h-20 bg-[#211a14]" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((item) => <div key={item} className="aspect-square bg-[#ece5da] p-2"><span className="block h-3 w-3 bg-[#8f6749]" /></div>)}
          </div>
          <div className="mt-3 h-7 bg-[#c8a96c]" />
        </div>
      </div>
    </div>
  );
}
