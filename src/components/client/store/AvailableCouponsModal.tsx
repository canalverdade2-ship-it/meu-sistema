import React from 'react';
import { ArrowRight, CheckCircle2, Clock, Tag, Ticket } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { Modal } from '../../ui/Modal';
import type { CupomLoja } from '../../../types';

interface AvailableCouponsModalProps {
  isOpen: boolean;
  onClose: () => void;
  coupons: CupomLoja[];
  onSelect: (code: string) => void;
  category: 'desconto' | 'entrega';
}

function getCouponValue(coupon: CupomLoja, category: 'desconto' | 'entrega'): string {
  if (category === 'desconto') {
    return coupon.tipo_desconto === 'porcentagem'
      ? `${coupon.valor_desconto}%`
      : formatCurrency(coupon.valor_desconto || 0);
  }

  if (coupon.tipo_entrega === 'frete_gratis' || coupon.tipo_entrega === 'frete_gratis_minimo') {
    return 'Grátis';
  }

  return formatCurrency(coupon.taxa_fixa_entrega || 0);
}

export default function AvailableCouponsModal({
  isOpen,
  onClose,
  coupons,
  onSelect,
  category,
}: AvailableCouponsModalProps) {
  if (!isOpen) return null;

  const title = category === 'desconto' ? 'Cupons de desconto' : 'Benefícios de entrega';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-3">
        {coupons.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[18px] border border-slate-200 bg-slate-50 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[18px] border border-slate-200 bg-white">
              <Ticket className="h-7 w-7 text-slate-300" aria-hidden="true" />
            </div>
            <h3 className="mt-5 text-base font-extrabold text-slate-950">Nenhum benefício disponível</h3>
            <p className="mt-2 max-w-[260px] text-sm leading-6 text-slate-500">
              Quando um novo cupom estiver ativo, ele aparecerá aqui para seleção.
            </p>
          </div>
        ) : (
          coupons.map((coupon) => (
            <button
              key={coupon.id}
              type="button"
              onClick={() => {
                onSelect(coupon.codigo_cupom);
                onClose();
              }}
              className="group w-full rounded-[16px] border border-slate-200 bg-white p-4 text-left transition hover:border-[#d6c39a] hover:bg-[#fcfaf6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b742f] focus-visible:ring-offset-2"
            >
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf2f7] text-[#17345f]">
                  <Tag className="h-5 w-5" aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-md border border-[#d6c39a] bg-[#faf7f0] px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#8b6729]">
                      {coupon.codigo_cupom}
                    </span>
                    {coupon.data_validade && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        Até {formatDate(coupon.data_validade)}
                      </span>
                    )}
                  </div>

                  <h4 className="mt-3 line-clamp-2 text-sm font-extrabold leading-5 text-slate-950">
                    {coupon.nome_cupom}
                  </h4>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500">
                        {category === 'desconto' ? 'Benefício no pedido' : 'Condição de entrega'}
                      </p>
                      <p className="mt-0.5 text-2xl font-black leading-none tracking-[-0.04em] text-[#17345f]">
                        {getCouponValue(coupon, category)}
                      </p>
                    </div>

                    <span className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#17345f] px-3 text-xs font-extrabold text-white transition group-hover:bg-[#102746]">
                      Usar
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </div>

                  {category === 'entrega' && coupon.tipo_entrega === 'frete_gratis_minimo' && (
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Compra mínima de {formatCurrency(coupon.valor_minimo_compra || 0)}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}
