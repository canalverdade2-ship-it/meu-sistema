import { useEffect, useState, type ComponentType } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Baby,
  BriefcaseBusiness,
  Calculator,
  Check,
  CheckCircle2,
  HandCoins,
  HeartHandshake,
  Info,
  Landmark,
  LockKeyhole,
  Palmtree,
  ShieldCheck,
} from 'lucide-react';
import {
  FreeToolsTieredCalculatorDialog,
  type FreeToolId,
} from './FreeToolsTieredCalculatorDialog';
import { readInfinitePayReturn } from '../../lib/freeToolsProAccess';

interface FreeToolsPageProps {
  onBack: () => void;
  onServices: () => void;
  onClientLogin: () => void;
}

interface ToolCard {
  id: FreeToolId | 'thirteenth' | 'benefits' | 'bpc';
  icon: ComponentType<{ className?: string }>;
  number: string;
  title: string;
  description: string;
  category: string;
  useCase: string;
  includes: string[];
  available: boolean;
}

const TOOLS: ToolCard[] = [
  { id: 'termination', icon: BriefcaseBusiness, number: '01', title: 'Rescisão trabalhista', description: 'Estimativa das principais verbas de encerramento de um vínculo CLT.', category: 'Trabalhista', useCase: 'Para compreender a composição aproximada da rescisão antes da conferência oficial.', includes: ['Saldo de salário', 'Aviso-prévio', '13º e férias', 'Multa estimada do FGTS'], available: true },
  { id: 'retirement', icon: Landmark, number: '02', title: 'Aposentadoria pelo INSS', description: 'Panorama inicial da regra geral e de duas regras de transição consideradas em 2026.', category: 'Previdenciário', useCase: 'Para comparar idade e contribuição com critérios previdenciários básicos.', includes: ['Regra geral', 'Regra dos pontos', 'Idade progressiva', 'Pendências por requisito'], available: true },
  { id: 'vacation', icon: Palmtree, number: '03', title: 'Cálculo de férias', description: 'Estimativa bruta da remuneração de férias e do adicional constitucional de um terço.', category: 'Trabalhista', useCase: 'Para visualizar o valor bruto antes dos descontos e das condições específicas do vínculo.', includes: ['Salário mensal', 'Médias variáveis', 'Adicional de 1/3', 'Total bruto estimado'], available: true },
  { id: 'thirteenth', icon: HandCoins, number: '04', title: '13º salário', description: 'Simulação das parcelas e do valor proporcional aos meses trabalhados.', category: 'Trabalhista', useCase: 'Para visualizar a formação aproximada do décimo terceiro salário.', includes: ['Meses trabalhados', 'Primeira parcela', 'Segunda parcela', 'Valor proporcional'], available: false },
  { id: 'benefits', icon: Baby, number: '05', title: 'Benefícios do INSS', description: 'Orientação inicial sobre incapacidade, salário-maternidade, pensão e outros benefícios.', category: 'Previdenciário', useCase: 'Para identificar as informações necessárias antes de uma análise completa.', includes: ['Tipo de benefício', 'Qualidade de segurado', 'Carência', 'Documentação inicial'], available: false },
  { id: 'bpc', icon: HeartHandshake, number: '06', title: 'BPC / LOAS', description: 'Triagem educativa dos critérios básicos do benefício assistencial.', category: 'Assistencial', useCase: 'Para compreender os pontos normalmente avaliados em um pedido.', includes: ['Renda familiar', 'Grupo familiar', 'Impedimento de longo prazo', 'Cadastro social'], available: false },
];

const AVAILABLE_TOOLS = TOOLS.filter((tool) => tool.available);
const FUTURE_TOOLS = TOOLS.filter((tool) => !tool.available);

export function FreeToolsPage({ onBack, onServices, onClientLogin }: FreeToolsPageProps) {
  const [activeTool, setActiveTool] = useState<FreeToolId | null>(null);

  useEffect(() => {
    const paymentReturn = readInfinitePayReturn();
    if (paymentReturn) setActiveTool(paymentReturn.tool);
  }, []);

  return (
    <main className="overflow-x-clip bg-[#eee9df] pt-[73px] text-[#17202a]">
      <section className="relative overflow-hidden border-b border-[#d4ccbe] bg-[linear-gradient(135deg,#faf7f0_0%,#f3ede2_56%,#e9dfcf_100%)]">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full border border-[#b8903e]/15" />
        <div className="pointer-events-none absolute right-10 top-12 h-64 w-64 rounded-full bg-[#d8bd73]/14 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#cfc5b5] bg-white/65 px-4 py-2 text-sm font-black text-[#52606a] transition hover:border-[#9f8140] hover:bg-white hover:text-[#17202a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f8140]"><ArrowLeft className="h-4 w-4" /> Voltar ao início</button>
          <div className="mt-10 grid items-stretch gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
            <div className="flex flex-col justify-center border-l-2 border-[#c7a458] pl-5 sm:pl-7">
              <p className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#806128] sm:text-xs"><span className="h-px w-8 bg-[#b8903e]" />Serviços públicos GSA</p>
              <h1 className="mt-5 max-w-[14ch] text-4xl font-black leading-[1.03] tracking-[-0.045em] text-[#111820] sm:text-5xl lg:text-[3.8rem]">Ferramentas para orientar decisões com mais clareza.</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[#5b6570] sm:text-lg">Use o cálculo simples gratuitamente ou avance para o modo Pro quando precisar de mais campos, regras e detalhamento.</p>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-[#56616a]">{['Free sem cadastro', 'Pro com liberação segura', 'Acesso imediato'].map((item) => <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#8a6e2f]" />{item}</span>)}</div>
            </div>
            <aside className="overflow-hidden rounded-2xl border border-[#d8bd73]/30 bg-[linear-gradient(180deg,#172635_0%,#0d1924_100%)] text-white shadow-[inset_0_3px_0_#d8bd73,0_30px_70px_rgba(18,27,36,0.2)]">
              <div className="border-b border-white/10 px-5 py-6 sm:px-7"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d8bd73]">Dois níveis de consulta</p><h2 className="mt-3 text-2xl font-black leading-tight">Comece simples. Aprofunde somente quando precisar.</h2><p className="mt-3 text-sm leading-6 text-white/55">O Free orienta rapidamente. O Pro organiza uma análise mais detalhada dentro da mesma ferramenta.</p></div>
              <div className="divide-y divide-white/10 px-5 sm:px-7">{[['01','Modo Free','Poucos campos e resultado básico, sem login.'],['02','Modo Pro','Cálculo avançado por pagamento, voucher ou benefício.'],['03','Confirmação segura','Pagamento e elegibilidade são verificados no servidor.']].map(([number,title,text]) => <div key={number} className="grid grid-cols-[36px_1fr] gap-3 py-5"><span className="text-[10px] font-black tracking-[0.18em] text-[#d8bd73]">{number}</span><div><strong className="block text-sm">{title}</strong><span className="mt-1 block text-xs leading-5 text-white/50">{text}</span></div></div>)}</div>
            </aside>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20" aria-labelledby="free-tools-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 border-b border-[#d4ccbe] pb-8 lg:grid-cols-[1fr_0.7fr] lg:items-end">
            <div className="max-w-3xl"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#806128]">Ferramentas disponíveis</p><h2 id="free-tools-title" className="mt-3 text-3xl font-black tracking-[-0.035em] text-[#111820] sm:text-5xl">Escolha a consulta que precisa iniciar.</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-[#606a73] sm:text-base">Cada ferramenta abre com o nível Free. A opção Pro fica disponível no mesmo modal.</p></div>
            <div className="flex items-start gap-3 border-l-2 border-[#c7a458] pl-5 text-sm leading-6 text-[#626c75]"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#8a6e2f]" />O Free não solicita identificação. Pagamento e voucher Pro também podem ser usados sem cadastro.</div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {AVAILABLE_TOOLS.map(({ id, icon: Icon, number, title, description, category, useCase, includes }) => (
              <button key={id} type="button" onClick={() => setActiveTool(id as FreeToolId)} className="group relative flex min-h-[390px] flex-col overflow-hidden rounded-2xl border border-[#d4cdc2] bg-[#fbf9f4] p-6 text-left shadow-[0_12px_32px_rgba(24,32,40,0.055)] transition duration-200 hover:-translate-y-1 hover:border-[#ad8b42] hover:bg-white hover:shadow-[0_22px_48px_rgba(24,32,40,0.11)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f8140] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eee9df] sm:p-7">
                <span className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8a6b2f,#d8bd73,transparent)] opacity-80" />
                <div className="flex items-start justify-between gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#172433] text-[#d8bd73]"><Icon className="h-5 w-5" /></span><div className="text-right"><span className="block text-[10px] font-black tracking-[0.2em] text-[#9b7c33]">{number}</span><span className="mt-2 inline-flex rounded-full border border-[#d7c69e] bg-[#f7efd9] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#715721]">Free + Pro</span></div></div>
                <p className="mt-7 text-[10px] font-black uppercase tracking-[0.17em] text-[#806128]">{category}</p><h3 className="mt-3 text-2xl font-black leading-tight tracking-[-0.025em] text-[#111820]">{title}</h3><p className="mt-4 text-sm leading-6 text-[#616b74]">{description}</p>
                <div className="mt-6 border-t border-[#ded8ce] pt-5"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#858c91]">Indicado para</p><p className="mt-2 text-xs leading-5 text-[#4f5a63]">{useCase}</p></div>
                <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] leading-4 text-[#5d6770]">{includes.map((item) => <li key={item} className="flex items-start gap-2"><Check className="mt-0.5 h-3 w-3 shrink-0 text-[#8a6e2f]" strokeWidth={3} />{item}</li>)}</ul>
                <div className="mt-auto flex items-center justify-between gap-4 border-t border-[#ded8ce] pt-5"><span className="text-[10px] font-bold text-[#838a90]">Free simples · Pro avançado</span><span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.09em] text-[#765b25]">Abrir ferramenta <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span></div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#d7d1c6] bg-[#f8f5ef] py-12 sm:py-16"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#806128]">Próximas ferramentas</p><h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-[#111820] sm:text-3xl">Novas consultas em desenvolvimento.</h2></div><p className="max-w-lg text-sm leading-6 text-[#667078]">Essas opções aparecem somente como previsão da evolução da área e ainda não recebem dados do usuário.</p></div><div className="mt-8 grid gap-4 md:grid-cols-3">{FUTURE_TOOLS.map(({ id, icon: Icon, number, title, description, category }) => <article key={id} className="rounded-2xl border border-[#d7d1c6] bg-white/55 p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6e1d8] text-[#737b80]"><Icon className="h-5 w-5" /></span><span className="text-[10px] font-black tracking-[0.18em] text-[#9a8a68]">{number}</span></div><p className="mt-5 text-[9px] font-black uppercase tracking-[0.15em] text-[#887a5d]">{category}</p><h3 className="mt-2 text-lg font-black text-[#222b32]">{title}</h3><p className="mt-3 text-xs leading-5 text-[#6c747a]">{description}</p><span className="mt-5 inline-flex rounded-full border border-[#d5cec3] bg-[#f2eee7] px-3 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#7c8388]">Em desenvolvimento</span></article>)}</div></div></section>

      <section className="border-b border-white/10 bg-[#111d29] py-14 text-white sm:py-16"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-14"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d8bd73]">Compromisso da plataforma</p><h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.03em] sm:text-4xl">Clareza antes de qualquer conclusão.</h2><p className="mt-4 text-sm leading-7 text-white/55">A área foi estruturada para informar sem esconder limites, condições ou situações que exigem análise individual.</p></div><div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">{[{ icon: ShieldCheck, title: 'Privacidade preservada', text: 'Os valores digitados permanecem no dispositivo e não são armazenados pela GSA.' },{ icon: Calculator, title: 'Cálculo explicado', text: 'O resultado apresenta a composição utilizada, não apenas um número isolado.' },{ icon: Info, title: 'Limites visíveis', text: 'Cada ferramenta informa o que não foi considerado e quando buscar confirmação.' }].map(({ icon: Icon, title, text }) => <article key={title} className="bg-[#172433] p-6"><Icon className="h-6 w-6 text-[#d8bd73]" /><h3 className="mt-5 font-black">{title}</h3><p className="mt-3 text-xs leading-5 text-white/55">{text}</p></article>)}</div></div></div></section>

      <section className="py-14 sm:py-20"><div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div className="grid overflow-hidden rounded-2xl border border-[#cbbd9f] bg-[#d8c28d] lg:grid-cols-[1fr_340px]"><div className="p-7 sm:p-10 lg:p-12"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#624d20]">Quando a simulação não basta</p><h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-[-0.03em] text-[#17202a] sm:text-4xl">Documentos, períodos especiais e regras específicas merecem uma análise completa.</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-[#5c4d31]">Conheça os serviços da GSA quando a situação exigir conferência individual, organização documental ou acompanhamento.</p></div><div className="flex flex-col justify-center border-t border-[#b69e69] bg-[#c8ad70] p-7 lg:border-l lg:border-t-0"><button type="button" onClick={onServices} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#172433] px-5 py-3 text-sm font-black text-white transition hover:bg-[#223449] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Conhecer os serviços GSA <ArrowRight className="h-4 w-4" /></button><p className="mt-4 text-center text-[11px] leading-5 text-[#584721]">Atendimento por WhatsApp, e-mail ou Portal do Cliente.</p></div></div><p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-[#69727a]">As ferramentas fornecem estimativas educativas e não comprovam direitos, não substituem o cálculo oficial dos órgãos competentes nem a orientação de profissional habilitado.</p></div></section>

      <FreeToolsTieredCalculatorDialog tool={activeTool} onClose={() => setActiveTool(null)} onToolChange={setActiveTool} onServices={() => { setActiveTool(null); onServices(); }} onClientLogin={onClientLogin} />
    </main>
  );
}
