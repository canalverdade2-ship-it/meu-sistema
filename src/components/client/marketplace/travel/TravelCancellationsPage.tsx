import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, RefreshCcw, Send } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { formatCurrency } from '../../../../lib/utils';
import { toast } from 'react-hot-toast';
import { Modal } from '../../../ui/Modal';

const statusLabels: Record<string, string> = {
  solicitado: 'Solicitado',
  em_analise: 'Em análise',
  reembolso_aprovado: 'Reembolso aprovado',
  reembolso_negado: 'Reembolso negado',
  concluido: 'Concluído',
};

const statusColors: Record<string, string> = {
  solicitado: 'bg-amber-100 text-amber-800',
  em_analise: 'bg-blue-100 text-blue-800',
  reembolso_aprovado: 'bg-emerald-100 text-emerald-800',
  reembolso_negado: 'bg-red-100 text-red-800',
  concluido: 'bg-neutral-100 text-neutral-800',
};

export function TravelCancellationsPage({
  clientId,
  onBack,
}: {
  clientId: string;
  onBack: () => void;
}) {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('viagens_transacoes')
        .select(`
          id,
          status,
          valor_pago,
          created_at,
          viagens_propostas(snapshot_completo),
          viagens_cancelamentos(
            id,
            motivo,
            valor_solicitado,
            taxas_aplicaveis,
            valor_reembolsado,
            status,
            resposta_gsa,
            created_at
          )
        `)
        .eq('cliente_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrips(data || []);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Não foi possível carregar os cancelamentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [clientId]);

  const openCancellation = (trip: any) => {
    if (trip.viagens_cancelamentos?.length > 0) {
      toast('Já existe uma solicitação para esta viagem.', { icon: 'ℹ️' });
      return;
    }
    if (['cancelada', 'reembolsada', 'concluida'].includes(trip.status)) {
      toast.error('Esta viagem não aceita uma nova solicitação de cancelamento.');
      return;
    }
    setReason('');
    setSelectedTrip(trip);
  };

  const submitCancellation = async () => {
    if (!selectedTrip || reason.trim().length < 10) {
      toast.error('Explique o motivo do cancelamento com pelo menos 10 caracteres.');
      return;
    }

    try {
      setSubmitting(true);
      const { data, error } = await supabase.rpc('gsa_request_travel_cancellation', {
        p_transacao_id: selectedTrip.id,
        p_motivo: reason.trim(),
      });

      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || 'Solicitação não processada.');

      toast.success('Solicitação enviada para análise da GSA.');
      setSelectedTrip(null);
      await fetchTrips();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Não foi possível solicitar o cancelamento.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f1ea] pb-24 font-sans">
      <nav className="sticky top-0 z-50 border-b border-black/[0.06] bg-[#f4f1ea]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-5">
          <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-[#0c2340]">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
          <div className="mx-4 h-5 w-px bg-black/10" />
          <span className="text-sm font-black text-[#0c2340]">Cancelamentos e Reembolsos</span>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-5 py-12">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-[#168ac1]">Pós-venda</p>
            <h1 className="text-3xl font-black text-[#0c2340] sm:text-4xl" style={{ fontFamily: '"Cinzel", serif' }}>
              Cancelamentos e Reembolsos
            </h1>
            <p className="mt-3 max-w-2xl text-neutral-600">Acompanhe solicitações, taxas aplicáveis e valores aprovados pela equipe.</p>
          </div>
          <button onClick={fetchTrips} className="flex items-center justify-center gap-2 rounded-xl border border-[#0c2340]/10 bg-white px-4 py-2 text-sm font-bold text-[#0c2340]">
            <RefreshCcw className="h-4 w-4" /> Atualizar
          </button>
        </div>

        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Cancelamentos seguem as regras do fornecedor, do período da viagem e dos serviços já emitidos. O envio da solicitação não garante reembolso integral.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-9 w-9 animate-spin text-[#0c2340]" /></div>
        ) : trips.length === 0 ? (
          <div className="rounded-3xl border border-black/5 bg-white p-10 text-center text-neutral-500">Nenhuma viagem encontrada.</div>
        ) : (
          <div className="space-y-4">
            {trips.map((trip) => {
              const snapshot = trip.viagens_propostas?.snapshot_completo || {};
              const cancellation = trip.viagens_cancelamentos?.[0];
              return (
                <article key={trip.id} className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm sm:p-7">
                  <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-black uppercase text-neutral-600">{String(trip.status).replace(/_/g, ' ')}</span>
                        {cancellation && (
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${statusColors[cancellation.status] || 'bg-neutral-100 text-neutral-700'}`}>
                            {statusLabels[cancellation.status] || cancellation.status}
                          </span>
                        )}
                      </div>
                      <h2 className="truncate text-xl font-black text-[#0c2340]">{snapshot.titulo || snapshot.destino || 'Viagem personalizada'}</h2>
                      <p className="mt-1 text-sm text-neutral-500">Valor da transação: {formatCurrency(trip.valor_pago)}</p>

                      {cancellation && (
                        <div className="mt-5 rounded-2xl bg-neutral-50 p-4 text-sm">
                          <p className="font-bold text-neutral-800">Motivo informado</p>
                          <p className="mt-1 text-neutral-600">{cancellation.motivo}</p>
                          <div className="mt-4 grid gap-3 border-t border-neutral-200 pt-4 sm:grid-cols-3">
                            <div><span className="block text-xs text-neutral-400">Solicitado</span><strong>{formatCurrency(cancellation.valor_solicitado || trip.valor_pago)}</strong></div>
                            <div><span className="block text-xs text-neutral-400">Taxas</span><strong>{cancellation.taxas_aplicaveis == null ? 'Em análise' : formatCurrency(cancellation.taxas_aplicaveis)}</strong></div>
                            <div><span className="block text-xs text-neutral-400">Reembolso</span><strong>{cancellation.valor_reembolsado == null ? 'Em análise' : formatCurrency(cancellation.valor_reembolsado)}</strong></div>
                          </div>
                          {cancellation.resposta_gsa && <p className="mt-4 rounded-xl bg-white p-3 text-neutral-700"><strong>Resposta GSA:</strong> {cancellation.resposta_gsa}</p>}
                        </div>
                      )}
                    </div>

                    {!cancellation ? (
                      <button onClick={() => openCancellation(trip)} className="rounded-xl bg-[#0c2340] px-5 py-3 text-sm font-black text-white hover:bg-[#134e78]">Solicitar cancelamento</button>
                    ) : cancellation.status === 'concluido' ? (
                      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Processo concluído</div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <Modal isOpen={Boolean(selectedTrip)} onClose={() => setSelectedTrip(null)} title="Solicitar cancelamento" size="lg">
        {selectedTrip && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-neutral-50 p-4">
              <p className="font-black text-[#0c2340]">{selectedTrip.viagens_propostas?.snapshot_completo?.titulo || 'Viagem personalizada'}</p>
              <p className="mt-1 text-sm text-neutral-500">Valor de referência: {formatCurrency(selectedTrip.valor_pago)}</p>
            </div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-500">
              Motivo do cancelamento
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={6} placeholder="Explique o motivo e informe qualquer detalhe importante..." className="mt-2 w-full resize-y rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium outline-none focus:border-[#168ac1] focus:ring-4 focus:ring-[#38bdf8]/10" />
            </label>
            <button onClick={submitCancellation} disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c2340] py-3 font-black text-white disabled:opacity-60">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {submitting ? 'Enviando...' : 'Enviar para análise'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
