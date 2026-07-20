import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Tag, CheckCircle, Clock, Zap, History } from 'lucide-react';
import { formatDate } from '../../lib/utils';

interface PrestadorPromocoesProps {
  prestadorId: string;
  initialItemId?: string;
}

export function PrestadorPromocoes({ prestadorId, initialItemId }: PrestadorPromocoesProps) {
  const [promocoes, setPromocoes] = useState<any[]>([]);
  const [ativacoes, setAtivacoes] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'ativas' | 'encerradas'>('ativas');
  const [loading, setLoading] = useState(true);

  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (initialItemId && promocoes.length > 0) {
      const promo = promocoes.find(p => p.id === initialItemId);
      if (promo) {
        setTimeout(() => {
          const element = document.getElementById(`promo-${initialItemId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedItemId(initialItemId);
            setTimeout(() => setHighlightedItemId(null), 3000);
          }
        }, 400);
      }
    }
  }, [initialItemId, promocoes.length]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`prestador-promocoes-${prestadorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_promocoes' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_promocoes_ativacoes', filter: `prestador_id=eq.${prestadorId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [prestadorId, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch promotions
      // Note: expiration is now handled automatically by a DB trigger (trg_auto_expire_promocoes)
      let query = supabase
        .from('prestador_promocoes')
        .select('*');

      if (!initialItemId) {
        query = query.eq('status', activeTab === 'ativas' ? 'ativa' : 'encerrada');
      }

      const { data: promoData, error: promoError } = await query.order('created_at', { ascending: false });

      if (promoError) {
        if (promoError.code === '42P01') {
          console.warn('Tabela prestador_promocoes não existe ainda.');
          setPromocoes([]);
          setAtivacoes([]);
          return;
        }
        throw promoError;
      }

      if (promoData && initialItemId) {
        const target = promoData.find(p => p.id === initialItemId);
        if (target) {
          setActiveTab(target.status === 'ativa' ? 'ativas' : 'encerradas');
        }
      }

      // Fetch activations for this provider
      const { data: ativData, error: ativError } = await supabase
        .from('prestador_promocoes_ativacoes')
        .select('*')
        .eq('prestador_id', prestadorId);

      if (ativError) throw ativError;

      setPromocoes(promoData || []);
      setAtivacoes(ativData || []);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao buscar promoções.');
    } finally {
      setLoading(false);
    }
  };

  const ativarPromocao = async (promocaoId: string) => {
    try {
      const { error } = await supabase
        .from('prestador_promocoes_ativacoes')
        .insert([{
          prestador_id: prestadorId,
          promocao_id: promocaoId,
          ativa: true
        }]);
      
      if (error) throw error;
      toast.success('Promoção ativada com sucesso!');
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao ativar a promoção.');
    }
  };

  if (loading) return <div className="py-12 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-fuchsia-600 border-t-transparent animate-spin"/></div>;

  const isAtivada = (promoId: string) => ativacoes.some(a => a.promocao_id === promoId && a.ativa);

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex gap-2 p-1 bg-neutral-100 rounded-2xl w-max border border-neutral-200">
        <button
          onClick={() => setActiveTab('ativas')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'ativas' 
              ? 'bg-white text-fuchsia-600 shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <Zap className="w-4 h-4" />
          Campanhas Ativas
        </button>
        <button
          onClick={() => setActiveTab('encerradas')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'encerradas' 
              ? 'bg-white text-fuchsia-600 shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <History className="w-4 h-4" />
          Meu Histórico
        </button>
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-fuchsia-50/50">
          <div>
            <h3 className="text-lg font-medium text-neutral-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-fuchsia-600" />
              {activeTab === 'ativas' ? 'Promoções e Campanhas' : 'Histórico de Campanhas'}
            </h3>
            <p className="text-sm text-neutral-500 mt-1">
              {activeTab === 'ativas' 
                ? 'Participe das campanhas para aumentar seus ganhos.' 
                : 'Veja as campanhas em que você já participou.'}
            </p>
          </div>
          <span className="bg-fuchsia-100 text-fuchsia-700 px-3 py-1 rounded-full text-sm font-bold">
            {promocoes.length} campanhas
          </span>
        </div>
        
        {promocoes.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">
            {activeTab === 'ativas' ? (
              <>
                <Tag className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <p className="font-medium text-neutral-900">Nenhuma promoção ativa no momento</p>
                <p className="text-sm mt-1">Fique atento, novas promoções podem surgir a qualquer momento.</p>
              </>
            ) : (
              <>
                <History className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <p className="font-medium text-neutral-900">Sem histórico de campanhas</p>
                <p className="text-sm mt-1">Sua participação em campanhas encerradas aparecerá aqui.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
            {promocoes.map(promo => {
              const ativada = isAtivada(promo.id);
              return (
                <div 
                  id={`promo-${promo.id}`}
                  key={promo.id} 
                  className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${
                    highlightedItemId === promo.id 
                      ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500 scale-[1.02] z-10 shadow-lg' 
                      : ativada ? 'border-fuchsia-200 bg-fuchsia-50/30' : 'border-neutral-200 bg-white'
                  } p-6`}
                >
                  {ativada && (
                    <div className="absolute top-0 right-0 p-4">
                      <div className="bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Participando
                      </div>
                    </div>
                  )}
                  
                  <div className="w-12 h-12 bg-fuchsia-100 text-fuchsia-600 rounded-xl flex items-center justify-center mb-4">
                    <Tag className="w-6 h-6" />
                  </div>
                  
                  <h4 className="text-xl font-bold text-neutral-900 mb-2">{promo.titulo}</h4>
                  <p className="text-sm text-neutral-600 mb-4">{promo.descricao}</p>
                  
                  {promo.regras && (
                    <div className="bg-neutral-50 rounded-lg p-3 text-xs text-neutral-500 mb-6 border border-neutral-100">
                      <strong>Regras: </strong> {promo.regras}
                    </div>
                  )}
                  
                  {activeTab === 'ativas' ? (
                    promo.data_fim && (
                      <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-4 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        Válido até: {formatDate(promo.data_fim)}
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-red-500 mb-4 font-bold uppercase tracking-widest">
                      <Clock className="w-3.5 h-3.5" />
                      Campanha Encerrada
                    </div>
                  )}

                  {!ativada && activeTab === 'ativas' && (
                    <button
                      onClick={() => ativarPromocao(promo.id)}
                      className="w-full bg-[#1a1a1a] hover:bg-black text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      Quero Participar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
