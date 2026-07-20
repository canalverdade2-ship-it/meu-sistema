import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plane, MapPin, Calendar, Clock, Receipt, Download, Loader2 } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { navigate } from '../../../../routing/navigationService';
import { routes } from '../../../../routing/routeCatalog';
import { formatCurrency } from '../../../../lib/utils';

export function MyTripsPage({ clientId, onBack }: { clientId: string, onBack: () => void }) {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrips() {
      try {
        const { data, error } = await supabase
          .from('viagens_transacoes')
          .select(`
            id,
            status,
            valor_pago,
            created_at,
            proposta_id,
            viagens_propostas (
              snapshot_completo,
              reserva_id,
              viagens_solicitacoes_reserva (protocolo)
            )
          `)
          .eq('cliente_id', clientId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setTrips(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchTrips();
  }, [clientId]);

  return (
    <div className="bg-[#f4f1ea] min-h-screen font-sans pb-32">
      <nav className="sticky top-0 z-50 border-b border-black/[0.06] bg-[#f4f1ea]/80 backdrop-blur-xl shrink-0">
        <div className="max-w-7xl mx-auto px-5 flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-[#1a1a1a] transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="h-5 w-px bg-black/10" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a1a2e]">
                <Plane className="h-4 w-4 text-[#4dc9f6]" />
              </div>
              <span className="text-sm font-black tracking-tight text-[#1a1a2e]">Minhas Viagens</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-5 py-12">
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a2e] mb-3" style={{ fontFamily: '"Cinzel", serif', fontWeight: 700 }}>
            Minhas Viagens
          </h1>
          <p className="text-neutral-600">
            Acompanhe o status das suas viagens, vouchers e documentação.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
            <Loader2 className="h-10 w-10 animate-spin mb-4" />
            <p className="font-medium">Carregando viagens...</p>
          </div>
        ) : trips.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-black/5">
            <div className="h-20 w-20 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-6">
              <Plane className="h-10 w-10 text-neutral-400" />
            </div>
            <h3 className="text-xl font-bold text-[#1a1a1a] mb-2">Nenhuma viagem encontrada</h3>
            <p className="text-neutral-500 mb-8 max-w-md mx-auto">
              Você ainda não possui viagens confirmadas. Explore nossos pacotes ou solicite um orçamento.
            </p>
            <button
              onClick={() => navigate(routes.marketplace.travelPackages.ofertas())}
              className="px-6 py-3 rounded-xl bg-[#1a1a2e] text-white font-bold hover:bg-[#0c2340] transition-colors"
            >
              Explorar Ofertas
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => {
              const snapshot = trip.viagens_propostas?.snapshot_completo || {};
              const protocolo = trip.viagens_propostas?.viagens_solicitacoes_reserva?.protocolo || 'N/A';
              
              let statusLabel = 'Pendente';
              let statusColor = 'bg-yellow-100 text-yellow-800 border-yellow-200';
              if (trip.status === 'pagamento_confirmado') { statusLabel = 'Pagamento Confirmado'; statusColor = 'bg-blue-100 text-blue-800 border-blue-200'; }
              if (trip.status === 'documentos_disponiveis') { statusLabel = 'Vouchers Disponíveis'; statusColor = 'bg-emerald-100 text-emerald-800 border-emerald-200'; }
              if (trip.status === 'viagem_confirmada') { statusLabel = 'Viagem Confirmada'; statusColor = 'bg-emerald-100 text-emerald-800 border-emerald-200'; }
              if (trip.status === 'concluida') { statusLabel = 'Concluída'; statusColor = 'bg-neutral-100 text-neutral-800 border-neutral-200'; }

              return (
                <div key={trip.id} className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm hover:shadow-xl transition-all border border-black/5 flex flex-col">
                  <div className="flex items-start justify-between mb-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusColor}`}>
                      {statusLabel}
                    </span>
                    <span className="text-xs font-medium text-neutral-400">Ref: {protocolo}</span>
                  </div>
                  
                  <div className="mb-6 flex-1">
                    <h3 className="text-xl font-black text-[#1a1a1a] leading-tight mb-2">
                      {snapshot.titulo || 'Viagem Personalizada'}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-neutral-500 font-medium mb-4">
                      <MapPin className="h-4 w-4 text-[#4dc9f6]" />
                      <span>{snapshot.destino || 'Destino a definir'}</span>
                    </div>
                    
                    <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-neutral-500">Valor Total</span>
                        <span className="font-bold text-[#1a1a1a]">{formatCurrency(trip.valor_pago)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-neutral-500">Data da Compra</span>
                        <span className="font-medium text-neutral-700">
                          {new Date(trip.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-auto">
                    <button 
                      onClick={() => navigate(routes.marketplace.travelPackages.minhaViagem(trip.id))}
                      className="flex-1 py-3 rounded-xl bg-neutral-100 text-[#1a1a1a] font-bold hover:bg-neutral-200 transition-colors text-sm"
                    >
                      Ver Detalhes
                    </button>
                    {trip.status === 'documentos_disponiveis' && (
                      <button className="h-11 w-11 rounded-xl bg-[#1a1a2e] text-white flex items-center justify-center hover:bg-[#0c2340] transition-colors shrink-0">
                        <Download className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
