import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  Copy, 
  Check, 
  QrCode, 
  FileText, 
  Clock, 
  Loader2, 
  ShieldCheck, 
  ExternalLink,
  Sparkles,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { formatCurrency } from '../../../lib/utils';
import { supabase } from '../../../lib/supabase';
import { checkOrderStatus } from '../../../lib/pixService';

export interface CheckoutPixModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderCode: string;
  total: number;
  pixCode: string;
  qrCodeUrl: string;
  checkoutUrl?: string;
  onPaymentSuccess: (orderId: string, orderCode: string) => void;
}

export function CheckoutPixModal({
  isOpen,
  onClose,
  orderId,
  orderCode,
  total,
  pixCode,
  qrCodeUrl,
  checkoutUrl,
  onPaymentSuccess,
}: CheckoutPixModalProps) {
  const [activeTab, setActiveTab] = useState<'copia_e_cola' | 'qrcode'>('copia_e_cola');
  const [copied, setCopied] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutos em segundos
  const hasTriggeredSuccess = useRef(false);

  // Timer de Expiração (15 minutos)
  useEffect(() => {
    if (!isOpen || isPaid) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, isPaid]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyPix = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(pixCode);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = pixCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success('Código PIX copiado com sucesso!', { id: 'pix-copy' });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Erro ao copiar código. Selecione e copie manualmente.');
    }
  };

  const handlePaymentApproved = useCallback(() => {
    if (hasTriggeredSuccess.current) return;
    hasTriggeredSuccess.current = true;
    setIsPaid(true);

    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10b981', '#059669', '#34d399', '#d8bd73', '#17345f']
      });
    } catch (_) {}

    toast.success('🎉 Pagamento Aprovado com Sucesso!', {
      duration: 5000,
      icon: '✅',
    });

    // Aguarda animação de confirmação e redireciona
    setTimeout(() => {
      onPaymentSuccess(orderId, orderCode);
    }, 2000);
  }, [orderId, orderCode, onPaymentSuccess]);

  // Consulta manual / periódica
  const checkStatusNow = useCallback(async () => {
    if (!orderId || isPaid || hasTriggeredSuccess.current) return;
    setIsChecking(true);
    try {
      const res = await checkOrderStatus(orderId);
      if (res.pago) {
        handlePaymentApproved();
      }
    } catch (e) {
      console.error('[CheckoutPixModal] Erro ao verificar status:', e);
    } finally {
      setIsChecking(false);
    }
  }, [orderId, isPaid, handlePaymentApproved]);

  // Escuta em Tempo Real (Supabase Realtime) + Polling de fallback (3s)
  useEffect(() => {
    if (!isOpen || !orderId || isPaid) return;

    // 1. Polling a cada 3 segundos
    const pollInterval = setInterval(() => {
      checkStatusNow();
    }, 3000);

    // 2. Realtime Channel no Supabase
    const channel = supabase
      .channel(`pix-payment-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orcamentos',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const newStatus = String(payload?.new?.status || '').toLowerCase();
          if (['pago', 'aprovado', 'em_expedicao', 'em_transporte', 'concluido'].includes(newStatus)) {
            handlePaymentApproved();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'faturas',
          filter: `orcamento_id=eq.${orderId}`,
        },
        (payload) => {
          const newStatus = String(payload?.new?.status || '').toLowerCase();
          if (newStatus === 'pago') {
            handlePaymentApproved();
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [isOpen, orderId, isPaid, checkStatusNow, handlePaymentApproved]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/70 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border border-neutral-200"
        >
          {/* Top Bar com Gradiente */}
          <div className="bg-gradient-to-r from-[#17345f] via-[#1e457e] to-[#17345f] px-6 py-5 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-950/20">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">
                    {isPaid ? 'Pagamento Aprovado!' : 'Pagamento Instantâneo PIX'}
                  </h3>
                  <p className="text-xs text-blue-100 font-medium">
                    Pedido #{orderCode} • Banco InfinitePay
                  </p>
                </div>
              </div>

              {!isPaid && (
                <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-emerald-300 backdrop-blur-xs border border-white/10">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatTimer(timeLeft)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Conteúdo Principal */}
          <div className="p-5 sm:p-6 space-y-5">
            {isPaid ? (
              /* Tela de Sucesso */
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-8 text-center space-y-4"
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
                  <CheckCircle2 className="h-12 w-12 animate-bounce" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xl font-black text-neutral-900">
                    Pagamento Confirmado com Sucesso!
                  </h4>
                  <p className="text-sm text-neutral-600 font-medium">
                    Identificamos o pagamento de <strong className="text-emerald-700">{formatCurrency(total)}</strong>.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-neutral-500 pt-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#17345f]" />
                  <span>Redirecionando para suas compras...</span>
                </div>
              </motion.div>
            ) : (
              <>
                {/* Destaque do Valor */}
                <div className="flex items-center justify-between rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-4">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
                      Total com 5% de Desconto PIX
                    </span>
                    <p className="text-2xl font-black text-emerald-950">
                      {formatCurrency(total)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black uppercase text-white tracking-wide">
                      Aprovação Imediata
                    </span>
                  </div>
                </div>

                {/* Alternância de Abas: Copia e Cola / QR Code */}
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-neutral-100 p-1 border border-neutral-200">
                  <button
                    type="button"
                    onClick={() => setActiveTab('copia_e_cola')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition-all cursor-pointer ${
                      activeTab === 'copia_e_cola'
                        ? 'bg-white text-[#17345f] shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    <span>Pix Copia e Cola</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('qrcode')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition-all cursor-pointer ${
                      activeTab === 'qrcode'
                        ? 'bg-white text-[#17345f] shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <QrCode className="h-4 w-4" />
                    <span>QR Code Pix</span>
                  </button>
                </div>

                {/* Exibição da Aba Ativa */}
                {activeTab === 'copia_e_cola' ? (
                  <div className="space-y-3">
                    <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                      Clique no botão abaixo para copiar o código PIX e cole no aplicativo do seu banco:
                    </p>

                    {/* Bloco do Código */}
                    <div className="relative rounded-2xl bg-neutral-950 p-3.5 border border-neutral-800">
                      <div className="max-h-24 overflow-y-auto font-mono text-[11px] font-bold leading-relaxed text-emerald-400 break-all select-all pr-2">
                        {pixCode}
                      </div>
                    </div>

                    {/* Botão de 1 Clique para Copiar */}
                    <button
                      type="button"
                      onClick={handleCopyPix}
                      className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white shadow-md transition-all cursor-pointer ${
                        copied
                          ? 'bg-emerald-700 shadow-emerald-700/30'
                          : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check className="h-5 w-5" />
                          <span>Código PIX Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-5 w-5" />
                          <span>Copiar Código PIX</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 text-center">
                    <p className="text-xs text-neutral-600 font-medium">
                      Abra o aplicativo do seu banco, escolha <strong>Pagar com PIX &gt; Ler QR Code</strong> e aponte a câmera:
                    </p>

                    <div className="mx-auto flex h-60 w-60 items-center justify-center rounded-2xl border-2 border-dashed border-emerald-300 bg-white p-3 shadow-inner">
                      {qrCodeUrl ? (
                        <img
                          src={qrCodeUrl}
                          alt="QR Code Pix InfinitePay"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-neutral-400">
                          <Loader2 className="h-8 w-8 animate-spin" />
                          <span className="text-xs font-bold">Gerando QR Code...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Status em Tempo Real com o Banco */}
                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs font-black text-[#17345f]">
                        Aguardando confirmação do banco...
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={checkStatusNow}
                      disabled={isChecking}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                    >
                      <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
                      <span>Verificar agora</span>
                    </button>
                  </div>

                  {/* Barra de Progresso Animada */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-200/60">
                    <div className="h-full w-1/2 rounded-full bg-emerald-500 animate-[shimmer_2s_ease-in-out_infinite]"></div>
                  </div>

                  <p className="text-[10px] text-neutral-500 font-medium">
                    Assim que você pagar no app do seu banco, o sistema reconhecerá automaticamente em poucos segundos.
                  </p>
                </div>

                {/* Link Externo Opcional InfinitePay */}
                {checkoutUrl && (
                  <div className="text-center pt-1">
                    <a
                      href={checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-800 transition-colors"
                    >
                      <span>Prefere abrir a página da InfinitePay?</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}

                {/* Botão de Fechar / Acompanhar depois */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-xl border border-neutral-300 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-all cursor-pointer"
                  >
                    Fechar e Pagar Mais Tarde em Minhas Compras
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Rodapé Seguro */}
          <div className="bg-neutral-50 px-6 py-3 border-t border-neutral-200 flex items-center justify-between text-[11px] text-neutral-500 font-medium">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Ambiente 100% Seguro</span>
            </div>
            <span>Grupo GSA &bull; InfinitePay</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default CheckoutPixModal;
