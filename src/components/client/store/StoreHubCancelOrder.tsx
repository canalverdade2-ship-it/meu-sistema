// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../../ui/Modal';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { toast } from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
// ADD ICONS AS NEEDED
import * as LucideIcons from 'lucide-react';

export default function StoreHubCancelOrder(props: any) {
  const { name, search } = props; // Adjust props as needed
  return (
    <Modal 
            isOpen={!!cancelRequestOrder} 
            onClose={() => {
              setCancelRequestOrder(null);
              setCancelReason('');
              setCancelObservation('');
            }} 
            title="Cancelar Compra Confirmada" 
            size="md"
          >
            <div className="space-y-6">
              <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 font-medium">
                  Sua compra já foi confirmada e o pagamento já foi realizado. Para prosseguir com o cancelamento e estorno do valor, escolha um motivo abaixo:
                </p>
              </div>
    
              <div className="space-y-4">
                <label className="text-xs font-black text-neutral-400 uppercase tracking-widest block">Motivo do Cancelamento</label>
                
                <div className="space-y-2">
                  {['COMPREI ERRADO', 'DESISTI DA COMPRA', 'OUTRO MOTIVO'].map(reason => (
                    <label 
                      key={reason} 
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        cancelReason === reason ? 'border-red-500 bg-red-50/50' : 'border-neutral-100 bg-white hover:border-neutral-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancelReason"
                        value={reason}
                        checked={cancelReason === reason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-xs font-black text-neutral-700">{reason}</span>
                    </label>
                  ))}
                </div>
    
                {cancelReason === 'OUTRO MOTIVO' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pt-2"
                  >
                    <textarea
                      value={cancelObservation}
                      onChange={(e) => setCancelObservation(e.target.value)}
                      placeholder="Por favor, detalhe o motivo..."
                      className="w-full h-24 p-4 text-sm font-semibold text-neutral-700 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none transition-all placeholder:text-neutral-400"
                    />
                  </motion.div>
                )}
              </div>
    
              <div className="pt-4 border-t border-neutral-100 grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setCancelRequestOrder(null);
                    setCancelReason('');
                    setCancelObservation('');
                  }}
                  className="py-3 px-4 rounded-xl font-black text-xs uppercase tracking-widest text-neutral-500 bg-neutral-100 hover:bg-neutral-200 transition-all"
                >
                  Voltar
                </button>
                <button
                  onClick={handleProcessPaidCancellation}
                  disabled={isCancelingPaidOrder || !cancelReason}
                  className="py-3 px-4 rounded-xl font-black text-xs uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isCancelingPaidOrder ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Confirmar Cancelamento'
                  )}
                </button>
              </div>
            </div>
          </Modal>
  );
}
