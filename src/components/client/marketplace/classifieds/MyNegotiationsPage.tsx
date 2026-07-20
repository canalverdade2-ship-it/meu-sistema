import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Handshake, AlertTriangle, Shield, CheckCircle2, ChevronRight, XCircle } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';

export function MyNegotiationsPage({ clientId }: { clientId: string }) {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'comprando' | 'vendendo'>('comprando');

  useEffect(() => {
    fetchProposals();
  }, [clientId, tab]);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const field = tab === 'comprando' ? 'comprador_id' : 'vendedor_id';
      
      const { data, error } = await supabase
        .from('classificados_propostas')
        .select(`
          *,
          classificados_anuncios(titulo, preco, slug, categoria),
          classificados_transacoes(status)
        `)
        .eq(field, clientId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProposals(data || []);
    } catch (err) {
      console.error('Error fetching proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: any = {
      nova: { color: 'bg-blue-100 text-blue-700', label: 'Nova' },
      em_analise_gsa: { color: 'bg-amber-100 text-amber-700', label: 'Em Análise GSA' },
      aguardando_vendedor: { color: 'bg-orange-100 text-orange-700', label: 'Aguardando Vendedor' },
      aguardando_comprador: { color: 'bg-orange-100 text-orange-700', label: 'Aguardando Comprador' },
      contraproposta: { color: 'bg-purple-100 text-purple-700', label: 'Contraproposta' },
      aceita: { color: 'bg-emerald-100 text-emerald-700', label: 'Aceita' },
      rejeitada: { color: 'bg-red-100 text-red-700', label: 'Rejeitada' },
    };
    const c = configs[status] || { color: 'bg-neutral-100 text-neutral-600', label: status };
    return <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${c.color}`}>{c.label}</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-[#1a1a1a]">Minhas Negociações</h2>
        <p className="text-neutral-500">Acompanhe suas propostas e converse com segurança via GSA.</p>
      </div>

      <div className="flex bg-neutral-200/50 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('comprando')}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
            tab === 'comprando' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'
          }`}
        >
          Estou Comprando
        </button>
        <button
          onClick={() => setTab('vendendo')}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
            tab === 'vendendo' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'
          }`}
        >
          Estou Vendendo
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-black/5 overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-[#1a1a1a] border-t-transparent rounded-full" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="p-16 flex flex-col items-center text-center">
            <div className="h-20 w-20 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
              <Handshake className="h-10 w-10 text-neutral-400" />
            </div>
            <h3 className="text-xl font-bold text-neutral-900 mb-2">Nenhuma negociação encontrada</h3>
            <p className="text-neutral-500 max-w-sm mb-6">Você ainda não tem propostas nesta categoria.</p>
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {proposals.map(prop => (
              <div key={prop.id} className="p-6 hover:bg-neutral-50 transition-colors">
                <div className="flex flex-col md:flex-row gap-6">
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                        {prop.classificados_anuncios?.categoria}
                      </span>
                      {getStatusBadge(prop.status)}
                    </div>
                    
                    <h4 className="text-xl font-black text-[#1a1a1a] mb-1 truncate">
                      {prop.classificados_anuncios?.titulo}
                    </h4>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 mt-4">
                      <div>
                        <div className="text-xs text-neutral-500 font-medium">Valor do Anúncio</div>
                        <div className="font-bold text-neutral-900">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prop.classificados_anuncios?.preco)}
                        </div>
                      </div>
                      <div className="hidden sm:block w-px h-8 bg-neutral-200" />
                      <div>
                        <div className="text-xs text-[#e8a838] font-bold">Proposta Ofertada</div>
                        <div className="font-black text-lg text-[#1a1a1a]">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prop.valor_proposta)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 shrink-0 w-full md:w-64 border-t md:border-t-0 md:border-l border-black/5 pt-4 md:pt-0 md:pl-6 justify-center">
                    {prop.status === 'aceita' ? (
                      <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center">
                        <CheckCircle2 className="h-6 w-6 mb-2" />
                        <span className="font-bold text-sm">Negócio Fechado!</span>
                        <span className="text-xs mt-1 opacity-80">Aguardando instruções de pagamento.</span>
                      </div>
                    ) : prop.status === 'rejeitada' ? (
                      <div className="bg-red-50 text-red-700 p-4 rounded-2xl border border-red-100 flex flex-col items-center justify-center text-center">
                        <XCircle className="h-6 w-6 mb-2" />
                        <span className="font-bold text-sm">Proposta Recusada</span>
                      </div>
                    ) : (
                      <>
                        <button className="w-full py-3 bg-[#1a1a1a] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors">
                          <MessageCircle className="h-4 w-4" /> Abrir Chat Moderado
                        </button>
                        <p className="text-[10px] text-center text-neutral-400 font-medium px-2 leading-tight">
                          <Shield className="h-3 w-3 inline mr-1 text-[#e8a838]" />
                          Mensagens mediadas pela GSA.
                        </p>
                      </>
                    )}
                  </div>
                  
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
