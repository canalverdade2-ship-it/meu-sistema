import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Ticket, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import { Voucher } from '../../types';
import { Modal } from '../ui/Modal';
import { notificationService } from '../../lib/notificationService';

interface PrestadorVouchersProps {
  prestadorId: string;
  initialItemId?: string;
}

export function PrestadorVouchers({ prestadorId, initialItemId }: PrestadorVouchersProps) {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [monthFilter, setMonthFilter] = useState<string>('');
  const [confirmVoucherId, setConfirmVoucherId] = useState<string | null>(null);

  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (initialItemId && vouchers.length > 0) {
      const voucher = vouchers.find(v => v.id === initialItemId);
      if (voucher) {
        setTimeout(() => {
          const element = document.getElementById(`voucher-${initialItemId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedItemId(initialItemId);
            setTimeout(() => setHighlightedItemId(null), 3000);
          }
        }, 400);
      }
    }
  }, [initialItemId, vouchers.length]);

  useEffect(() => {
    fetchVouchers();
    const channel = supabase
      .channel(`prestador-vouchers-${prestadorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_vouchers', filter: `prestador_id=eq.${prestadorId}` }, fetchVouchers)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [prestadorId, monthFilter]);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('prestador_vouchers')
        .select('*')
        .eq('prestador_id', prestadorId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      
      if (data) {
        let filtered = data;
        if (monthFilter) {
          filtered = filtered.filter((v: any) => v.created_at?.startsWith(monthFilter));
        }
        setVouchers(filtered || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao buscar vouchers.');
    } finally {
      setLoading(false);
    }
  };

  const solicitarSaque = async (voucherId: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const voucher = vouchers.find(v => v.id === voucherId);
      if (!voucher) return;

      // 1. Update voucher status to 'pago'
      const { error: updateError } = await supabase
        .from('prestador_vouchers')
        .update({ status: 'pago' })
        .eq('id', voucherId);
      
      if (updateError) throw updateError;

      // 2. Insert transaction into prestador_transacoes
      const { error: transacaoError } = await supabase
        .from('prestador_transacoes')
        .insert([{
          prestador_id: prestadorId,
          tipo: 'credito',
          valor: voucher.valor,
          descricao: `Resgate de Voucher: ${voucher.codigo}`,
          status: 'concluido'
        }]);

      if (transacaoError) throw transacaoError;

      // 3. Notificar ADM do resgate
      await notificationService.notifyAdmin(
        '🎟️ Voucher Resgatado pelo Prestador',
        `O prestador resgatou o voucher ${voucher.codigo} no valor de ${formatCurrency(voucher.valor)}. O valor foi creditado automaticamente na carteira.`,
        'vouchers',
        'voucher_resgate_solicitado',
        { tab: 'usados', itemId: voucher.id, contexto: { prestador_id: prestadorId, voucher_id: voucher.id } }
      );

      toast.success('Voucher resgatado! O valor foi creditado em sua carteira instantaneamente.');
      setConfirmVoucherId(null);
      fetchVouchers();
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao resgatar voucher: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="py-12 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"/></div>;

  const ativos = vouchers.filter(v => v.status === 'ativo');
  const resgatados = vouchers.filter(v => ['resgatado', 'pago'].includes(v.status));

  return (
    <>
    <div className="space-y-6">
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-indigo-50/50">
          <div>
            <h3 className="text-lg font-medium text-neutral-900">Meus Vouchers Disponíveis</h3>
            <p className="text-sm text-neutral-500 mt-1">Utilize seus vouchers para solicitar saque em dinheiro.</p>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={monthFilter} 
              onChange={e => setMonthFilter(e.target.value)} 
              className="bg-white border border-neutral-200 text-xs font-bold text-neutral-700 rounded-xl px-4 py-2 focus:outline-none cursor-pointer"
            >
              <option value="">Todos os meses</option>
              {Array.from({ length: 12 }, (_, i) => {
                const month = (i + 1).toString().padStart(2, '0');
                const year = new Date().getFullYear();
                return (
                  <option key={month} value={`${year}-${month}`}>
                    {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(year, i))}
                  </option>
                );
              })}
            </select>
            <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap">
              {ativos.length} disponíveis
            </span>
          </div>
        </div>
        
        {ativos.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">
            <Ticket className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="font-medium text-neutral-900">Nenhum voucher disponível</p>
            <p className="text-sm mt-1">Continue prestando serviços para ganhar vouchers de bônus.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
              {ativos.map(voucher => (
                <div 
                  id={`voucher-${voucher.id}`}
                  key={voucher.id} 
                  className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-500 ${
                    highlightedItemId === voucher.id 
                      ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500 scale-[1.02] z-10 shadow-lg' 
                      : 'border-indigo-100 bg-white shadow-sm'
                  } p-6 flex flex-col items-center text-center justify-between`}
                >
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -z-10" />
                <div className="absolute bottom-0 left-0 w-16 h-16 bg-pink-50 rounded-tr-full -z-10" />
                
                <Ticket className="h-10 w-10 text-indigo-500 mb-3" />
                <h4 className="text-xl font-black text-indigo-900">{formatCurrency(voucher.valor)}</h4>
                <p className="text-xs text-indigo-600/70 font-bold uppercase tracking-widest mt-1 mb-4">
                  Código: {voucher.codigo}
                </p>
                
                {voucher.descricao && (
                  <p className="text-sm text-neutral-600 mb-6 flex-1 px-4">{voucher.descricao}</p>
                )}
                
                <button
                  onClick={() => setConfirmVoucherId(voucher.id)}
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-transform active:scale-95 disabled:opacity-50"
                >
                  Solicitar Saque
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
        <div className="p-6 border-b border-neutral-100">
          <h3 className="text-lg font-medium text-neutral-900">Histórico de Saques (Vouchers Utilizados)</h3>
        </div>
        <div className="divide-y divide-neutral-100">
          {resgatados.length === 0 ? (
             <div className="p-8 text-center text-sm text-neutral-500">Nenhum voucher utilizado até o momento.</div>
          ) : (
            resgatados.map(v => (
              <div 
                id={`voucher-${v.id}`}
                key={v.id} 
                className={`p-4 flex items-center justify-between hover:bg-neutral-50 transition-all duration-500 ${
                  highlightedItemId === v.id 
                    ? 'bg-indigo-50/50 ring-2 ring-indigo-500 scale-[1.01] z-10 shadow-lg' 
                    : ''
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-bold text-neutral-900">{formatCurrency(v.valor)}</span>
                  <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                    <span className="font-mono">{v.codigo}</span>
                    <span>•</span>
                    <span>{formatDateTime(v.updated_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm bg-emerald-50 px-3 py-1 rounded-full">
                  <CheckCircle className="w-4 h-4" />
                  Saque Solicitado
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>

      {/* Modal de Confirmação de Resgate de Voucher */}
      <Modal
        isOpen={!!confirmVoucherId}
        onClose={() => setConfirmVoucherId(null)}
        title="Confirmar Resgate de Voucher"
        size="wide"
      >
        {(() => {
          const voucher = vouchers.find(v => v.id === confirmVoucherId);
          if (!voucher) return null;
          return (
            <div className="space-y-5">
              <div className="rounded-2xl bg-indigo-50 p-5 border border-indigo-100 flex items-start gap-4">
                <Ticket className="h-6 w-6 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-indigo-900">Você está prestes a resgatar este voucher</p>
                  <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
                    O valor será creditado imediatamente em sua carteira e o voucher não poderá ser utilizado novamente.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-white ring-1 ring-neutral-200 p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Voucher</p>
                  <p className="font-mono text-sm font-bold text-neutral-700">{voucher.codigo}</p>
                  {voucher.descricao && <p className="text-xs text-neutral-500 mt-1">{voucher.descricao}</p>}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Valor</p>
                  <p className="text-2xl font-black text-indigo-600">{formatCurrency(voucher.valor)}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmVoucherId(null)}
                  className="flex-1 rounded-xl border border-neutral-200 py-3 text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() => solicitarSaque(voucher.id)}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Processando...</>
                  ) : (
                    <><CheckCircle className="h-4 w-4" />Confirmar Resgate</>
                  )}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </>
  );
}
