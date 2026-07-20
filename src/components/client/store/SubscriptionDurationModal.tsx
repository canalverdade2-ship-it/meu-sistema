import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, Package, Scissors, Calendar, Trash2, X, Plus, Minus, Tag, Check, AlertCircle, Loader2, ChevronLeft, ChevronRight, Filter, SlidersHorizontal, Briefcase, ArrowRight, Ticket, Coins, Sparkles, CreditCard, CheckCircle, Clock, CheckCircle2, Wallet, Gift } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatCurrency, generateCode, formatDate } from '../../../lib/utils';
import { toast } from 'react-hot-toast';
import { Modal } from '../../ui/Modal';

export default function SubscriptionDurationModal({ isOpen, onClose, item, onConfirm, initialDuration = 12 }: any) {
  const [months, setMonths] = useState(initialDuration);

  useEffect(() => {
    if (isOpen) setMonths(initialDuration);
  }, [isOpen, initialDuration]);

  if (!isOpen || !item) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Duração da Assinatura" size="sm">
      <div className="p-6 text-center">
        <div className="w-28 h-28 bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-[2rem] mx-auto mb-6 flex items-center justify-center overflow-hidden border border-neutral-200/50 shadow-inner">
          {item.imagem_url ? (
            <img src={item.imagem_url} alt="" className="w-full h-full object-contain p-2" />
          ) : (
            <Calendar className="w-12 h-12 text-neutral-300" />
          )}
        </div>
        <h3 className="text-xl font-black text-neutral-900 mb-1">{item.nome}</h3>
        <p className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-8">{formatCurrency(item.valor)} / mês</p>

        <div className="bg-neutral-50/80 backdrop-blur-sm rounded-[2rem] p-8 mb-8 border border-neutral-100 shadow-sm">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-6">Quantos Meses?</p>
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="flex items-center justify-center gap-6">
              <button 
                onClick={() => setMonths(Math.max(1, months - 1))}
                className="w-12 h-12 bg-white border border-neutral-200 rounded-full flex items-center justify-center text-neutral-600 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all shadow-sm active:scale-90"
              >
                <Minus className="w-6 h-6" />
              </button>
              <div className="flex flex-col items-center w-24">
                <span className="text-4xl font-black text-neutral-900 tabular-nums">{months}</span>
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{months === 1 ? 'Mês' : 'Meses'}</span>
              </div>
              <button 
                onClick={() => setMonths(Math.min(12, months + 1))}
                className="w-12 h-12 bg-white border border-neutral-200 rounded-full flex items-center justify-center text-neutral-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-500 transition-all shadow-sm active:scale-90"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
            
            <input 
              type="range" 
              min="1" 
              max="12" 
              value={months} 
              onChange={(e) => setMonths(parseInt(e.target.value))}
              className="w-full mt-4 accent-indigo-600"
            />
          </div>
        </div>

        <button 
          onClick={() => onConfirm(months)}
          className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] hover:bg-right text-white py-5 rounded-[1.5rem] font-black text-sm shadow-xl shadow-indigo-200 hover:shadow-indigo-300 transition-all duration-500 flex items-center justify-center gap-3 group"
        >
          <Check className="w-5 h-5 group-hover:scale-110" />
          Confirmar Prazo
        </button>
      </div>
    </Modal>
  );
}