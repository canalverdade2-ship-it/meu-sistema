import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, Package, Scissors, Calendar, Trash2, X, Plus, Minus, Tag, Check, AlertCircle, Loader2, ChevronLeft, ChevronRight, Filter, SlidersHorizontal, Briefcase, ArrowRight, Ticket, Coins, Sparkles, CreditCard, CheckCircle, Clock, CheckCircle2, Wallet, Gift } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatCurrency, generateCode, formatDate } from '../../../lib/utils';
import { toast } from 'react-hot-toast';
import { Modal } from '../../ui/Modal';
import { hasActiveProductDiscount, getProductEffectivePrice, getProductQuantityPriceBreakdown, getProductRemainingQuantityText } from '../../../lib/productPricing';

export default function QuantityModal({ isOpen, onClose, item, onConfirm, initialQty = 1 }: any) {
  const [qty, setQty] = useState(initialQty);

  useEffect(() => {
    if (isOpen) setQty(initialQty);
  }, [isOpen, initialQty]);

  if (!isOpen || !item) return null;

  const max = item.controle_estoque ? item.estoque_disponivel : 99;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Selecionar Quantidade" size="sm">
      <div className="p-6 text-center">
        <div className="w-28 h-28 bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-[2rem] mx-auto mb-6 flex items-center justify-center overflow-hidden border border-neutral-200/50 shadow-inner">
          {item.imagem_url ? (
            <img src={item.imagem_url} alt="" className="w-full h-full object-contain p-2" />
          ) : (
            <Package className="w-12 h-12 text-neutral-300" />
          )}
        </div>
        <h3 className="text-xl font-black text-neutral-900 mb-1">{item.nome}</h3>
        {hasActiveProductDiscount(item) ? (() => {
          const bd = getProductQuantityPriceBreakdown(item, qty);
          const hasMix = bd.quantidadeComDesconto > 0 && bd.quantidadeSemDesconto > 0;
          const textoRestante = getProductRemainingQuantityText(item);
          return (
            <div className="mb-8">
              <span className="text-[10px] text-neutral-400 line-through font-bold block mb-1">De {formatCurrency(item.valor)} por</span>
              {hasMix ? (
                <div className="space-y-1.5">
                  <div className="bg-indigo-50 rounded-xl px-3 py-2 text-xs">
                    <div className="flex justify-between font-bold text-indigo-700">
                      <span>{bd.quantidadeComDesconto}× com desconto</span>
                      <span>{formatCurrency(bd.subtotalComDesconto)}</span>
                    </div>
                    <div className="flex justify-between text-neutral-500 mt-1">
                      <span>{bd.quantidadeSemDesconto}× preço normal</span>
                      <span>{formatCurrency(bd.subtotalSemDesconto)}</span>
                    </div>
                  </div>
                  <p className="text-sm font-black text-indigo-600 leading-none">
                    Total: {formatCurrency(bd.subtotalFinal)}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xl font-black text-indigo-600 leading-none">
                    {formatCurrency(getProductEffectivePrice(item))} <span className="text-xs text-neutral-400 font-bold">/ unidade</span>
                  </p>
                  <p className="text-xs font-bold text-emerald-600 mt-2">
                    Total: {formatCurrency(bd.subtotalFinal)}
                  </p>
                </>
              )}
              {textoRestante && (
                <p className={`text-[10px] font-bold mt-2 ${textoRestante.includes('ltima') ? 'text-orange-600' : textoRestante.includes('esgotada') ? 'text-red-600' : 'text-emerald-600'}`}>
                  {textoRestante}
                </p>
              )}
            </div>
          );
        })() : (
          <div className="mb-8">
            <p className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
              {formatCurrency(item.valor)} / unidade
            </p>
            <p className="text-xs font-bold text-neutral-400 mt-2">
              Total: {formatCurrency(item.valor * qty)}
            </p>
          </div>
        )}

        <div className="bg-neutral-50/80 backdrop-blur-sm rounded-[2rem] p-8 mb-8 border border-neutral-100 shadow-sm">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-6">Quantidade</p>
          <div className="flex items-center justify-center gap-10">
            <button 
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="w-16 h-16 bg-white border border-neutral-200 rounded-2xl flex items-center justify-center text-neutral-600 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all shadow-sm active:scale-90"
            >
              <Minus className="w-7 h-7" />
            </button>
            <span className="text-5xl font-black text-neutral-900 w-20 tabular-nums">{qty}</span>
            <button 
              onClick={() => setQty(Math.min(max, qty + 1))}
              className="w-16 h-16 bg-white border border-neutral-200 rounded-2xl flex items-center justify-center text-neutral-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-500 transition-all shadow-sm active:scale-90"
            >
              <Plus className="w-7 h-7" />
            </button>
          </div>
          {item.controle_estoque && (
            <div className="mt-6 inline-flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-full border border-amber-100">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
              <p className="text-[10px] font-black text-amber-700 uppercase">Estoque: {item.estoque_disponivel} un</p>
            </div>
          )}
        </div>

        <button 
          onClick={() => onConfirm(qty)}
          className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] hover:bg-right text-white py-5 rounded-[1.5rem] font-black text-sm shadow-xl shadow-indigo-200 hover:shadow-indigo-300 transition-all duration-500 flex items-center justify-center gap-3 group"
        >
          <ShoppingCart className="w-5 h-5 group-hover:animate-bounce" />
          Adicionar ao Carrinho
        </button>
      </div>
    </Modal>
  );
}