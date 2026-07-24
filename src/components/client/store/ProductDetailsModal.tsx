import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Headphones,
  Package,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from 'lucide-react';
import { getProductDisplayCode } from '../../../lib/productIdentification';
import { formatCurrency } from '../../../lib/utils';
import { Modal } from '../../ui/Modal';
import { mapColumnsToGallery } from '../ClientGSAStore';
import {
  formatProductDiscountPercentage,
  getProductDiscountAmount,
  getProductEffectivePrice,
  getProductRemainingDaysText,
  getProductRemainingQuantityText,
  hasActiveProductDiscount,
} from '../../../lib/productPricing';

type ItemType = 'produto' | 'servico' | 'assinatura';

interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  tipo: ItemType;
  onAdd: () => void;
}

function getTypeLabel(tipo: ItemType) {
  if (tipo === 'assinatura') return 'Plano e assinatura';
  if (tipo === 'servico') return 'Serviço';
  return 'Produto';
}

function getCategoryLabel(item: any): string {
  if (typeof item?.categoria === 'string') return item.categoria;
  if (typeof item?.categorias?.nome === 'string') return item.categorias.nome;
  if (typeof item?.categoria_nome === 'string') return item.categoria_nome;
  return '';
}

function Placeholder({ tipo }: { tipo: ItemType }) {
  const className = 'h-20 w-20 text-slate-300';
  if (tipo === 'assinatura') return <Calendar className={className} aria-hidden="true" />;
  if (tipo === 'servico') return <Scissors className={className} aria-hidden="true" />;
  return <Package className={className} aria-hidden="true" />;
}

export default function ProductDetailsModal({ isOpen, onClose, item, tipo, onAdd }: ProductDetailsModalProps) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const images = useMemo(() => mapColumnsToGallery(item), [item]);

  useEffect(() => {
    setActiveImageIdx(0);
  }, [item?.id]);

  if (!isOpen || !item) return null;

  const category = getCategoryLabel(item);
  const isProduct = tipo === 'produto';
  const outOfStock = isProduct && item.controle_estoque && Number(item.estoque_disponivel || 0) <= 0;
  const lowStock = isProduct && item.controle_estoque && Number(item.estoque_disponivel || 0) > 0 && Number(item.estoque_disponivel || 0) <= 5;
  const discount = isProduct && hasActiveProductDiscount(item);
  const currentPrice = discount ? getProductEffectivePrice(item) : Number(item.valor || 0);
  const remainingDays = discount ? getProductRemainingDaysText(item) : null;
  const remainingQuantity = discount ? getProductRemainingQuantityText(item) : null;
  const isFeatured = Boolean(item?.destaque || item?.mais_vendido || item?.mais_procurado);
  const reference = tipo === 'produto'
    ? getProductDisplayCode(item)
    : tipo === 'servico'
      ? item.codigo_servico
      : item.codigo_assinatura;

  const goToPreviousImage = () => {
    setActiveImageIdx((current) => (current > 0 ? current - 1 : images.length - 1));
  };

  const goToNextImage = () => {
    setActiveImageIdx((current) => (current < images.length - 1 ? current + 1 : 0));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Experiência GSA Store" size="wide">
      <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="border-b border-[#d7c39a]/35 bg-[#0e2746] px-5 py-4 text-white sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-[#ddc28d]">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddc28d]">Seleção GSA Store</p>
                <p className="mt-0.5 text-xs font-semibold text-white/70">Apresentação completa, compra clara e acompanhamento pelo portal.</p>
              </div>
            </div>
            <span className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/85">
              Ambiente institucional
            </span>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
          <section aria-label="Galeria do item" className="min-w-0 border-b border-slate-200 bg-[#f4f5f7] p-4 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[20px] border border-white bg-white shadow-[0_16px_42px_rgba(15,23,42,0.08)] md:aspect-[4/3]">
              {images.length > 0 ? (
                <img
                  src={images[activeImageIdx]}
                  alt={`${item.nome} — imagem ${activeImageIdx + 1} de ${images.length}`}
                  className="h-full w-full object-contain p-2 sm:p-3"
                />
              ) : (
                <Placeholder tipo={tipo} />
              )}

              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/[0.07] to-transparent" aria-hidden="true" />

              {discount && !outOfStock && (
                <span className="absolute left-4 top-4 rounded-lg bg-[#9b742f] px-3 py-2 text-[10px] font-black uppercase tracking-[0.09em] text-white shadow-[0_8px_22px_rgba(155,116,47,0.28)]">
                  {formatProductDiscountPercentage(item)} off
                </span>
              )}

              {isFeatured && !outOfStock && (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#17345f] shadow-sm backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5 text-[#9b742f]" aria-hidden="true" />
                  Destaque da loja
                </span>
              )}

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goToPreviousImage}
                    className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.12)] transition hover:border-[#d7c39a] hover:text-[#8b6729]"
                    aria-label="Imagem anterior"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={goToNextImage}
                    className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.12)] transition hover:border-[#d7c39a] hover:text-[#8b6729]"
                    aria-label="Próxima imagem"
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <span className="absolute bottom-4 right-4 rounded-lg bg-[#0e2746]/90 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm">
                    {activeImageIdx + 1}/{images.length}
                  </span>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {images.map((url: string, index: number) => (
                  <button
                    key={`${url}-${index}`}
                    type="button"
                    onClick={() => setActiveImageIdx(index)}
                    aria-label={`Exibir imagem ${index + 1}`}
                    aria-pressed={activeImageIdx === index}
                    className={`flex h-17 w-17 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white transition ${
                      activeImageIdx === index
                        ? 'border-[#9b742f] ring-2 ring-[#9b742f]/15'
                        : 'border-slate-200 opacity-70 hover:border-slate-300 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt="" className="h-full w-full object-contain p-0.5" />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-3">
                <ShieldCheck className="h-4.5 w-4.5 shrink-0 text-[#9b742f]" aria-hidden="true" />
                <span className="text-[11px] font-bold leading-4 text-slate-700">Compra protegida</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-3">
                <Headphones className="h-4.5 w-4.5 shrink-0 text-[#9b742f]" aria-hidden="true" />
                <span className="text-[11px] font-bold leading-4 text-slate-700">Atendimento GSA</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-3">
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-[#9b742f]" aria-hidden="true" />
                <span className="text-[11px] font-bold leading-4 text-slate-700">Pedido registrado</span>
              </div>
            </div>
          </section>

          <section className="flex min-w-0 flex-col p-5 sm:p-7 lg:p-8">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.1em]">
              <span className="rounded-lg bg-[#edf2f7] px-2.5 py-1.5 text-[#17345f]">{getTypeLabel(tipo)}</span>
              {category && <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-500">{category}</span>}
              {reference && <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-500">Ref. {reference}</span>}
            </div>

            <h1 className="mt-4 text-2xl font-black leading-[1.12] tracking-[-0.04em] text-slate-950 sm:text-3xl lg:text-[40px]">
              {item.nome}
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              {item.descricao || 'Conheça esta solução selecionada para a GSA Store e acompanhe todo o pedido pelo portal.'}
            </p>

            <div className="mt-6 rounded-[18px] border border-[#dfd1b4] bg-[#fbf8f2] p-5 shadow-[inset_4px_0_0_#9b742f]">
              {item.ocultar_valor ? (
                <p className="text-lg font-extrabold text-slate-700">Valor sob consulta</p>
              ) : (
                <>
                  <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#8b6729]">Condição atual</p>
                  {discount && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-slate-400 line-through">{formatCurrency(item.valor)}</span>
                      <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                        Economia de {formatCurrency(getProductDiscountAmount(item))}
                      </span>
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <span className="text-[36px] font-black leading-none tracking-[-0.05em] text-[#17345f] sm:text-[46px]">
                      {formatCurrency(currentPrice)}
                    </span>
                    {tipo === 'assinatura' && <span className="pb-1 text-sm font-semibold text-slate-500">por mês</span>}
                  </div>
                </>
              )}

              {(remainingDays || remainingQuantity) && (
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                  {remainingDays && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-amber-800">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {remainingDays}
                    </span>
                  )}
                  {remainingQuantity && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-emerald-800">
                      <Package className="h-3.5 w-3.5" aria-hidden="true" />
                      {remainingQuantity}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-2">
                <span className="h-5 w-1 rounded-full bg-[#9b742f]" aria-hidden="true" />
                <h2 className="text-sm font-black text-slate-950">Sobre este item</h2>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                {item.descricao || 'As informações detalhadas deste item serão disponibilizadas pela equipe GSA.'}
              </p>
            </div>

            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-[14px] border border-slate-200 bg-white p-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#9b742f]" aria-hidden="true" />
                <div>
                  <p className="text-xs font-extrabold text-slate-900">Compra protegida</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">Pedido registrado e acompanhado no portal.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-[14px] border border-slate-200 bg-white p-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
                {isProduct ? <Truck className="mt-0.5 h-5 w-5 shrink-0 text-[#9b742f]" aria-hidden="true" /> : <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#9b742f]" aria-hidden="true" />}
                <div>
                  <p className="text-xs font-extrabold text-slate-900">{isProduct ? 'Entrega acompanhada' : 'Ativação acompanhada'}</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">Você recebe atualizações em cada etapa.</p>
                </div>
              </div>
            </div>

            {isProduct && item.controle_estoque && (
              <div className={`mt-5 flex items-center gap-2 rounded-xl border px-3.5 py-3 text-xs font-bold ${
                outOfStock
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : lowStock
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}>
                {outOfStock ? <AlertCircle className="h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                {outOfStock
                  ? 'Produto temporariamente esgotado'
                  : lowStock
                    ? `Restam ${item.estoque_disponivel} unidades`
                    : `${item.estoque_disponivel} unidades disponíveis`}
              </div>
            )}

            <div className="sticky bottom-0 mt-auto bg-white/95 pt-6 backdrop-blur-sm">
              <button
                type="button"
                disabled={outOfStock}
                onClick={onAdd}
                className="inline-flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-xl bg-[#17345f] px-5 py-4 text-sm font-black text-white shadow-[0_14px_30px_rgba(23,52,95,0.22)] transition hover:bg-[#102746] hover:shadow-[0_18px_38px_rgba(23,52,95,0.3)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
              >
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                {outOfStock ? 'Produto indisponível' : tipo === 'assinatura' ? 'Escolher período' : 'Adicionar ao carrinho'}
              </button>
              <p className="mt-2.5 text-center text-[10px] font-semibold leading-4 text-slate-400">
                Preço, disponibilidade e condições serão confirmados antes da finalização.
              </p>
            </div>
          </section>
        </div>
      </div>
    </Modal>
  );
}
