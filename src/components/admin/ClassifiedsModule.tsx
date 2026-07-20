import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tags, MessageCircle, Landmark, CheckCircle2, XCircle, Search, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface ClassifiedsModuleProps {
  initialTab?: string;
  initialItemId?: string;
  colaboradorId?: string;
  colaboradorNome?: string | null;
}

export function ClassifiedsModule({ initialTab = 'anuncios' }: ClassifiedsModuleProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [ads, setAds] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'anuncios') fetchAds();
    if (activeTab === 'mensagens') fetchMessages();
    if (activeTab === 'financeiro') fetchTransactions();
  }, [activeTab]);

  const fetchAds = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('classificados_anuncios')
      .select('*, clientes(nome, email)')
      .eq('status', 'aguardando_revisao')
      .order('created_at', { ascending: false });
    setAds(data || []);
    setLoading(false);
  };

  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('classificados_mensagens')
      .select('*, classificados_propostas(id, valor_proposta, classificados_anuncios(titulo))')
      .eq('status_moderacao', 'pendente')
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoading(false);
  };

  const fetchTransactions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('classificados_transacoes')
      .select('*, classificados_propostas(valor_proposta, classificados_anuncios(titulo))')
      .eq('status', 'pendente_pagamento')
      .order('created_at', { ascending: false });
    setTransactions(data || []);
    setLoading(false);
  };

  const handleApproveAd = async (id: string) => {
    try {
      const { error } = await supabase.from('classificados_anuncios').update({ status: 'publicado' }).eq('id', id);
      if (error) throw error;
      toast.success('Anúncio aprovado e publicado!');
      fetchAds();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRejectAd = async (id: string) => {
    try {
      const motivo = prompt('Motivo da rejeição:');
      if (!motivo) return;
      const { error } = await supabase.from('classificados_anuncios').update({ status: 'rejeitado', motivo_rejeicao: motivo }).eq('id', id);
      if (error) throw error;
      toast.success('Anúncio rejeitado.');
      fetchAds();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleModerateMessage = async (msgId: string, propId: string, action: 'approve' | 'reject') => {
    try {
      const { data, error } = await supabase.rpc('rpc_moderar_mensagem_classificado', {
        p_mensagem_id: msgId,
        p_proposta_id: propId,
        p_acao: action
      });
      if (error || !data?.success) throw error || new Error(data?.error);
      toast.success(action === 'approve' ? 'Mensagem liberada!' : 'Mensagem bloqueada.');
      fetchMessages();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#1a1a1a]">Gestão de Classificados</h2>
          <p className="text-neutral-500">Moderação de anúncios, mensagens e transações da plataforma GSA.</p>
        </div>
      </div>

      <div className="flex bg-neutral-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('anuncios')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'anuncios' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'
          }`}
        >
          <Tags className="h-4 w-4" /> Anúncios Pendentes
        </button>
        <button
          onClick={() => setActiveTab('mensagens')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'mensagens' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'
          }`}
        >
          <MessageCircle className="h-4 w-4" /> Mensagens
        </button>
        <button
          onClick={() => setActiveTab('financeiro')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'financeiro' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'
          }`}
        >
          <Landmark className="h-4 w-4" /> Transações
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-black/5 overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="p-10 flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-[#1a1a1a] border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="p-6">
            
            {activeTab === 'anuncios' && (
              ads.length === 0 ? <p className="text-neutral-500">Nenhum anúncio pendente de revisão.</p> : (
                <div className="space-y-4">
                  {ads.map(ad => (
                    <div key={ad.id} className="p-4 border border-black/5 rounded-2xl flex items-center justify-between hover:bg-neutral-50">
                      <div>
                        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{ad.categoria}</div>
                        <h4 className="font-black text-lg text-[#1a1a1a]">{ad.titulo}</h4>
                        <div className="text-sm text-neutral-500">
                          Preço: R$ {ad.preco} • Vendedor: {ad.clientes?.nome}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleApproveAd(ad.id)} className="px-4 py-2 bg-emerald-100 text-emerald-700 font-bold rounded-lg hover:bg-emerald-200">
                          Aprovar
                        </button>
                        <button onClick={() => handleRejectAd(ad.id)} className="px-4 py-2 bg-red-100 text-red-700 font-bold rounded-lg hover:bg-red-200">
                          Rejeitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'mensagens' && (
              messages.length === 0 ? <p className="text-neutral-500">Nenhuma mensagem pendente de moderação.</p> : (
                <div className="space-y-4">
                  {messages.map(msg => (
                    <div key={msg.id} className="p-4 border border-amber-200 bg-amber-50 rounded-2xl flex flex-col md:flex-row gap-4 justify-between">
                      <div className="flex-1">
                        <div className="text-xs font-bold text-neutral-500 mb-1">
                          Anúncio: {msg.classificados_propostas?.classificados_anuncios?.titulo}
                        </div>
                        <p className="font-medium text-neutral-900 bg-white p-3 rounded-lg border border-black/5">
                          "{msg.conteudo}"
                        </p>
                        <div className="text-xs text-neutral-400 mt-2">Remetente: {msg.remetente_id}</div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0 justify-center">
                        <button onClick={() => handleModerateMessage(msg.id, msg.proposta_id, 'approve')} className="px-4 py-2 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" /> Aprovar Envio
                        </button>
                        <button onClick={() => handleModerateMessage(msg.id, msg.proposta_id, 'reject')} className="px-4 py-2 bg-neutral-200 text-neutral-700 font-bold rounded-lg hover:bg-neutral-300 flex items-center gap-2">
                          <XCircle className="h-4 w-4" /> Bloquear (Contato direto)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'financeiro' && (
              transactions.length === 0 ? <p className="text-neutral-500">Nenhuma transação pendente.</p> : (
                <div className="space-y-4">
                  {transactions.map(txn => (
                    <div key={txn.id} className="p-4 border border-black/5 rounded-2xl flex items-center justify-between hover:bg-neutral-50">
                      <div>
                        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                          Venda: {txn.classificados_propostas?.classificados_anuncios?.titulo}
                        </div>
                        <h4 className="font-black text-lg text-[#1a1a1a]">Comissão GSA: R$ {txn.valor_comissao}</h4>
                        <div className="text-sm text-neutral-500">
                          Valor total: R$ {txn.classificados_propostas?.valor_proposta}
                        </div>
                      </div>
                      <div>
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 font-bold rounded-full text-xs">
                          Aguardando Pagamento da Fatura
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

          </div>
        )}
      </div>
    </div>
  );
}
