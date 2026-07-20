import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../../ui/Modal';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { toast } from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
// ADD ICONS AS NEEDED
import { Package, History, Clock, Trash2, DollarSign, CreditCard, RefreshCcw, ShoppingBag } from 'lucide-react';


export interface StoreHubPurchasesProps {
  isPurchasesModalOpen: boolean;
  setIsPurchasesModalOpen: (open: boolean) => void;
  setSelectedOrderId: (id: string | null) => void;
  loading: boolean;
  allPurchases: any[];
  groupedPurchases: (purchases: any[]) => any[];
  handleCancelOrder: (order: any) => void;
  isProcessingPayment: boolean;
  handlePayOrder: (order: any) => void;
  setSelectedOrderDetail: (order: any) => void;
  setCancelRequestOrder: (order: any) => void;
  setSelectedOrderTimeline: (order: any) => void;
  onNavigate?: (path: string) => void;
}

export default function StoreHubPurchases({
  isPurchasesModalOpen,
  setIsPurchasesModalOpen,
  setSelectedOrderId,
  loading,
  allPurchases,
  groupedPurchases,
  handleCancelOrder,
  isProcessingPayment,
  handlePayOrder,
  setSelectedOrderDetail,
  setCancelRequestOrder,
  setSelectedOrderTimeline,
  onNavigate
}: StoreHubPurchasesProps) {
  const [purchasesTab, setPurchasesTab] = useState<'pendentes' | 'pagos' | 'cancelados'>('pendentes');

  return (
    <Modal isOpen={isPurchasesModalOpen} onClose={() => { setIsPurchasesModalOpen(false); setSelectedOrderId(null); }} title="Minhas Compras" size="wide">
            <div className="space-y-6">
              {loading ? (
                <div className="flex justify-center py-20">
                  <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : allPurchases.length > 0 ? (
                <div className="space-y-6">
                  {/* Tab Navigation */}
                  <div className="flex p-1 bg-neutral-100 rounded-2xl gap-1">
                    {(['pendentes', 'pagos', 'cancelados'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setPurchasesTab(tab)}
                        className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                          purchasesTab === tab 
                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' 
                            : 'text-neutral-400 hover:text-neutral-600'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
    
                  <div className="grid grid-cols-1 gap-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
                    {groupedPurchases(allPurchases)
                      .filter(order => {
                        const orderStatus = order.ordens_items?.[0]?.status || order.status;
                        const isCancelled = orderStatus === 'cancelado';
                        const isCredit = order.descricao_adicional?.includes('Crédito GSA');
                        const isExpiredPending = !isCredit && new Date(order.data_criacao).getTime() + 24 * 60 * 60 * 1000 <= Date.now() && (orderStatus === 'aberto' || orderStatus === 'em_analise');
                        if (purchasesTab === 'pendentes') return (orderStatus === 'aberto' || orderStatus === 'aprovado' || orderStatus === 'em_analise') && !isExpiredPending && !isCancelled && !isCredit;
                        if (purchasesTab === 'pagos') return (['pago', 'em_expedicao', 'em_transporte', 'concluido'].includes(orderStatus) || isCredit) && !isCancelled;
                        if (purchasesTab === 'cancelados') return isCancelled || isExpiredPending;
                        return true;
                      })
                      .map((order) => {
                        const createdDate = new Date(order.data_criacao);
                        const expiryDate = new Date(createdDate.getTime() + 24 * 60 * 60 * 1000);
                        const now = new Date();
                        const timeLeftMs = expiryDate.getTime() - now.getTime();
                        const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
                        const minsLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
                        
                        let orderStatus = order.ordens_items?.[0]?.status || order.status;
                        const isCredit = order.descricao_adicional?.includes('Crédito GSA');
                        const isAssinatura = order.ordens_items?.[0]?.tipo === 'assinatura';
                        
                        // Se for assinatura e já tiver alguma fatura paga, consideramos a assinatura ativa/paga
                        if (isAssinatura && order.ordens_items[0].faturas?.some((f: any) => f.status === 'pago')) {
                          orderStatus = 'pago'; // Força visualização de pago
                        }
                        
                        const isPaid = ['pago', 'em_expedicao', 'em_transporte', 'concluido'].includes(orderStatus) || isCredit;
                        const isCancelled = orderStatus === 'cancelado';
                        const isExpiredPending = !isCredit && timeLeftMs <= 0 && (orderStatus === 'aberto' || orderStatus === 'em_analise');
                        const isExpired = isCancelled || isExpiredPending;
                        const isAwaiting = (orderStatus === 'aberto' || orderStatus === 'aprovado' || orderStatus === 'em_analise') && !isCredit;
    
                        return (
                          <div 
                            key={order.codigo_orcamento} 
                            className="relative group overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-orange-50/50 to-amber-50/50 border-2 border-orange-100/50 hover:border-orange-300 transition-all duration-500 shadow-sm hover:shadow-xl"
                          >
                            <div className={`absolute top-0 left-0 right-0 h-1 transition-colors duration-500 ${
                              isExpired ? 'bg-red-500' :
                              orderStatus === 'concluido' ? 'bg-purple-500' :
                              orderStatus === 'em_transporte' ? 'bg-amber-500' :
                              orderStatus === 'em_expedicao' ? 'bg-blue-500' :
                              orderStatus === 'pago' ? 'bg-emerald-500' :
                              'bg-orange-500'
                            }`} />
    
                            <div className="p-4 md:p-6 relative z-10">
                              <div className="flex flex-col gap-6">
                                <div className="flex flex-wrap items-center gap-4">
                                  <div className="relative h-16 w-16 md:h-20 md:w-20 flex-shrink-0 rounded-full bg-white border-2 border-orange-100 flex items-center justify-center overflow-hidden shadow-sm">
                                    {(order.ordens_items?.[0]?.produtos?.imagem_url || order.ordens_items?.[0]?.assinaturas?.imagem_url) ? (
                                      <img src={order.ordens_items[0].produtos?.imagem_url || order.ordens_items[0].assinaturas?.imagem_url} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      <Package className="w-8 h-8 text-neutral-200" />
                                    )}
                                  </div>
    
                                  {(() => {
                                    let wrapperClass = '';
                                    let dotClass = '';
                                    let labelText = '';
    
                                    if (isExpired) {
                                      wrapperClass = 'bg-red-50 border-red-100 text-red-700';
                                      dotClass = 'bg-red-500';
                                      labelText = 'Cancelado';
                                    } else if (orderStatus === 'concluido') {
                                      wrapperClass = 'bg-purple-50 border-purple-100 text-purple-700';
                                      dotClass = 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]';
                                      labelText = 'Concluído';
                                    } else if (orderStatus === 'em_transporte') {
                                      wrapperClass = 'bg-amber-50 border-amber-100 text-amber-700';
                                      dotClass = 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
                                      labelText = 'Em Transporte';
                                    } else if (orderStatus === 'em_expedicao') {
                                      wrapperClass = 'bg-blue-50 border-blue-100 text-blue-700';
                                      dotClass = 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]';
                                      labelText = 'Em Expedição';
                                    } else if (orderStatus === 'pago' || isPaid) {
                                      wrapperClass = 'bg-emerald-50 border-emerald-100 text-emerald-700';
                                      dotClass = 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
                                      labelText = 'Pago';
                                    } else if (isAwaiting) {
                                      wrapperClass = 'bg-white border-orange-200 text-orange-700 animate-pulse ring-4 ring-orange-500/10';
                                      dotClass = 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]';
                                      labelText = 'Aguardando Pagamento';
                                    } else {
                                      wrapperClass = 'bg-neutral-50 border-neutral-100 text-neutral-700';
                                      dotClass = 'bg-neutral-500';
                                      labelText = 'Status Indeterminado';
                                    }
    
                                    return (
                                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm border transition-all ${wrapperClass}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                                        <span className="text-[10px] font-black uppercase tracking-wider">
                                          {labelText}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </div>
    
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-2xl md:text-3xl font-black text-[#1a1a1a] tracking-tighter mb-2 group-hover:text-orange-600 transition-colors">
                                      {order.codigo_orcamento?.startsWith('#') ? order.codigo_orcamento : `#${order.codigo_orcamento}`}
                                    </h4>
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <History className="w-3.5 h-3.5 text-orange-600/40" />
                                        <p className="text-xs text-neutral-600 font-bold uppercase tracking-wide">
                                          Comprado em {formatDate(order.data_criacao)}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Package className="w-3.5 h-3.5 text-orange-600/40" />
                                        <p className="text-[10px] text-neutral-400 font-bold uppercase">
                                          {order.ordens_items?.length || order.quantidade || 1} {(order.ordens_items?.length || order.quantidade || 1) === 1 ? 'item' : 'itens'} no pedido
                                        </p>
                                      </div>
                                    </div>
                                  </div>
    
                                  <div className="flex flex-row md:flex-col md:items-end justify-between md:justify-center border-t md:border-t-0 md:border-l border-orange-200/50 pt-5 md:pt-0 md:pl-8 gap-3 bg-gradient-to-br from-orange-100/40 via-orange-50/30 to-amber-100/40 md:bg-none -mx-4 -mb-4 md:m-0 p-5 md:p-2 rounded-b-[1.5rem] md:rounded-none shadow-inner md:shadow-none">
                                    <div className="text-left md:text-right">
                                      <span className="text-[10px] font-black text-orange-900/40 uppercase tracking-[0.2em] block mb-1">Valor Total</span>
                                      <span className="text-2xl md:text-3xl font-black text-[#1a1a1a] tracking-tighter tabular-nums leading-none">
                                        {formatCurrency(order.total)}
                                      </span>
                                    </div>
                                    
                                    {isAwaiting && !isExpired && (
                                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/60 backdrop-blur-sm rounded-xl border border-orange-200 shadow-sm transition-transform hover:scale-105">
                                        <Clock className="w-3.5 h-3.5 text-orange-600" />
                                        <span className="text-[10px] font-black text-orange-700 uppercase tracking-wide">
                                          Expira em {hoursLeft}h {minsLeft}m
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
    
                              <div className="mt-5 pt-5 border-t-2 border-orange-100/50 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                                {isAwaiting && !isExpired && !order.descricao_adicional?.includes('Crédito GSA') && order.total > 0 && (
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    disabled={isProcessingPayment}
                                    onClick={() => {
                                      setIsPurchasesModalOpen(false);
                                      handlePayOrder(order);
                                    }}
                                    className="px-5 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-all w-full sm:w-auto flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 border border-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                    title="Realizar Pagamento"
                                  >
                                    <CreditCard className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                      {isProcessingPayment ? 'Gerando Fatura...' : 'Realizar Pagamento'}
                                    </span>
                                  </motion.button>
                                )}

                                {isAwaiting && !isExpired && !order.descricao_adicional?.includes('Crédito GSA') && order.total > 0 && (
                                  <motion.button 
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    disabled={loading}
                                    onClick={() => handleCancelOrder(order)}
                                    className="px-4 py-2.5 bg-amber-400 text-amber-950 hover:bg-amber-500 rounded-xl transition-all w-full sm:w-auto flex items-center justify-center gap-2 shadow-sm border border-amber-500"
                                    title="Cancelar Pedido"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Cancelar Pedido</span>
                                  </motion.button>
                                )}
                                
                                <motion.button 
                                  whileHover={{ scale: 1.05, backgroundColor: '#f1f5f9' }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setSelectedOrderDetail(order)}
                                  className="w-full sm:w-auto px-5 py-2.5 bg-white text-neutral-600 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border border-neutral-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                                >
                                  Detalhes
                                </motion.button>
    
                                {isPaid && ['aprovado', 'pago'].includes(orderStatus) && (
                                  <motion.button 
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setCancelRequestOrder(order)}
                                    className="px-5 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-xl transition-all w-full sm:w-auto flex items-center justify-center gap-2 shadow-lg shadow-red-200 border border-red-700"
                                    title="Cancelar Compra"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Cancelar Compra</span>
                                  </motion.button>
                                )}
    
                                {isPaid && (
                                  <motion.button 
                                    whileHover={{ scale: 1.05, y: -2 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setSelectedOrderTimeline(order)}
                                    className="w-full sm:w-auto px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border border-indigo-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                    Acompanhar Pedido
                                  </motion.button>
                                )}
    
                                {isAssinatura && isPaid && (
                                  <motion.button 
                                    whileHover={{ scale: 1.05, y: -2 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                      if (onNavigate) {
                                        setIsPurchasesModalOpen(false);
                                        handlePayOrder(order);
                                      }
                                    }}
                                    className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:shadow-xl hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2 relative overflow-hidden group/pay"
                                  >
                                    <CreditCard className="w-3.5 h-3.5" />
                                    PRÓXIMAS MENSALIDADES
                                  </motion.button>
                                )}
    

                              </div>
                            </div>
                          </div>
                        );
                      })}
                    
                    {groupedPurchases(allPurchases).filter(order => {
                      let orderStatus = order.ordens_items?.[0]?.status || order.status;
                      const isAssinatura = order.ordens_items?.[0]?.tipo === 'assinatura';
                      if (isAssinatura && order.ordens_items[0].faturas?.some((f: any) => f.status === 'pago')) {
                        orderStatus = 'pago';
                      }
                      
                      const isCancelled = orderStatus === 'cancelado';
                      const isCredit = order.descricao_adicional?.includes('Crédito GSA');
                      const isExpiredPending = !isCredit && new Date(order.data_criacao).getTime() + 24 * 60 * 60 * 1000 <= Date.now() && (orderStatus === 'aberto' || orderStatus === 'em_analise');
                      if (purchasesTab === 'pendentes') return (orderStatus === 'aberto' || orderStatus === 'aprovado' || orderStatus === 'em_analise') && !isExpiredPending && !isCancelled && !isCredit;
                      if (purchasesTab === 'pagos') return (['pago', 'em_expedicao', 'em_transporte', 'concluido'].includes(orderStatus) || isCredit) && !isCancelled;
                      if (purchasesTab === 'cancelados') return isCancelled || isExpiredPending;
                      return true;
                    }).length === 0 && (
                      <div className="py-12 text-center bg-neutral-50 rounded-[2rem] border-2 border-dashed border-neutral-200">
                        <ShoppingBag className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                        <p className="text-neutral-400 font-bold text-xs uppercase tracking-widest">Nenhum pedido nesta categoria</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="mx-auto w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
                    <ShoppingBag className="w-8 h-8 text-neutral-300" />
                  </div>
                  <p className="text-neutral-500 font-medium">Você ainda não realizou nenhuma compra.</p>
                </div>
              )}
              <button 
                onClick={() => { setIsPurchasesModalOpen(false); setSelectedOrderId(null); }}
                className="w-full mt-6 py-4 bg-neutral-100 text-neutral-600 font-bold rounded-2xl hover:bg-neutral-200 transition-all"
              >
                Fechar
              </button>
            </div>
          </Modal>
  );
}
