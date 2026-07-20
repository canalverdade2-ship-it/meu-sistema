import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, Package, Scissors, Calendar, Trash2, X, Plus, Minus, Tag, Check, AlertCircle, Loader2, ChevronLeft, ChevronRight, Filter, SlidersHorizontal, Briefcase, ArrowRight, Ticket, Coins, Sparkles, CreditCard, CheckCircle, Clock, CheckCircle2, Wallet, Gift } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatCurrency, generateCode, formatDate } from '../../../lib/utils';
import { toast } from 'react-hot-toast';
import { Modal } from '../../ui/Modal';

export default function FilterModal({ isOpen, onClose, sortBy, setSortBy, minPrice, setMinPrice, maxPrice, setMaxPrice }: any) {
  if (!isOpen) return null;

  const clearFilters = () => {
    setSortBy('none');
    setMinPrice('');
    setMaxPrice('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Filtrar e Ordenar" size="sm">
      <div className="p-2 space-y-8">
        {/* Ordenação */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4">Ordenar por</h4>
          <div className="grid grid-cols-1 gap-2">
            {[
              { id: 'none', label: 'Padrão' },
              { id: 'price-asc', label: 'Menor Preço' },
              { id: 'price-desc', label: 'Maior Preço' },
              { id: 'alpha-asc', label: 'Ordem Alfabética (A-Z)' },
              { id: 'alpha-desc', label: 'Ordem Alfabética (Z-A)' },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setSortBy(option.id)}
                className={`flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all font-bold text-sm ${
                  sortBy === option.id
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                    : 'border-neutral-100 bg-white text-neutral-600 hover:border-neutral-200'
                }`}
              >
                {option.label}
                {sortBy === option.id && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>

        {/* Faixa de Preço */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4">Faixa de Preço (R$)</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-neutral-400 uppercase ml-1">Mínimo</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-bold">R$</span>
                <input
                  type="number"
                  placeholder="0,00"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 pl-9 pr-4 text-sm font-bold text-neutral-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-neutral-400 uppercase ml-1">Máximo</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-bold">R$</span>
                <input
                  type="number"
                  placeholder="Sem limite"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 pl-9 pr-4 text-sm font-bold text-neutral-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 flex gap-3">
          <button
            onClick={clearFilters}
            className="flex-1 py-4 rounded-xl font-bold text-sm text-neutral-500 hover:bg-neutral-100 transition-colors"
          >
            Limpar
          </button>
          <button
            onClick={onClose}
            className="flex-[2] bg-[#1a1a1a] text-white py-4 rounded-xl font-black text-sm hover:bg-indigo-600 shadow-xl hover:shadow-indigo-600/20 transition-all uppercase tracking-wider"
          >
            Aplicar
          </button>
        </div>
      </div>
    </Modal>
  );
}