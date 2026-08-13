import React, { useEffect, useState } from 'react';
import { Gift, Minus, Package, Plus, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import { Modal } from '../../ui/Modal';
import {
  getProductEffectivePrice,
  getProductQuantityPriceBreakdown,
  getProductRemainingQuantityText,
  hasActiveProductDiscount,
} from '../../../lib/productPricing';

interface QuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  onConfirm: (quantity: number) => void;
  initialQty?: number;
}

export default function QuantityModal({ isOpen, onClose, item, onConfirm, initialQty = 1 }: QuantityModalProps) {
  const [quantity, setQuantity] = useState(initialQty);

  useEffect(() => {
    if (isOpen) setQuantity(Math.max(1, initialQty));
  }, [isOpen, initialQty]);

  if (!isOpen || !item) return null;

  // Não força mínimo de 1 quando o estoque real é 0 — isso permitia "adicionar 1 unidade"
  // de um item esgotado através deste modal.
  const maxQuantity = item.controle_estoque ? Math.max(0, Number(item.estoque_disponivel || 0)) : 99;
  const isOutOfStock = item.controle_estoque && maxQuantity <= 0;
  const breakdown = getProductQuantityPriceBreakdown(item, quantity);
  const hasDiscount = hasActiveProductDiscount(item);
  const mixedPrice = breakdown.quantidadeComDesconto > 0 && breakdown.quantidadeSemDesconto > 0;
  const promotionAvailability = getProductRemainingQuantityText(item);
  const total = hasDiscount ? breakdown.subtotalFinal : Number(item.valor || 0) * quantity;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Escolha a quantidade" size="sm">
      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-[16px] border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
            {item.imagem_url ? (
              <img src={item.imagem_url} alt={item.nome} className="h-full w-full object-contain" />
            ) : (
              <Package className="h-8 w-8 text-slate-300" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-base font-extrabold leading-5 text-slate-950">{item.nome}</h3>
            <p className="mt-1 text-sm font-black text-[#17345f]">
              {formatCurrency(hasDiscount ? getProductEffectivePrice(item) : Number(item.valor || 0))}
              <span className="ml-1 text-xs font-semibold text-slate-500">por unidade</span>
            </p>
          </div>
        </div>

        <section className="rounded-[16px] border border-slate-200 bg-white p-5" aria-labelledby="quantity-title">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 id="quantity-title" className="text-sm font-extrabold text-slate-950">Quantidade</h4>
              <p className="mt-1 text-xs text-slate-500">Selecione quantas unidades deseja comprar.</p>
            </div>
            {item.controle_estoque && (
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                {item.estoque_disponivel} disponíveis
              </span>
            )}
          </div>

          <div className="mt-5 grid grid-cols-[48px_1fr_48px] items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              disabled={quantity <= 1}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Diminuir quantidade"
            >
              <Minus className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="flex h-14 items-center justify-center rounded-xl bg-[#f5f6f8] text-3xl font-black tabular-nums text-slate-950" aria-live="polite">
              {quantity}
            </div>
            <button
              type="button"
              onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))}
              disabled={quantity >= maxQuantity}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Aumentar quantidade"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </section>

        {hasDiscount && mixedPrice && (
          <div className="rounded-[16px] border border-[#dfd1b4] bg-[#faf7f0] p-4 text-xs">
            <div className="flex justify-between gap-4 font-bold text-[#17345f]">
              <span>{breakdown.quantidadeComDesconto} com preço promocional</span>
              <span>{formatCurrency(breakdown.subtotalComDesconto)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-4 text-slate-600">
              <span>{breakdown.quantidadeSemDesconto} com preço normal</span>
              <span>{formatCurrency(breakdown.subtotalSemDesconto)}</span>
            </div>
          </div>
        )}

        {promotionAvailability && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800">
            {promotionAvailability}
          </p>
        )}

        {quantity > 1 && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50/90 p-3.5 border border-emerald-200/80 animate-in fade-in duration-200">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-emerald-800">Total ({quantity} unidades):</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-black text-emerald-700">{formatCurrency(total)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-black text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200/60 shrink-0">
              <Gift className="h-4 w-4 text-amber-500" />
              <span>+ {Math.floor(total)} pts</span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => onConfirm(quantity)}
          disabled={isOutOfStock}
          className="inline-flex min-h-13 w-full items-center justify-center gap-2.5 rounded-xl bg-[#17345f] px-5 py-4 text-sm font-extrabold text-white transition hover:bg-[#102746] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          <ShoppingBag className="h-5 w-5" aria-hidden="true" />
          {isOutOfStock ? 'Produto esgotado' : `Adicionar ${quantity} ${quantity === 1 ? 'unidade' : 'unidades'}`}
        </button>
      </div>
    </Modal>
  );
}
