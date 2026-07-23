import {
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

interface ExampleModel {
  title: string;
  segment: string;
  description: string;
  features: string[];
  variant: PreviewVariant;
  label: string;
}

interface CategoryData {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  examples: ExampleModel[];
}

const categories: Record<BrandExampleCategory, CategoryData> = {
  naming: {
    eyebrow: 'Nome e posicionamento',
    title: 'Direções para construir uma marca reconhecível',
    description: 'Exemplos de caminhos estratégicos para nome, personalidade e mensagem principal da empresa.',
    icon: PenTool,
    examples: [
      {
        title: 'Nome institucional',
        segment: 'Serviços e empresas',
        description: 'Direção objetiva, confiável e fácil de relacionar ao segmento de atuação.',
        features: ['Conceito central', 'Tom profissional', 'Possibilidades de assinatura'],
        variant: 'wordmark',
        label: 'Institucional',
      },
      {
        title: 'Nome autoral',
        segment: 'Profissionais e especialistas',
        description: 'Construção baseada em autoridade pessoal, especialidade e proximidade com o público.',
        features: ['Marca pessoal', 'Posicionamento claro', 'Linguagem de autoridade'],
        variant: 'wordmark',
        label: 'Autoral',
      },
      {
        title: 'Nome contemporâneo',
        segment: 'Novos negócios e produtos',
        description: 'Direção mais curta e memorável, preparada para crescer em diferentes canais digitais.',
        features: ['Memorização', 'Versatilidade digital', 'Personalidade própria'],
        variant: 'wordmark',
        label: 'Contemporâneo',
      },
    ],
  },
  identity: {
    eyebrow: 'Logo e identidade visual',
    title: 'Modelos de expressão visual da marca',
    description: 'Referências para definir símbolo, tipografia, cores e uma linguagem visual consistente.',
    icon: Palette,
    examples: [
      {
        title: 'Identidade corporativa',
        segment: 'Empresas e consultorias',
        description: 'Visual sóbrio, organizado e preparado para documentos, apresentações e ambiente digital.',
        features: ['Logo principal e versões', 'Paleta institucional', 'Tipografia e aplicações'],
        variant: 'identity',
        label: 'Corporativo',
      },
      {
        title: 'Identidade premium',
        segment: 'Marcas de alto valor percebido',
        description: 'Composição elegante, poucos elementos e contraste visual para transmitir exclusividade.',
        features: ['Símbolo marcante', 'Cores refinadas', 'Aplicações seletivas'],
        variant: 'identity',
        label: 'Premium',
      },
      {
        title: 'Identidade acessível',
        segment: 'Comércio e atendimento',
        description: 'Sistema visual acolhedor, legível e fácil de reconhecer em diferentes pontos de contato.',
        features: ['Leitura rápida', 'Cores funcionais', 'Uso simples no dia a dia'],
        variant: 'identity',
        label: 'Acessível',
      },
    ],
  },
  materials: {
    eyebrow: 'Materiais da empresa',
    title: 'Aplicações que deixam a marca pronta para atuar',
    description: 'Exemplos de peças institucionais para apresentar a empresa com consistência e profissionalismo.',
    icon: FileText,
    examples: [
      {
        title: 'Kit comercial',
        segment: 'Vendas e apresentação',
        description: 'Conjunto visual para propostas, apresentações, catálogos e materiais enviados ao cliente.',
        features: ['Apresentação institucional', 'Proposta comercial', 'Catálogo de serviços'],
        variant: 'materials',
        label: 'Comercial',
      },
      {
        title: 'Kit de atendimento',
        segment: 'Relacionamento com clientes',
        description: 'Peças padronizadas para assinatura de e-mail, cartão digital, WhatsApp e documentos.',
        features: ['Cartão digital', 'Assinatura de e-mail', 'Modelos de documentos'],
        variant: 'materials',
        label: 'Atendimento',
      },
      {
        title: 'Kit institucional',
        segment: 'Operação e equipe',
        description: 'Aplicações internas e externas para manter a marca uniforme em diferentes situações.',
        features: ['Papelaria básica', 'Capas e documentos', 'Guia rápido de uso'],
        variant: 'materials',
        label: 'Institucional',
      },
    ],
  },
  social: {
    eyebrow: 'Redes sociais',
    title: 'Modelos de presença visual para os canais sociais',
    description: 'Referências para organizar perfil, destaques, capas e uma identidade reconhecível nas redes.',
    icon: Instagram,
    examples: [
      {
        title: 'Perfil institucional',
        segment: 'Empresas e serviços',
        description: 'Feed sóbrio com informações claras, prova de autoridade e chamadas para atendimento.',
        features: ['Foto e biografia', 'Destaques organizados', 'Padrão visual do feed'],
        variant: 'social',
        label: 'Institucional',
      },
      {
        title: 'Perfil comercial',
        segment: 'Produtos e ofertas',
        description: 'Estrutura pensada para apresentar soluções, campanhas, benefícios e oportunidades.',
        features: ['Vitrine de produtos', 'Campanhas e ofertas', 'Contato em destaque'],
        variant: 'social',
        label: 'Comercial',
      },
      {
        title: 'Perfil de especialista',
        segment: 'Profissionais e autoridade',
        description: 'Comunicação baseada em conhecimento, posicionamento e relacionamento com o público.',
        features: ['Conteúdo educativo', 'Apresentação profissional', 'Provas e resultados'],
        variant: 'social',
        label: 'Autoridade',
      },
    ],
  },
  content: {
    eyebrow: 'Conteúdo e campanhas',
    title: 'Modelos para comunicar, educar e gerar oportunidades',
    description: 'Exemplos de linhas editoriais e campanhas que mantêm a marca ativa e conectada ao cliente.',
    icon: Share2,
    examples: [
      {
        title: 'Conteúdo de autoridade',
        segment: 'Especialistas e empresas',
        description: 'Publicações educativas que explicam temas, demonstram experiência e fortalecem confiança.',
        features: ['Carrosséis educativos', 'Vídeos curtos', 'Calendário editorial'],
        variant: 'campaign',
        label: 'Autoridade',
      },
      {
        title: 'Conteúdo comercial',
        segment: 'Venda de produtos e serviços',
        description: 'Comunicação que apresenta ofertas, diferenciais, condições e caminhos para contratação.',
        features: ['Campanhas de oferta', 'Benefícios e diferenciais', 'Chamadas para ação'],
        variant: 'campaign',
        label: 'Conversão',
      },
      {
        title: 'Conteúdo de relacionamento',
        segment: 'Comunidade e atendimento',
        description: 'Linha editorial para aproximar o público, mostrar bastidores e manter presença constante.',
        features: ['Stories e bastidores', 'Datas estratégicas', 'Interação com o público'],
        variant: 'campaign',
        label: 'Relacionamento',
      },
    ],
  },
  digital: {
    eyebrow: 'Presença digital integrada',
    title: 'Modelos para conectar marca, canais e atendimento',
    description: 'Referências de uma presença completa, em que identidade, site, redes sociais e contato funcionam juntos.',
    icon: LayoutTemplate,
    examples: [
      {
        title: 'Marca com site institucional',
        segment: 'Empresas e profissionais',
        description: 'Identidade aplicada a uma página profissional com serviços, diferenciais e contato organizado.',
        features: ['Identidade consistente', 'Site responsivo', 'Contato e WhatsApp'],
        variant: 'digital',
        label: 'Institucional',
      },
      {
        title: 'Marca com lançamento digital',
        segment: 'Novos negócios',
        description: 'Conjunto preparado para apresentar a empresa, iniciar os canais e comunicar o lançamento.',
        features: ['Identidade de lançamento', 'Landing page', 'Conteúdo inicial'],
        variant: 'digital',
        label: 'Lançamento',
      },
      {
        title: 'Marca com operação comercial',
        segment: 'Empresas em crescimento',
        description: 'Presença conectada a catálogo, atendimento, campanhas e ferramentas de acompanhamento.',
        features: ['Site ou loja', 'Redes sociais', 'Campanhas e atendimento'],
        variant: 'digital',
        label: 'Operação',
      },
    ],
  },
};

interface BrandExamplesDialogProps {
  category: BrandExampleCategory | null;
  onClose: () => void;
  onRequestBudget: () => void;
}

export function BrandExamplesDialog({ category, onClose, onRequestBudget }: BrandExamplesDialogProps) {
  const data = category ? categories[category] : null;
  const Icon = data?.icon;

  return (
    <AccessibleDialog
      isOpen={Boolean(data)}
      onClose={onClose}
      ariaLabel={data ? `Modelos demonstrativos de ${data.eyebrow}` : 'Modelos demonstrativos de marca'}
      overlayClassName="items-center justify-center overflow-y-auto bg-[#03070d]/80 p-3 backdrop-blur-sm sm:p-6"
      panelClassName="max-h-[92dvh] max-w-6xl overflow-hidden rounded-[1.25rem] border border-white/15 bg-white shadow-[0_28px_90px_rgba(0,0,0,0.5)]"
    >
      {data && Icon && (
        <div className="flex max-h-[92dvh] min-h-0 flex-col">
          <header className="shrink-0 border-b border-white/10 bg-[#0a1420] px-4 py-4 text-white sm:px-6 sm:py-5 lg:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#d7b96e]/12 text-[#d7b96e]">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.17em] text-[#d7b96e]">{data.eyebrow}</p>
                  <h2 className="mt-1 text-xl font-black leading-tight sm:text-2xl">{data.title}</h2>
                  <p className="mt-1.5 max-w-3xl text-xs leading-5 text-white/62 sm:text-sm">{data.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                data-dialog-autofocus
                aria-label="Fechar modelos"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7b96e]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f6f4ef] p-4 sm:p-6 lg:p-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-xs font-black text-[#111820]">Referências de estrutura</p>
              <span className="rounded-full border border-[#d8c89b] bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-[#705a29]">
                Modelos conceituais
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {data.examples.map((example) => (
                <article key={example.title} className="overflow-hidden rounded-[10px] border border-[#dcd6ca] bg-white shadow-[0_6px_20px_rgba(16,24,32,0.05)]">
                  <BrandPreview variant={example.variant} label={example.label} />
                  <div className="p-4 sm:p-5">
                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#80672c]">{example.segment}</p>
                    <h3 className="mt-2 text-lg font-black leading-tight text-[#111820]">{example.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">{example.description}</p>
                    <ul className="mt-4 space-y-2 border-t border-[#ebe7df] pt-4">
                      {example.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-xs font-semibold leading-5 text-neutral-700">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#80672c]" strokeWidth={3} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <footer className="shrink-0 border-t border-[#ddd7cc] bg-white px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-neutral-500">
                As referências orientam a conversa. Nome, cores, símbolos, aplicações e conteúdo são desenvolvidos para cada marca.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestBudget();
                }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#0a1420] px-5 py-3 text-sm font-black text-white transition hover:bg-[#142434] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80672c] focus-visible:ring-offset-2"
              >
                Solicitar análise
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </footer>
        </div>
      )}
    </AccessibleDialog>
  );
}

function BrandPreview({ variant, label }: { variant: PreviewVariant; label: string }) {
  return (
    <div className="relative aspect-[16/9] overflow-hidden border-b border-[#dfd9cf] bg-[#ebe7de] p-3">
      <div className="flex h-full flex-col overflow-hidden rounded-[8px] border border-[#cfc8bb] bg-white shadow-sm">
        <div className="flex h-6 shrink-0 items-center gap-1.5 border-b border-[#e4dfd6] bg-[#f7f5f0] px-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
          <span className="ml-auto rounded-full bg-[#e8dfc4] px-2 py-0.5 text-[6px] font-black uppercase tracking-wider text-[#705a29]">{label}</span>
        </div>
        <div className="min-h-0 flex-1">
          {variant === 'wordmark' && <WordmarkPreview />}
          {variant === 'identity' && <IdentityPreview />}
          {variant === 'materials' && <MaterialsPreview />}
          {variant === 'social' && <SocialPreview />}
          {variant === 'campaign' && <CampaignPreview />}
          {variant === 'digital' && <DigitalPreview />}
        </div>
      </div>
    </div>
  );
}

function WordmarkPreview() {
  return (
    <div className="grid h-full grid-cols-[1.05fr_0.95fr]">
      <div className="flex flex-col justify-center bg-[#0b1723] p-4">
        <span className="h-4 w-4/5 rounded bg-white/90" />
        <span className="mt-2 h-1.5 w-2/5 rounded bg-[#d7b96e]" />
        <span className="mt-4 h-1 w-full rounded bg-white/20" />
        <span className="mt-1.5 h-1 w-4/5 rounded bg-white/15" />
      </div>
      <div className="grid grid-rows-3 gap-2 bg-[#f5f1e8] p-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex items-center gap-2 rounded border border-[#ddd5c7] bg-white p-2">
            <span className="h-5 w-5 rounded bg-[#0b1723]" />
            <span className="h-2 flex-1 rounded bg-neutral-300" />
          </div>
        ))}
      </div>
    </div>
  );
}

function IdentityPreview() {
  return (
    <div className="grid h-full grid-cols-[1fr_1.25fr] gap-3 bg-[#f5f1e8] p-3">
      <div className="flex items-center justify-center rounded bg-[#0b1723]">
        <div className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-[#d7b96e]/60 text-xl font-black text-[#d7b96e]">A</div>
      </div>
      <div className="grid grid-rows-[1fr_auto] gap-3">
        <div className="grid grid-cols-3 gap-2">
          <span className="rounded bg-[#0b1723]" />
          <span className="rounded bg-[#d7b96e]" />
          <span className="rounded bg-[#e9e2d3]" />
        </div>
        <div className="rounded border border-[#ddd5c7] bg-white p-3">
          <span className="block h-2 w-3/4 rounded bg-[#0b1723]" />
          <span className="mt-2 block h-1.5 w-full rounded bg-neutral-300" />
          <span className="mt-1 block h-1.5 w-4/5 rounded bg-neutral-200" />
        </div>
      </div>
    </div>
  );
}

function MaterialsPreview() {
  return (
    <div className="relative h-full bg-[#efeae0] p-4">
      <div className="absolute left-5 top-4 h-[72%] w-[45%] rotate-[-4deg] rounded border border-[#d4ccbe] bg-white p-3 shadow-md">
        <span className="block h-3 w-3 rounded bg-[#0b1723]" />
        <span className="mt-4 block h-2 w-4/5 rounded bg-[#0b1723]" />
        <span className="mt-2 block h-1 w-full rounded bg-neutral-300" />
        <span className="mt-1 block h-1 w-3/4 rounded bg-neutral-200" />
      </div>
      <div className="absolute bottom-4 right-5 h-[58%] w-[52%] rotate-[3deg] rounded bg-[#0b1723] p-3 shadow-md">
        <span className="block h-3 w-3 rounded bg-[#d7b96e]" />
        <span className="mt-4 block h-2 w-3/4 rounded bg-white/85" />
        <span className="mt-2 block h-1 w-full rounded bg-white/25" />
      </div>
    </div>
  );
}

function SocialPreview() {
  return (
    <div className="grid h-full grid-cols-[0.72fr_1.28fr] bg-[#f4f1ea]">
      <div className="border-r border-[#ded8cc] bg-white p-3">
        <span className="mx-auto block h-10 w-10 rounded-full bg-[#0b1723]" />
        <span className="mx-auto mt-2 block h-2 w-3/4 rounded bg-neutral-300" />
        <div className="mt-3 grid grid-cols-3 gap-1">
          {[0, 1, 2].map((item) => <span key={item} className="aspect-square rounded-full bg-[#e4dccb]" />)}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 p-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className={`aspect-square rounded ${item % 2 === 0 ? 'bg-[#0b1723]' : 'bg-[#d7b96e]'}`} />
        ))}
      </div>
    </div>
  );
}

function CampaignPreview() {
  return (
    <div className="grid h-full grid-cols-3 gap-2 bg-[#f4f1ea] p-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex flex-col rounded border border-[#ddd5c7] bg-white p-2">
          <div className={`aspect-square rounded ${item === 1 ? 'bg-[#d7b96e]' : 'bg-[#0b1723]'}`} />
          <span className="mt-2 h-1.5 w-4/5 rounded bg-neutral-300" />
          <span className="mt-1 h-1 w-full rounded bg-neutral-200" />
          <span className="mt-auto h-3 w-2/3 rounded bg-[#e6dfd2]" />
        </div>
      ))}
    </div>
  );
}

function DigitalPreview() {
  return (
    <div className="grid h-full grid-cols-[1.2fr_0.8fr] gap-3 bg-[#eef0f2] p-3">
      <div className="overflow-hidden rounded border border-[#d4d8dc] bg-white">
        <div className="h-[44%] bg-[#0b1723] p-3">
          <span className="block h-2 w-16 rounded bg-[#d7b96e]" />
          <span className="mt-3 block h-3 w-4/5 rounded bg-white/90" />
          <span className="mt-2 block h-1.5 w-3/5 rounded bg-white/30" />
        </div>
        <div className="grid grid-cols-3 gap-2 p-3">
          {[0, 1, 2].map((item) => <span key={item} className="aspect-square rounded bg-[#ece8df]" />)}
        </div>
      </div>
      <div className="flex items-center justify-center">
        <div className="h-full w-[72%] rounded-[10px] border-2 border-[#182431] bg-white p-2">
          <span className="block h-4 w-4 rounded-full bg-[#d7b96e]" />
          <span className="mt-3 block h-2 w-3/4 rounded bg-[#0b1723]" />
          {[0, 1, 2].map((item) => <span key={item} className="mt-2 block h-5 rounded bg-[#f0ece4]" />)}
        </div>
      </div>
    </div>
  );
}
