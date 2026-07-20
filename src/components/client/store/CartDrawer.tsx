import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, Package, Scissors, Calendar, Trash2, X, Plus, Minus, Tag, Check, AlertCircle, Loader2, ChevronLeft, ChevronRight, Filter, SlidersHorizontal, Briefcase, ArrowRight, Ticket, Coins, Sparkles, CreditCard, CheckCircle, Clock, CheckCircle2, Wallet, Gift } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatCurrency, generateCode, formatDate } from '../../../lib/utils';
import { toast } from 'react-hot-toast';
import { Modal } from '../../ui/Modal';
import type { Produto } from '../../../types';
import type { PromoResult } from '../../../lib/promocaoQuantidadeEngine';
import { hasActiveProductDiscount, getProductEffectivePrice, getProductRemainingDaysText, getProductQuantityPriceBreakdown } from '../../../lib/productPricing';

type CartItem = {
  id: string;
  item_id: string;
  tipo: 'produto' | 'servico' | 'assinatura';
  quantidade: number;
  item_detalhes?: Produto | any;
  prazo_meses?: number;
};

export default function CartDrawer({ isOpen, onClose, cartItems, promosAplicadas = [], isGuest = false, cupomDesconto, cupomEntrega, cupomDescInput, cupomEntInput, onCupomDescInputChange, onCupomEntInputChange, onApplyCoupon, onRemoveCoupon, onUpdateQuantity, onRemove, onCheckout }: any) {
  if (!isOpen) return null;

  const [showCouponInputs, setShowCouponInputs] = useState(!!cupomDesconto || !!cupomEntrega);

  const subtotal = cartItems.reduce((acc: number, cur: CartItem) => {
    if (cur.tipo === 'produto') {
      return acc + getProductQuantityPriceBreakdown(cur.item_detalhes, cur.quantidade).subtotalFinal;
    }
    return acc + (cur.item_detalhes?.valor || 0) * cur.quantidade;
  }, 0);
  
  // Calcula descontos em dinheiro se houver promos de desconto em valor
  const descontoPromocoes = promosAplicadas.reduce((acc: number, promo: PromoResult) => {
    if (promo.status === 'ativa' && promo.desconto_aplicado) {
      return acc + promo.desconto_aplicado.valor_desconto;
    }
    return acc;
  }, 0);
  
  const descontoCupom = (() => {
    if (!isGuest || !cupomDesconto) return 0;

    let baseCalculo = subtotal;
    if (cupomDesconto.produto_id) {
      const itemEsp = cartItems.find((c: CartItem) => c.item_id === cupomDesconto.produto_id);
      const descontoPromocionalDoProduto = promosAplicadas.reduce((acc: number, promo: PromoResult) => {
        if (promo.status !== 'ativa') return acc;
        if (promo.desconto_aplicado?.produto_id === cupomDesconto.produto_id) {
          return acc + Number(promo.desconto_aplicado.valor_desconto || 0);
        }
        return acc;
      }, 0);
      let unitVal: number;
      if (itemEsp.tipo === 'produto') {
        unitVal = getProductQuantityPriceBreakdown(itemEsp.item_detalhes, itemEsp.quantidade).subtotalFinal / itemEsp.quantidade;
      } else {
        unitVal = itemEsp.item_detalhes?.valor || 0;
      }
      baseCalculo = itemEsp ? Math.max(0, (unitVal * itemEsp.quantidade) - descontoPromocionalDoProduto) : 0;
    }

    const desconto = cupomDesconto.tipo_desconto === 'porcentagem'
      ? baseCalculo * ((cupomDesconto.valor_desconto || 0) / 100)
      : (cupomDesconto.valor_desconto || 0);

    return Math.min(desconto, Math.max(0, subtotal - descontoPromocoes));
  })();

  const totalFinal = Math.max(0, subtotal - descontoPromocoes - descontoCupom);

  const hasOutOfStockItems = cartItems.some((c: CartItem) => c.tipo === 'produto' && (c.item_detalhes as Produto)?.controle_estoque && ((c.item_detalhes as Produto)?.estoque_disponivel <= 0));

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-stretch md:justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-500">
      <div className="w-full md:max-w-md bg-white h-[92%] md:h-full shadow-[0_-20px_50px_rgba(0,0,0,0.15)] md:shadow-2xl flex flex-col rounded-t-[3rem] md:rounded-none animate-in slide-in-from-bottom md:slide-in-from-right duration-500 relative overflow-hidden">
        {/* Handle de arraste apenas no mobile */}
        <div className="md:hidden flex justify-center pt-4 pb-1">
          <div className="w-12 h-1.5 bg-neutral-200 rounded-full"></div>
        </div>

        <div className="flex items-center justify-between p-6 md:p-8 border-b border-neutral-100">
          <h2 className="text-xl md:text-2xl font-black text-neutral-900 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <ShoppingCart className="w-6 h-6 text-indigo-600" />
            </div>
            Meu Carrinho
          </h2>
          <button onClick={onClose} className="p-2.5 hover:bg-neutral-100 rounded-full transition-all text-neutral-400 hover:text-red-500 hover:rotate-90">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-5">
          {cartItems.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingCart className="w-10 h-10 text-neutral-200" />
              </div>
              <p className="text-lg font-black text-neutral-900">Seu carrinho está vazio</p>
              <p className="text-sm text-neutral-400 mt-2 font-medium">Explore nossa vitrine e adicione itens incríveis!</p>
            </div>
          ) : (
            <>
              {cartItems.map((c: CartItem) => {
                const isProduto = c.tipo === 'produto';
                const isOutOfStock = isProduto && (c.item_detalhes as Produto)?.controle_estoque && ((c.item_detalhes as Produto)?.estoque_disponivel <= 0);

                return (
                <div key={c.id} className={`flex gap-4 p-5 rounded-3xl border bg-white transition-all group relative ${isOutOfStock ? 'border-red-200 bg-red-50/30' : 'border-neutral-100 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-500/5'}`}>
                  <button 
                    onClick={() => onRemove(c.id)}
                    className="absolute top-3 right-3 w-8 h-8 bg-white border border-neutral-100 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-500 hover:border-red-100 shadow-sm transition-all z-10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className={`w-20 h-20 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center overflow-hidden shrink-0 transition-transform ${!isOutOfStock && 'group-hover:scale-105'}`}>
                    {c.item_detalhes?.imagem_url ? (
                      <img src={c.item_detalhes.imagem_url} alt="" className={`w-full h-full object-contain p-2 ${isOutOfStock ? 'grayscale opacity-50' : ''}`} />
                    ) : (
                      <Package className="w-8 h-8 text-neutral-200" />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${
                      c.tipo === 'produto' ? 'text-indigo-500' : c.tipo === 'servico' ? 'text-purple-500' : 'text-pink-500'
                    }`}>{c.tipo}</span>
                    <p className={`text-sm font-black leading-tight mb-2 truncate pr-6 ${isOutOfStock ? 'text-neutral-500 line-through' : 'text-neutral-900'}`}>
                      {c.item_detalhes?.nome}
                      {c.prazo_meses && <span className="ml-2 text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">({c.prazo_meses} Meses)</span>}
                    </p>
                    
                    {isOutOfStock ? (
                      <div className="mt-auto">
                        <div className="flex items-center gap-1.5 mb-2 text-red-500">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Produto Esgotado</span>
                        </div>
                        <button 
                          onClick={() => {
                            onClose();
                            window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'suporte' } }));
                            setTimeout(() => {
                              window.dispatchEvent(new CustomEvent('open-stock-ticket', { detail: { produto: c.item_detalhes } }));
                            }, 150);
                          }}
                          className="w-full text-center bg-white border border-neutral-200 rounded-xl py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-all shadow-sm"
                        >
                          Solicitar Informações
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mt-auto">
                        {isProduto && hasActiveProductDiscount(c.item_detalhes) ? (() => {
                          const bd = getProductQuantityPriceBreakdown(c.item_detalhes, c.quantidade);
                          return (
                            <div className="flex flex-col">
                              <span className="text-[10px] text-neutral-400 line-through font-bold leading-none">{formatCurrency(c.item_detalhes.valor * c.quantidade)}</span>
                              <p className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 leading-tight mt-0.5">{formatCurrency(bd.subtotalFinal)}</p>
                              {c.item_detalhes?.desconto_prazo_tipo === 'determinado' && c.item_detalhes?.desconto_fim_em && (() => {
                                const texto = getProductRemainingDaysText(c.item_detalhes);
                                if (!texto) return null;
                                const isHoje = texto.toLowerCase().includes('hoje');
                                return (
                                  <span className={`text-[9px] font-bold mt-0.5 ${
                                    isHoje ? 'text-orange-500' : 'text-indigo-400'
                                  }`}>
                                    {texto}
                                  </span>
                                );
                              })()}
                            </div>
                          );
                        })() : (
                          <p className="text-base font-black text-neutral-900 leading-none">
                            {formatCurrency((c.item_detalhes?.valor || 0) * c.quantidade)}
                          </p>
                        )}
                        {c.tipo === 'produto' && (
                          <div className="flex items-center gap-3 bg-neutral-50 rounded-xl p-1 px-2 border border-neutral-100">
                            {c.quantidade === 1 ? (
                              <button onClick={() => onRemove(c.id)} className="p-1 text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            ) : (
                              <button onClick={() => onUpdateQuantity(c.id, c.quantidade - 1, c.item_detalhes)} className="p-1 hover:text-red-500 transition-colors"><Minus className="w-3.5 h-3.5" /></button>
                            )}
                            <span className="text-xs font-black text-neutral-900 w-4 text-center tabular-nums">{c.quantidade}</span>
                            <button onClick={() => onUpdateQuantity(c.id, c.quantidade + 1, c.item_detalhes)} className="p-1 hover:text-emerald-500 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
              
              {/* Injeção Visual dos Brindes (Promoções Inteligentes) */}
              {promosAplicadas.filter((p: PromoResult) => p.status === 'ativa' && p.item_brinde).map((promo: PromoResult, index: number) => (
                <div key={`brinde-${promo.promocao_id}-${index}`} className="flex gap-4 p-5 rounded-3xl border border-indigo-200 bg-indigo-50/50 transition-all relative overflow-hidden group hover:shadow-lg hover:shadow-indigo-500/10">
                  <div className="absolute top-0 right-0 p-2 bg-indigo-500 rounded-bl-xl shadow-sm z-10 flex flex-col items-center justify-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> BRINDE
                    </span>
                  </div>
                  <div className="w-20 h-20 rounded-2xl bg-white border border-indigo-100 flex items-center justify-center overflow-hidden shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                    {promo.item_brinde?.produto_imagem_url ? (
                      <img src={promo.item_brinde.produto_imagem_url} alt="" className="w-full h-full object-contain p-2" />
                    ) : (
                      <Gift className="w-8 h-8 text-indigo-300" />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-center min-w-0 pt-2">
                    <p className="text-sm font-black leading-tight mb-1 text-indigo-900 pr-16 line-clamp-2">
                      {promo.item_brinde?.produto_nome}
                    </p>
                    <p className="text-[10px] text-indigo-500 font-bold mb-3 uppercase tracking-wider">{promo.nome}</p>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-emerald-500 line-through decoration-emerald-200">{formatCurrency(promo.item_brinde?.valor_unitario || 0)}</p>
                        <p className="text-base font-black text-indigo-600 uppercase">Grátis</p>
                      </div>
                      <div className="text-sm font-black text-indigo-900 px-3 py-1 bg-white rounded-lg shadow-sm border border-indigo-100 tabular-nums">x{promo.item_brinde?.quantidade}</div>
                    </div>
                  </div>
                </div>
              ))
            }
            
            {/* Injeção Visual dos Descontos VIP */}
            {promosAplicadas.filter((p: PromoResult) => p.status === 'ativa' && p.desconto_aplicado).map((promo: PromoResult, index: number) => (
                <div key={`desconto-${promo.promocao_id}-${index}`} className="flex gap-4 p-5 rounded-3xl border border-emerald-200 bg-emerald-50/50 transition-all relative overflow-hidden group hover:shadow-lg hover:shadow-emerald-500/10">
                  <div className="absolute top-0 right-0 p-2 bg-emerald-500 rounded-bl-xl shadow-sm z-10 flex flex-col items-center justify-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> DESCONTO
                    </span>
                  </div>
                <div className="w-20 h-20 rounded-2xl bg-white border border-emerald-100 flex items-center justify-center overflow-hidden shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                    <Tag className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="flex-1 flex flex-col justify-center min-w-0 pt-2">
                  <p className="text-sm font-black leading-tight mb-1 text-emerald-900 pr-16 line-clamp-2">
                    {promo.desconto_aplicado?.produto_nome}
                  </p>
                  <p className="text-[10px] text-emerald-600 font-bold mb-3 uppercase tracking-wider">{promo.nome}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-emerald-600/70 font-black uppercase tracking-widest">Valor Economizado</span>
                      <p className="text-lg font-black text-emerald-600">- {formatCurrency(promo.desconto_aplicado?.valor_desconto || 0)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
            }
            </>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-4 md:p-6 border-t border-neutral-100 bg-white/80 backdrop-blur-xl rounded-t-[2.5rem] md:rounded-none">
            {isGuest && (
              !showCouponInputs ? (
                <button
                  onClick={() => setShowCouponInputs(true)}
                  className="mb-4 w-full flex items-center justify-between p-2 px-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/20 hover:bg-indigo-50/50 hover:border-indigo-300 text-indigo-700 transition-all text-left"
                >
                  <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5 text-indigo-500" /> Possui cupom?
                  </span>
                  <span className="text-[9px] font-black uppercase bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md">Inserir</span>
                </button>
              ) : (
                <div className="mb-4 space-y-2 rounded-2xl border border-blue-100 bg-blue-50/60 p-3 relative">
                  <button 
                    onClick={() => setShowCouponInputs(false)}
                    className="absolute top-2 right-2 text-neutral-400 hover:text-neutral-600 p-0.5 rounded-full hover:bg-neutral-200/50 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="flex items-center justify-between gap-2 pr-5">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-blue-700 leading-none">Cupom da Loja</p>
                      <p className="text-[10px] font-medium text-blue-500 mt-0.5">Aplique o cupom para finalizar.</p>
                    </div>
                  </div>

                {cupomDesconto ? (
                  <div className="rounded-xl border border-blue-200 bg-white p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-black text-blue-700">{cupomDesconto.codigo_cupom}</span>
                      <button onClick={() => onRemoveCoupon('desconto')} className="text-[10px] font-black text-red-500">Remover</button>
                    </div>
                    <p className="mt-0.5 text-[10px] font-bold text-blue-600">Desconto: {formatCurrency(descontoCupom)}</p>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      value={cupomDescInput}
                      onChange={(event) => onCupomDescInputChange(event.target.value.toUpperCase())}
                      placeholder="CUPOM DESCONTO"
                      className="min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-blue-900 outline-none focus:ring-2 focus:ring-blue-500/10"
                    />
                    <button onClick={() => onApplyCoupon(cupomDescInput, 'desconto')} className="rounded-xl bg-blue-600 px-3 py-2 text-[10px] font-black text-white shadow-sm shrink-0">
                      Aplicar
                    </button>
                  </div>
                )}

                {cartItems.some((c: CartItem) => c.tipo === 'produto') && (
                  cupomEntrega ? (
                    <div className="rounded-xl border border-emerald-200 bg-white p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-black text-emerald-700">{cupomEntrega.codigo_cupom}</span>
                        <button onClick={() => onRemoveCoupon('entrega')} className="text-[10px] font-black text-red-500">Remover</button>
                      </div>
                      <p className="mt-0.5 text-[10px] font-bold text-emerald-600">
                        {cupomEntrega.tipo_entrega === 'taxa_fixa' ? `Frete fixo: ${formatCurrency(cupomEntrega.taxa_fixa_entrega || 0)}` : 'Benefício de entrega'}
                      </p>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <input
                        value={cupomEntInput}
                        onChange={(event) => onCupomEntInputChange(event.target.value.toUpperCase())}
                        placeholder="CUPOM ENTREGA"
                        className="min-w-0 flex-1 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-900 outline-none focus:ring-2 focus:ring-emerald-500/10"
                      />
                      <button onClick={() => onApplyCoupon(cupomEntInput, 'entrega')} className="rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black text-white shadow-sm shrink-0">
                        Aplicar
                      </button>
                    </div>
                  )
                )}
              </div>
            ))}

            <div className="flex items-center justify-between mb-4 px-1">
              <div>
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Total</span>
                {(descontoPromocoes > 0 || descontoCupom > 0) && (
                   <p className="text-sm font-black text-emerald-500 line-through mb-0.5">{formatCurrency(subtotal)}</p>
                )}
                {descontoCupom > 0 && (
                  <p className="text-xs font-black text-blue-600 mb-1">Cupom: -{formatCurrency(descontoCupom)}</p>
                )}
                <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 tabular-nums">
                  {formatCurrency(totalFinal)}
                </p>
              </div>
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
            <button 
              onClick={onCheckout}
              disabled={hasOutOfStockItems}
              className={`w-full py-5 rounded-[1.5rem] font-black text-sm shadow-xl transition-all duration-500 flex justify-center items-center gap-3 group ${
                hasOutOfStockItems 
                  ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] hover:bg-right text-white shadow-indigo-100 hover:shadow-indigo-300'
              }`}
            >
              {hasOutOfStockItems ? 'Remova os itens esgotados' : 'Finalizar Compra'}
              {!hasOutOfStockItems && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
