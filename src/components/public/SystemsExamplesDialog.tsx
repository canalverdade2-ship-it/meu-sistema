import {
  ArrowRight,
  Check,
  CircleDot,
  LayoutDashboard,
  Link2,
  ShoppingBag,
  Smartphone,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AccessibleDialog } from '../ui/AccessibleDialog';

export type SystemExampleCategory =
  | 'sites'
  | 'stores'
  | 'systems'
  | 'portals'
  | 'automations'
  | 'integrations';

type PreviewVariant = 'institutional' | 'commerce' | 'dashboard' | 'portal' | 'flow' | 'integration';

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

const categories: Record<SystemExampleCategory, CategoryData> = {
  sites: {
    eyebrow: 'Sites institucionais',
    title: 'Modelos de apresentação profissional',
    description: 'Referências de estrutura para empresas que precisam apresentar serviços, gerar confiança e facilitar o contato com o cliente.',
    icon: CircleDot,
    examples: [
      {
        title: 'Institucional executivo',
        segment: 'Empresas e consultorias',
        description: 'Página sóbria com posicionamento, serviços, diferenciais, equipe e chamada comercial bem definida.',
        features: ['Página inicial estratégica', 'Serviços organizados', 'Contato e WhatsApp'],
        variant: 'institutional',
        label: 'Autoridade',
      },
      {
        title: 'Site de serviços',
        segment: 'Profissionais e prestadores',
        description: 'Estrutura direta para explicar especialidades, etapas do atendimento e formas de contratação.',
        features: ['Catálogo de serviços', 'Perguntas frequentes', 'Formulário de orçamento'],
        variant: 'institutional',
        label: 'Conversão',
      },
      {
        title: 'Landing page comercial',
        segment: 'Campanhas e lançamentos',
        description: 'Página focada em uma oferta, com conteúdo objetivo, benefícios e uma ação principal para o visitante.',
        features: ['Oferta em destaque', 'Benefícios e provas', 'Chamada para ação'],
        variant: 'institutional',
        label: 'Campanha',
      },
    ],
  },
  stores: {
    eyebrow: 'Lojas virtuais',
    title: 'Modelos para venda digital',
    description: 'Estruturas pensadas para apresentar produtos com clareza, facilitar a compra e organizar a operação comercial.',
    icon: ShoppingBag,
    examples: [
      {
        title: 'Loja de produtos',
        segment: 'Varejo e marcas próprias',
        description: 'Vitrine com categorias, busca, página de produto, carrinho e fluxo de pedido organizado.',
        features: ['Catálogo e filtros', 'Carrinho e checkout', 'Gestão de pedidos'],
        variant: 'commerce',
        label: 'E-commerce',
      },
      {
        title: 'Catálogo comercial',
        segment: 'Atacado e vendas consultivas',
        description: 'Apresentação de linhas e produtos com solicitação de cotação ou atendimento da equipe comercial.',
        features: ['Categorias comerciais', 'Pedido de cotação', 'Atendimento integrado'],
        variant: 'commerce',
        label: 'B2B',
      },
      {
        title: 'Serviços e assinaturas',
        segment: 'Planos, clubes e recorrência',
        description: 'Página para comparar opções, explicar benefícios e conduzir o cliente à contratação recorrente.',
        features: ['Comparação de planos', 'Cobrança recorrente', 'Área do assinante'],
        variant: 'commerce',
        label: 'Recorrência',
      },
    ],
  },
  systems: {
    eyebrow: 'Sistemas personalizados',
    title: 'Modelos de gestão e operação',
    description: 'Exemplos de ambientes internos para centralizar dados, processos, usuários, indicadores e rotinas da empresa.',
    icon: LayoutDashboard,
    examples: [
      {
        title: 'Gestão operacional',
        segment: 'Equipes e processos internos',
        description: 'Painel para acompanhar solicitações, responsáveis, prazos, documentos e andamento das atividades.',
        features: ['Painel de indicadores', 'Fluxos por status', 'Histórico de ações'],
        variant: 'dashboard',
        label: 'Operação',
      },
      {
        title: 'Financeiro e contratos',
        segment: 'Controle administrativo',
        description: 'Ambiente para organizar receitas, despesas, cobranças, contratos, vencimentos e relatórios.',
        features: ['Lançamentos financeiros', 'Alertas de vencimento', 'Relatórios gerenciais'],
        variant: 'dashboard',
        label: 'Controle',
      },
      {
        title: 'Atendimento e solicitações',
        segment: 'Clientes e equipes',
        description: 'Sistema para registrar demandas, distribuir atendimentos e acompanhar cada solicitação até a conclusão.',
        features: ['Fila de atendimento', 'Responsáveis e prioridades', 'Notificações e histórico'],
        variant: 'dashboard',
        label: 'Atendimento',
      },
    ],
  },
  portals: {
    eyebrow: 'Portais e aplicativos',
    title: 'Modelos de acesso e relacionamento',
    description: 'Referências para áreas seguras em que clientes, equipes ou parceiros acessam serviços e informações pelo celular ou computador.',
    icon: Smartphone,
    examples: [
      {
        title: 'Portal do cliente',
        segment: 'Serviços e relacionamento',
        description: 'Área para acompanhar solicitações, documentos, pagamentos, mensagens e informações da conta.',
        features: ['Login seguro', 'Acompanhamento de solicitações', 'Documentos e pagamentos'],
        variant: 'portal',
        label: 'Cliente',
      },
      {
        title: 'Portal do prestador',
        segment: 'Rede de parceiros',
        description: 'Ambiente para receber demandas, atualizar etapas, anexar comprovantes e consultar histórico.',
        features: ['Distribuição de demandas', 'Atualização de status', 'Envio de documentos'],
        variant: 'portal',
        label: 'Parceiros',
      },
      {
        title: 'Aplicativo de atendimento',
        segment: 'Uso frequente no celular',
        description: 'Experiência mobile para acessar serviços, receber avisos e resolver solicitações com poucos passos.',
        features: ['Navegação mobile', 'Notificações', 'Atalhos de atendimento'],
        variant: 'portal',
        label: 'Mobile',
      },
    ],
  },
  automations: {
    eyebrow: 'Automações',
    title: 'Modelos de fluxos automáticos',
    description: 'Exemplos de rotinas que podem reduzir atividades manuais, organizar etapas e avisar a equipe no momento certo.',
    icon: Workflow,
    examples: [
      {
        title: 'Entrada e distribuição de leads',
        segment: 'Comercial e atendimento',
        description: 'Recebe contatos, classifica informações e direciona cada oportunidade para o responsável adequado.',
        features: ['Captura automática', 'Regras de distribuição', 'Avisos para a equipe'],
        variant: 'flow',
        label: 'Comercial',
      },
      {
        title: 'Cobranças e vencimentos',
        segment: 'Financeiro',
        description: 'Monitora datas, identifica pendências e dispara lembretes ou tarefas de acompanhamento.',
        features: ['Controle de datas', 'Lembretes automáticos', 'Registro de tentativas'],
        variant: 'flow',
        label: 'Financeiro',
      },
      {
        title: 'Aprovação de documentos',
        segment: 'Administrativo e contratos',
        description: 'Organiza envio, análise, correção e aprovação de documentos em uma sequência padronizada.',
        features: ['Etapas de aprovação', 'Notificações por status', 'Histórico e responsáveis'],
        variant: 'flow',
        label: 'Processos',
      },
    ],
  },
  integrations: {
    eyebrow: 'Integrações',
    title: 'Modelos de conexão entre plataformas',
    description: 'Exemplos de integrações para manter dados alinhados e evitar que a equipe repita as mesmas informações em vários sistemas.',
    icon: Link2,
    examples: [
      {
        title: 'Pagamentos e financeiro',
        segment: 'Cobranças e conciliação',
        description: 'Conecta pedidos, cobranças, confirmação de pagamentos e atualização automática do sistema.',
        features: ['Gateway de pagamento', 'Baixa automática', 'Atualização de status'],
        variant: 'integration',
        label: 'Pagamentos',
      },
      {
        title: 'CRM e atendimento',
        segment: 'Comercial e relacionamento',
        description: 'Integra formulários, WhatsApp, cadastro de contatos e histórico do atendimento comercial.',
        features: ['Captura de contatos', 'Sincronização de dados', 'Histórico centralizado'],
        variant: 'integration',
        label: 'Relacionamento',
      },
      {
        title: 'Marketplace e operação',
        segment: 'Pedidos, estoque e gestão',
        description: 'Mantém pedidos, produtos e informações operacionais conectados entre diferentes plataformas.',
        features: ['Sincronização de pedidos', 'Atualização de produtos', 'Controle de eventos'],
        variant: 'integration',
        label: 'Operação',
      },
    ],
  },
};

interface SystemsExamplesDialogProps {
  category: SystemExampleCategory | null;
  onClose: () => void;
  onRequestBudget: () => void;
}

export function SystemsExamplesDialog({ category, onClose, onRequestBudget }: SystemsExamplesDialogProps) {
  const data = category ? categories[category] : null;
  const CategoryIcon = data?.icon;

  return (
    <AccessibleDialog
      isOpen={Boolean(data)}
      onClose={onClose}
      ariaLabel={data ? `Modelos de ${data.eyebrow}` : 'Modelos de soluções digitais'}
      overlayClassName="items-end justify-center overflow-y-auto bg-[#03070d]/80 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      panelClassName="max-h-[96dvh] max-w-6xl overflow-hidden rounded-t-[1.5rem] border border-white/12 bg-[#f6f4ef] shadow-[0_28px_90px_rgba(0,0,0,0.48)] sm:max-h-[92dvh] sm:rounded-[1.5rem]"
    >
      {data && CategoryIcon && (
        <div className="flex max-h-[96dvh] min-h-0 flex-col sm:max-h-[92dvh]">
          <header className="shrink-0 border-b border-white/10 bg-[#08131f] px-4 py-4 text-white sm:px-6 sm:py-5 lg:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-[#d7b96e]/12 text-[#d7b96e] sm:h-11 sm:w-11">
                  <CategoryIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.17em] text-[#d7b96e]">{data.eyebrow}</p>
                  <h2 className="mt-1 text-xl font-black leading-tight tracking-[-0.02em] sm:text-2xl">{data.title}</h2>
                  <p className="mt-2 hidden max-w-3xl text-sm leading-6 text-white/62 sm:block">{data.description}</p>
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

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
            <div className="rounded-[10px] border border-[#dfd9cf] bg-white px-4 py-3 sm:hidden">
              <p className="text-xs leading-5 text-neutral-600">{data.description}</p>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 sm:mt-0">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#80672c]">Referências para análise</p>
                <p className="mt-1 text-xs text-neutral-500">Modelos conceituais que podem ser adaptados à identidade e às regras do seu negócio.</p>
              </div>
              <span className="hidden shrink-0 rounded-full border border-[#d9d2c5] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600 sm:inline-flex">
                3 modelos
              </span>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {data.examples.map((example) => (
                <article key={example.title} className="overflow-hidden rounded-[12px] border border-[#dcd6cb] bg-white shadow-[0_8px_22px_rgba(16,24,32,0.05)]">
                  <ExamplePreview variant={example.variant} label={example.label} />
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
                Os modelos servem como referência. Cores, estrutura, módulos e conteúdo são definidos para cada projeto.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestBudget();
                }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#0a1420] px-5 py-3 text-sm font-black text-white transition hover:bg-[#142434] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80672c] focus-visible:ring-offset-2"
              >
                Solicitar orçamento
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </footer>
        </div>
      )}
    </AccessibleDialog>
  );
}

function ExamplePreview({ variant, label }: { variant: PreviewVariant; label: string }) {
  return (
    <div className="relative aspect-[16/9] overflow-hidden border-b border-[#dfd9cf] bg-[#e9e5dc] p-3">
      <div className="flex h-full flex-col overflow-hidden rounded-[8px] border border-[#cfc8bb] bg-white shadow-sm">
        <div className="flex h-6 shrink-0 items-center gap-1.5 border-b border-[#e4dfd6] bg-[#f7f5f0] px-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
          <span className="ml-auto rounded-full bg-[#e8dfc4] px-2 py-0.5 text-[6px] font-black uppercase tracking-wider text-[#705a29]">{label}</span>
        </div>
        <div className="min-h-0 flex-1">
          {variant === 'institutional' && <InstitutionalPreview />}
          {variant === 'commerce' && <CommercePreview />}
          {variant === 'dashboard' && <DashboardPreview />}
          {variant === 'portal' && <PortalPreview />}
          {variant === 'flow' && <FlowPreview />}
          {variant === 'integration' && <IntegrationPreview />}
        </div>
      </div>
    </div>
  );
}

function InstitutionalPreview() {
  return (
    <div className="grid h-full grid-rows-[1.1fr_0.9fr]">
      <div className="grid grid-cols-[1.2fr_0.8fr] bg-[#0b1723] p-3">
        <div className="flex flex-col justify-center">
          <span className="h-1.5 w-12 rounded bg-[#d7b96e]" />
          <span className="mt-2 h-3 w-4/5 rounded bg-white/90" />
          <span className="mt-1.5 h-2 w-3/5 rounded bg-white/35" />
          <span className="mt-2.5 h-4 w-16 rounded bg-[#d7b96e]" />
        </div>
        <div className="m-1 rounded-md border border-white/10 bg-white/5 p-2">
          <div className="h-full rounded bg-white/8" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded border border-[#e4dfd6] p-2">
            <span className="block h-3 w-3 rounded bg-[#0b1723]" />
            <span className="mt-2 block h-1.5 w-4/5 rounded bg-neutral-300" />
            <span className="mt-1 block h-1 w-full rounded bg-neutral-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CommercePreview() {
  return (
    <div className="grid h-full grid-cols-[42px_1fr]">
      <div className="border-r border-[#e5e0d7] bg-[#f7f5f0] p-2">
        <span className="block h-4 rounded bg-[#0b1723]" />
        {[0, 1, 2, 3].map((item) => <span key={item} className="mt-2 block h-1.5 rounded bg-neutral-300" />)}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <span className="h-2.5 w-20 rounded bg-[#0b1723]" />
          <span className="h-4 w-12 rounded bg-[#d7b96e]" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="rounded border border-[#e4dfd6] p-1.5">
              <div className="aspect-square rounded bg-[#ece8df]" />
              <span className="mt-1.5 block h-1.5 w-4/5 rounded bg-neutral-300" />
              <span className="mt-1 block h-2 w-2/5 rounded bg-[#80672c]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="grid h-full grid-cols-[48px_1fr] bg-[#f7f8fa]">
      <div className="bg-[#0b1723] p-2">
        <span className="block h-5 rounded bg-[#d7b96e]" />
        {[0, 1, 2, 3].map((item) => <span key={item} className="mt-2 block h-2 rounded bg-white/15" />)}
      </div>
      <div className="p-3">
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="rounded border border-[#e0e3e7] bg-white p-2">
              <span className="block h-1.5 w-3/5 rounded bg-neutral-300" />
              <span className="mt-2 block h-3 w-2/5 rounded bg-[#0b1723]" />
            </div>
          ))}
        </div>
        <div className="mt-2 rounded border border-[#e0e3e7] bg-white p-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex items-center gap-2 border-b border-[#eef0f2] py-1.5 last:border-0">
              <span className="h-2 w-2 rounded-full bg-[#d7b96e]" />
              <span className="h-1.5 flex-1 rounded bg-neutral-200" />
              <span className="h-3 w-10 rounded bg-[#e8edf1]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PortalPreview() {
  return (
    <div className="flex h-full items-center justify-center bg-[#eef1f4] p-3">
      <div className="h-full w-[44%] rounded-[10px] border-2 border-[#182431] bg-white p-2 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="h-3 w-8 rounded bg-[#0b1723]" />
          <span className="h-3 w-3 rounded-full bg-[#d7b96e]" />
        </div>
        <span className="mt-3 block h-2 w-3/5 rounded bg-neutral-300" />
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {[0, 1, 2, 3].map((item) => <div key={item} className="aspect-[1.25] rounded bg-[#f1eee7] p-1.5"><span className="block h-2 w-2 rounded bg-[#80672c]" /></div>)}
        </div>
        <div className="mt-2 h-4 rounded bg-[#0b1723]" />
      </div>
    </div>
  );
}

function FlowPreview() {
  return (
    <div className="flex h-full items-center justify-center bg-[#f8f6f1] p-4">
      <div className="flex w-full items-center justify-between gap-1">
        {['Entrada', 'Regra', 'Ação'].map((item, index) => (
          <div key={item} className="contents">
            <div className="flex min-w-0 flex-1 flex-col items-center rounded border border-[#dcd6ca] bg-white p-2 text-center shadow-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0b1723] text-[7px] font-black text-[#d7b96e]">{index + 1}</span>
              <span className="mt-1.5 h-1.5 w-4/5 rounded bg-neutral-300" />
              <span className="mt-1 h-1 w-3/5 rounded bg-neutral-200" />
            </div>
            {index < 2 && <ArrowRight className="h-3 w-3 shrink-0 text-[#80672c]" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationPreview() {
  return (
    <div className="relative flex h-full items-center justify-center bg-[#f6f4ef] p-4">
      <div className="absolute left-5 top-4 h-8 w-14 rounded border border-[#dcd6ca] bg-white shadow-sm" />
      <div className="absolute right-5 top-4 h-8 w-14 rounded border border-[#dcd6ca] bg-white shadow-sm" />
      <div className="absolute bottom-4 left-5 h-8 w-14 rounded border border-[#dcd6ca] bg-white shadow-sm" />
      <div className="absolute bottom-4 right-5 h-8 w-14 rounded border border-[#dcd6ca] bg-white shadow-sm" />
      <div className="absolute left-[25%] right-[25%] top-1/2 h-px bg-[#c7b77f]" />
      <div className="absolute bottom-[25%] top-[25%] left-1/2 w-px bg-[#c7b77f]" />
      <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#0b1723] text-[#d7b96e] shadow-lg">
        <Link2 className="h-5 w-5" />
      </div>
    </div>
  );
}
