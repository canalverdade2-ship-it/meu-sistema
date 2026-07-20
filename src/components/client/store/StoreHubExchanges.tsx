// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../../ui/Modal';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { toast } from 'react-hot-toast';
import { getProductQuantityPriceBreakdown } from '../../../lib/productPricing';
import { supabase } from '../../../lib/supabase';
import { AlertCircle, CheckCircle2, XCircle, MessageSquare, Package, ShoppingBag, CreditCard, Upload, Trash2, Search, CheckCircle, Clock } from 'lucide-react';
import { uploadMultipleFiles } from '../../../lib/uploadHelper';

const parseDescricaoDetalhada = (desc: string) => {
  try {
    return JSON.parse(desc);
  } catch {
    return desc;
  }
};

export default function StoreHubExchanges(props: any) {
  const { 
    isTrocaModalOpen, closeTrocaModal, setExchangeActiveTab, exchangeActiveTab, 
    myExchangeRequests, loading, recentOrders, setSelectedOrder, selectedOrder,
    selectedExchangeItems, setSelectedExchangeItems, setExchangeCart, exchangeCart,
    trocaReason, setTrocaReason, trocaImages, setTrocaImages,
    isSubmittingTroca, handleSubmitTroca, metodoEntrega, setMetodoEntrega,
    searchProductQuery, setSearchProductQuery, storeProducts, fetchMyExchanges,
    trocaType, setTrocaType, exchangeProductOption, setExchangeProductOption,
    showNewProductSelector, setShowNewProductSelector, handleImageChange, removeImage,
    trocaImagePreviews, loadingExchanges
  } = props;
  return (
    <Modal isOpen={isTrocaModalOpen} onClose={closeTrocaModal} title="Solicitar Troca ou Devolução" size="wide">
            <div className="space-y-6">
              {/* Navegação por Abas do Modal */}
              <div className="flex p-1 bg-neutral-100 rounded-2xl gap-1">
                <button
                  onClick={() => setExchangeActiveTab('nova')}
                  className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-widest rounded-xl transition-all ${exchangeActiveTab === 'nova' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
                >
                  Nova Solicitação
                </button>
                <button
                  onClick={() => { setExchangeActiveTab('acompanhar'); fetchMyExchanges(); }}
                  className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-widest rounded-xl transition-all ${exchangeActiveTab === 'acompanhar' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
                >
                  Acompanhar Solicitações ({myExchangeRequests.length})
                </button>
              </div>
    
              {exchangeActiveTab === 'nova' ? (
                <div className="space-y-6">
                  <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100 mb-2">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800 leading-relaxed font-medium">
                        Selecione um pedido finalizado, escolha quais itens deseja trocar ou devolver, e defina se prefere trocar pelo mesmo produto ou por outros produtos da nossa loja.
                      </p>
                    </div>
                  </div>
    
                  <div className="space-y-4">
                    <label className="text-xs font-black text-neutral-400 uppercase tracking-widest block">1. Selecione o Pedido</label>
                {loading ? (
                  <div className="h-20 bg-neutral-100 rounded-2xl animate-pulse"></div>
                ) : recentOrders.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {recentOrders.map((order) => (
                      <div 
                        key={order.id} 
                        onClick={() => {
                          if (!order.isExpired) {
                            setSelectedOrder(order);
                            setSelectedExchangeItems([]);
                            setExchangeCart([]);
                          }
                        }}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          order.isExpired 
                            ? 'bg-neutral-50 border-neutral-150 text-neutral-400 cursor-not-allowed opacity-75' 
                            : selectedOrder?.id === order.id 
                              ? 'border-indigo-500 bg-indigo-50/50 cursor-pointer' 
                              : 'border-neutral-100 bg-white hover:border-neutral-300 cursor-pointer'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">#{order.codigo_orcamento}</span>
                              {order.isExpired ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 ring-1 ring-rose-200/50">
                                  ⚠️ Prazo Expirado (7 dias)
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/50">
                                  ✅ Disponível (Restam {order.daysRemaining} {order.daysRemaining === 1 ? 'dia' : 'dias'})
                                </span>
                              )}
                            </div>
                            <h5 className={`font-bold text-sm ${order.isExpired ? 'text-neutral-500' : 'text-neutral-900'}`}>{order.produtos?.nome || 'Pedido de Produto'}</h5>
                            <p className="text-[10px] text-neutral-400 font-medium">
                              Entregue em: {order.deliveryDateStr ? formatDate(order.deliveryDateStr) : formatDate(order.data_criacao)}
                            </p>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <span className={`text-sm font-black ${order.isExpired ? 'text-neutral-500' : 'text-neutral-900'}`}>{formatCurrency(order.total)}</span>
                            {selectedOrder?.id === order.id && !order.isExpired && <CheckCircle2 className="w-5 h-5 text-indigo-500" />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500 italic p-4 bg-neutral-50 rounded-xl text-center">Nenhum pedido finalizado encontrado para troca.</p>
                )}
              </div>
    
              {selectedOrder && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pt-4 border-t border-neutral-100">
                  {/* Seleção de itens do pedido */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-neutral-400 uppercase tracking-widest block">2. Selecione os itens a trocar/devolver</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedExchangeItems((selectedOrder.items || []).map((it: any) => it.id))}
                          className="text-[10px] font-black text-indigo-600 uppercase hover:underline"
                        >
                          Selecionar Todos
                        </button>
                        <span className="text-neutral-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedExchangeItems([])}
                          className="text-[10px] font-black text-neutral-500 uppercase hover:underline"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>
    
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                      {selectedOrder.items?.map((item: any) => {
                        const isChecked = selectedExchangeItems.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (isChecked) {
                                setSelectedExchangeItems(prev => prev.filter(id => id !== item.id));
                              } else {
                                setSelectedExchangeItems(prev => [...prev, item.id]);
                              }
                            }}
                            className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer ${isChecked ? 'border-indigo-500 bg-indigo-50/10' : 'border-neutral-100 bg-white hover:border-neutral-200'}`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <div>
                                <p className="text-xs font-bold text-neutral-900">{item.produtos?.nome}</p>
                                <p className="text-[10px] text-neutral-400 font-medium">Qtd: {item.quantidade || 1} | Unitário: {formatCurrency(item.valor_unitario ?? item.produtos?.valor ?? 0)}</p>
                              </div>
                            </div>
                            <span className="text-xs font-black text-neutral-900">{formatCurrency((item.valor_unitario ?? item.produtos?.valor ?? 0) * (item.quantidade || 1))}</span>
                          </div>
                        );
                      })}
                    </div>
    
                    {selectedExchangeItems.length > 0 && (() => {
                      const creditoTroca = selectedOrder.items
                        .filter((it: any) => selectedExchangeItems.includes(it.id))
                        .reduce((acc: number, curr: any) => acc + (curr.valor_unitario ?? curr.produtos?.valor ?? 0) * (curr.quantidade || 1), 0);
                      return (
                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-150 flex justify-between items-center">
                          <span className="text-xs font-black text-emerald-800 uppercase tracking-wider">Crédito Gerado:</span>
                          <span className="text-sm font-black text-emerald-700">{formatCurrency(creditoTroca)}</span>
                        </div>
                      );
                    })()}
                  </div>
    
                  {selectedExchangeItems.length > 0 && (
                    <>
                      {/* Tipo de Solicitação */}
                      <div className="space-y-3">
                        <label className="text-xs font-black text-neutral-400 uppercase tracking-widest block">3. Tipo da Solicitação</label>
                        <div className="grid grid-cols-2 gap-4">
                          <button 
                            type="button"
                            onClick={() => setTrocaType('troca')}
                            className={`py-3 rounded-xl font-bold text-xs uppercase tracking-widest border-2 transition-all ${trocaType === 'troca' ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white shadow-lg' : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300'}`}
                          >
                            Realizar Troca
                          </button>
                          <button 
                            type="button"
                            onClick={() => setTrocaType('devolucao')}
                            className={`py-3 rounded-xl font-bold text-xs uppercase tracking-widest border-2 transition-all ${trocaType === 'devolucao' ? 'bg-amber-600 border-amber-600 text-white shadow-lg' : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300'}`}
                          >
                            Realizar Devolução
                          </button>
                        </div>
                      </div>
    
                      {/* Opções de Substituição para Troca */}
                      {trocaType === 'troca' && (
                        <div className="space-y-3">
                          <label className="text-xs font-black text-neutral-400 uppercase tracking-widest block">4. Substituição do Produto</label>
                          <div className="grid grid-cols-2 gap-4">
                            <button
                              type="button"
                              onClick={() => {
                                setExchangeProductOption('mesmo_produto');
                                setExchangeCart([]);
                              }}
                              className={`py-3 rounded-xl font-bold text-xs uppercase tracking-widest border-2 transition-all ${exchangeProductOption === 'mesmo_produto' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300'}`}
                            >
                              Trocar pelo Mesmo Produto
                            </button>
                            <button
                              type="button"
                              onClick={() => setExchangeProductOption('outro_produto')}
                              className={`py-3 rounded-xl font-bold text-xs uppercase tracking-widest border-2 transition-all ${exchangeProductOption === 'outro_produto' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300'}`}
                            >
                              Trocar por Outros da Loja
                            </button>
                          </div>
    
                          {exchangeProductOption === 'outro_produto' && (
                            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-4">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-neutral-700 uppercase tracking-wider">Produtos Substitutos</span>
                                <button
                                  type="button"
                                  onClick={() => setShowNewProductSelector(!showNewProductSelector)}
                                  className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-3 py-1.5 rounded-xl uppercase transition-colors"
                                >
                                  {showNewProductSelector ? 'Ocultar Seletor' : '➕ Adicionar Produto'}
                                </button>
                              </div>
    
                              {showNewProductSelector && (
                                <div className="space-y-3 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                                  <div className="relative">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
                                    <input
                                      type="text"
                                      placeholder="Pesquise por nome do produto..."
                                      value={searchProductQuery}
                                      onChange={e => setSearchProductQuery(e.target.value)}
                                      className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-xl text-xs"
                                    />
                                  </div>
    
                                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                    {storeProducts
                                      .filter(p => p.nome.toLowerCase().includes(searchProductQuery.toLowerCase()))
                                      .map(prod => {
                                        const isInCart = exchangeCart.some(it => it.produto.id === prod.id);
                                        return (
                                          <div key={prod.id} className="flex justify-between items-center p-2 rounded-lg border border-neutral-100 hover:bg-neutral-50">
                                            <div className="flex items-center gap-2">
                                              {prod.imagem_url && <img src={prod.imagem_url} alt={prod.nome} className="w-8 h-8 rounded object-cover" />}
                                              <div>
                                                <p className="text-xs font-bold text-neutral-800 leading-tight">{prod.nome}</p>
                                                <p className="text-[10px] text-neutral-500 font-mono font-medium">{formatCurrency(prod.valor)}</p>
                                              </div>
                                            </div>
                                            <button
                                              type="button"
                                              disabled={isInCart}
                                              onClick={() => {
                                                setExchangeCart(prev => [...prev, { produto: prod, quantity: 1, quantidade: 1 }]);
                                                toast.success(`${prod.nome} selecionado.`);
                                              }}
                                              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${isInCart ? 'bg-neutral-100 text-neutral-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                            >
                                              {isInCart ? 'Selecionado' : 'Escolher'}
                                            </button>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              )}
    
                              {exchangeCart.length > 0 ? (
                                <div className="space-y-2">
                                  {exchangeCart.map((item, idx) => (
                                    <div key={item.produto.id} className="flex items-center justify-between p-3 bg-white border border-neutral-100 rounded-xl">
                                      <div className="flex items-center gap-3">
                                        {item.produto.imagem_url && <img src={item.produto.imagem_url} alt={item.produto.nome} className="w-10 h-10 rounded object-cover" />}
                                        <div>
                                          <p className="text-xs font-bold text-neutral-900 leading-tight">{item.produto.nome}</p>
                                          <p className="text-[10px] text-neutral-500 font-medium">{formatCurrency(item.produto.valor)}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center border border-neutral-200 rounded-lg overflow-hidden bg-neutral-50">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (item.quantidade > 1) {
                                                setExchangeCart(prev => prev.map((it, i) => i === idx ? { ...it, quantidade: it.quantidade - 1 } : it));
                                              } else {
                                                setExchangeCart(prev => prev.filter((_, i) => i !== idx));
                                              }
                                            }}
                                            className="px-2.5 py-1 text-xs font-bold hover:bg-neutral-200 transition-colors"
                                          >
                                            -
                                          </button>
                                          <span className="px-3 text-xs font-bold text-neutral-800">{item.quantidade}</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setExchangeCart(prev => prev.map((it, i) => i === idx ? { ...it, quantidade: it.quantidade + 1 } : it));
                                            }}
                                            className="px-2.5 py-1 text-xs font-bold hover:bg-neutral-200 transition-colors"
                                          >
                                            +
                                          </button>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setExchangeCart(prev => prev.filter((_, i) => i !== idx))}
                                          className="text-neutral-400 hover:text-rose-600 transition-colors"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
    
                                  {(() => {
                                    const totalNovosProdutos = exchangeCart.reduce((sum, item) => sum + getProductQuantityPriceBreakdown(item.produto, item.quantidade).subtotalFinal, 0);
                                    const creditoTroca = selectedOrder.items
                                      .filter((it: any) => selectedExchangeItems.includes(it.id))
                                      .reduce((acc: number, curr: any) => acc + (curr.valor_unitario ?? curr.produtos?.valor ?? 0) * (curr.quantidade || 1), 0);
                                    const diferenca = totalNovosProdutos - creditoTroca;
                                    const isValorMenor = totalNovosProdutos < creditoTroca;
    
                                    return (
                                      <div className="pt-3 border-t border-neutral-200 space-y-2">
                                        <div className="flex justify-between items-center text-xs">
                                          <span className="text-neutral-500 font-bold">Total Novos Produtos:</span>
                                          <span className="font-black text-neutral-900">{formatCurrency(totalNovosProdutos)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                          <span className="text-neutral-500 font-bold">Crédito de Troca:</span>
                                          <span className="font-black text-neutral-900">- {formatCurrency(creditoTroca)}</span>
                                        </div>
    
                                        {diferenca > 0 ? (
                                          <div className="p-3 bg-blue-50 border border-blue-150 rounded-xl space-y-1">
                                            <div className="flex justify-between items-center text-xs text-blue-900 font-black">
                                              <span>Diferença a Pagar:</span>
                                              <span>{formatCurrency(diferenca)}</span>
                                            </div>
                                            <p className="text-[10px] text-blue-700 leading-normal">
                                              ⚠️ <strong>Atenção:</strong> Será gerada uma fatura referente à diferença de <strong>{formatCurrency(diferenca)}</strong> com vencimento em <strong>2 dias</strong> após a aprovação do Sistema.
                                            </p>
                                          </div>
                                        ) : isValorMenor ? (
                                          <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl">
                                            <p className="text-[10px] text-rose-700 leading-normal font-bold">
                                              ❌ A soma dos novos produtos ({formatCurrency(totalNovosProdutos)}) deve ser <strong>igual ou maior</strong> ao crédito de troca ({formatCurrency(creditoTroca)}). Adicione mais produtos substitutos.
                                            </p>
                                          </div>
                                        ) : (
                                          <div className="p-3 bg-emerald-50 border border-emerald-150 rounded-xl">
                                            <p className="text-[10px] text-emerald-700 leading-normal font-bold">
                                              ✅ Valor da troca equivale exatamente ao crédito. Nenhuma cobrança adicional será gerada.
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              ) : (
                                <p className="text-xs text-neutral-500 italic text-center py-4 bg-white rounded-xl border border-neutral-150">
                                  Nenhum produto substituto selecionado. Adicione clicando no botão acima.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
    
                      {/* Método de Entrega */}
                      <div>
                        <label className="text-xs font-black text-neutral-400 uppercase tracking-widest block mb-3">5. Método de Devolução</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setMetodoEntrega('correios')}
                            className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col gap-1 ${
                              metodoEntrega === 'correios' ? 'border-indigo-600 bg-indigo-50/50' : 'border-neutral-200 bg-white hover:border-indigo-300 hover:bg-neutral-50'
                            }`}
                          >
                            <span className={`text-sm font-black ${metodoEntrega === 'correios' ? 'text-indigo-900' : 'text-neutral-700'}`}>📦 Via Correios</span>
                            <span className="text-[10px] text-neutral-500 font-medium">Você envia pelos correios e solicita o reembolso do frete na aba de Reembolsos.</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setMetodoEntrega('pessoalmente')}
                            className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col gap-1 ${
                              metodoEntrega === 'pessoalmente' ? 'border-indigo-600 bg-indigo-50/50' : 'border-neutral-200 bg-white hover:border-indigo-300 hover:bg-neutral-50'
                            }`}
                          >
                            <span className={`text-sm font-black ${metodoEntrega === 'pessoalmente' ? 'text-indigo-900' : 'text-neutral-700'}`}>🤝 Presencial na GSA</span>
                            <span className="text-[10px] text-neutral-500 font-medium">Agendaremos uma data e hora para você comparecer à sede.</span>
                          </button>
                        </div>
                      </div>
    
                      {/* Motivo */}
                      <div>
                        <label className="text-xs font-black text-neutral-400 uppercase tracking-widest block mb-2">6. Motivo da Solicitação</label>
                        <textarea 
                          value={trocaReason}
                          onChange={(e) => setTrocaReason(e.target.value)}
                          placeholder="Explique detalhadamente o motivo da troca ou devolução do produto..."
                          className="w-full bg-white border border-neutral-200 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                          rows={3}
                        />
                      </div>
    
                      {/* Imagens */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-black text-neutral-400 uppercase tracking-widest block">
                            7. Imagens do Produto <span className="text-rose-500 font-bold">* Obrigatório (Mínimo 1, Máximo 5)</span>
                          </label>
                          <span className="text-[11px] font-bold text-[#1a1a1a] bg-neutral-100 px-2 py-0.5 rounded-full">
                            {trocaImages.length} de 5
                          </span>
                        </div>
    
                        {trocaImages.length < 5 && (
                          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-neutral-200 rounded-2xl cursor-pointer hover:bg-neutral-50 hover:border-indigo-400 transition-all group p-4">
                            <div className="flex flex-col items-center justify-center text-center">
                              <Upload className="w-5 h-5 text-indigo-600 mb-1 group-hover:scale-110 transition-transform" />
                              <span className="text-xs font-bold text-neutral-700">Selecione fotos do produto</span>
                            </div>
                            <input 
                              type="file" 
                              multiple 
                              accept="image/*" 
                              onChange={handleImageChange} 
                              className="hidden" 
                            />
                          </label>
                        )}
    
                        {trocaImagePreviews.length > 0 && (
                          <div className="grid grid-cols-5 gap-3 pt-2">
                            {trocaImagePreviews.map((preview, idx) => (
                              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-neutral-200 group bg-neutral-50 shadow-sm animate-in zoom-in-95 duration-200">
                                <img 
                                  src={preview} 
                                  alt={`Preview ${idx + 1}`} 
                                  className="w-full h-full object-cover" 
                                />
                                <button
                                  type="button"
                                  onClick={() => removeImage(idx)}
                                  className="absolute top-1 right-1 p-1.5 rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700 transition-colors opacity-90 hover:opacity-100"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
    
                      {/* Botões de Ação */}
                      <div className="flex gap-4 pt-4 border-t border-neutral-100">
                        <button 
                          onClick={closeTrocaModal}
                          className="flex-1 py-4 bg-neutral-100 text-neutral-600 font-bold rounded-2xl hover:bg-neutral-200 transition-all text-xs uppercase tracking-widest"
                        >
                          Cancelar
                        </button>
                        <button 
                          disabled={
                            isSubmittingTroca || 
                            !trocaReason.trim() || 
                            trocaImages.length === 0 || 
                            (trocaType === 'troca' && exchangeProductOption === 'outro_produto' && (exchangeCart.length === 0 || (exchangeCart.reduce((sum, item) => sum + getProductQuantityPriceBreakdown(item.produto, item.quantidade).subtotalFinal, 0) < (selectedOrder.items?.filter((it: any) => selectedExchangeItems.includes(it.id)).reduce((acc: number, curr: any) => acc + (curr.valor_unitario ?? curr.produtos?.valor ?? 0) * (curr.quantidade || 1), 0) || 0))))
                          }
                          onClick={handleSubmitTroca}
                          className="flex-[2] py-4 bg-[#1a1a1a] text-white font-bold rounded-2xl hover:bg-black transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                        >
                          {isSubmittingTroca ? 'Enviando...' : 'Enviar Solicitação'}
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
              </div>
              ) : (
                /* Aba Acompanhar Solicitações */
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                  {loadingExchanges ? (
                    <div className="flex justify-center py-12">
                      <div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : myExchangeRequests.length > 0 ? (
                    <div className="space-y-4">
                      {myExchangeRequests.map((req) => {
                        const isCorreios = req.metodo_entrega !== 'pessoalmente'; // default to correios for legacy
                        const statusSteps = isCorreios ? [
                          { key: 'solicitado', label: 'Solicitado', desc: 'Em Análise' },
                          { key: 'aprovado', label: 'Aprovado', desc: 'Aguardando Pag./Instruções' },
                          { key: 'aguardando_devolucao', label: 'Postagem', desc: 'Postar nos Correios' },
                          { key: 'devolucao_recebida', label: 'Conferência', desc: 'Em Análise na GSA' },
                          { key: 'novo_produto_enviado', label: 'Enviado', desc: 'Novo produto a caminho' },
                          { key: 'concluido', label: 'Concluído', desc: 'Troca finalizada' }
                        ] : [
                          { key: 'solicitado', label: 'Solicitado', desc: 'Em Análise' },
                          { key: 'aprovado', label: 'Aprovado', desc: 'Aguardando Pag./Instruções' },
                          { key: 'agendado', label: 'Agendado', desc: 'Entrega Marcada' },
                          { key: 'concluido', label: 'Concluído', desc: 'Troca presencial feita' }
                        ];
    
                        let activeStep = 0;
                        if (req.status === 'aprovado' || req.status === 'aguardando_instrucoes') activeStep = 1;
                        if (req.status === 'aguardando_devolucao' || req.status === 'devolucao_postada') activeStep = 2;
                        if (req.status === 'agendado') activeStep = 2;
                        if (req.status === 'devolucao_recebida') activeStep = 3;
                        if (req.status === 'novo_produto_enviado') activeStep = 4;
                        if (req.status === 'concluido') activeStep = isCorreios ? 5 : 3;
                        if (req.status === 'rejeitado') activeStep = 1;
    
                        return (
                          <div key={req.id} className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-wider font-mono">
                                  Solicitação #{req.codigo_solicitacao || 'N/A'}
                                </span>
                                <h4 className="text-sm font-black text-neutral-900 tracking-tight mt-1 uppercase">
                                  Tipo: {req.tipo}
                                </h4>
                              </div>
                              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                                req.status === 'aprovado' ? 'bg-emerald-50 text-emerald-700' :
                                req.status === 'rejeitado' ? 'bg-rose-50 text-rose-700' :
                                req.status === 'concluido' ? 'bg-purple-50 text-purple-700' :
                                req.status === 'em_analise' ? 'bg-blue-50 text-blue-700' :
                                'bg-amber-50 text-amber-700'
                              }`}>
                                {req.status}
                              </span>
                            </div>
    
                            {/* Linha do Tempo Visual */}
                            <div className="pt-2 pb-4 border-b border-neutral-100">
                              <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-4">Acompanhamento</span>
                              <div className="flex justify-between items-start relative">
                                {/* Linha de progresso no fundo */}
                                <div className="absolute top-3.5 left-4 right-4 h-0.5 bg-neutral-100 -z-10" />
                                {/* Linha ativa */}
                                <div 
                                  className="absolute top-3.5 left-4 h-0.5 bg-indigo-600 -z-10 transition-all duration-500" 
                                  style={{ width: `${(activeStep / (statusSteps.length - 1)) * 100}%` }}
                                />
    
                                {statusSteps.map((step, idx) => {
                                  const isCompleted = idx <= activeStep;
                                  const isCurrent = idx === activeStep;
                                  const isRejeitadoStep = req.status === 'rejeitado' && idx === 1;
    
                                  const getStepDate = (stepKey: string) => {
                                    if (!isCompleted && !isCurrent) return null;
                                    const historico = req.historico_status || {};
                                    let dateStr = historico[stepKey];
                                    if (stepKey === 'aprovado' && !dateStr && historico['aguardando_instrucoes']) dateStr = historico['aguardando_instrucoes'];
                                    if (stepKey === 'aguardando_devolucao' && !dateStr && historico['devolucao_postada']) dateStr = historico['devolucao_postada'];
                                    if (!dateStr) {
                                      if (stepKey === 'solicitado') dateStr = req.created_at;
                                      else if (isCurrent) dateStr = req.updated_at;
                                    }
                                    if (!dateStr) return null;
                                    try {
                                      const d = new Date(dateStr);
                                      return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                                    } catch { return null; }
                                  };
                                  const stepDate = getStepDate(step.key);
    
                                  return (
                                    <div key={step.key} className="flex flex-col items-center text-center max-w-[80px]">
                                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                                        isRejeitadoStep ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-200' :
                                        isCurrent ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110' :
                                        isCompleted ? 'bg-indigo-50 border-indigo-600 text-indigo-600' :
                                        'bg-white border-neutral-200 text-neutral-300'
                                      }`}>
                                        {isRejeitadoStep ? (
                                          <XCircle className="w-4 h-4" />
                                        ) : isCompleted ? (
                                          <CheckCircle2 className="w-4 h-4" />
                                        ) : (
                                          <span className="text-xs font-bold">{idx + 1}</span>
                                        )}
                                      </div>
                                      <span className={`text-[10px] font-black mt-2 leading-none ${
                                        isRejeitadoStep ? 'text-rose-600' :
                                        isCurrent ? 'text-indigo-600' :
                                        isCompleted ? 'text-neutral-800' : 'text-neutral-400'
                                      }`}>
                                        {isRejeitadoStep ? 'Rejeitado' : step.label}
                                      </span>
                                      <span className="text-[8px] text-neutral-400 mt-1 leading-normal hidden sm:block">
                                        {isRejeitadoStep ? 'Solicitação não aceita' : step.desc}
                                      </span>
                                      {stepDate && (
                                        <span className="text-[8px] font-bold text-neutral-500 mt-0.5 whitespace-nowrap">
                                          {stepDate}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
    
                            {(() => {
                              const parsed = req.descricao_detalhada ? parseDescricaoDetalhada(req.descricao_detalhada) : null;
                              return (
                                <div className="space-y-4">
                                  {/* 1. Motivo do Cliente & Resolução do Admin */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-neutral-50/60 border border-neutral-100 rounded-2xl p-4 space-y-1.5 shadow-sm">
                                      <div className="flex items-center gap-2 text-neutral-400">
                                        <MessageSquare className="w-4 h-4 text-neutral-500" />
                                        <span className="text-[10px] font-black uppercase tracking-wider">Motivo da Solicitação</span>
                                      </div>
                                      <p className="text-neutral-800 text-xs font-bold leading-relaxed">{req.motivo}</p>
                                    </div>
    
                                    {req.resposta_admin ? (
                                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 space-y-1.5 shadow-sm flex items-start gap-3">
                                        <div className="p-1.5 bg-emerald-100 rounded-xl text-emerald-600 shrink-0 mt-0.5">
                                          <CheckCircle className="w-4 h-4" />
                                        </div>
                                        <div>
                                          <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block">Resolução do Sistema</span>
                                          <p className="text-emerald-950 text-xs font-bold leading-relaxed mt-0.5">{req.resposta_admin}</p>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 space-y-1.5 shadow-sm flex items-start gap-3">
                                        <div className="p-1.5 bg-amber-100 rounded-xl text-amber-600 shrink-0 mt-0.5">
                                          <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                          <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider block">Aguardando Avaliação</span>
                                          <p className="text-amber-900 text-xs font-bold leading-relaxed mt-0.5">Nossa equipe de suporte está avaliando sua solicitação de {req.tipo === 'troca' ? 'troca' : 'devolução'}.</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
    
                                  {/* 2. Listagem de Itens (Devolvidos vs Substitutos) */}
                                  {parsed ? (
                                    <div className="flex flex-col sm:flex-row gap-4">
                                      {/* Coluna 1: Itens Devolvidos */}
                                      <div className="bg-white rounded-2xl p-4 border border-neutral-150 shadow-sm space-y-3 flex-1 flex flex-col justify-between">
                                        <div>
                                          <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                                            <div className="p-1.5 bg-rose-50 rounded-lg text-rose-600">
                                              <Package className="w-4 h-4" />
                                            </div>
                                            <span className="text-[10px] font-black text-neutral-700 uppercase tracking-wider">Itens Devolvidos</span>
                                          </div>
                                          <div className="space-y-2 mt-3">
                                            {parsed.itensDevolvidos.map((item, idx) => (
                                              <div key={idx} className="flex justify-between items-center text-xs font-bold text-neutral-800 bg-neutral-50/60 p-2.5 rounded-xl border border-neutral-100">
                                                <span>{item}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                        <div className="flex justify-between items-center pt-3 border-t border-neutral-100 mt-4 text-xs">
                                          <span className="text-neutral-400 font-bold">Crédito Gerado:</span>
                                          <span className="font-black text-rose-600">{parsed.creditoTroca || formatCurrency(req.orcamento_orig?.total || 0)}</span>
                                        </div>
                                      </div>
    
                                      {/* Coluna 2: Novos Produtos (Apenas se for troca) */}
                                      {req.tipo === 'troca' && (
                                        <div className="bg-white rounded-2xl p-4 border border-neutral-150 shadow-sm space-y-3 flex-1 flex flex-col justify-between">
                                          <div>
                                            <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                                              <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                                                <ShoppingBag className="w-4 h-4" />
                                              </div>
                                              <span className="text-[10px] font-black text-neutral-700 uppercase tracking-wider">Produtos Substitutos</span>
                                            </div>
                                            <div className="space-y-2 mt-3">
                                              {parsed.itensSubstitutos.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-xs font-bold text-neutral-800 bg-neutral-50/60 p-2.5 rounded-xl border border-neutral-100">
                                                  <span>{item}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                          {parsed.totalSubstitutos && (
                                            <div className="flex justify-between items-center pt-3 border-t border-neutral-100 mt-4 text-xs">
                                              <span className="text-neutral-400 font-bold">Total Novos Produtos:</span>
                                              <span className="font-black text-indigo-600">{parsed.totalSubstitutos}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    req.descricao_detalhada && (
                                      <div className="text-xs text-neutral-600 bg-neutral-50 rounded-xl p-3 border border-neutral-100 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                                        {req.descricao_detalhada}
                                      </div>
                                    )
                                  )}
    
                                  {/* 3. Resumo Financeiro da Diferença a Pagar */}
                                  {req.valor_diferenca && Number(req.valor_diferenca) > 0 ? (
                                    <div className="bg-gradient-to-r from-indigo-50/80 to-blue-50/80 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                                      <div className="space-y-1.5">
                                        <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider block">Diferença de Valor</span>
                                        <p className="text-[11px] text-indigo-800 leading-normal font-semibold max-w-md">
                                          ⚠️ Diferença a pagar: Fatura gerada com vencimento de 2 dias após a aprovação da solicitação.
                                        </p>
                                        {req.status === 'aprovado' && (
                                          <button
                                            onClick={async () => {
                                              try {
                                                const codigoFatura = `FAT-TROCA-${req.codigo_solicitacao}`;
                                                const { data: fatura, error: fatError } = await supabase
                                                  .from('faturas')
                                                  .select('id')
                                                  .eq('codigo_fatura', codigoFatura)
                                                  .order('created_at', { ascending: false })
                                                  .limit(1)
                                                  .maybeSingle();
    
                                                if (fatError || !fatura) {
                                                  toast.error('Não foi possível localizar a fatura gerada para esta troca.');
                                                  return;
                                                }
    
                                                toast.success('Redirecionando para a fatura...');
                                                onNavigate('financeiro', 'faturas', fatura.id);
                                              } catch (err) {
                                                console.error('Erro ao redirecionar para a fatura:', err);
                                                toast.error('Erro de conexão ao buscar fatura.');
                                              }
                                            }}
                                            className="mt-2.5 flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md hover:scale-[1.02] w-fit"
                                          >
                                            <CreditCard className="w-3.5 h-3.5" />
                                            Pagar Fatura da Diferença
                                          </button>
                                        )}
                                      </div>
                                      <div className="text-right shrink-0">
                                        <span className="text-xl font-black text-indigo-950 block">{formatCurrency(req.valor_diferenca)}</span>
                                        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full inline-block mt-1 uppercase tracking-wider ${req.status === 'aprovado' ? 'text-indigo-600 bg-indigo-100/60 border border-indigo-200/50' : 'text-emerald-600 bg-emerald-100/60 border border-emerald-200/50'}`}>
                                          {req.status === 'aprovado' ? 'A Pagar' : 'Pago'}
                                        </span>
                                      </div>
                                    </div>
                                  ) : null}
    
                                  {/* 3b. Fluxo Logístico Real-Time */}
                                  {(() => {
                                    const isCorreios = req.metodo_entrega !== 'pessoalmente';
                                    if (req.status === 'aguardando_instrucoes') {
                                      return (
                                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
                                          <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase">
                                            <Clock className="w-4 h-4 animate-pulse" />
                                            <span>Aguardando Instruções da GSA</span>
                                          </div>
                                          <p className="text-[11px] text-blue-700 leading-normal font-bold">
                                            Sua solicitação foi aprovada! A equipe administrativa da GSA está cadastrando o endereço de postagem {isCorreios ? "dos Correios" : "e agendando a data/hora"} para você realizar a troca.
                                          </p>
                                        </div>
                                      );
                                    }
    
                                    if (isCorreios) {
                                      if (req.status === 'aguardando_devolucao') {
                                        return (
                                          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 space-y-4 shadow-sm">
                                            <div className="flex items-center gap-2 text-indigo-900 font-black text-xs uppercase">
                                              <Package className="w-4 h-4" />
                                              <span>Instruções para Envio do Produto</span>
                                            </div>
                                            <div className="text-xs text-neutral-700 font-medium space-y-2">
                                              <p className="font-bold">Por favor, poste o produto para o endereço abaixo:</p>
                                              <div className="p-3 bg-white rounded-xl border border-neutral-200 font-bold font-mono text-[11px] text-neutral-800">
                                                {req.endereco_devolucao || "Endereço não informado."}
                                              </div>
                                              <p className="text-[10px] text-amber-600 font-bold">
                                                ⚠️ Atenção: Você deve arcar com o frete da postagem inicial. Depois, anexe o comprovante de pagamento no módulo <strong>"Meus Reembolsos"</strong> para receber o estorno completo do frete.
                                              </p>
                                            </div>
                                            
                                            <div className="pt-2 border-t border-indigo-100 space-y-2">
                                              <label className="block text-[10px] font-black uppercase text-neutral-400">Código de Rastreio da Postagem</label>
                                              <div className="flex gap-2">
                                                <input 
                                                  type="text"
                                                  placeholder="Ex: OB123456789BR"
                                                  value={trackingInputs[req.id] || ''}
                                                  onChange={(e) => setTrackingInputs(prev => ({ ...prev, [req.id]: e.target.value }))}
                                                  className="flex-1 bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs focus:ring-4 focus:ring-indigo-500/10 focus:outline-none font-bold"
                                                />
                                                <button
                                                  disabled={submittingTracking[req.id]}
                                                  onClick={() => handleSendClientTracking(req.id, trackingInputs[req.id] || '')}
                                                  className="bg-[#1a1a1a] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-black transition-all disabled:opacity-50"
                                                >
                                                  {submittingTracking[req.id] ? "Enviando..." : "Enviar"}
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      }
    
                                      if (req.status === 'devolucao_postada') {
                                        return (
                                          <div className="bg-blue-50/50 border border-blue-150 rounded-2xl p-4 space-y-1.5">
                                            <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block">Produto Devolvido em Trânsito</span>
                                            <p className="text-xs text-neutral-700 font-bold leading-normal">
                                              Você informou o código de rastreio: <strong className="font-mono text-indigo-600">{req.rastreio_cliente}</strong>. A GSA está aguardando a chegada física do produto na sede.
                                            </p>
                                          </div>
                                        );
                                      }
    
                                      if (req.status === 'devolucao_recebida') {
                                        return (
                                          <div className="bg-amber-50/50 border border-amber-150 rounded-2xl p-4 space-y-1.5">
                                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider block">Produto Recebido pela GSA</span>
                                            <p className="text-xs text-neutral-700 font-bold leading-normal">
                                              O produto devolvido chegou à sede da GSA e passou pela conferência com sucesso. Estamos preparando o envio do seu novo produto substituto!
                                            </p>
                                          </div>
                                        );
                                      }
    
                                      if (req.status === 'novo_produto_enviado') {
                                        return (
                                          <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 space-y-2">
                                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block">Novo Produto Enviado!</span>
                                            <p className="text-xs text-neutral-700 font-bold leading-normal">
                                              O novo produto foi enviado e já está a caminho de sua residência!
                                            </p>
                                            <div className="p-3 bg-white rounded-xl border border-emerald-200">
                                              <span className="text-[9px] text-neutral-400 font-black block uppercase">Código de Rastreio (GSA)</span>
                                              <span className="text-sm font-black text-emerald-800 font-mono">{req.rastreio_admin}</span>
                                            </div>
                                          </div>
                                        );
                                      }
                                    } else {
                                      // Fluxo Presencial
                                      if (req.status === 'aguardando_devolucao') {
                                        return (
                                          <div className="bg-amber-50/50 border border-amber-150 rounded-2xl p-4">
                                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider block">Aguardando Agendamento Presencial</span>
                                            <p className="text-xs text-neutral-700 font-bold mt-1 leading-normal">
                                              A GSA está agendando uma data e horário de atendimento para você efetuar a troca presencialmente.
                                            </p>
                                          </div>
                                        );
                                      }
    
                                      if (req.status === 'agendado') {
                                        const dateFormatted = req.data_agendamento ? new Date(req.data_agendamento).toLocaleString('pt-BR') : '';
                                        return (
                                          <div className="bg-indigo-50 border border-indigo-150 rounded-2xl p-5 space-y-3">
                                            <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider block">🤝 Troca Presencial Confirmada</span>
                                            <div className="text-xs text-neutral-700 font-medium space-y-2">
                                              <p className="font-bold">Por favor, compareça no endereço abaixo levando o produto original para troca:</p>
                                              <div className="p-3 bg-white rounded-xl border border-indigo-200 font-bold font-mono text-[11px] text-neutral-800 mb-2">
                                                {req.endereco_devolucao || "Sede GSA"}
                                              </div>
                                              <p className="font-bold"><strong>Data & Hora Marcada:</strong> <span className="text-indigo-600 font-black">{dateFormatted || "Pendente"}</span></p>
                                            </div>
                                          </div>
                                        );
                                      }
                                    }
                                    return null;
                                  })()}
    
                                  {/* 4. Anexos de Imagens */}
                                  {req.imagens_anexo && req.imagens_anexo.length > 0 && (
                                    <div className="space-y-2.5 pt-2">
                                      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Imagens do Produto Anexadas ({req.imagens_anexo.length})</span>
                                      <div className="flex flex-wrap gap-2.5">
                                        {req.imagens_anexo.map((url: string, idx: number) => (
                                          <a 
                                            key={idx} 
                                            href={url} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-neutral-100 hover:border-indigo-500 transition-all shadow-sm hover:scale-105 active:scale-95 duration-200 block bg-neutral-50 shrink-0"
                                          >
                                            <img src={url} alt={`Anexo ${idx + 1}`} className="w-full h-full object-cover" />
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center bg-neutral-50 rounded-[2rem] border-2 border-dashed border-neutral-200">
                      <RefreshCcw className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-400 font-bold text-xs uppercase tracking-widest">Nenhuma solicitação de troca encontrada</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Modal>
  );
}
