// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../../ui/Modal';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { toast } from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
// ADD ICONS AS NEEDED
import * as LucideIcons from 'lucide-react';

export default function StoreHubRefunds(props: any) {
  const { name, search } = props; // Adjust props as needed
  return (
    <Modal isOpen={isRefundsModalOpen} onClose={() => setIsRefundsModalOpen(false)} title="Minhas Solicitações de Reembolsos" size="wide">
            <div className="space-y-6">
              {loadingRefunds ? (
                <div className="flex justify-center py-20">
                  <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : refunds.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {refunds.map((refund) => {
                    const deadline = new Date(refund.prazo_pagamento);
                    const today = new Date();
                    const diffTime = deadline.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const isOverdue = diffDays <= 0;
    
                    // Nível da Timeline de Reembolso:
                    // 1. Solicitado (Sempre)
                    // 2. Em Processamento (Pendente)
                    // 3. Concluído (Pago)
                    let currentLevel = 1;
                    if (refund.status === 'pendente') {
                      currentLevel = 2;
                    } else if (refund.status === 'pago') {
                      currentLevel = 3;
                    }
    
                    return (
                      <div 
                        key={refund.id} 
                        className="relative overflow-hidden rounded-[2rem] bg-neutral-50 border border-neutral-200 p-6 flex flex-col justify-between"
                      >
                        <div className="space-y-4">
                          {/* Cabeçalho Card */}
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                  {refund.codigo_reembolso}
                                </span>
                                {(refund.ordens_compra?.orcamento_id || refund.ordens_assinatura?.orcamento_id) && (
                                  <button
                                    onClick={() => {
                                      const orcamentoId = refund.ordens_compra?.orcamento_id || refund.ordens_assinatura?.orcamento_id;
                                      const orderToOpen = allPurchases.find(p => p.id === orcamentoId);
                                      setIsRefundsModalOpen(false);
                                      if (orderToOpen) {
                                        setSelectedOrderDetail(orderToOpen);
                                      } else {
                                        setSelectedOrderId(orcamentoId);
                                        setIsPurchasesModalOpen(true);
                                      }
                                    }}
                                    className="text-[9px] font-black text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-md uppercase tracking-wider transition-colors inline-flex items-center gap-1"
                                    title="Ver Pedido Original"
                                  >
                                    REF: #{refund.ordens_compra?.orcamentos?.codigo_orcamento || refund.ordens_assinatura?.orcamentos?.codigo_orcamento || refund.ordens_compra?.codigo_ordem || refund.ordens_assinatura?.codigo_ordem || 'PEDIDO'}
                                  </button>
                                )}
                              </div>
                              <h4 className="text-lg font-black text-neutral-900 tracking-tight mt-1">
                                {formatCurrency(refund.valor_reembolso)}
                              </h4>
                            </div>
                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border ${
                              refund.status === 'pago'
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : refund.status === 'cancelado'
                                ? 'bg-red-50 text-red-600 border-red-200'
                                : isOverdue
                                ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
                                : 'bg-amber-50 text-amber-600 border-amber-200'
                            }`}>
                              {refund.status === 'pago' ? 'Pago' : refund.status === 'cancelado' ? 'Cancelado' : `Pendente: ${diffDays}d`}
                            </span>
                          </div>
    
                          {/* Timeline do Reembolso */}
                          {refund.status !== 'cancelado' ? (
                            <div className="bg-white rounded-2xl p-4 border border-neutral-100 space-y-3">
                              <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Status do Estorno</span>
                              <div className="relative pl-5 space-y-4 before:absolute before:left-1.5 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-neutral-100">
                                {/* Fase 1: Solicitado */}
                                <div className="relative flex items-start gap-3">
                                  <div className={`absolute -left-[1.55rem] w-3.5 h-3.5 rounded-full flex items-center justify-center border transition-all ${
                                    currentLevel >= 1 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-neutral-200'
                                  }`}>
                                    {currentLevel >= 1 && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black text-neutral-800 uppercase tracking-wider">Solicitado</p>
                                    <p className="text-[9px] text-neutral-400 font-semibold">Cancelamento registrado pelo Sistema</p>
                                  </div>
                                </div>
    
                                {/* Fase 2: Em Análise / Processamento */}
                                <div className="relative flex items-start gap-3">
                                  <div className={`absolute -left-[1.55rem] w-3.5 h-3.5 rounded-full flex items-center justify-center border transition-all ${
                                    currentLevel >= 2 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-neutral-200'
                                  }`}>
                                    {currentLevel >= 2 && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black text-neutral-800 uppercase tracking-wider">Processando Estorno</p>
                                    <p className="text-[9px] text-neutral-400 font-semibold">
                                      {refund.status === 'pendente' 
                                        ? `Prazo: até ${formatDate(refund.prazo_pagamento)} (${diffDays} dias restantes)` 
                                        : 'Aprovado para pagamento'}
                                    </p>
                                  </div>
                                </div>
    
                                {/* Fase 3: Pago */}
                                <div className="relative flex items-start gap-3">
                                  <div className={`absolute -left-[1.55rem] w-3.5 h-3.5 rounded-full flex items-center justify-center border transition-all ${
                                    currentLevel >= 3 ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-neutral-200'
                                  }`}>
                                    {currentLevel >= 3 && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black text-neutral-800 uppercase tracking-wider">Estorno Concluído</p>
                                    <p className="text-[9px] text-neutral-400 font-semibold">
                                      {refund.status === 'pago' ? `Pago em ${formatDate(refund.data_pagamento)}` : 'Aguardando transferência Pix'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
                              <p className="text-[11px] font-black uppercase tracking-wider mb-1">Solicitação Anulada / Rejeitada</p>
                              <p className="text-[10px] font-medium leading-normal italic">
                                "{refund.observacoes_pagamento || 'Sem notas adicionais.'}"
                              </p>
                            </div>
                          )}
    
                          {/* Motivo do Cancelamento */}
                          <div className="text-[11px] font-semibold text-neutral-600 bg-white rounded-2xl p-4 border border-neutral-100">
                            <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Motivo do Estorno</span>
                            <p className="text-neutral-700 italic font-medium leading-normal">"{refund.motivo_cancelamento}"</p>
                          </div>
                        </div>
    
                        {/* Comprovante */}
                        {refund.status === 'pago' && refund.comprovante_url && (
                          <div className="mt-4 pt-4 border-t border-neutral-200/60">
                            <a
                              href={refund.comprovante_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm"
                            >
                              <FileCheck className="w-4 h-4" />
                              Ver Comprovante Pix
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-20 text-center">
                  <DollarSign className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                    Você não possui solicitações de reembolsos cadastradas.
                  </p>
                </div>
              )}
    
              <button
                onClick={() => setIsRefundsModalOpen(false)}
                className="w-full py-4 bg-neutral-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg"
              >
                Fechar
              </button>
            </div>
          </Modal>
  );
}
