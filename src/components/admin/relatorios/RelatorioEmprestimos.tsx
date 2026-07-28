import { useState, useEffect } from 'react';
import { Download, RefreshCw, Landmark, DollarSign, Activity, AlertCircle, Calendar } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatarMoeda, formatarNumero, getRangeDatas, exportarCSV } from './utils/relatorioExport';

interface Props { periodo: string; dataInicio?: string; dataFim?: string; }

export function RelatorioEmprestimos({ periodo, dataInicio, dataFim }: Props) {
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<any>(null);

  useEffect(() => { carregar(); }, [periodo, dataInicio, dataFim]);

  const carregar = async () => {
    setLoading(true);
    try {
      const { inicio, fim } = getRangeDatas(periodo, dataInicio, dataFim);

      const [emprestimosRes, parcelasRes] = await Promise.all([
        supabase.from('emprestimos').select(`id, status, valor_aprovado, valor_total_financiado, taxa_servico, created_at, juros_total_percentual`).gte('created_at', inicio).lte('created_at', fim),
        // For installments, we might want to see all installments regardless of when the loan was created, 
        // but for simplicity matching the period to the loan creation date is easier, or we get installments due in this period.
        // Let's get installments due in this period.
        supabase.from('emprestimo_parcelas').select(`id, valor, status, data_vencimento`).gte('data_vencimento', inicio).lte('data_vencimento', fim)
      ]);

      const emp = emprestimosRes.data || [];
      const parc = parcelasRes.data || [];

      // Empréstimos metrics
      const ativos = emp.filter(e => e.status === 'ativo');
      const quitados = emp.filter(e => e.status === 'quitado');
      
      const totalFinanciado = [...ativos, ...quitados].reduce((acc, e) => acc + (Number(e.valor_aprovado) || 0), 0);
      const totalComJuros = [...ativos, ...quitados].reduce((acc, e) => acc + (Number(e.valor_total_financiado) || 0), 0);
      
      const receitaTaxas = [...ativos, ...quitados].reduce((acc, e) => acc + (Number(e.taxa_servico) || 0), 0);
      const lucroProjetado = totalComJuros - totalFinanciado;

      // Parcelas metrics
      const parcelasPagas = parc.filter(p => p.status === 'paga').reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
      const parcelasVencidas = parc.filter(p => p.status === 'vencida').reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
      const parcelasPendentes = parc.filter(p => p.status === 'pendente').reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

      // Status chart
      const statusCounts: Record<string, number> = {};
      emp.forEach(e => {
        const s = e.status;
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });

      setDados({
        totalFinanciado, totalComJuros, receitaTaxas, lucroProjetado,
        qtdAtivos: ativos.length,
        parcelasPagas, parcelasVencidas, parcelasPendentes,
        statusCounts, emp
      });

    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="animate-pulse space-y-4">{[...Array(4)].map((_,i)=><div key={i} className="h-28 bg-neutral-100 rounded-2xl"/>)}</div>;

  const exportar = () => exportarCSV(
    (dados?.emp || []).map((e: any) => ({
      ID: e.id,
      Status: e.status,
      Valor_Aprovado: e.valor_aprovado,
      Valor_Financiado: e.valor_total_financiado,
      Taxa_Servico: e.taxa_servico,
      Data_Criacao: e.created_at
    })),
    'relatorio_emprestimos'
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-neutral-900">Relatório de Empréstimos</h2>
        <div className="flex gap-2">
          <button onClick={exportar} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-all"><Download className="h-3 w-3"/>CSV</button>
          <button onClick={carregar} className="flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-bold text-white hover:bg-black transition-all"><RefreshCw className="h-3 w-3"/>Atualizar</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 mb-3"><Landmark className="h-5 w-5"/></div>
          <p className="text-2xl font-black text-neutral-900">{formatarMoeda(dados?.totalFinanciado || 0)}</p>
          <p className="text-xs text-neutral-500 mt-1">Capital Emprestado</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 mb-3"><Activity className="h-5 w-5"/></div>
          <p className="text-2xl font-black text-neutral-900">{formatarMoeda(dados?.lucroProjetado || 0)}</p>
          <p className="text-xs text-neutral-500 mt-1">Juros Projetados</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-violet-50 text-violet-600 mb-3"><DollarSign className="h-5 w-5"/></div>
          <p className="text-2xl font-black text-neutral-900">{formatarMoeda(dados?.receitaTaxas || 0)}</p>
          <p className="text-xs text-neutral-500 mt-1">Receita com Taxas (TAC)</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 mb-3"><Landmark className="h-5 w-5"/></div>
          <p className="text-2xl font-black text-neutral-900">{formatarNumero(dados?.qtdAtivos || 0)}</p>
          <p className="text-xs text-neutral-500 mt-1">Empréstimos Ativos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status Distribution */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
          <h3 className="font-bold text-neutral-900 mb-4 flex items-center gap-2"><Activity className="h-4 w-4 text-neutral-400"/> Funil de Solicitações</h3>
          <div className="space-y-3">
            {Object.entries(dados?.statusCounts || {}).sort((a: any, b: any) => b[1] - a[1]).map(([key, val]: [string, any]) => {
              const totalReq = dados?.emp?.length || 1;
              const pct = ((val / totalReq) * 100).toFixed(1);
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-neutral-700 uppercase">{key.replace(/_/g, ' ')}</span>
                    <span className="font-bold text-neutral-900">{val} <span className="text-neutral-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Inadimplência vs Pagamentos */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-neutral-900 mb-4 flex items-center gap-2"><Calendar className="h-4 w-4 text-neutral-400"/> Fluxo de Parcelas (Vencimento no período)</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <div>
                  <p className="text-xs font-bold text-emerald-800">Parcelas Pagas</p>
                  <p className="text-xs text-emerald-600">Valor recebido no período</p>
                </div>
                <p className="text-xl font-black text-emerald-600">{formatarMoeda(dados?.parcelasPagas || 0)}</p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
                <div>
                  <p className="text-xs font-bold text-amber-800">Parcelas a Vencer</p>
                  <p className="text-xs text-amber-600">Pendentes dentro do prazo</p>
                </div>
                <p className="text-xl font-black text-amber-600">{formatarMoeda(dados?.parcelasPendentes || 0)}</p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-100">
                <div>
                  <p className="text-xs font-bold text-red-800 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> Parcelas Vencidas</p>
                  <p className="text-xs text-red-600">Em atraso (inadimplência)</p>
                </div>
                <p className="text-xl font-black text-red-600">{formatarMoeda(dados?.parcelasVencidas || 0)}</p>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-neutral-100 text-xs text-neutral-500">
            Baseado na data de vencimento das parcelas no período selecionado.
          </div>
        </div>
      </div>
    </div>
  );
}
