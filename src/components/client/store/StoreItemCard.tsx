import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, Package, Scissors, Calendar, Trash2, X, Plus, Minus, Tag, Check, AlertCircle, Loader2, ChevronLeft, ChevronRight, Filter, SlidersHorizontal, Briefcase, ArrowRight, Ticket, Coins, Sparkles, CreditCard, CheckCircle, Clock, CheckCircle2, Wallet, Gift, Zap, Flame } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatCurrency, generateCode, formatDate } from '../../../lib/utils';
import { toast } from 'react-hot-toast';
import { Modal } from '../../ui/Modal';
import { hasActiveProductDiscount, getProductEffectivePrice, formatProductDiscountPercentage, getProductDiscountAmount, getProductRemainingDaysText, getProductPromotionQuantityInfo, getProductRemainingQuantityText } from '../../../lib/productPricing';

type ItemType = 'produto' | 'servico' | 'assinatura';

export default function StoreItemCard({ item, tipo, onAdd, onClick }: { key?: string, item: any, tipo: ItemType, onAdd: () => any, onClick: () => any }) {
  const isOutOfStock = tipo === 'produto' && item.controle_estoque && item.estoque_disponivel <= 0;
  const isLowStock = tipo === 'produto' && item.controle_estoque && item.estoque_disponivel > 0 && item.estoque_disponivel <= 5;
  
  return (
    <button type="button" onClick={onClick} className="text-left w-full block group relative flex min-h-[250px] flex-col overflow-hidden rounded-2xl border border-neutral-300/90 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.07)] transition-all duration-300 hover:-translate-y-1.5 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/10 md:min-h-[320px] md:rounded-2xl">
      {tipo === 'produto' && hasActiveProductDiscount(item) && !isOutOfStock && (
        <div className="absolute top-0 left-0 z-30 overflow-hidden w-28 h-28 pointer-events-none rounded-tl-2xl">
          <motion.div 
            animate={{ 
              rotate: [-45, -45.6, -44.4, -45.6, -44.4, -45],
            }}
            transition={{ 
              duration: 0.6, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="absolute bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 text-white text-[18px] font-black text-center py-2 w-[170px] top-[24px] left-[-44px] uppercase tracking-normal leading-none flex items-center justify-center origin-center"
          >
            <motion.span
              animate={{ 
                scale: [1, 1.08, 1],
              }}
              transition={{ 
                duration: 1.8, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="inline-block"
            >
              {formatProductDiscountPercentage(item)}
            </motion.span>
          </motion.div>
        </div>
      )}

      <div className="relative m-2 mb-0 flex aspect-[1.12/1] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-50/70 md:m-3 md:mb-0 md:rounded-2xl">
        <div className="absolute inset-0 border border-neutral-200/60"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>
        {item.imagem_url ? (
          <img src={item.imagem_url} alt={item.nome} className="h-full w-full object-contain p-0 rounded-lg md:rounded-xl transition-transform duration-500 ease-out group-hover:scale-105" />
        ) : (
          <div className="text-neutral-200 group-hover:text-indigo-200 transition-colors duration-500">
            {tipo === 'produto' ? <Package className="w-12 h-12 md:w-20 md:h-20" /> : 
             tipo === 'servico' ? <Scissors className="w-12 h-12 md:w-20 md:h-20" /> : 
             <Calendar className="w-12 h-12 md:w-20 md:h-20" />
            }
          </div>
        )}
        
        {tipo === 'produto' && (
          <>
            {/* Stock Warning (only when low stock but not out of stock) */}
            {item.controle_estoque && isLowStock && !isOutOfStock && (
              <div className="absolute left-1.5 top-1.5 md:left-3 md:top-3 z-20 flex flex-col items-start gap-1">
                <span className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-2 py-0.5 text-[7px] font-black uppercase tracking-widest text-white shadow-[0_4px_10px_rgba(245,158,11,0.4)] md:px-2.5 md:py-1 md:text-[8px]">
                  Últimas {item.estoque_disponivel} un
                </span>
              </div>
            )}

            {/* Botão de adicionar ao carrinho absoluto no canto inferior direito da imagem */}
            <button 
              disabled={isOutOfStock}
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className={`absolute bottom-1.5 right-1.5 md:bottom-2.5 md:right-2.5 z-20 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md transition-all md:h-12 md:w-12 md:rounded-2xl ${
                isOutOfStock 
                  ? 'bg-neutral-100/90 text-neutral-400 cursor-not-allowed' 
                  : 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-indigo-200 hover:scale-105'
              }`}
            >
              {isOutOfStock ? <AlertCircle className="w-4 h-4 md:w-5 md:h-5" /> : <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" />}
            </button>
          </>
        )}
      </div>

      <div className="relative flex flex-1 flex-col bg-white px-3 pb-3 pt-3 md:px-5 md:pb-5 md:pt-4">
        <div className="mb-2 flex min-w-0 items-center gap-1.5 md:mb-3 md:gap-2">
          <span className={`rounded-md px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] md:text-[9px] ${
            tipo === 'produto' ? 'bg-indigo-50 text-indigo-600' :
            tipo === 'servico' ? 'bg-purple-50 text-purple-600' :
            'bg-pink-50 text-pink-600'
          }`}>
            {tipo}
          </span>

          {item.categoria && (
            <span className="truncate text-[8px] font-black uppercase tracking-widest text-neutral-400 md:text-[9px]">{item.categoria}</span>
          )}
        </div>
        
        <h3 className="mb-2 line-clamp-2 min-h-[34px] text-sm font-black leading-tight text-neutral-950 transition-colors group-hover:text-indigo-600 md:mb-3 md:min-h-[44px] md:text-lg">{item.nome}</h3>
        
        {tipo === 'produto' && isOutOfStock && (
          <div className="mb-2.5 -mx-3 md:-mx-5 py-2 bg-gradient-to-r from-red-600 via-red-500 to-red-600 text-white text-[18px] font-black uppercase tracking-widest flex items-center justify-center shadow-sm">
            <span>ESGOTADO</span>
          </div>
        )}
        
        {/* Barra de progresso discreta para cotas promocionais */}
        {tipo === 'produto' && hasActiveProductDiscount(item) && item.desconto_limite_quantidade_ativo && (() => {
          const qInfo = getProductPromotionQuantityInfo(item);
          if (!qInfo.limitadoPorQuantidade || qInfo.quantidadeRestante === null) return null;
          
          const total = qInfo.quantidadeLimite || 1;
          const restante = qInfo.quantidadeRestante;
          const porcentagem = Math.min(100, Math.max(0, (restante / total) * 100));
          
          return (
            <div className="mb-3 flex flex-col gap-1.5 w-full z-10 pointer-events-none">
              <div className="flex items-center justify-between text-[10px] md:text-[12px] font-black tracking-wider uppercase">
                <span className="flex items-center gap-1.5 text-emerald-600 font-black animate-pulse">
                  <Zap className="w-3 h-3 md:w-3.5 md:h-3.5 fill-current shrink-0" />
                  RESTAM {restante}
                </span>
                <span className="text-neutral-500 font-extrabold">
                  {restante}/{total} un
                </span>
              </div>
              <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden border border-neutral-200">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                  style={{ width: `${porcentagem}%` }}
                />
              </div>
            </div>
          );
        })()}

        <p className="hidden flex-1 text-xs font-medium leading-5 text-neutral-500 line-clamp-2 md:block">{item.descricao || 'Produto selecionado pelo Grupo GSA.'}</p>
        
        <div className="mt-auto flex items-center justify-between gap-2 rounded-xl bg-neutral-50/80 px-3 py-3 md:gap-4 md:rounded-2xl md:px-4">
          <div className="flex flex-col w-full">
            <span className="mb-1 text-[11px] md:text-[12px] font-black uppercase tracking-wider text-neutral-400">Valor</span>
            {item.ocultar_valor ? (
              <span className="text-[11px] font-black uppercase text-neutral-500 md:text-xs">Sob Consulta</span>
            ) : tipo === 'produto' && hasActiveProductDiscount(item) ? (
              <div className="flex flex-col w-full">
                <span className="text-sm md:text-base text-red-600 line-through font-extrabold leading-none bg-yellow-300 px-1 rounded w-fit">{formatCurrency(item.valor)}</span>
                <span className="text-[22px] font-black text-indigo-700 md:text-3xl leading-none mt-1">{formatCurrency(getProductEffectivePrice(item))}</span>
                <span className="text-[11px] md:text-sm text-emerald-600 font-black uppercase tracking-wider mt-1 whitespace-nowrap">
                  Economize {formatCurrency(getProductDiscountAmount(item))}
                </span>
              </div>
            ) : (
              <span className="text-[22px] font-black text-indigo-700 md:text-3xl leading-none">{formatCurrency(item.valor)}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
