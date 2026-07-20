import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, Package, Scissors, Calendar, Trash2, X, Plus, Minus, Tag, Check, AlertCircle, Loader2, ChevronLeft, ChevronRight, Filter, SlidersHorizontal, Briefcase, ArrowRight, Ticket, Coins, Sparkles, CreditCard, CheckCircle, Clock, CheckCircle2, Wallet, Gift } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatCurrency, generateCode, formatDate } from '../../../lib/utils';
import { toast } from 'react-hot-toast';
import { Modal } from '../../ui/Modal';
import type { CupomLoja } from '../../../types';

export default function AvailableCouponsModal({ isOpen, onClose, coupons, onSelect, category }: { isOpen: boolean, onClose: () => void, coupons: CupomLoja[], onSelect: (code: string) => void, category: 'desconto' | 'entrega' }) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={category === 'desconto' ? "Cupons de Desconto" : "Benefícios de Entrega"} size="sm">
      <div className="p-2 space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
        {coupons.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Ticket className="w-10 h-10 text-neutral-200" />
            </div>
            <p className="text-sm text-neutral-500 font-bold uppercase tracking-widest">Nenhum cupom disponível</p>
            <p className="text-xs text-neutral-400 mt-2 font-medium">Fique atento às nossas promoções!</p>
          </div>
        ) : (
          coupons.map((coupon, idx) => (
            <motion.button
              key={coupon.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: idx * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { onSelect(coupon.codigo_cupom); onClose(); }}
              className="w-full text-left relative group outline-none focus:ring-4 focus:ring-blue-500/20 rounded-3xl"
            >
              {/* Card Container with "Ticket" cutout effect */}
              <div className="relative bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-3xl border-2 border-blue-200/60 p-5 pr-16 hover:border-blue-500 transition-all shadow-sm group-hover:shadow-blue-200/50 group-hover:shadow-xl overflow-hidden overflow-visible">
                {/* Shine Effect */}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:animate-[shimmer_1.5s_infinite] skew-x-12 z-0"></div>

                {/* Side Circles Decoration */}
                <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-6 bg-white border-2 border-blue-200/60 rounded-full z-10 hidden md:block group-hover:border-blue-500 transition-colors shadow-inner"></div>
                <div className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 bg-white border-2 border-blue-200/60 rounded-full z-10 hidden md:block group-hover:border-blue-500 transition-colors shadow-inner"></div>

                <div className="flex flex-col gap-2 relative z-10">
                  <div className="flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white shadow-sm border border-blue-100 text-blue-700 rounded-lg">
                      <Tag className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-black uppercase tracking-widest">{coupon.codigo_cupom}</span>
                    </div>
                    {coupon.data_validade && (
                      <span className="text-[10px] font-bold text-neutral-500 uppercase flex items-center gap-1 bg-white/60 px-2 py-0.5 rounded-full border border-neutral-200/50 backdrop-blur-sm">
                        <Clock className="w-3 h-3" />
                        Até {formatDate(coupon.data_validade)}
                      </span>
                    )}
                  </div>

                  <h4 className="text-base font-black text-neutral-800 group-hover:text-blue-700 transition-colors line-clamp-1 mt-1 drop-shadow-sm">
                    {coupon.nome_cupom}
                  </h4>

                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-3xl font-black tabular-nums bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 drop-shadow-sm group-hover:scale-105 origin-left transition-transform duration-300">
                      {category === 'desconto' 
                        ? (coupon.tipo_desconto === 'porcentagem' ? `${coupon.valor_desconto}%` : formatCurrency(coupon.valor_desconto || 0))
                        : (coupon.tipo_entrega === 'frete_gratis' ? 'GRÁTIS' : coupon.tipo_entrega === 'frete_gratis_minimo' ? 'GRÁTIS' : formatCurrency(coupon.taxa_fixa_entrega || 0))
                      }
                    </span>
                    <span className="text-xs font-bold text-blue-600/70 uppercase tracking-widest">
                      {category === 'desconto' ? 'OFF' : 'ENTREGA'}
                    </span>
                  </div>

                  {category === 'entrega' && coupon.tipo_entrega === 'frete_gratis_minimo' && (
                    <p className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-100/80 border border-emerald-200 w-fit px-2.5 py-1 rounded-md mt-1 shadow-sm flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Mín. {formatCurrency(coupon.valor_minimo_compra || 0)}
                    </p>
                  )}
                </div>

                {/* Vertical Divider Pattern */}
                <div className="absolute right-12 top-0 bottom-0 border-l-2 border-dashed border-blue-300/60 group-hover:border-blue-400 transition-colors z-0"></div>

                {/* Right Action Area */}
                <div className="absolute right-0 top-0 bottom-0 w-12 flex flex-col items-center justify-center bg-gradient-to-b from-emerald-500 to-emerald-600 group-hover:from-emerald-400 group-hover:to-emerald-500 transition-all z-10 shadow-[inset_1px_0_0_rgba(255,255,255,0.2)]">
                  <div className="text-white rotate-90 font-black text-sm uppercase tracking-[0.4em] whitespace-nowrap pl-1 drop-shadow-md flex items-center gap-2">
                    USAR <ArrowRight className="w-4 h-4 -rotate-90 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </div>
            </motion.button>
          ))
        )}
      </div>
    </Modal>
  );
}
