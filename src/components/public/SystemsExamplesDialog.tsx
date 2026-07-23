import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDot,
  Laptop,
  LayoutDashboard,
  Link2,
  Monitor,
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
type DeviceMode = 'desktop' | 'mobile';

interface ExampleModel {
  title: string;
  segment: string;
  description: string;
  features: string[];
  variant: PreviewVariant;
  label: string;
  objective: string;
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
    title: 'Experiências para apresentar e gerar confiança',
    description: 'Estruturas demonstrativas para empresas que precisam explicar seus serviços, fortalecer credibilidade e facilitar o contato.',
    icon: CircleDot,
    examples: [
      {
        title: 'Institucional executivo',
        segment: 'Empresas e consultorias',
        description: 'Página sóbria com posicionamento, serviços, diferenciais, equipe e chamada comercial bem definida.',
        features: ['Página inicial estratégica', 'Serviços organizados', 'Contato e WhatsApp'],
        variant: 'institutional',
        label: 'Autoridade',
        objective: 'Apresentar uma empresa complexa de forma clara e confiável.',
      },
      {
        title: 'Site de serviços',
        segment: 'Profissionais e prestadores',
        description: 'Estrutura direta para explicar especialidades, etapas do atendimento e formas de contratação.',
        features: ['Catálogo de serviços', 'Perguntas frequentes', 'Formulário de orçamento'],
        variant: 'institutional',
        label: 'Conversão',
        objective: 'Levar o visitante da descoberta ao contato sem caminhos desnecessários.',
      },
      {
        title: 'Landing page comercial',
        segment: 'Campanhas e lançamentos',
        description: 'Página focada em uma oferta, com benefícios, provas e uma ação principal para o visitante.',
        features: ['Oferta em destaque', 'Benefícios e provas', 'Chamada para ação'],
        variant: 'institutional',
        label: 'Campanha',
        objective: 'Concentrar a atenção em uma oferta e estimular uma ação específica.',
      },
    ],
  },
  stores: {
    eyebrow: 'Lojas virtuais',
    title: 'Experiências para apresentar produtos e vender',
    description: 'Modelos de operação digital para catálogo, compra, pagamento e acompanhamento comercial.',
    icon: ShoppingBag,
    examples: [
      {
        title: 'Loja de produtos',
        segment: 'Varejo e marcas próprias',
        description: 'Vitrine com categorias, busca, página de produto, carrinho e fluxo de pedido organizado.',
        features: ['Catálogo e filtros', 'Carrinho e checkout', 'Gestão de pedidos'],
        variant: 'commerce',
        label: 'E-commerce',
        objective: 'Reduzir esforço na escolha e conduzir o cliente até a compra.',
      },
      {
        title: 'Catálogo comercial',
        segment: 'Atacado e vendas consultivas',
        description: 'Apresentação de linhas e produtos com solicitação de cotação ou atendimento comercial.',
        features: ['Categorias comerciais', 'Pedido de cotação', 'Atendimento integrado'],
        variant: 'commerce',
        label: 'B2B',
        objective: 'Organizar produtos e preparar oportunidades para a equipe comercial.',
      },
      {
        title: 'Serviços e assinaturas',
        segment: 'Planos, clubes e recorrência',
        description: 'Página para comparar opções, explicar benefícios e conduzir o cliente à contratação recorrente.',
        features: ['Comparação de planos', 'Cobrança recorrente', 'Área do assinante'],
        variant: 'commerce',
        label: 'Recorrência',
        objective: 'Facilitar a comparação e tornar a contratação contínua mais simples.',
      },
    ],
  },
  systems: {
    eyebrow: 'Sistemas personalizados',
    title: 'Ambientes para controlar processos e decisões',
    description: 'Demonstrações de produtos internos para centralizar dados, tarefas, usuários, indicadores e histórico.',
    icon: LayoutDashboard,
    examples: [
      {
        title: 'Gestão operacional',
        segment: 'Equipes e processos internos',
        description: 'Painel para acompanhar solicitações, responsáveis, prazos, documentos e andamento das atividades.',
        features: ['Painel de indicadores', 'Fluxos por status', 'Histórico de ações'],
        variant: 'dashboard',
        label: 'Operação',
        objective: 'Dar visão diária do trabalho e reduzir controles espalhados.',
      },
      {
        title: 'Financeiro e contratos',
        segment: 'Controle administrativo',
        description: 'Ambiente para organizar receitas, despesas, cobranças, contratos, vencimentos e relatórios.',
        features: ['Lançamentos financeiros', 'Alertas de vencimento', 'Relatórios gerenciais'],
        variant: 'dashboard',
        label: 'Controle',
        objective: 'Centralizar compromissos financeiros e melhorar a tomada de decisão.',
      },
      {
        title: 'Atendimento e solicitações',
        segment: 'Clientes e equipes',
        description: 'Sistema para registrar demandas, distribuir atendimentos e acompanhar cada solicitação até a conclusão.',
        features: ['Fila de atendimento', 'Responsáveis e prioridades', 'Notificações e histórico'],
        variant: 'dashboard',
        label: 'Atendimento',
        objective: 'Evitar perda de demandas e tornar cada atendimento rastreável.',
      },
    ],
  },
  portals: {
    eyebrow: 'Portais e aplicativos',
    title: 'Experiências de acesso e relacionamento',
    description: 'Áreas seguras para clientes, equipes e parceiros acessarem serviços e informações em qualquer tela.',
    icon: Smartphone,
    examples: [
      {
        title: 'Portal do cliente',
        segment: 'Serviços e relacionamento',
        description: 'Área para acompanhar solicitações, documentos, pagamentos, mensagens e informações da conta.',
        features: ['Login seguro', 'Acompanhamento de solicitações', 'Documentos e pagamentos'],
        variant: 'portal',
        label: 'Cliente',
        objective: 'Dar autonomia ao cliente sem perder organização no atendimento.',
      },
      {
        title: 'Portal do prestador',
        segment: 'Rede de parceiros',
        description: 'Ambiente para receber demandas, atualizar etapas, anexar comprovantes e consultar histórico.',
        features: ['Distribuição de demandas', 'Atualização de status', 'Envio de documentos'],
        variant: 'portal',
        label: 'Parceiros',
        objective: 'Conectar a rede de execução à operação principal da empresa.',
      },
      {
        title: 'Aplicativo de atendimento',
        segment: 'Uso frequente no celular',
        description: 'Experiência mobile para acessar serviços, receber avisos e resolver solicitações com poucos passos.',
        features: ['Navegação mobile', 'Notificações', 'Atalhos de atendimento'],
        variant: 'portal',
        label: 'Mobile',
        objective: 'Colocar as ações mais importantes ao alcance do usuário no celular.',
      },
    ],
  },
  automations: {
    eyebrow: 'Automações',
    title: 'Fluxos que executam tarefas e regras automaticamente',
    description: 'Demonstrações de rotinas que recebem informações, tomam decisões e acionam pessoas ou sistemas.',
    icon: Workflow,
    examples: [
      {
        title: 'Entrada e distribuição de leads',
        segment: 'Comercial e atendimento',
        description: 'Recebe contatos, classifica informações e direciona cada oportunidade ao responsável adequado.',
        features: ['Captura automática', 'Regras de distribuição', 'Avisos para a equipe'],
        variant: 'flow',
        label: 'Comercial',
        objective: 'Responder mais rápido e evitar oportunidades sem responsável.',
      },
      {
        title: 'Cobranças e vencimentos',
        segment: 'Financeiro',
        description: 'Monitora datas, identifica pendências e dispara lembretes ou tarefas de acompanhamento.',
        features: ['Controle de datas', 'Lembretes automáticos', 'Registro de tentativas'],
        variant: 'flow',
        label: 'Financeiro',
        objective: 'Reduzir esquecimentos e padronizar o acompanhamento de pendências.',
      },
      {
        title: 'Aprovação de documentos',
        segment: 'Administrativo e contratos',
        description: 'Organiza envio, análise, correção e aprovação de documentos em uma sequência padronizada.',
        features: ['Etapas de aprovação', 'Notificações por status', 'Histórico e responsáveis'],
        variant: 'flow',
        label: 'Processos',
        objective: 'Eliminar dúvidas sobre etapa, responsável e versão do documento.',
      },
    ],
  },
  integrations: {
    eyebrow: 'Integrações',
    title: 'Conexões para manter ferramentas e dados alinhados',
    description: 'Demonstrações de comunicação entre plataformas para reduzir digitação repetida e atualizar informações automaticamente.',
    icon: Link2,
    examples: [
      {
        title: 'Pagamentos e financeiro',
        segment: 'Cobranças e conciliação',
        description: 'Conecta pedidos, cobranças, confirmação de pagamentos e atualização automática do sistema.',
        features: ['Gateway de pagamento', 'Baixa automática', 'Atualização de status'],
        variant: 'integration',
        label: 'Pagamentos',
        objective: 'Fazer a confirmação financeira atualizar a operação sem intervenção manual.',
      },
      {
        title: 'CRM e atendimento',
        segment: 'Comercial e relacionamento',
        description: 'Integra formulários, WhatsApp, cadastro de contatos e histórico do atendimento comercial.',
        features: ['Captura de contatos', 'Sincronização de dados', 'Histórico centralizado'],
        variant: 'integration',
        label: 'Relacionamento',
        objective: 'Manter o contexto do cliente disponível durante toda a conversa comercial.',
      },
      {
        title: 'Marketplace e operação',
        segment: 'Pedidos, estoque e gestão',
        description: 'Mantém pedidos, produtos e informações operacionais conectados entre diferentes plataformas.',
        features: ['Sincronização de pedidos', 'Atualização de produtos', 'Controle de eventos'],
        variant: 'integration',
        label: 'Operação',
        objective: 'Evitar divergências entre canais de venda e operação interna.',
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const data = category ? categories[category] : null;
  const model = useMemo(() => data?.examples[selectedIndex] || null, [data, selectedIndex]);
  const CategoryIcon = data?.icon;

  useEffect(() => {
    setSelectedIndex(0);
    setDevice('desktop');
  }, [category]);

  const changeModel = (nextIndex: number) => {
    if (!data) return;
    setSelectedIndex((nextIndex + data.examples.length) % data.examples.length);
  };

  return (
    <AccessibleDialog
      isOpen={Boolean(data)}
      onClose={onClose}
      ariaLabel={data ? `Laboratório de demonstração de ${data.eyebrow}` : 'Laboratório de produtos digitais'}
      overlayClassName="items-center justify-center overflow-y-auto bg-[#02070d]/88 p-2 backdrop-blur-md sm:p-5"
      panelClassName="max-h-[94dvh] max-w-7xl overflow-hidden rounded-xl border border-cyan-300/16 bg-[#07101b] shadow-[0_35px_110px_rgba(0,0,0,0.68)]"
    >
      {data && model && CategoryIcon && (
        <div className="flex max-h-[94dvh] min-h-0 flex-col text-white">
          <header className="shrink-0 border-b border-white/8 bg-[#0a1522] px-3 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-300"><CategoryIcon className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-cyan-300">Ambiente de demonstração</p>
                <h2 className="mt-0.5 truncate text-sm font-black sm:text-base">{data.eyebrow}</h2>
              </div>

              <div className="hidden items-center rounded-lg border border-white/10 bg-black/20 p-1 sm:flex" aria-label="Escolher dispositivo da demonstração">
                <button type="button" onClick={() => setDevice('desktop')} className={`flex h-8 items-center gap-2 rounded-md px-3 text-[10px] font-black transition ${device === 'desktop' ? 'bg-cyan-300 text-[#07101b]' : 'text-slate-400 hover:text-white'}`}><Laptop className="h-3.5 w-3.5" /> Computador</button>
                <button type="button" onClick={() => setDevice('mobile')} className={`flex h-8 items-center gap-2 rounded-md px-3 text-[10px] font-black transition ${device === 'mobile' ? 'bg-cyan-300 text-[#07101b]' : 'text-slate-400 hover:text-white'}`}><Smartphone className="h-3.5 w-3.5" /> Celular</button>
              </div>

              <button type="button" onClick={onClose} data-dialog-autofocus aria-label="Fechar demonstração" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"><X className="h-4 w-4" /></button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[250px_minmax(0,1fr)_310px] lg:overflow-hidden">
            <aside className="border-b border-white/8 bg-[#08121e] p-4 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">Escolha um cenário</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{data.description}</p>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                {data.examples.map((item, index) => (
                  <button key={item.title} type="button" onClick={() => setSelectedIndex(index)} className={`min-w-[200px] rounded-lg border p-3 text-left transition lg:min-w-0 lg:w-full ${index === selectedIndex ? 'border-cyan-300/40 bg-cyan-300/10' : 'border-white/8 bg-white/[0.02] hover:border-white/18'}`}>
                    <div className="flex items-center justify-between gap-3"><span className={`text-[9px] font-black tracking-[0.16em] ${index === selectedIndex ? 'text-cyan-300' : 'text-slate-600'}`}>0{index + 1}</span><span className={`rounded-full px-2 py-0.5 text-[7px] font-black uppercase tracking-wider ${index === selectedIndex ? 'bg-cyan-300 text-[#07101b]' : 'bg-white/5 text-slate-500'}`}>{item.label}</span></div>
                    <strong className="mt-3 block text-xs text-white">{item.title}</strong>
                    <span className="mt-1 block text-[9px] text-slate-500">{item.segment}</span>
                  </button>
                ))}
              </div>

              <div className="mt-5 flex rounded-lg border border-white/10 bg-black/20 p-1 sm:hidden">
                <button type="button" onClick={() => setDevice('desktop')} className={`flex flex-1 items-center justify-center gap-2 rounded-md px-2 py-2 text-[9px] font-black ${device === 'desktop' ? 'bg-cyan-300 text-[#07101b]' : 'text-slate-500'}`}><Laptop className="h-3.5 w-3.5" /> Computador</button>
                <button type="button" onClick={() => setDevice('mobile')} className={`flex flex-1 items-center justify-center gap-2 rounded-md px-2 py-2 text-[9px] font-black ${device === 'mobile' ? 'bg-cyan-300 text-[#07101b]' : 'text-slate-500'}`}><Smartphone className="h-3.5 w-3.5" /> Celular</button>
              </div>
            </aside>

            <section className="flex min-h-[430px] flex-col bg-[#0a1522] p-3 sm:p-5 lg:min-h-0 lg:overflow-y-auto lg:p-7">
              <div className="flex items-center justify-between gap-4">
                <div><p className="text-[8px] font-black uppercase tracking-[0.18em] text-cyan-300">Prévia interativa</p><p className="mt-1 text-[10px] text-slate-500">Visualização conceitual em {device === 'desktop' ? 'computador' : 'celular'}</p></div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-300" /><span className="text-[8px] font-black uppercase tracking-wider text-emerald-300">Demonstração ativa</span></div>
              </div>

              <div className="mt-4 flex min-h-[330px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-white/8 bg-[#050b12] p-3 sm:p-5">
                <ProductDemo variant={model.variant} device={device} label={model.label} />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <button type="button" onClick={() => changeModel(selectedIndex - 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-cyan-300/35 hover:text-cyan-300" aria-label="Demonstração anterior"><ArrowLeft className="h-4 w-4" /></button>
                <div className="flex gap-1.5">{data.examples.map((item, index) => <button key={item.title} type="button" onClick={() => setSelectedIndex(index)} aria-label={`Abrir ${item.title}`} className={`h-1.5 rounded-full transition ${index === selectedIndex ? 'w-8 bg-cyan-300' : 'w-3 bg-white/15'}`} />)}</div>
                <button type="button" onClick={() => changeModel(selectedIndex + 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-cyan-300/35 hover:text-cyan-300" aria-label="Próxima demonstração"><ArrowRight className="h-4 w-4" /></button>
              </div>
            </section>

            <aside className="border-t border-white/8 bg-[#08121e] p-5 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:p-6">
              <span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/8 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-cyan-300">{model.segment}</span>
              <h3 className="mt-5 text-2xl font-black leading-tight tracking-[-0.025em]">{model.title}</h3>
              <p className="mt-4 text-sm leading-6 text-slate-400">{model.description}</p>

              <div className="mt-6 rounded-lg border border-cyan-300/12 bg-cyan-300/[0.035] p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.17em] text-cyan-300">Objetivo do cenário</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-200">{model.objective}</p>
              </div>

              <div className="mt-6 border-t border-white/8 pt-5">
                <p className="text-[8px] font-black uppercase tracking-[0.17em] text-slate-500">Recursos demonstrados</p>
                <ul className="mt-4 space-y-3">
                  {model.features.map((feature) => <li key={feature} className="flex items-start gap-2.5 text-xs font-semibold leading-5 text-slate-300"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" strokeWidth={3} />{feature}</li>)}
                </ul>
              </div>

              <button type="button" onClick={() => { onClose(); onRequestBudget(); }} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-5 py-3.5 text-sm font-black text-[#07101b] transition hover:bg-cyan-200">Solicitar projeto semelhante <ArrowRight className="h-4 w-4" /></button>
              <p className="mt-3 text-center text-[9px] leading-4 text-slate-600">A estrutura final é personalizada para a identidade, os usuários e as regras do negócio.</p>
            </aside>
          </div>
        </div>
      )}
    </AccessibleDialog>
  );
}

function ProductDemo({ variant, device, label }: { variant: PreviewVariant; device: DeviceMode; label: string }) {
  return (
    <div className={`transition-all duration-300 ${device === 'mobile' ? 'w-[230px]' : 'w-full max-w-3xl'}`}>
      <div className={`overflow-hidden border border-white/12 bg-white shadow-[0_28px_70px_rgba(0,0,0,0.45)] ${device === 'mobile' ? 'rounded-[1.8rem] border-[5px] border-[#1b2b3c]' : 'rounded-xl'}`}>
        <div className={`flex items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-3 ${device === 'mobile' ? 'h-7 justify-center' : 'h-9'}`}>
          {device === 'desktop' && <><span className="h-2 w-2 rounded-full bg-rose-300" /><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="h-2 w-2 rounded-full bg-emerald-300" /><span className="mx-auto h-4 w-2/5 rounded bg-slate-200" /></>}
          {device === 'mobile' && <span className="h-1.5 w-14 rounded-full bg-slate-300" />}
          <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[6px] font-black uppercase tracking-wider text-cyan-800">{label}</span>
        </div>
        <div className={`${device === 'mobile' ? 'h-[390px]' : 'aspect-[16/10] min-h-[330px]'}`}>
          {variant === 'institutional' && <InstitutionalScene mobile={device === 'mobile'} />}
          {variant === 'commerce' && <CommerceScene mobile={device === 'mobile'} />}
          {variant === 'dashboard' && <DashboardScene mobile={device === 'mobile'} />}
          {variant === 'portal' && <PortalScene mobile={device === 'mobile'} />}
          {variant === 'flow' && <FlowScene mobile={device === 'mobile'} />}
          {variant === 'integration' && <IntegrationScene mobile={device === 'mobile'} />}
        </div>
      </div>
    </div>
  );
}

function InstitutionalScene({ mobile }: { mobile: boolean }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-11 items-center justify-between border-b border-slate-100 px-4"><span className="h-5 w-16 rounded bg-[#0b1623]" /><div className="flex gap-2">{[0, 1, 2].map((item) => <span key={item} className="h-1.5 w-8 rounded bg-slate-200" />)}</div></div>
      <div className={`grid flex-1 bg-[#0b1623] ${mobile ? 'grid-rows-[1fr_0.7fr]' : 'grid-cols-[1.15fr_0.85fr]'}`}>
        <div className="flex flex-col justify-center p-5 sm:p-8"><span className="h-1.5 w-16 rounded bg-cyan-300" /><span className="mt-4 h-5 w-4/5 rounded bg-white" /><span className="mt-2 h-3 w-3/5 rounded bg-white/25" /><span className="mt-5 h-9 w-28 rounded-lg bg-cyan-300" /></div>
        <div className="m-4 rounded-xl border border-white/8 bg-white/5 p-4"><div className="h-full rounded-lg bg-[linear-gradient(135deg,rgba(103,232,249,0.18),rgba(255,255,255,0.03))]" /></div>
      </div>
      {!mobile && <div className="grid grid-cols-3 gap-3 p-4">{[0, 1, 2].map((item) => <div key={item} className="rounded-lg border border-slate-200 p-3"><span className="block h-6 w-6 rounded-md bg-[#0b1623]" /><span className="mt-3 block h-2 w-3/4 rounded bg-slate-200" /><span className="mt-2 block h-1.5 w-full rounded bg-slate-100" /></div>)}</div>}
    </div>
  );
}

function CommerceScene({ mobile }: { mobile: boolean }) {
  return (
    <div className={`grid h-full bg-slate-50 ${mobile ? 'grid-rows-[48px_1fr]' : 'grid-cols-[70px_1fr]'}`}>
      <div className={`${mobile ? 'flex items-center gap-3 border-b px-3' : 'border-r p-3'} border-slate-200 bg-white`}><span className="block h-7 w-7 rounded-lg bg-[#0b1623]" />{[0, 1, 2].map((item) => <span key={item} className={`${mobile ? 'h-2 flex-1' : 'mt-4 block h-2'} rounded bg-slate-200`} />)}</div>
      <div className="p-4 sm:p-6"><div className="flex items-center justify-between"><span className="h-4 w-28 rounded bg-[#0b1623]" /><span className="h-8 w-20 rounded-lg bg-cyan-300" /></div><div className={`mt-5 grid gap-3 ${mobile ? 'grid-cols-2' : 'grid-cols-3'}`}>{[0, 1, 2, 3, 4, 5].slice(0, mobile ? 4 : 6).map((item) => <div key={item} className="rounded-lg border border-slate-200 bg-white p-2"><div className="aspect-square rounded-md bg-slate-100" /><span className="mt-2 block h-2 w-4/5 rounded bg-slate-200" /><span className="mt-2 block h-3 w-2/5 rounded bg-cyan-500" /></div>)}</div></div>
    </div>
  );
}

function DashboardScene({ mobile }: { mobile: boolean }) {
  return (
    <div className={`grid h-full bg-[#f4f7f9] ${mobile ? 'grid-rows-[54px_1fr]' : 'grid-cols-[68px_1fr]'}`}>
      <div className={`${mobile ? 'flex items-center gap-3 px-3' : 'p-3'} bg-[#0b1623]`}><span className="block h-8 w-8 rounded-lg bg-cyan-300" />{[0, 1, 2].map((item) => <span key={item} className={`${mobile ? 'h-2 flex-1' : 'mt-4 block h-8'} rounded-lg bg-white/8`} />)}</div>
      <div className="p-4 sm:p-6"><div className={`grid gap-3 ${mobile ? 'grid-cols-2' : 'grid-cols-3'}`}>{[0, 1, 2].slice(0, mobile ? 2 : 3).map((item) => <div key={item} className="rounded-lg border border-slate-200 bg-white p-3"><span className="block h-2 w-2/3 rounded bg-slate-200" /><span className="mt-3 block h-5 w-1/3 rounded bg-[#0b1623]" /></div>)}</div><div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">{[0, 1, 2, 3].map((item) => <div key={item} className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-0"><span className="h-2.5 w-2.5 rounded-full bg-cyan-300" /><span className="h-2 flex-1 rounded bg-slate-100" /><span className="h-5 w-14 rounded bg-slate-100" /></div>)}</div></div>
    </div>
  );
}

function PortalScene({ mobile }: { mobile: boolean }) {
  return (
    <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#e8f5f8,#f5f7f9)] p-5">
      <div className={`${mobile ? 'h-full w-full rounded-2xl' : 'h-[88%] w-[48%] rounded-[1.8rem]'} border-[4px] border-[#0b1623] bg-white p-4 shadow-xl`}><div className="flex items-center justify-between"><span className="h-7 w-20 rounded-lg bg-[#0b1623]" /><span className="h-8 w-8 rounded-full bg-cyan-300" /></div><span className="mt-6 block h-3 w-2/3 rounded bg-slate-200" /><div className="mt-4 grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((item) => <div key={item} className="rounded-xl bg-slate-50 p-3"><span className="block h-8 w-8 rounded-lg bg-cyan-100" /><span className="mt-4 block h-2 w-3/4 rounded bg-slate-200" /></div>)}</div><div className="mt-4 h-10 rounded-lg bg-[#0b1623]" /></div>
    </div>
  );
}

function FlowScene({ mobile }: { mobile: boolean }) {
  const steps = ['Entrada', 'Validação', 'Regra', 'Ação'];
  return (
    <div className="flex h-full items-center justify-center bg-[#f3f7f9] p-5">
      <div className={`flex w-full items-center justify-center gap-2 ${mobile ? 'flex-col' : ''}`}>{steps.map((step, index) => <div key={step} className="contents"><div className={`rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm ${mobile ? 'w-full' : 'flex-1'}`}><span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#0b1623] text-xs font-black text-cyan-300">{index + 1}</span><strong className="mt-3 block text-[10px] text-slate-700">{step}</strong><span className="mt-2 block h-1.5 w-full rounded bg-slate-100" /></div>{index < steps.length - 1 && <ArrowRight className={`h-4 w-4 shrink-0 text-cyan-600 ${mobile ? 'rotate-90' : ''}`} />}</div>)}</div>
    </div>
  );
}

function IntegrationScene({ mobile }: { mobile: boolean }) {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-[#f2f7f9] p-5">
      <div className={`grid w-full gap-4 ${mobile ? 'grid-cols-2' : 'grid-cols-[1fr_120px_1fr]'}`}>
        <div className="space-y-3">{['Formulário', 'WhatsApp', 'Loja'].map((item) => <div key={item} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><span className="block h-7 w-7 rounded-lg bg-slate-100" /><strong className="mt-2 block text-[9px] text-slate-600">{item}</strong></div>)}</div>
        {!mobile && <div className="flex items-center justify-center"><span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#0b1623] text-cyan-300 shadow-xl"><Link2 className="h-7 w-7" /></span></div>}
        <div className="space-y-3">{['CRM', 'Financeiro', 'Operação'].map((item) => <div key={item} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><span className="block h-7 w-7 rounded-lg bg-cyan-100" /><strong className="mt-2 block text-[9px] text-slate-600">{item}</strong></div>)}</div>
      </div>
      {mobile && <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-[#0b1623] text-cyan-300 shadow-xl"><Link2 className="h-5 w-5" /></span>}
    </div>
  );
}
