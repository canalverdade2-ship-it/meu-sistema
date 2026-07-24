import { useEffect, useState } from 'react';
import { BadgeCheck, Check, CreditCard, Crown, Loader2, LockKeyhole, LogIn, ShieldCheck, Ticket, X } from 'lucide-react';
import { AccessibleDialog } from '../ui/AccessibleDialog';
import { freeToolsProAccess, type ProAccessStatus, type ProToolId } from '../../lib/freeToolsProAccess';

const TOOL_NAMES: Record<ProToolId, string> = {
  termination: 'Rescisão trabalhista Pro',
  retirement: 'Aposentadoria INSS Pro',
  vacation: 'Cálculo de férias Pro',
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_voucher: 'Voucher inválido. Confira o código informado.',
  voucher_unavailable: 'Este voucher já foi utilizado ou foi cancelado.',
  voucher_expired: 'Este voucher expirou.',
  voucher_wrong_tool: 'Este voucher não é válido para esta calculadora.',
  checkout_creation_failed: 'Não foi possível gerar o checkout neste momento.',
  infinitepay_not_configured: 'O checkout InfinitePay ainda não está configurado no servidor.',
  product_unavailable: 'O modo Pro desta calculadora está temporariamente indisponível.',
};

interface FreeToolsProUnlockDialogProps {
  isOpen: boolean;
  tool: ProToolId;
  status: ProAccessStatus | null;
  onClose: () => void;
  onUnlocked: () => void;
  onClientLogin: () => void;
}

export function FreeToolsProUnlockDialog({ isOpen, tool, status, onClose, onUnlocked, onClientLogin }: FreeToolsProUnlockDialogProps) {
  const [voucher, setVoucher] = useState('');
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState<'payment' | 'voucher' | null>(null);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMessage(null);
    setLoading(null);
  }, [isOpen, tool]);

  const price = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((status?.product?.preco_centavos || 0) / 100);
  const durationMinutes = Number(status?.product?.duracao_acesso_minutos || 0);
  const durationText = durationMinutes >= 1440 && durationMinutes % 1440 === 0
    ? `${durationMinutes / 1440} dia(s)`
    : durationMinutes >= 60 && durationMinutes % 60 === 0
      ? `${durationMinutes / 60} hora(s)`
      : `${durationMinutes} minuto(s)`;

  const pay = async () => {
    setLoading('payment');
    setMessage(null);
    try {
      const result = await freeToolsProAccess.createCheckout(tool, customer);
      if (!result.success || !result.checkout_url) throw new Error(result.error || 'checkout_creation_failed');
      window.location.assign(result.checkout_url);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'checkout_creation_failed';
      setMessage({ type: 'error', text: ERROR_MESSAGES[code] || 'Não foi possível iniciar o pagamento. Tente novamente.' });
      setLoading(null);
    }
  };

  const redeem = async () => {
    if (!voucher.trim()) return setMessage({ type: 'error', text: 'Informe o código do voucher.' });
    setLoading('voucher');
    setMessage(null);
    try {
      const result = await freeToolsProAccess.redeemVoucher(tool, voucher.trim());
      if (!result.success || !result.session?.success) throw new Error(result.error || result.session?.error || 'voucher_unavailable');
      setMessage({ type: 'success', text: 'Voucher validado. O modo Pro foi liberado para uma utilização.' });
      window.setTimeout(() => {
        onUnlocked();
        onClose();
      }, 650);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'voucher_unavailable';
      setMessage({ type: 'error', text: ERROR_MESSAGES[code] || 'Não foi possível validar o voucher.' });
    } finally {
      setLoading(null);
    }
  };

  return <AccessibleDialog
    isOpen={isOpen}
    onClose={onClose}
    ariaLabel={`Desbloquear ${TOOL_NAMES[tool]}`}
    panelClassName="max-w-[980px] overflow-hidden rounded-2xl border border-[#c8bda9] bg-[#f5f1e9] shadow-[0_38px_110px_rgba(4,12,18,0.55)]"
    overlayClassName="items-center justify-center overflow-y-auto bg-[#07101b]/90 p-2 backdrop-blur-sm sm:p-5"
    zIndexClassName="z-[170]"
  >
    <div className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-h-[calc(100dvh-2.5rem)]">
      <header className="flex items-start justify-between gap-4 border-b border-[#d8d0c4] bg-[#fbf8f1] px-5 py-5 sm:px-7">
        <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#172433] text-[#d8bd73]"><Crown className="h-6 w-6" /></span><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#806128]">Acesso Pro avançado</p><h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-[#111820]">Desbloqueie a experiência completa.</h2><p className="mt-2 text-sm leading-6 text-[#66717a]">{TOOL_NAMES[tool]}</p></div></div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d1c9bd] bg-white text-[#5c6670] hover:border-[#9d7c34]"><X className="h-5 w-5" /></button>
      </header>

      <div className="grid lg:grid-cols-[1.04fr_0.96fr]">
        <section className="p-5 sm:p-7">
          <div className="rounded-2xl border border-[#d5cdc1] bg-white p-5 sm:p-6">
            <div className="flex items-start justify-between gap-5"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#806128]">Compra avulsa</p><p className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#111820]">{price}</p><p className="mt-1 text-xs text-[#6a737a]">Acesso por {durationText} após a confirmação.</p></div><CreditCard className="h-6 w-6 text-[#8a6e2f]" /></div>
            <ul className="mt-6 grid gap-3 text-sm text-[#4e5962] sm:grid-cols-2">{['Pagamento por Pix ou cartão', 'Liberação automática', 'Não exige cadastro', 'Checkout seguro InfinitePay'].map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}</ul>

            <div className="mt-6 border-t border-[#e3ddd4] pt-5"><p className="text-xs font-black text-[#333e47]">Dados opcionais para facilitar o checkout</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} placeholder="Nome" className="min-h-11 rounded-lg border border-[#d6cfc4] px-3 text-sm outline-none focus:border-[#91722f]" /><input type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} placeholder="E-mail" className="min-h-11 rounded-lg border border-[#d6cfc4] px-3 text-sm outline-none focus:border-[#91722f]" /><input value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} placeholder="Telefone" className="min-h-11 rounded-lg border border-[#d6cfc4] px-3 text-sm outline-none focus:border-[#91722f] sm:col-span-2" /></div></div>

            <button type="button" onClick={() => void pay()} disabled={loading !== null} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#172433] px-5 py-3 text-sm font-black text-white transition hover:bg-[#22364a] disabled:opacity-60">{loading === 'payment' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}Pagar e desbloquear agora</button>
          </div>
        </section>

        <aside className="border-t border-[#d8d0c4] bg-[#ece6db] p-5 sm:p-7 lg:border-l lg:border-t-0">
          <div className="rounded-2xl border border-[#d1c8ba] bg-[#faf7f0] p-5">
            <div className="flex items-center gap-3"><Ticket className="h-5 w-5 text-[#8a6e2f]" /><div><p className="text-sm font-black text-[#202a32]">Voucher de uso único</p><p className="mt-0.5 text-xs text-[#6b747b]">Pode ser utilizado mesmo sem login.</p></div></div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row"><input value={voucher} onChange={(event) => setVoucher(event.target.value.toUpperCase())} placeholder="GSA-PRO-XXXXXXXXXX" className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#d1c9bd] bg-white px-3 font-mono text-sm uppercase outline-none focus:border-[#91722f]" /><button type="button" onClick={() => void redeem()} disabled={loading !== null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#9d7c34] bg-[#f4ead0] px-4 text-sm font-black text-[#654f20] disabled:opacity-60">{loading === 'voucher' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}Validar</button></div>
          </div>

          <div className="mt-4 rounded-2xl border border-[#b9c9c0] bg-[#edf4f0] p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#35705a]" /><div><p className="text-sm font-black text-[#163e31]">Benefício para clientes GSA</p><p className="mt-2 text-xs leading-5 text-[#426558]">Cliente ativo, logado e com pelo menos uma fatura paga recebe acesso Pro automaticamente, quando a regra estiver habilitada pelo administrador.</p>{status?.logged_in ? <p className="mt-3 flex items-center gap-2 text-xs font-black text-[#315d4c]"><LockKeyhole className="h-4 w-4" />Sessão de cliente identificada. O sistema verificará a elegibilidade.</p> : <button type="button" onClick={onClientLogin} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#315d4c] px-4 text-sm font-black text-white"><LogIn className="h-4 w-4" />Entrar como cliente</button>}</div></div></div>

          <div className="mt-4 flex gap-3 rounded-xl border border-[#d5cec2] bg-white/65 p-4 text-xs leading-5 text-[#626c74]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6e2f]" />O pagamento é conferido no servidor antes da liberação. A tela de retorno, sozinha, não concede acesso.</div>
        </aside>
      </div>

      {message && <div className={`mx-5 mb-5 rounded-xl border px-4 py-3 text-sm font-bold sm:mx-7 ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{message.text}</div>}
    </div>
  </AccessibleDialog>;
}
