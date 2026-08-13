import React from 'react';
import { ArrowRight, CheckCircle2, Clock, Tag, Ticket, AlertCircle, ShoppingBag } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { Modal } from '../../ui/Modal';
import type { CupomLoja } from '../../../types';

interface AvailableCouponsModalProps {
  isOpen: boolean;
  onClose: () => void;
  coupons: CupomLoja[];
  onSelect?: (code: string) => void;
  onSelectCoupon?: (coupon: CupomLoja) => void;
  category: 'desconto' | 'entrega';
  subtotal?: number;
}

function getCouponValue(coupon: CupomLoja, category: 'desconto' | 'entrega'): string {
  if (category === 'desconto') {
    return coupon.tipo_desconto === 'porcentagem'
      ? `${coupon.valor_desconto}% OFF`
      : `${formatCurrency(coupon.valor_desconto || 0)} OFF`;
  }

  if (coupon.tipo_entrega === 'frete_gratis' || coupon.tipo_entrega === 'frete_gratis_minimo') {
    return 'Frete Grátis';
  }

  return formatCurrency(coupon.taxa_fixa_entrega || 0);
}

export default function AvailableCouponsModal({
  isOpen,
  onClose,
  coupons,
  onSelect,
  onSelectCoupon,
  category,
  subtotal,
}: AvailableCouponsModalProps) {
  if (!isOpen) return null;

  const title = category === 'desconto' ? 'Cupons de Desconto' : 'Benefícios de Entrega';

  const handleSelect = (coupon: CupomLoja) => {
    if (onSelect) {
      onSelect(coupon.codigo_cupom);
    }
    if (onSelectCoupon) {
      onSelectCoupon(coupon);
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-3.5 max-h-[70vh] overflow-y-auto pr-1">
        {coupons.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <Ticket className="h-6 w-6 text-slate-400" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-black text-slate-900">Nenhum cupom ativado disponível</h3>
            <p className="mt-1.5 max-w-[260px] text-xs leading-relaxed text-slate-500">
              Você pode ativar cupons na aba <strong>Meus Cupons</strong> para utilizá-los no checkout.
            </p>
          </div>
        ) : (
          coupons.map((coupon) => {
            const minValor = Number(coupon.valor_minimo_compra || 0);
            const isMinMet = subtotal === undefined || minValor <= 0 || subtotal >= minValor;
            const faltandoParaMinimo = subtotal !== undefined && minValor > 0 && subtotal < minValor ? minValor - subtotal : 0;

            return (
              <div
                key={coupon.id}
                onClick={() => handleSelect(coupon)}
                className={`group w-full rounded-2xl border-2 p-4 text-left transition-all cursor-pointer shadow-xs ${
                  isMinMet
                    ? 'border-neutral-200 bg-white hover:border-[#17345f] hover:bg-slate-50/50 hover:shadow-md'
                    : 'border-amber-200 bg-amber-50/30 hover:border-amber-400'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    isMinMet ? 'bg-[#17345f]/10 text-[#17345f] group-hover:bg-[#17345f] group-hover:text-white' : 'bg-amber-100 text-amber-700'
                  }`}>
                    <Tag className="h-5 w-5" aria-hidden="true" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-amber-800">
                        {coupon.codigo_cupom}
                      </span>
                      {coupon.data_validade && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          Até {formatDate(coupon.data_validade)}
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-black text-slate-900 leading-tight">
                        {coupon.nome_cupom}
                      </h4>
                      {coupon.descricao && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 font-medium">
                          {coupon.descricao}
                        </p>
                      )}
                    </div>

                    <div className="flex items-end justify-between gap-3 pt-1">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {category === 'desconto' ? 'Benefício no pedido' : 'Condição de entrega'}
                        </p>
                        <p className="text-xl font-black text-[#17345f]">
                          {getCouponValue(coupon, category)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(coupon);
                        }}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-black text-white transition cursor-pointer shadow-xs ${
                          isMinMet
                            ? 'bg-[#17345f] hover:bg-[#102746] hover:scale-105 active:scale-95'
                            : 'bg-amber-600 hover:bg-amber-700'
                        }`}
                      >
                        <span>Usar</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    {/* Informações de Regras e Restrições do Cupom */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {minValor > 0 && (
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          isMinMet
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}>
                          {isMinMet ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <AlertCircle className="h-3 w-3 text-amber-600" />}
                          Compra mín. {formatCurrency(minValor)} {faltandoParaMinimo > 0 ? `(faltam ${formatCurrency(faltandoParaMinimo)})` : ''}
                        </span>
                      )}

                      {coupon.produto_id && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">
                          <ShoppingBag className="h-3 w-3 text-blue-600" />
                          Produto específico
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}
