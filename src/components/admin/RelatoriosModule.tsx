import { useState } from 'react';
import {
  BarChart3, DollarSign, Users, ClipboardList, Wrench, Trophy,
  MessageSquare, Megaphone, FileText, Settings2, LayoutDashboard,
  ChevronRight, Calendar, Filter, ShieldAlert, Landmark, ShoppingCart, CreditCard, TrendingUp
} from 'lucide-react';
import { RelatorioExecutivo } from './relatorios/RelatorioExecutivo';
import { RelatorioFinanceiro } from './relatorios/RelatorioFinanceiro';
import { RelatorioClientes } from './relatorios/RelatorioClientes';
import { RelatorioOS } from './relatorios/RelatorioOS';
import { RelatorioRentabilidade } from './relatorios/RelatorioRentabilidade';
import { RelatorioPrestadores } from './relatorios/RelatorioPrestadores';
import { RelatorioGamificacao } from './relatorios/RelatorioGamificacao';
import { RelatorioSuporte } from './relatorios/RelatorioSuporte';
import { RelatorioMarketing } from './relatorios/RelatorioMarketing';
import { RelatorioFiscal } from './relatorios/RelatorioFiscal';
import { RelatorioOperacional } from './relatorios/RelatorioOperacional';
import { RelatorioCobranca } from './relatorios/RelatorioCobranca';
import { RelatorioEmprestimos } from './relatorios/RelatorioEmprestimos';
import { RelatorioLoja } from './relatorios/RelatorioLoja';
import { RelatorioCredito } from './relatorios/RelatorioCredito';

type ReportId = 'executivo' | 'financeiro' | 'rentabilidade' | 'clientes' | 'os' | 'prestadores' | 'gamificacao' | 'suporte' | 'marketing' | 'fiscal' | 'operacional' | 'cobranca' | 'emprestimos' | 'loja' | 'credito';

const RELATORIOS: { id: ReportId; label: string; desc: string; icon: any; color: string; activeColor: string; activeBg: string }[] = [
  { id: 'executivo',    label: 'Executivo',       desc: 'Visão consolidada',        icon: LayoutDashboard, color: 'text-white/60',     activeColor: 'text-indigo-400',  activeBg: 'bg-indigo-500/15' },
  { id: 'financeiro',   label: 'Financeiro',       desc: 'Receita e pagamentos',     icon: DollarSign,      color: 'text-white/60',     activeColor: 'text-emerald-400', activeBg: 'bg-emerald-500/15' },
  { id: 'rentabilidade',label: 'Rentabilidade',    desc: 'Margem Real Pós-Quitação', icon: TrendingUp,      color: 'text-white/60',     activeColor: 'text-emerald-400', activeBg: 'bg-emerald-500/15' },
  { id: 'cobranca',     label: 'Cobrança',         desc: 'Inadimplência e Acordos',  icon: ShieldAlert,     color: 'text-white/60',     activeColor: 'text-red-400',     activeBg: 'bg-red-500/15' },
  { id: 'emprestimos',  label: 'Empréstimos',      desc: 'Valores e Juros',          icon: Landmark,        color: 'text-white/60',     activeColor: 'text-blue-400',    activeBg: 'bg-blue-500/15' },
  { id: 'loja',         label: 'Loja',             desc: 'Vendas e Estoque',         icon: ShoppingCart,    color: 'text-white/60',     activeColor: 'text-amber-400',   activeBg: 'bg-amber-500/15' },
  { id: 'credito',      label: 'Crédito Loja',     desc: 'Limites e Uso',            icon: CreditCard,      color: 'text-white/60',     activeColor: 'text-purple-400',  activeBg: 'bg-purple-500/15' },
  { id: 'clientes',     label: 'Clientes',         desc: 'Base e crescimento',       icon: Users,           color: 'text-white/60',     activeColor: 'text-blue-400',    activeBg: 'bg-blue-500/15' },
  { id: 'os',           label: 'OS & Orçamentos',  desc: 'Operações e SLA',          icon: ClipboardList,   color: 'text-white/60',     activeColor: 'text-violet-400',  activeBg: 'bg-violet-500/15' },
  { id: 'prestadores',  label: 'Prestadores',      desc: 'Demandas e pagamentos',    icon: Wrench,          color: 'text-white/60',     activeColor: 'text-orange-400',  activeBg: 'bg-orange-500/15' },
  { id: 'gamificacao',  label: 'Gamificação',      desc: 'Pontos e níveis',          icon: Trophy,          color: 'text-white/60',     activeColor: 'text-amber-400',   activeBg: 'bg-amber-500/15' },
  { id: 'suporte',      label: 'Suporte',          desc: 'Tickets e SLA',            icon: MessageSquare,   color: 'text-white/60',     activeColor: 'text-cyan-400',    activeBg: 'bg-cyan-500/15' },
  { id: 'marketing',    label: 'Marketing',        desc: 'Vouchers e promoções',     icon: Megaphone,       color: 'text-white/60',     activeColor: 'text-rose-400',    activeBg: 'bg-rose-500/15' },
  { id: 'fiscal',       label: 'Fiscal',           desc: 'Notas e emissões',         icon: FileText,        color: 'text-white/60',     activeColor: 'text-teal-400',    activeBg: 'bg-teal-500/15' },
  { id: 'operacional',  label: 'Operacional',      desc: 'Colaboradores e sistema',  icon: Settings2,       color: 'text-white/60',     activeColor: 'text-slate-300',   activeBg: 'bg-slate-500/15' },
];

const PERIODOS = [
  { id: 'hoje',       label: 'Hoje' },
  { id: 'semana',     label: 'Semana' },
  { id: 'mes',        label: 'Mês' },
  { id: 'trimestre',  label: 'Trimestre' },
  { id: 'semestre',   label: 'Semestre' },
  { id: 'ano',        label: 'Ano' },
  { id: 'personalizado', label: 'Personalizado' },
];

export function RelatoriosModule({ adminType, colaboradorModulos = [] }: { adminType?: string, colaboradorModulos?: string[] }) {
  // Filtrar relatórios disponíveis com base no tipo de admin e módulos permitidos
  const relatoriosFiltrados = RELATORIOS.filter(rel => {
    if (adminType === 'admin') return true; // Master vê tudo

    switch (rel.id) {
      case 'executivo':
      case 'operacional':
        return false; // Colaboradores não veem relatórios sensíveis de sistema/gestão total
      case 'financeiro':
      case 'rentabilidade':
      case 'cobranca':
      case 'emprestimos':
        return colaboradorModulos.includes('financeiro');
      case 'loja':
      case 'credito':
        return colaboradorModulos.includes('vendas');
      case 'clientes':
        return colaboradorModulos.includes('clientes');
      case 'os':
      case 'prestadores':
        return colaboradorModulos.includes('vendas');
      case 'gamificacao':
        return colaboradorModulos.includes('marketing') || colaboradorModulos.includes('clientes');
      case 'suporte':
        return colaboradorModulos.includes('suporte');
      case 'marketing':
        return colaboradorModulos.includes('marketing');
      case 'fiscal':
        return colaboradorModulos.includes('fiscal');
      default:
        return false;
    }
  });

  const [ativo, setAtivo] = useState<ReportId>(relatoriosFiltrados[0]?.id || 'os');
  const [periodo, setPeriodo] = useState('mes');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const relAtivo = relatoriosFiltrados.find(r => r.id === ativo) || relatoriosFiltrados[0];

  const renderRelatorio = () => {
    const props = { periodo, dataInicio, dataFim };
    switch (ativo) {
      case 'executivo':   return <RelatorioExecutivo   {...props} />;
      case 'financeiro':  return <RelatorioFinanceiro  {...props} />;
      case 'rentabilidade': return <RelatorioRentabilidade {...props} />;
      case 'cobranca':    return <RelatorioCobranca    {...props} />;
      case 'emprestimos': return <RelatorioEmprestimos {...props} />;
      case 'loja':        return <RelatorioLoja        {...props} />;
      case 'credito':     return <RelatorioCredito     {...props} />;
      case 'clientes':    return <RelatorioClientes    {...props} />;
      case 'os':          return <RelatorioOS          {...props} />;
      case 'prestadores': return <RelatorioPrestadores {...props} />;
      case 'gamificacao': return <RelatorioGamificacao {...props} />;
      case 'suporte':     return <RelatorioSuporte     {...props} />;
      case 'marketing':   return <RelatorioMarketing   {...props} />;
      case 'fiscal':      return <RelatorioFiscal      {...props} />;
      case 'operacional': return <RelatorioOperacional {...props} />;
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-[#1a1a1a] p-3 md:p-4 rounded-[2rem] md:rounded-[2.5rem] text-white relative shadow-2xl mb-3 no-print">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-3 md:gap-3">
          <div className="flex flex-row items-center justify-between gap-6 border-b border-white/5 pb-3">
            <div className="flex items-center gap-4">
              <div className="h-6 w-1 bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.6)]" />
              <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-black tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-neutral-100 to-neutral-400 whitespace-nowrap overflow-hidden">
                Centro de Relatórios
              </h1>
            </div>
            <BarChart3 className="hidden md:block h-8 w-8 text-white/5" />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Períodos */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Calendar className="h-4 w-4 text-white/30" />
              {PERIODOS.filter(p=>p.id!=='personalizado').map(p => (
                <button
                  key={p.id}
                  onClick={() => setPeriodo(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-[8.5px] md:text-[9.5px] font-black uppercase tracking-widest transition-all border shadow-lg
                    ${periodo === p.id
                      ? 'bg-white text-indigo-600 border-white border-b-4 border-b-indigo-500 shadow-[0_10px_20px_rgba(0,0,0,0.2)]'
                      : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border-white/5'}`}
                >{p.label}</button>
              ))}
              <button
                onClick={() => setPeriodo('personalizado')}
                className={`px-3 py-1.5 rounded-xl text-[8.5px] md:text-[9.5px] font-black uppercase tracking-widest transition-all border shadow-lg
                  ${periodo === 'personalizado'
                    ? 'bg-white text-indigo-600 border-white border-b-4 border-b-indigo-500'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border-white/5'}`}
              ><Filter className="inline h-3 w-3 mr-1" />Personalizado</button>
            </div>
          </div>

          {/* Date Range picker — só aparece se personalizado */}
          {periodo === 'personalizado' && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-xl border border-white/10">
                <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest">De:</span>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                />
              </div>
              <span className="text-white/30 text-sm">→</span>
              <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-xl border border-white/10">
                <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest">Até:</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Relatório ativo — pill */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Visualizando:</span>
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${relAtivo.activeBg} ${relAtivo.activeColor}`}>
              <relAtivo.icon className="h-3 w-3" /> {relAtivo.label}
            </span>
          </div>
        </div>
      </div>

      {/* Body: sidebar + conteúdo */}
      <div className="flex gap-5">
        {/* Sidebar desktop */}
        <aside className="hidden lg:flex flex-col gap-1 w-52 shrink-0 no-print">
          {relatoriosFiltrados.map(r => (
            <button
              key={r.id}
              onClick={() => setAtivo(r.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all group ${
                ativo === r.id
                  ? `${r.activeBg} ring-1 ring-white/10`
                  : 'hover:bg-neutral-100'
              }`}
            >
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${ativo === r.id ? r.activeBg : 'bg-neutral-100 group-hover:bg-neutral-200'} transition-all`}>
                <r.icon className={`h-4 w-4 ${ativo === r.id ? r.activeColor : 'text-neutral-500'}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-black truncate ${ativo === r.id ? r.activeColor : 'text-neutral-700'}`}>{r.label}</p>
                <p className="text-[9px] text-neutral-400 truncate">{r.desc}</p>
              </div>
              {ativo === r.id && <ChevronRight className={`h-3 w-3 ml-auto shrink-0 ${r.activeColor}`} />}
            </button>
          ))}
        </aside>

        {/* Mobile nav — horizontal scroll */}
        <div className="lg:hidden w-full overflow-x-auto no-print">
          <div className="flex gap-2 pb-2 min-w-max">
            {relatoriosFiltrados.map(r => (
              <button
                key={r.id}
                onClick={() => { setAtivo(r.id); setSidebarOpen(false); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl whitespace-nowrap text-xs font-bold transition-all ${
                  ativo === r.id ? `${r.activeBg} ${r.activeColor} ring-1 ring-white/10` : 'bg-white ring-1 ring-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <r.icon className="h-3.5 w-3.5" /> {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo do relatório */}
        <main className="flex-1 min-w-0">
          {renderRelatorio()}
        </main>
      </div>
    </div>
  );
}
