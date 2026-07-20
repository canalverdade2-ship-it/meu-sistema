// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../../ui/Modal';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { toast } from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
// ADD ICONS AS NEEDED
import * as LucideIcons from 'lucide-react';

export default function StoreHubVipPromos(props: any) {
  const { name, search } = props; // Adjust props as needed
  return (
    <Modal isOpen={isVipPromosModalOpen} onClose={() => setIsVipPromosModalOpen(false)} title="Promoções VIP" size="2xl">
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-6 text-white shadow-xl shadow-purple-500/20">
                <h3 className="text-xl font-black mb-2 flex items-center gap-2"><Star className="w-6 h-6 fill-current text-yellow-300" /> Suas Ofertas Exclusivas</h3>
                <p className="text-sm font-medium text-purple-100">Como cliente VIP, você tem acesso a estas promoções especiais. Aproveite antes que expirem!</p>
              </div>
    
              {loadingVipPromos ? (
                <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div></div>
              ) : vipPromos.length === 0 ? (
                <div className="text-center py-12 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <Megaphone className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                  <h3 className="text-lg font-black text-neutral-800 mb-2">Nenhuma promoção ativa</h3>
                  <p className="text-sm text-neutral-500">No momento não há novas promoções. Fique de olho, avisaremos quando surgir algo especial para você!</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {vipPromos.map(promoItem => {
                    const promo = promoItem.promocoes;
                    const expirou = new Date(promoItem.data_expiracao) < new Date();
                    return (
                      <div key={promoItem.id} className={`relative bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm transition-shadow ${expirou ? 'opacity-60 grayscale' : 'hover:shadow-md'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="inline-flex px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-black uppercase tracking-wider rounded-lg">
                            {promo.tipo === 'desconto_proxima' ? 'OFERTA ESPECIAL' 
                              : promo.tipo === 'unidade_gratis' ? 'COMPRE E GANHE' 
                              : promo.tipo === 'ganhe_outro_produto' ? 'BRINDE EXCLUSIVO' 
                              : promo.tipo.replace(/_/g, ' ')}
                          </div>
                          {expirou ? (
                            <span className="text-[10px] font-black text-red-500 uppercase flex items-center gap-1"><Clock className="w-3 h-3" /> Expirada</span>
                          ) : (
                            <span className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-1"><Clock className="w-3 h-3" /> Expira em {formatDate(promoItem.data_expiracao)}</span>
                          )}
                        </div>
                        <h4 className="font-black text-neutral-800 text-lg mb-2">{promo.titulo}</h4>
                        <p className="text-xs text-neutral-500 line-clamp-2 mb-4">{promo.descricao}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-black text-purple-600">
                            {promoItem.is_inteligente ? (
                              ['unidade_gratis', 'ganhe_outro_produto'].includes(promo.tipo) 
                                ? 'BRINDE'
                                : (promo.tipo_desconto === 'valor' ? formatCurrency(promo.valor_desconto) : `${promo.valor_desconto}% OFF`)
                            ) : (
                              promo.tipo === 'desconto_fixo' || promo.tipo_desconto === 'valor' ? formatCurrency(promo.valor_desconto) : `${promo.valor_desconto}% OFF`
                            )}
                          </span>
                        </div>
                        {promoItem.is_inteligente && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAtivarPromocao(promoItem.id);
                            }}
                            disabled={promocoesAtivadas.has(promoItem.id)}
                            className={`w-full mt-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                              promocoesAtivadas.has(promoItem.id)
                                ? 'bg-emerald-50 text-emerald-600 cursor-default border border-emerald-100'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-[1.02] shadow-md hover:shadow-indigo-500/20 active:scale-95'
                            }`}
                          >
                            {promocoesAtivadas.has(promoItem.id) ? 'Promoção Ativada' : 'Ativar Promoção'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Modal>
  );
}
