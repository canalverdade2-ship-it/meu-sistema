import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe2,
  Laptop,
  Link2,
  MonitorSmartphone,
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

type DeviceMode = 'desktop' | 'mobile';

interface ShowcaseModel {
  title: string;
  context: string;
  indication: string;
  description: string;
  includes: string[];
  result: string;
}

interface ShowcaseCategory {
  title: string;
  introduction: string;
  icon: LucideIcon;
  models: ShowcaseModel[];
}

const showcase: Record<SystemExampleCategory, ShowcaseCategory> = {
  sites: {
    title: 'Exemplos de sites institucionais',
    introduction: 'Referências para empresas que precisam apresentar serviços com clareza, credibilidade e uma chamada comercial bem definida.',
    icon: Globe2,
    models: [
      { title: 'Site corporativo', context: 'Consultorias e empresas de serviços', indication: 'Para negócios que precisam explicar uma atuação mais completa sem confundir o visitante.', description: 'Uma estrutura sóbria, organizada por prioridades: posicionamento, serviços, diferenciais, experiência e contato.', includes: ['Página inicial estratégica', 'Serviços organizados', 'Provas de confiança', 'Formulário e WhatsApp'], result: 'Uma presença institucional clara, confiável e preparada para gerar conversas comerciais.' },
      { title: 'Site para profissional ou escritório', context: 'Especialistas e prestadores', indication: 'Para quem vende conhecimento, atendimento ou serviços especializados.', description: 'A página apresenta especialidades, forma de trabalho, experiência e caminhos de contratação sem excesso de informação.', includes: ['Apresentação profissional', 'Áreas de atuação', 'Etapas do atendimento', 'Perguntas frequentes'], result: 'Mais autoridade e menos dúvidas antes do primeiro contato.' },
      { title: 'Página comercial', context: 'Campanhas e ofertas específicas', indication: 'Para concentrar a atenção do público em uma solução, condição ou lançamento.', description: 'Uma página direta, com problema, benefício, prova e chamada para ação em uma sequência comercial simples.', includes: ['Oferta em destaque', 'Benefícios principais', 'Provas e depoimentos', 'Chamada para ação'], result: 'Uma jornada curta entre o interesse e a solicitação de atendimento.' },
    ],
  },
  stores: {
    title: 'Exemplos de operação comercial digital',
    introduction: 'Estruturas para apresentar produtos, receber pedidos e organizar a experiência de compra.',
    icon: ShoppingBag,
    models: [
      { title: 'Loja virtual completa', context: 'Varejo e marcas próprias', indication: 'Para negócios que precisam vender produtos diretamente pela internet.', description: 'Catálogo, filtros, página de produto, carrinho, pagamento e acompanhamento de pedidos em uma única experiência.', includes: ['Categorias e busca', 'Página de produto', 'Carrinho e pagamento', 'Área do cliente'], result: 'Compra mais simples para o cliente e operação centralizada para a empresa.' },
      { title: 'Catálogo para orçamento', context: 'Atacado e venda consultiva', indication: 'Para produtos que exigem negociação, quantidade mínima ou atendimento comercial.', description: 'O cliente explora linhas e produtos, monta uma seleção e envia uma solicitação organizada para a equipe.', includes: ['Catálogo por linha', 'Lista de interesse', 'Pedido de cotação', 'Integração com atendimento'], result: 'Oportunidades comerciais chegam com mais contexto e menos troca de mensagens.' },
      { title: 'Planos e assinaturas', context: 'Serviços recorrentes', indication: 'Para empresas que comercializam planos, clubes, mensalidades ou serviços contínuos.', description: 'A experiência compara opções, explica benefícios e conduz para contratação e acompanhamento.', includes: ['Comparação de planos', 'Contratação recorrente', 'Cobrança integrada', 'Área do assinante'], result: 'Contratação mais compreensível e relacionamento recorrente organizado.' },
    ],
  },
  systems: {
    title: 'Exemplos de sistemas personalizados',
    introduction: 'Ambientes criados para centralizar processos, informações, responsabilidades e decisões.',
    icon: MonitorSmartphone,
    models: [
      { title: 'Gestão operacional', context: 'Equipes e processos internos', indication: 'Para empresas que controlam atividades em planilhas, mensagens e ferramentas separadas.', description: 'Um ambiente único para acompanhar solicitações, responsáveis, prazos, documentos e andamento.', includes: ['Painel de indicadores', 'Fluxos por status', 'Responsáveis e prazos', 'Histórico de ações'], result: 'Mais visão da operação e menos retrabalho entre equipes.' },
      { title: 'Financeiro e contratos', context: 'Administração e controle', indication: 'Para negócios que precisam acompanhar cobranças, compromissos, contratos e vencimentos.', description: 'Receitas, despesas, contratos, alertas e relatórios organizados conforme a rotina da empresa.', includes: ['Lançamentos financeiros', 'Cobranças e vencimentos', 'Contratos e documentos', 'Relatórios gerenciais'], result: 'Informações financeiras centralizadas para decisões mais seguras.' },
      { title: 'Atendimento e solicitações', context: 'Clientes e equipes', indication: 'Para operações que recebem demandas por vários canais e perdem histórico ou prioridade.', description: 'Cada solicitação entra, recebe responsável, prioridade e acompanhamento até a conclusão.', includes: ['Fila de atendimento', 'Prioridades e responsáveis', 'Notificações', 'Histórico completo'], result: 'Atendimentos rastreáveis, organizados e fáceis de acompanhar.' },
    ],
  },
  portals: {
    title: 'Exemplos de portais e aplicativos',
    introduction: 'Áreas seguras para clientes, parceiros e equipes acessarem serviços e informações.',
    icon: Smartphone,
    models: [
      { title: 'Portal do cliente', context: 'Relacionamento e serviços', indication: 'Para empresas que precisam dar autonomia ao cliente sem perder controle do atendimento.', description: 'O usuário acompanha solicitações, documentos, pagamentos e mensagens em uma área própria.', includes: ['Login e perfil', 'Solicitações', 'Documentos e pagamentos', 'Mensagens e avisos'], result: 'Mais autonomia para o cliente e menos demandas repetitivas para a equipe.' },
      { title: 'Portal de parceiros', context: 'Rede de prestadores', indication: 'Para operações que distribuem demandas e precisam acompanhar execução externa.', description: 'Parceiros recebem atividades, atualizam etapas, enviam comprovantes e consultam histórico.', includes: ['Distribuição de demandas', 'Atualização de status', 'Envio de documentos', 'Histórico por parceiro'], result: 'Execução externa conectada à operação principal da empresa.' },
      { title: 'Aplicativo de atendimento', context: 'Uso recorrente no celular', indication: 'Para serviços que precisam estar disponíveis de forma rápida e frequente.', description: 'Atalhos, avisos e ações principais organizados para uma experiência mobile simples.', includes: ['Navegação mobile', 'Notificações', 'Atalhos de serviço', 'Contato rápido'], result: 'Ações importantes disponíveis no celular com poucos passos.' },
    ],
  },
  automations: {
    title: 'Exemplos de automações empresariais',
    introduction: 'Fluxos para executar tarefas repetitivas, aplicar regras e avisar as pessoas certas.',
    icon: Workflow,
    models: [
      { title: 'Distribuição de oportunidades', context: 'Comercial e atendimento', indication: 'Para equipes que recebem contatos por vários canais e demoram para direcioná-los.', description: 'A automação recebe os dados, identifica o perfil e encaminha a oportunidade ao responsável.', includes: ['Captura de contatos', 'Regras de classificação', 'Distribuição automática', 'Avisos para a equipe'], result: 'Resposta mais rápida e nenhuma oportunidade sem responsável.' },
      { title: 'Cobranças e vencimentos', context: 'Financeiro', indication: 'Para rotinas que dependem de acompanhamento manual de datas e pendências.', description: 'O fluxo identifica vencimentos, dispara lembretes e registra cada tentativa de acompanhamento.', includes: ['Monitoramento de datas', 'Lembretes automáticos', 'Tarefas de cobrança', 'Registro de contatos'], result: 'Menos esquecimentos e uma rotina financeira mais consistente.' },
      { title: 'Aprovação de documentos', context: 'Administrativo e contratos', indication: 'Para processos com envio, revisão, correção e aprovação de arquivos.', description: 'Cada documento percorre etapas definidas, com responsável, aviso e histórico de versões.', includes: ['Etapas de aprovação', 'Responsáveis', 'Notificações', 'Controle de versões'], result: 'Clareza sobre etapa, responsável e versão correta do documento.' },
    ],
  },
  integrations: {
    title: 'Exemplos de integrações entre sistemas',
    introduction: 'Conexões para evitar digitação repetida e manter informações atualizadas entre plataformas.',
    icon: Link2,
    models: [
      { title: 'Pagamentos e operação', context: 'Cobranças e conciliação', indication: 'Para empresas que precisam atualizar pedidos e serviços após a confirmação de pagamento.', description: 'O pagamento confirmado atualiza automaticamente o status financeiro e operacional.', includes: ['Gateway de pagamento', 'Confirmação automática', 'Atualização de status', 'Registro de eventos'], result: 'Menos conferência manual e operação atualizada em tempo real.' },
      { title: 'CRM e atendimento', context: 'Comercial e relacionamento', indication: 'Para equipes que precisam manter o contexto do cliente entre formulário, WhatsApp e CRM.', description: 'Os dados entram uma vez e seguem disponíveis durante toda a conversa comercial.', includes: ['Captura de contatos', 'Sincronização de cadastro', 'Histórico centralizado', 'Distribuição comercial'], result: 'Atendimento mais contínuo e menos perda de contexto.' },
      { title: 'Marketplace e gestão', context: 'Pedidos, produtos e estoque', indication: 'Para empresas que vendem em mais de um canal e precisam manter informações alinhadas.', description: 'Pedidos e produtos circulam entre marketplace e sistema interno de forma controlada.', includes: ['Sincronização de pedidos', 'Atualização de produtos', 'Eventos de estoque', 'Tratamento de falhas'], result: 'Menos divergência entre canais e operação interna.' },
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
  const data = category ? showcase[category] : null;
  const model = data?.models[selectedIndex] || null;
  const Icon = data?.icon;

  useEffect(() => {
    setSelectedIndex(0);
    setDevice('desktop');
  }, [category]);

  const changeModel = (next: number) => {
    if (!data) return;
    setSelectedIndex((next + data.models.length) % data.models.length);
  };

  return (
    <AccessibleDialog
      isOpen={Boolean(category)}
      onClose={onClose}
      ariaLabel={data ? data.title : 'Exemplos de soluções digitais'}
      overlayClassName="items-center justify-center overflow-y-auto bg-black/70 p-2 sm:p-5"
      panelClassName="max-h-[94dvh] max-w-6xl overflow-hidden rounded-xl border border-slate-300 bg-[#f5f3ee] shadow-2xl"
    >
      {category && data && model && Icon && (
        <div className="flex max-h-[94dvh] min-h-0 flex-col text-[#17202a]">
          <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#c8aa68] text-[#8a6b2f]"><Icon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#8a6b2f]">Referências de solução</p>
                <h2 className="mt-1 text-xl font-black leading-tight sm:text-2xl">{data.title}</h2>
                <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500 sm:text-sm">{data.introduction}</p>
              </div>
              <button type="button" onClick={onClose} data-dialog-autofocus aria-label="Fechar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-900"><X className="h-4 w-4" /></button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="grid lg:grid-cols-[250px_minmax(0,1fr)]">
              <aside className="border-b border-slate-200 bg-[#ece8df] p-4 lg:border-b-0 lg:border-r lg:p-5">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Escolha uma referência</p>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" role="tablist">
                  {data.models.map((item, index) => (
                    <button key={item.title} type="button" role="tab" aria-selected={selectedIndex === index} onClick={() => setSelectedIndex(index)} className={`min-w-[215px] border px-4 py-3 text-left transition lg:min-w-0 ${selectedIndex === index ? 'border-[#8a6b2f] bg-white text-[#17202a]' : 'border-transparent bg-transparent text-slate-600 hover:border-slate-300 hover:bg-white/60'}`}>
                      <span className="text-[9px] font-black text-[#8a6b2f]">0{index + 1}</span>
                      <strong className="mt-2 block text-sm">{item.title}</strong>
                      <span className="mt-1 block text-[10px] leading-4 text-slate-500">{item.context}</span>
                    </button>
                  ))}
                </div>
              </aside>

              <main className="min-w-0 p-4 sm:p-6 lg:p-8">
                <section className="border-b border-slate-200 pb-6">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#8a6b2f]">{model.context}</p>
                  <h3 className="mt-3 text-3xl font-black leading-tight tracking-[-0.025em] sm:text-4xl">{model.title}</h3>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{model.description}</p>

                  <div className="mt-6 grid gap-5 md:grid-cols-[1fr_0.85fr]">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Indicado para</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{model.indication}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Resultado esperado</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{model.result}</p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">O que esse modelo pode incluir</p>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {model.includes.map((item) => <li key={item} className="flex items-start gap-2.5 border-t border-slate-200 py-2.5 text-sm font-semibold text-slate-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6b2f]" strokeWidth={2.5} />{item}</li>)}
                    </ul>
                  </div>
                </section>

                <section className="pt-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Amostra de interface</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">Uma referência visual para explicar a estrutura. O projeto final recebe identidade, conteúdo e regras próprias.</p>
                    </div>
                    <div className="flex rounded-lg border border-slate-300 bg-white p-1">
                      <button type="button" onClick={() => setDevice('desktop')} className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-black ${device === 'desktop' ? 'bg-[#17202a] text-white' : 'text-slate-500'}`}><Laptop className="h-4 w-4" /> Computador</button>
                      <button type="button" onClick={() => setDevice('mobile')} className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-black ${device === 'mobile' ? 'bg-[#17202a] text-white' : 'text-slate-500'}`}><Smartphone className="h-4 w-4" /> Celular</button>
                    </div>
                  </div>

                  <div className="mt-4 flex min-h-[300px] items-center justify-center overflow-hidden border border-slate-300 bg-[#dedad1] p-3 sm:min-h-[380px] sm:p-5">
                    <SolutionPreview category={category} index={selectedIndex} device={device} />
                  </div>
                </section>
              </main>
            </div>
          </div>

          <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => changeModel(selectedIndex - 1)} aria-label="Referência anterior" className="flex h-11 w-11 items-center justify-center border border-slate-300 text-slate-700"><ArrowLeft className="h-4 w-4" /></button>
              <span className="text-xs font-bold text-slate-500">{selectedIndex + 1} de {data.models.length}</span>
              <button type="button" onClick={() => changeModel(selectedIndex + 1)} aria-label="Próxima referência" className="flex h-11 w-11 items-center justify-center border border-slate-300 text-slate-700"><ArrowRight className="h-4 w-4" /></button>
              <button type="button" onClick={() => { onClose(); onRequestBudget(); }} className="ml-auto inline-flex min-h-11 items-center justify-center gap-2 bg-[#17202a] px-4 py-3 text-xs font-black text-white sm:px-6 sm:text-sm">Solicitar projeto semelhante <ArrowRight className="h-4 w-4" /></button>
            </div>
          </footer>
        </div>
      )}
    </AccessibleDialog>
  );
}

function SolutionPreview({ category, index, device }: { category: SystemExampleCategory; index: number; device: DeviceMode }) {
  const accent = index === 0 ? '#b6924b' : index === 1 ? '#8b5d4a' : '#55706f';
  const shell = device === 'mobile' ? 'w-[230px] rounded-[26px] border-[6px]' : 'w-full max-w-3xl rounded-lg border';
  return (
    <div className={`${shell} overflow-hidden border-[#17202a] bg-white shadow-xl`}>
      <div className="flex h-8 items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-3">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" /><span className="h-1.5 w-1.5 rounded-full bg-slate-300" /><span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
      </div>
      <div className={device === 'mobile' ? 'h-[390px]' : 'aspect-[16/10] min-h-[330px]'}>
        <PreviewLayout category={category} accent={accent} mobile={device === 'mobile'} />
      </div>
    </div>
  );
}

function PreviewLayout({ category, accent, mobile }: { category: SystemExampleCategory; accent: string; mobile: boolean }) {
  if (category === 'automations' || category === 'integrations') {
    return <FlowPreview accent={accent} integration={category === 'integrations'} />;
  }
  if (category === 'systems' || category === 'portals') {
    return <WorkspacePreview accent={accent} mobile={mobile} portal={category === 'portals'} />;
  }
  return <WebsitePreview accent={accent} mobile={mobile} store={category === 'stores'} />;
}

function WebsitePreview({ accent, mobile, store }: { accent: string; mobile: boolean; store: boolean }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4"><span className="h-5 w-16 bg-[#17202a]" /><div className="flex gap-2">{[0,1,2].map(i => <span key={i} className="h-1.5 w-8 bg-slate-200" />)}</div></div>
      <div className={`${mobile ? 'grid-rows-[1fr_0.7fr]' : 'grid-cols-[1.1fr_0.9fr]'} grid flex-1`}>
        <div className="flex flex-col justify-center bg-[#17202a] p-6 text-white"><span className="h-1 w-12" style={{ backgroundColor: accent }} /><span className="mt-5 h-5 w-4/5 bg-white" /><span className="mt-3 h-2 w-3/5 bg-white/25" /><span className="mt-6 h-9 w-28" style={{ backgroundColor: accent }} /></div>
        <div className="grid grid-cols-2 gap-3 bg-[#eeeae2] p-4">{[0,1,2,3].map(i => <div key={i} className="border border-slate-300 bg-white p-3"><span className="block aspect-square bg-slate-100" /><span className="mt-3 block h-2 w-3/4 bg-slate-300" />{store && <span className="mt-3 block h-6 w-16" style={{ backgroundColor: accent }} />}</div>)}</div>
      </div>
    </div>
  );
}

function WorkspacePreview({ accent, mobile, portal }: { accent: string; mobile: boolean; portal: boolean }) {
  return (
    <div className={`${mobile ? 'grid-rows-[52px_1fr]' : 'grid-cols-[76px_1fr]'} grid h-full bg-[#eef0ef]`}>
      <div className={`${mobile ? 'flex items-center gap-3 border-b px-3' : 'border-r p-3'} border-slate-200 bg-[#17202a]`}><span className="block h-7 w-7" style={{ backgroundColor: accent }} />{[0,1,2].map(i => <span key={i} className={`${mobile ? 'h-2 flex-1' : 'mt-4 block h-7'} bg-white/10`} />)}</div>
      <div className="p-4"><div className="flex items-center justify-between"><span className="h-4 w-28 bg-[#17202a]" /><span className="h-8 w-24" style={{ backgroundColor: accent }} /></div><div className="mt-4 grid grid-cols-3 gap-3">{[0,1,2].map(i => <div key={i} className="border border-slate-200 bg-white p-3"><span className="block h-2 w-12 bg-slate-300" /><span className="mt-4 block h-5 w-16" style={{ backgroundColor: i === 0 ? accent : '#17202a' }} /></div>)}</div><div className="mt-4 border border-slate-200 bg-white p-3">{[0,1,2,3].map(i => <div key={i} className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-0"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} /><span className="h-2 flex-1 bg-slate-100" /><span className="h-5 w-16 bg-slate-200" /></div>)}</div>{portal && <div className="mt-4 h-10" style={{ backgroundColor: accent }} />}</div>
    </div>
  );
}

function FlowPreview({ accent, integration }: { accent: string; integration: boolean }) {
  const nodes = integration ? ['Origem', 'Conexão', 'Destino'] : ['Entrada', 'Regra', 'Ação'];
  return <div className="flex h-full items-center justify-center bg-[#e8e5de] p-5"><div className="grid w-full max-w-2xl grid-cols-[1fr_70px_1fr_70px_1fr] items-center gap-2">{nodes.map((node, index) => <div key={node} className="contents"><div className="border border-slate-300 bg-white p-5 text-center"><span className="mx-auto block h-9 w-9" style={{ backgroundColor: accent }} /><p className="mt-4 text-xs font-black text-[#17202a]">{node}</p><span className="mt-3 block h-1.5 w-full bg-slate-100" /></div>{index < 2 && <div className="h-px bg-slate-400" />}</div>)}</div></div>;
}
