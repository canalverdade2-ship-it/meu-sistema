import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { ArrowRight, BriefcaseBusiness, Calculator, CheckCircle2, Crown, FileCheck2, Landmark, Loader2, LockKeyhole, Palmtree, Scale, ShieldCheck, Sparkles, X } from 'lucide-react';
import { AccessibleDialog } from '../ui/AccessibleDialog';
import { FreeToolsSimpleCalculator } from './FreeToolsSimpleCalculators';
import { FreeToolsAdvancedCalculator } from './FreeToolsAdvancedCalculators';
import { FreeToolsProUnlockDialog } from './FreeToolsProUnlockDialog';
import {
  clearInfinitePayReturnFromUrl,
  freeToolsProAccess,
  readInfinitePayReturn,
  type ProAccessStatus,
  type ProToolId,
} from '../../lib/freeToolsProAccess';

export type FreeToolId = ProToolId;

interface FreeToolsTieredCalculatorDialogProps {
  tool: FreeToolId | null;
  onClose: () => void;
  onToolChange: (tool: FreeToolId) => void;
  onServices: () => void;
  onClientLogin: () => void;
}

const TOOL_ORDER: FreeToolId[] = ['termination', 'retirement', 'vacation'];
const TOOLS: Record<FreeToolId, { icon: ComponentType<{ className?: string }>; code: string; shortTitle: string; category: string; title: string; description: string }> = {
  termination: { icon: BriefcaseBusiness, code: 'FT-01', shortTitle: 'Rescisão', category: 'Ferramenta trabalhista', title: 'Cálculo de rescisão CLT', description: 'Comece com uma estimativa simples ou desbloqueie a memória avançada das verbas rescisórias.' },
  retirement: { icon: Landmark, code: 'FT-02', shortTitle: 'Aposentadoria', category: 'Ferramenta previdenciária · 2026', title: 'Panorama de aposentadoria INSS', description: 'Consulte a regra geral gratuitamente ou compare regras de transição no modo Pro.' },
  vacation: { icon: Palmtree, code: 'FT-03', shortTitle: 'Férias', category: 'Ferramenta trabalhista', title: 'Cálculo de férias', description: 'Calcule salário e adicional de um terço no Free ou inclua médias e composição detalhada no Pro.' },
};

const STYLES = `
  [role="dialog"][aria-label^="Calculadora GSA"] { isolation: isolate; }
  .gsa-tier-tool-nav { scrollbar-width: none; -webkit-overflow-scrolling: touch; }
  .gsa-tier-tool-nav::-webkit-scrollbar { display: none; }
  @media (max-width: 767px) {
    [role="dialog"][aria-label^="Calculadora GSA"] { width:100vw!important;max-width:100vw!important;height:100dvh!important;max-height:100dvh!important;margin:0!important;border:0!important;border-radius:0!important; }
    [role="dialog"][aria-label^="Calculadora GSA"] > div { height:100dvh!important;max-height:100dvh!important; }
    [role="dialog"][aria-label^="Calculadora GSA"] footer { padding-bottom:max(.75rem,env(safe-area-inset-bottom))!important; }
    .gsa-tier-tool-nav > button { min-width:148px;scroll-snap-align:start; }
  }
`;

function sourceLabel(source?: string | null) {
  const labels: Record<string, string> = {
    payment: 'Pagamento confirmado', voucher: 'Voucher ativado', manual: 'Liberado pelo administrador', client_paid_invoice: 'Benefício de cliente', free_period: 'Período gratuito', session: 'Sessão Pro ativa',
  };
  return source ? labels[source] || 'Acesso Pro ativo' : 'Acesso Pro bloqueado';
}

export function FreeToolsTieredCalculatorDialog({ tool, onClose, onToolChange, onServices, onClientLogin }: FreeToolsTieredCalculatorDialogProps) {
  const [mode, setMode] = useState<'free' | 'pro'>('free');
  const [status, setStatus] = useState<ProAccessStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const presentation = tool ? TOOLS[tool] : null;
  const Icon = presentation?.icon || Calculator;

  const refreshStatus = useCallback(async (selectedTool: FreeToolId) => {
    try {
      const next = await freeToolsProAccess.status(selectedTool);
      setStatus(next);
      return next;
    } catch {
      setStatus(null);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!tool) return;
    setMode('free');
    setNotice(null);
    void refreshStatus(tool);
  }, [tool, refreshStatus]);

  useEffect(() => {
    if (!tool) return;
    const paymentReturn = readInfinitePayReturn();
    if (!paymentReturn || paymentReturn.tool !== tool) return;
    let active = true;
    const verify = async () => {
      setChecking(true);
      setNotice('Confirmando o pagamento com a InfinitePay...');
      try {
        let unlocked = false;
        if (paymentReturn.transactionNsu && paymentReturn.slug) {
          const result = await freeToolsProAccess.verifyPayment(tool, paymentReturn);
          unlocked = Boolean(result.paid && result.session?.success);
        } else {
          for (let attempt = 0; attempt < 6 && active; attempt += 1) {
            const next = await refreshStatus(tool);
            if (next?.access) { unlocked = true; break; }
            await new Promise((resolve) => window.setTimeout(resolve, 1500));
          }
        }
        if (!active) return;
        if (unlocked) {
          const activation = await freeToolsProAccess.activate(tool);
          if (activation.success) {
            setMode('pro');
            setNotice('Pagamento confirmado. O modo Pro foi desbloqueado.');
            await refreshStatus(tool);
          }
        } else {
          setNotice('O pagamento ainda está em processamento. A confirmação será atualizada automaticamente.');
        }
      } catch {
        if (active) setNotice('Não foi possível confirmar o pagamento agora. Abra o modo Pro novamente para consultar o status.');
      } finally {
        if (active) { setChecking(false); clearInfinitePayReturnFromUrl(); }
      }
    };
    void verify();
    return () => { active = false; };
  }, [tool, refreshStatus]);

  const selectPro = async () => {
    if (!tool || checking) return;
    setChecking(true);
    setNotice(null);
    try {
      const next = await refreshStatus(tool);
      if (!next?.access) {
        setUnlockOpen(true);
        return;
      }
      const activation = await freeToolsProAccess.activate(tool);
      if (!activation.success) {
        setUnlockOpen(true);
        return;
      }
      setMode('pro');
      await refreshStatus(tool);
    } catch {
      setUnlockOpen(true);
    } finally {
      setChecking(false);
    }
  };

  const unlockedFromPopup = async () => {
    if (!tool) return;
    setMode('pro');
    setNotice('Acesso Pro liberado com sucesso.');
    await refreshStatus(tool);
  };

  const price = status?.product ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(status.product.preco_centavos / 100) : null;

  return <>
    <style>{STYLES}</style>
    <AccessibleDialog isOpen={Boolean(tool)} onClose={onClose} ariaLabel={presentation ? `Calculadora GSA — ${presentation.title}` : 'Calculadora GSA'} panelClassName="max-w-[1240px] overflow-hidden rounded-2xl border border-[#beb5a7] bg-[#f4efe6] shadow-[0_38px_110px_rgba(4,12,18,0.48)]" overlayClassName="items-center justify-center overflow-y-auto bg-[#07101b]/88 p-0 backdrop-blur-sm sm:p-5" zIndexClassName="z-[130]">
      <div className="flex max-h-[calc(100dvh-.75rem)] min-h-0 flex-col sm:max-h-[calc(100dvh-2.5rem)]">
        <div className="flex min-h-9 items-center justify-between gap-4 bg-[#111e2a] px-4 py-2 text-white sm:px-6"><div className="flex items-center gap-3"><strong className="text-[10px] font-black tracking-[.18em] text-[#d8bd73]">GSA HUB</strong><span className="h-3 w-px bg-white/20" /><span className="text-[9px] font-bold uppercase tracking-[.14em] text-white/50">Centro de ferramentas públicas</span></div><span className="hidden items-center gap-2 text-[9px] font-black uppercase tracking-[.12em] text-white/45 sm:inline-flex"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />Free + Pro</span></div>

        <header className="sticky top-0 z-30 flex items-start justify-between gap-4 border-b border-[#d6cec2] bg-[#faf7f0]/97 px-4 py-4 backdrop-blur sm:px-6 sm:py-5"><div className="flex min-w-0 items-start gap-3 sm:gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#172433] text-[#d8bd73]"><Icon className="h-5 w-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><p className="text-[9px] font-black uppercase tracking-[.18em] text-[#806128]">{presentation?.category}</p><span className="text-[9px] font-black tracking-[.16em] text-[#989084]">{presentation?.code}</span></div><h2 className="mt-1 text-xl font-black leading-tight tracking-[-.025em] text-[#111820] sm:text-2xl">{presentation?.title}</h2></div></div><button type="button" onClick={onClose} aria-label="Fechar calculadora" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d1c9bd] bg-white text-[#5c6670] hover:border-[#9d7c34]"><X className="h-5 w-5" /></button></header>

        <nav className="gsa-tier-tool-nav flex shrink-0 snap-x gap-2 overflow-x-auto border-b border-[#d9d2c7] bg-[#f2ede4] px-3 py-3 sm:px-6" aria-label="Escolher calculadora">{TOOL_ORDER.map((toolId) => { const item = TOOLS[toolId]; const ItemIcon = item.icon; const selected = tool === toolId; return <button key={toolId} type="button" onClick={() => onToolChange(toolId)} className={`flex min-h-12 snap-start items-center gap-3 rounded-lg border px-4 py-2 text-left ${selected ? 'border-[#172433] bg-[#172433] text-white' : 'border-[#d5cec2] bg-white/70 text-[#4d5962]'}`}><ItemIcon className={`h-4 w-4 ${selected ? 'text-[#d8bd73]' : 'text-[#8a6e2f]'}`} /><span><strong className="block text-xs">{item.shortTitle}</strong><span className={`mt-.5 block text-[9px] font-bold ${selected ? 'text-white/45' : 'text-[#969089]'}`}>{item.code}</span></span></button>; })}</nav>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <section className="border-b border-[#ddd6cb] bg-[#eee8dd] px-4 py-5 sm:px-6"><div className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-center"><div><p className="max-w-3xl text-sm leading-6 text-[#59646d] sm:text-base">{presentation?.description}</p><p className="mt-3 flex gap-2 text-xs leading-5 text-[#756a58]"><FileCheck2 className="mt-.5 h-4 w-4 shrink-0 text-[#8a6e2f]" /><span>Escolha o nível de profundidade adequado para sua consulta.</span></p></div><div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#cec5b8] bg-white p-1"><button type="button" onClick={() => setMode('free')} className={`min-h-12 rounded-lg px-5 text-sm font-black ${mode === 'free' ? 'bg-[#172433] text-white shadow-sm' : 'text-[#59646d]'}`}><span className="inline-flex items-center gap-2"><Calculator className="h-4 w-4" />Free</span><small className={`mt-0.5 block text-[9px] font-bold ${mode === 'free' ? 'text-white/50' : 'text-[#8b9297]'}`}>Cálculo simples</small></button><button type="button" onClick={() => void selectPro()} className={`min-h-12 rounded-lg px-5 text-sm font-black ${mode === 'pro' ? 'bg-[linear-gradient(135deg,#735721,#b58c37)] text-white shadow-sm' : 'text-[#725921]'}`}><span className="inline-flex items-center gap-2">{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : status?.access ? <Sparkles className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}Pro</span><small className={`mt-0.5 block text-[9px] font-bold ${mode === 'pro' ? 'text-white/60' : 'text-[#9a8558]'}`}>{status?.access ? sourceLabel(status.source) : price ? `Avançado · ${price}` : 'Cálculo avançado'}</small></button></div></div>{notice && <div className="mt-4 rounded-lg border border-[#d2c4a3] bg-[#faf3df] px-4 py-3 text-xs font-bold text-[#685326]">{notice}</div>}</section>

          <main className="p-3 sm:p-6">{tool && (mode === 'free' ? <FreeToolsSimpleCalculator tool={tool} /> : <FreeToolsAdvancedCalculator tool={tool} />)}</main>
        </div>

        <footer className="flex flex-col gap-3 border-t border-[#d7d0c5] bg-[#faf7f0] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="max-w-2xl"><p className="text-[11px] font-bold text-[#4f5961]">Resultado informativo e educativo.</p><p className="mt-.5 text-[10px] leading-4 text-[#7a8288]">Não comprova direitos nem substitui documentos, cálculo oficial ou orientação profissional.</p></div><div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={onServices} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#b89a58] bg-[#f5ecd5] px-4 text-sm font-black text-[#654f20]">Conhecer atendimento GSA <ArrowRight className="h-4 w-4" /></button><button type="button" onClick={onClose} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#172433] px-5 text-sm font-black text-white">Fechar ferramenta</button></div></footer>
      </div>
    </AccessibleDialog>

    {tool && <FreeToolsProUnlockDialog isOpen={unlockOpen} tool={tool} status={status} onClose={() => setUnlockOpen(false)} onUnlocked={() => void unlockedFromPopup()} onClientLogin={onClientLogin} />}
  </>;
}
