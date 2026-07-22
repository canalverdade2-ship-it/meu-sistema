import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileImage,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  MessageSquareText,
  Pencil,
  RefreshCw,
  Send,
  ShieldCheck,
  UploadCloud,
  WalletCards,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { advertiserAccess } from '../lib/advertiserAccess';
import { navigate } from '../routing/navigationService';
import type {
  AdvertiserPortalSnapshot,
  AdvertisingCampaign,
  AdvertisingCreative,
  AdvertisingPaymentStatus,
  AdvertisingProposal,
} from '../types/advertising';

type PortalTab = 'overview' | 'proposals' | 'campaigns' | 'creatives' | 'finance' | 'reports';

const PAGE_SIZE = 20;
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);

const TABS: Array<{ id: PortalTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'proposals', label: 'Propostas', icon: MessageSquareText },
  { id: 'campaigns', label: 'Campanhas', icon: Megaphone },
  { id: 'creatives', label: 'Criativos', icon: FileImage },
  { id: 'finance', label: 'Financeiro', icon: WalletCards },
  { id: 'reports', label: 'Relatórios', icon: BarChart3 },
];

const proposalLabels: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Aguardando sua resposta',
  negotiating: 'Em negociação',
  final_offer: 'Oferta final',
  accepted: 'Aceita',
  rejected: 'Recusada',
  expired: 'Expirada',
  cancelled: 'Cancelada',
};

const campaignLabels: Record<string, string> = {
  draft: 'Rascunho',
  payment_pending: 'Aguardando pagamento',
  creative_review: 'Criativo em análise',
  scheduled: 'Agendada',
  active: 'Ativa',
  paused: 'Pausada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

const paymentLabels: Record<AdvertisingPaymentStatus, string> = {
  pending: 'Pendente',
  processing: 'Em processamento',
  paid: 'Pago',
  failed: 'Falhou',
  refunded: 'Estornado',
  cancelled: 'Cancelado',
};

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function date(value?: string | null) {
  if (!value) return 'A definir';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Data inválida';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(parsed);
}

function dateTime(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

function safeFileName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120) || 'criativo';
}

function safeHttpsUrl(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function messageFromError(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

function validateFile(file: File) {
  const image = ALLOWED_IMAGE_TYPES.has(file.type);
  const video = ALLOWED_VIDEO_TYPES.has(file.type);
  if (!image && !video) return 'Formato não aceito. Use JPG, PNG, WEBP, GIF, MP4 ou WEBM.';
  if (image && file.size > IMAGE_MAX_BYTES) return 'A imagem deve ter no máximo 10 MB.';
  if (video && file.size > VIDEO_MAX_BYTES) return 'O vídeo deve ter no máximo 50 MB.';
  if (file.size === 0) return 'O arquivo selecionado está vazio.';
  return null;
}

async function readAssetMetadata(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    if (ALLOWED_IMAGE_TYPES.has(file.type)) {
      return await new Promise<{ width: number; height: number; durationSeconds: null }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight, durationSeconds: null });
        image.onerror = () => reject(new Error('A imagem está corrompida ou não pode ser lida.'));
        image.src = objectUrl;
      });
    }
    return await new Promise<{ width: number; height: number; durationSeconds: number }>((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        if (!Number.isFinite(video.duration) || video.duration <= 0) {
          reject(new Error('Não foi possível identificar a duração do vídeo.'));
          return;
        }
        resolve({ width: video.videoWidth, height: video.videoHeight, durationSeconds: Number(video.duration.toFixed(2)) });
      };
      video.onerror = () => reject(new Error('O vídeo está corrompido ou não pode ser lido.'));
      video.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function AdvertiserPortal() {
  const [snapshot, setSnapshot] = useState<AdvertiserPortalSnapshot | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [tab, setTab] = useState<PortalTab>('overview');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [counterProposal, setCounterProposal] = useState<AdvertisingProposal | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [rejectProposal, setRejectProposal] = useState<AdvertisingProposal | null>(null);
  const [rejectMessage, setRejectMessage] = useState('');

  const [editingCreative, setEditingCreative] = useState<AdvertisingCreative | null>(null);
  const [creativeCampaignId, setCreativeCampaignId] = useState('');
  const [creativeFile, setCreativeFile] = useState<File | null>(null);
  const [creativeHeadline, setCreativeHeadline] = useState('');
  const [creativeBody, setCreativeBody] = useState('');
  const [creativeAlt, setCreativeAlt] = useState('');
  const [creativeTarget, setCreativeTarget] = useState('');
  const [creativeInputKey, setCreativeInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);

  const creativePreviewUrl = useMemo(() => creativeFile ? URL.createObjectURL(creativeFile) : null, [creativeFile]);
  useEffect(() => () => { if (creativePreviewUrl) URL.revokeObjectURL(creativePreviewUrl); }, [creativePreviewUrl]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setChecking(true);
    else setRefreshing(true);
    try {
      setSnapshot(await advertiserAccess.getSnapshot());
    } catch (error) {
      console.error('Falha ao carregar portal do anunciante:', error);
      toast.error('Não foi possível carregar o portal do anunciante.');
    } finally {
      setChecking(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const { data } = supabase.auth.onAuthStateChange(() => { void load(true); });
    return () => data.subscription.unsubscribe();
  }, [load]);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [tab]);

  const metrics = useMemo(() => {
    const rows = snapshot?.campaigns.flatMap((campaign) => campaign.metrics || []) || [];
    return rows.reduce((acc, row) => ({
      served: acc.served + Number(row.served || 0),
      viewable: acc.viewable + Number(row.viewable_impressions || 0),
      clicks: acc.clicks + Number(row.clicks || 0),
      videoStarts: acc.videoStarts + Number(row.video_starts || 0),
      videoCompletions: acc.videoCompletions + Number(row.video_completions || 0),
    }), { served: 0, viewable: 0, clicks: 0, videoStarts: 0, videoCompletions: 0 });
  }, [snapshot]);

  const reportRows = useMemo(() => snapshot?.campaigns.flatMap((campaign) =>
    (campaign.metrics || []).map((row) => ({ campaign, row })),
  ) || [], [snapshot]);

  const sendMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    setSendingLink(true);
    try {
      await advertiserAccess.requestMagicLink(email);
      setLinkSent(true);
      toast.success('Link de acesso enviado.');
    } catch (error) {
      console.error('Falha ao solicitar link do anunciante:', error);
      toast.error(messageFromError(error, 'Não foi possível enviar o link. Confirme se o e-mail já foi liberado pela GSA.'));
    } finally {
      setSendingLink(false);
    }
  };

  const logout = async () => {
    await advertiserAccess.signOut();
    setSnapshot(null);
    navigate('/');
  };

  const acceptProposal = async (proposal: AdvertisingProposal) => {
    if (!['sent', 'negotiating', 'final_offer'].includes(proposal.status)) return;
    if (proposal.valid_until && new Date(proposal.valid_until).getTime() < Date.now()) {
      toast.error('Esta proposta expirou. Solicite uma nova versão à equipe GSA.');
      return;
    }
    setActionId(proposal.id);
    try {
      const { data, error } = await supabase.rpc('gsa_advertiser_accept_proposal', { p_proposal_id: proposal.id });
      if (error || !data?.success) throw error || new Error('Falha ao aceitar proposta');
      toast.success('Proposta aceita. A campanha foi criada.');
      setTab('finance');
      await load(true);
    } catch (error) {
      console.error('Falha ao aceitar proposta:', error);
      toast.error(messageFromError(error, 'Não foi possível aceitar a proposta.'));
    } finally {
      setActionId(null);
    }
  };

  const sendCounter = async (event: FormEvent) => {
    event.preventDefault();
    if (!counterProposal || !['sent', 'negotiating'].includes(counterProposal.status)) return;
    const proposedAmount = Number(counterAmount);
    if (!Number.isFinite(proposedAmount) || proposedAmount <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    setActionId(counterProposal.id);
    try {
      const { data, error } = await supabase.rpc('gsa_advertiser_counter_proposal', {
        p_proposal_id: counterProposal.id,
        p_amount: proposedAmount,
        p_message: counterMessage.trim(),
      });
      if (error || !data?.success) throw error || new Error('Falha ao enviar contraproposta');
      toast.success('Contraproposta enviada para a equipe GSA.');
      setCounterProposal(null);
      setCounterAmount('');
      setCounterMessage('');
      await load(true);
    } catch (error) {
      console.error('Falha ao enviar contraproposta:', error);
      toast.error(messageFromError(error, 'Não foi possível enviar a contraproposta.'));
    } finally {
      setActionId(null);
    }
  };

  const rejectCurrentProposal = async (event: FormEvent) => {
    event.preventDefault();
    if (!rejectProposal || !['sent', 'negotiating', 'final_offer'].includes(rejectProposal.status)) return;
    setActionId(rejectProposal.id);
    try {
      const { data, error } = await supabase.rpc('gsa_advertiser_reject_proposal', {
        p_proposal_id: rejectProposal.id,
        p_message: rejectMessage.trim() || null,
      });
      if (error || data?.success === false) throw error || new Error('Falha ao recusar proposta');
      toast.success('Proposta recusada.');
      setRejectProposal(null);
      setRejectMessage('');
      await load(true);
    } catch (error) {
      console.error('Falha ao recusar proposta:', error);
      toast.error(messageFromError(error, 'Não foi possível recusar a proposta.'));
    } finally {
      setActionId(null);
    }
  };

  const resetCreativeForm = () => {
    setEditingCreative(null);
    setCreativeCampaignId('');
    setCreativeFile(null);
    setCreativeHeadline('');
    setCreativeBody('');
    setCreativeAlt('');
    setCreativeTarget('');
    setCreativeInputKey((key) => key + 1);
  };

  const editCreative = (creative: AdvertisingCreative) => {
    if (!['draft', 'rejected'].includes(creative.status)) return;
    setEditingCreative(creative);
    setCreativeCampaignId(creative.campaign_id);
    setCreativeFile(null);
    setCreativeHeadline(creative.headline || '');
    setCreativeBody(creative.body || '');
    setCreativeAlt(creative.alt_text || '');
    setCreativeTarget(creative.target_url || '');
    setCreativeInputKey((key) => key + 1);
    document.getElementById('creative-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectCreativeFile = (file: File | null) => {
    if (!file) { setCreativeFile(null); return; }
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      setCreativeFile(null);
      setCreativeInputKey((key) => key + 1);
      return;
    }
    setCreativeFile(file);
  };

  const uploadCreative = async (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot || !creativeCampaignId) return;
    const campaign = snapshot.campaigns.find((item) => item.id === creativeCampaignId);
    if (!campaign || ['completed', 'cancelled'].includes(campaign.status)) {
      toast.error('Esta campanha não aceita novos criativos.');
      return;
    }
    const headline = creativeHeadline.trim();
    const body = creativeBody.trim();
    const altText = creativeAlt.trim();
    const targetUrl = creativeTarget.trim();
    const existingMedia = editingCreative?.kind !== 'text' && !!editingCreative?.storage_path;
    const kind: AdvertisingCreative['kind'] = creativeFile
      ? (ALLOWED_VIDEO_TYPES.has(creativeFile.type) ? 'video' : 'image')
      : (editingCreative?.kind || 'text');

    if (!creativeFile && !existingMedia && kind !== 'text') {
      toast.error('Selecione o novo arquivo do criativo.');
      return;
    }
    if (!creativeFile && !existingMedia && !headline) {
      toast.error('Envie uma imagem ou vídeo, ou informe um título para o criativo textual.');
      return;
    }
    if (headline.length > 120) { toast.error('O título deve ter no máximo 120 caracteres.'); return; }
    if (body.length > 1000) { toast.error('O texto deve ter no máximo 1.000 caracteres.'); return; }
    if (altText.length > 180) { toast.error('A descrição acessível deve ter no máximo 180 caracteres.'); return; }
    if (kind !== 'text' && altText.length < 3) { toast.error('Informe uma descrição acessível para a imagem ou o vídeo.'); return; }
    if (kind === 'text' && (headline.length < 3 || body.length < 3)) { toast.error('Criativos textuais precisam de título e texto com pelo menos 3 caracteres.'); return; }
    if (targetUrl && !safeHttpsUrl(targetUrl)) { toast.error('A URL de destino deve ser HTTPS e válida.'); return; }
    if (creativeFile) {
      const fileError = validateFile(creativeFile);
      if (fileError) { toast.error(fileError); return; }
    }

    setUploading(true);
    let uploadedPath: string | null = null;
    let saved = false;
    const previousPath = editingCreative?.storage_path || null;
    try {
      let storagePath = previousPath || '';
      let width = editingCreative?.width ?? null;
      let height = editingCreative?.height ?? null;
      let durationSeconds = editingCreative?.duration_seconds ?? null;

      if (creativeFile) {
        const metadata = await readAssetMetadata(creativeFile);
        width = metadata.width || null;
        height = metadata.height || null;
        durationSeconds = metadata.durationSeconds;
        storagePath = `${snapshot.advertiser.id}/${creativeCampaignId}/${crypto.randomUUID()}-${safeFileName(creativeFile.name)}`;
        const { error: uploadError } = await supabase.storage.from('gsa-ad-creatives').upload(storagePath, creativeFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: creativeFile.type,
        });
        if (uploadError) throw uploadError;
        uploadedPath = storagePath;
      }

      const { data, error } = await supabase.rpc('gsa_advertiser_save_creative', {
        p_creative_id: editingCreative?.id || null,
        p_campaign_id: creativeCampaignId,
        p_kind: kind,
        p_storage_path: kind === 'text' ? null : storagePath || null,
        p_target_url: targetUrl || null,
        p_headline: headline || null,
        p_body: body || null,
        p_alt_text: altText || null,
        p_width: width,
        p_height: height,
        p_duration_seconds: durationSeconds,
      });
      if (error || !data?.creative_id) throw error || new Error('Falha ao salvar criativo');
      saved = true;
      const { error: submitError } = await supabase.rpc('gsa_advertiser_submit_creative', { p_creative_id: data.creative_id });
      if (submitError) throw submitError;

      if (uploadedPath && previousPath && previousPath !== uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from('gsa-ad-creatives').remove([previousPath]);
        if (cleanupError) console.warn('O arquivo antigo será removido pela rotina de limpeza:', cleanupError);
      }
      toast.success(editingCreative ? 'Criativo corrigido e reenviado para análise.' : 'Criativo enviado para análise.');
      resetCreativeForm();
      await load(true);
    } catch (error) {
      if (uploadedPath && !saved) {
        const { error: cleanupError } = await supabase.storage.from('gsa-ad-creatives').remove([uploadedPath]);
        if (cleanupError) console.error('Falha ao limpar upload não utilizado:', cleanupError);
      }
      console.error('Falha ao enviar criativo:', error);
      toast.error(saved
        ? 'O criativo foi salvo como rascunho, mas não entrou em análise. Tente reenviar.'
        : messageFromError(error, 'Não foi possível enviar o criativo.'));
    } finally {
      setUploading(false);
    }
  };

  if (checking) return <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-sm font-bold text-white/70" role="status">Carregando portal do anunciante...</div>;

  if (!snapshot) {
    return (
      <main className="min-h-screen bg-neutral-950 px-5 py-12 text-white">
        <div className="mx-auto max-w-md">
          <button type="button" onClick={() => navigate('/anuncios')} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-white/60 hover:bg-white/10 hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar aos anúncios</button>
          <div className="mt-12 rounded-[2rem] border border-white/10 bg-white/[0.05] p-7 shadow-2xl sm:p-9">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-neutral-950"><Megaphone className="h-7 w-7" /></div>
            <h1 className="mt-6 text-3xl font-black">Portal do anunciante</h1>
            <p className="mt-3 text-sm leading-relaxed text-white/55">Use o e-mail liberado pela equipe GSA. O acesso é feito por link seguro, sem senha fixa.</p>
            {linkSent ? <div className="mt-7 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5"><Mail className="h-6 w-6 text-emerald-300" /><p className="mt-3 font-black text-emerald-100">Confira seu e-mail</p><p className="mt-1 text-sm text-emerald-100/65">Abra o link recebido neste mesmo navegador para entrar.</p></div> : (
              <form onSubmit={sendMagicLink} className="mt-7 space-y-4"><label className="block text-sm font-bold">E-mail cadastrado<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-amber-300" placeholder="contato@empresa.com.br" /></label><button disabled={sendingLink} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 font-black text-neutral-950 hover:bg-amber-300 disabled:opacity-60"><Send className="h-4 w-4" /> {sendingLink ? 'Enviando...' : 'Enviar link de acesso'}</button></form>
            )}
          </div>
        </div>
      </main>
    );
  }

  const activeCampaigns = snapshot.campaigns.filter((campaign) => campaign.status === 'active').length;
  const pendingProposals = snapshot.proposals.filter((proposal) => ['sent', 'negotiating', 'final_offer'].includes(proposal.status)).length;
  const pendingPayments = snapshot.campaigns.filter((campaign) => campaign.payment && ['pending', 'processing', 'failed'].includes(campaign.payment.status)).length;
  const creativeRows = snapshot.campaigns.flatMap((campaign) => (campaign.creatives || []).map((creative) => ({ campaign, creative })));

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">GSA Anúncios</p><p className="truncate font-black">{snapshot.advertiser.trade_name || snapshot.advertiser.legal_name}</p></div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => void load(true)} disabled={refreshing} aria-label="Atualizar portal" className="rounded-xl p-2.5 text-neutral-500 hover:bg-neutral-100"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></button><button type="button" onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-50"><LogOut className="h-4 w-4" /> Sair</button></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl bg-neutral-950 p-3 text-white lg:sticky lg:top-22">
          <nav aria-label="Seções do portal" className="flex gap-2 overflow-x-auto lg:flex-col">{TABS.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition ${tab === id ? 'bg-white text-neutral-950' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}><Icon className="h-4 w-4" /> {label}</button>)}</nav>
        </aside>

        <section className="min-w-0 space-y-6">
          {tab === 'overview' && <><div><p className="text-sm font-black uppercase tracking-[0.18em] text-amber-600">Visão geral</p><h1 className="mt-2 text-3xl font-black">Acompanhe sua operação publicitária</h1><p className="mt-2 text-sm text-neutral-500">Propostas, pagamentos, criativos, campanhas e resultados no mesmo ambiente.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard icon={MessageSquareText} label="Propostas pendentes" value={pendingProposals} /><MetricCard icon={Megaphone} label="Campanhas ativas" value={activeCampaigns} /><MetricCard icon={WalletCards} label="Pagamentos pendentes" value={pendingPayments} /><MetricCard icon={BarChart3} label="Impressões entregues" value={metrics.served} /></div><div className="grid gap-5 xl:grid-cols-2"><Panel title="Próximas ações"><ActionList snapshot={snapshot} onTab={setTab} /></Panel><Panel title="Desempenho acumulado"><div className="grid grid-cols-2 gap-3"><MiniMetric label="Entregues" value={metrics.served} /><MiniMetric label="Visíveis" value={metrics.viewable} /><MiniMetric label="Cliques" value={metrics.clicks} /><MiniMetric label="CTR" value={metrics.viewable ? `${((metrics.clicks / metrics.viewable) * 100).toFixed(2)}%` : '0%' } /></div></Panel></div></>}

          {tab === 'proposals' && <><SectionTitle title="Propostas comerciais" description="Aceite a proposta vigente, envie uma contraproposta documentada ou recuse formalmente." />{snapshot.proposals.length === 0 ? <Empty text="Nenhuma proposta disponível." /> : <div className="space-y-4">{snapshot.proposals.slice(0, visibleCount).map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} busy={actionId === proposal.id} onAccept={acceptProposal} onCounter={(item) => { setCounterProposal(item); setCounterAmount(String(item.total_amount)); setCounterMessage(''); }} onReject={(item) => { setRejectProposal(item); setRejectMessage(''); }} />)}<LoadMore shown={Math.min(visibleCount, snapshot.proposals.length)} total={snapshot.proposals.length} onMore={() => setVisibleCount((count) => count + PAGE_SIZE)} /></div>}</>}

          {tab === 'campaigns' && <><SectionTitle title="Campanhas" description="O status muda após pagamento, aprovação do criativo e início do período contratado." />{snapshot.campaigns.length === 0 ? <Empty text="As campanhas serão criadas quando uma proposta for aceita." /> : <div className="grid gap-4 xl:grid-cols-2">{snapshot.campaigns.slice(0, visibleCount).map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}<div className="xl:col-span-2"><LoadMore shown={Math.min(visibleCount, snapshot.campaigns.length)} total={snapshot.campaigns.length} onMore={() => setVisibleCount((count) => count + PAGE_SIZE)} /></div></div>}</>}

          {tab === 'creatives' && <><SectionTitle title="Criativos" description="Envie imagens, vídeos ou conteúdo textual. Materiais rejeitados devem ser corrigidos antes do reenvio." /><form id="creative-editor" onSubmit={uploadCreative} className="scroll-mt-24 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-lg font-black">{editingCreative ? 'Corrigir criativo rejeitado' : 'Novo criativo'}</h2>{editingCreative?.rejection_reason && <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Ajuste solicitado: {editingCreative.rejection_reason}</p>}</div>{editingCreative && <button type="button" onClick={resetCreativeForm} className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-bold">Cancelar edição</button>}</div><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Campanha"><select required disabled={!!editingCreative} value={creativeCampaignId} onChange={(event) => setCreativeCampaignId(event.target.value)} className="form-control disabled:bg-neutral-100"><option value="">Selecione</option>{snapshot.campaigns.filter((campaign) => !['completed', 'cancelled'].includes(campaign.status)).map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></Field><Field label={editingCreative?.storage_path ? 'Substituir arquivo (opcional)' : 'Arquivo'}><input key={creativeInputKey} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={(event) => selectCreativeFile(event.target.files?.[0] || null)} className="form-control bg-neutral-50 text-sm" /><span className="mt-1 block text-xs font-normal text-neutral-500">Imagem: até 10 MB. Vídeo: até 50 MB.</span></Field><Field label="Título"><input maxLength={120} value={creativeHeadline} onChange={(event) => setCreativeHeadline(event.target.value)} className="form-control" /></Field><Field label="URL de destino"><input type="url" inputMode="url" maxLength={2048} value={creativeTarget} onChange={(event) => setCreativeTarget(event.target.value)} placeholder="https://" className="form-control" /></Field><Field label="Texto" className="md:col-span-2"><textarea maxLength={1000} value={creativeBody} onChange={(event) => setCreativeBody(event.target.value)} rows={3} className="form-control" /></Field><Field label="Descrição acessível" className="md:col-span-2"><input maxLength={180} value={creativeAlt} onChange={(event) => setCreativeAlt(event.target.value)} className="form-control" /><span className="mt-1 block text-xs font-normal text-neutral-500">Obrigatória para imagens e vídeos. Descreva o conteúdo sem repetir o título.</span></Field></div>{(creativePreviewUrl || creativeHeadline || creativeBody) && <div className="mt-5"><p className="mb-2 text-xs font-black uppercase tracking-wider text-neutral-400">Prévia antes do envio</p><DraftCreativePreview file={creativeFile} objectUrl={creativePreviewUrl} headline={creativeHeadline} body={creativeBody} alt={creativeAlt} target={creativeTarget} /></div>}<button disabled={uploading} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60"><UploadCloud className="h-4 w-4" /> {uploading ? 'Validando e enviando...' : editingCreative ? 'Salvar correções e reenviar' : 'Enviar para análise'}</button></form><div className="space-y-4">{creativeRows.slice(0, visibleCount).map(({ campaign, creative }) => <CreativeRow key={creative.id} campaign={campaign} creative={creative} busy={actionId === creative.id} onEdit={editCreative} />)}<LoadMore shown={Math.min(visibleCount, creativeRows.length)} total={creativeRows.length} onMore={() => setVisibleCount((count) => count + PAGE_SIZE)} /></div></>}

          {tab === 'finance' && <><SectionTitle title="Financeiro" description="A campanha só entra na fila de publicação depois que o pagamento é confirmado." />{snapshot.campaigns.filter((campaign) => campaign.payment).length === 0 ? <Empty text="Nenhuma cobrança criada." /> : <div className="space-y-4">{snapshot.campaigns.filter((campaign) => campaign.payment).slice(0, visibleCount).map((campaign) => <PaymentCard key={campaign.id} campaign={campaign} />)}<LoadMore shown={Math.min(visibleCount, snapshot.campaigns.filter((campaign) => campaign.payment).length)} total={snapshot.campaigns.filter((campaign) => campaign.payment).length} onMore={() => setVisibleCount((count) => count + PAGE_SIZE)} /></div>}</>}

          {tab === 'reports' && <><SectionTitle title="Relatórios" description="Métricas agregadas por campanha e dia, registradas pelo motor de veiculação." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MetricCard icon={Megaphone} label="Entregues" value={metrics.served} /><MetricCard icon={ShieldCheck} label="Visíveis" value={metrics.viewable} /><MetricCard icon={BarChart3} label="Cliques" value={metrics.clicks} /><MetricCard icon={Clock3} label="Inícios de vídeo" value={metrics.videoStarts} /><MetricCard icon={CheckCircle2} label="Vídeos concluídos" value={metrics.videoCompletions} /></div><div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-400"><tr><th className="px-5 py-4">Campanha</th><th className="px-5 py-4">Data</th><th className="px-5 py-4">Entregues</th><th className="px-5 py-4">Visíveis</th><th className="px-5 py-4">Cliques</th><th className="px-5 py-4">CTR</th></tr></thead><tbody className="divide-y divide-neutral-100">{reportRows.slice(0, visibleCount).map(({ campaign, row }) => <tr key={`${campaign.id}-${row.placement_id}-${row.metric_date}`}><td className="px-5 py-4 font-bold">{campaign.name}</td><td className="px-5 py-4">{date(row.metric_date)}</td><td className="px-5 py-4">{row.served}</td><td className="px-5 py-4">{row.viewable_impressions}</td><td className="px-5 py-4">{row.clicks}</td><td className="px-5 py-4">{row.viewable_impressions ? `${((row.clicks / row.viewable_impressions) * 100).toFixed(2)}%` : '0%'}</td></tr>)}</tbody></table></div></div><LoadMore shown={Math.min(visibleCount, reportRows.length)} total={reportRows.length} onMore={() => setVisibleCount((count) => count + PAGE_SIZE)} /></>}
        </section>
      </div>

      {counterProposal && <AccessibleModal title="Enviar contraproposta" description="A equipe GSA receberá o valor e sua justificativa no histórico da negociação." onClose={() => setCounterProposal(null)}><form onSubmit={sendCounter}><Field label="Valor proposto"><input autoFocus type="number" min="1" step="0.01" required value={counterAmount} onChange={(event) => setCounterAmount(event.target.value)} className="form-control" /></Field><Field label="Mensagem" className="mt-4"><textarea required minLength={3} maxLength={1000} rows={4} value={counterMessage} onChange={(event) => setCounterMessage(event.target.value)} className="form-control" /></Field><ModalActions onCancel={() => setCounterProposal(null)} busy={actionId === counterProposal.id} submitLabel="Enviar contraproposta" /></form></AccessibleModal>}

      {rejectProposal && <AccessibleModal title="Recusar proposta" description={`Proposta v${rejectProposal.current_version} · ${money(rejectProposal.total_amount)}`} onClose={() => setRejectProposal(null)}><form onSubmit={rejectCurrentProposal}><p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-800">Esta proposta será encerrada. Se quiser negociar o valor, volte e use a contraproposta.</p><Field label="Motivo (opcional)" className="mt-4"><textarea autoFocus maxLength={1000} rows={4} value={rejectMessage} onChange={(event) => setRejectMessage(event.target.value)} className="form-control" /></Field><ModalActions onCancel={() => setRejectProposal(null)} busy={actionId === rejectProposal.id} submitLabel="Confirmar recusa" destructive /></form></AccessibleModal>}
    </main>
  );
}

function AccessibleModal({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('[autofocus], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]')?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')) as HTMLElement[];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { window.cancelAnimationFrame(frame); document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = originalOverflow; previous?.focus(); };
  }, [onClose]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id={titleId} className="text-2xl font-black">{title}</h2>{description && <p id={descriptionId} className="mt-2 text-sm text-neutral-500">{description}</p>}</div><button type="button" onClick={onClose} aria-label="Fechar diálogo" className="shrink-0 rounded-full p-2 hover:bg-neutral-100"><X className="h-5 w-5" /></button></div><div className="mt-6">{children}</div></div></div>;
}

function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={`block text-sm font-bold ${className}`}>{label}<div className="mt-2 [&_.form-control]:w-full [&_.form-control]:rounded-xl [&_.form-control]:border [&_.form-control]:border-neutral-200 [&_.form-control]:px-4 [&_.form-control]:py-3 [&_.form-control]:outline-none [&_.form-control]:focus:border-amber-400 [&_.form-control]:focus:ring-2 [&_.form-control]:focus:ring-amber-100">{children}</div></label>;
}

function ModalActions({ onCancel, busy, submitLabel, destructive = false }: { onCancel: () => void; busy: boolean; submitLabel: string; destructive?: boolean }) {
  return <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-bold">Cancelar</button><button disabled={busy} className={`rounded-xl px-4 py-2.5 text-sm font-black text-white disabled:opacity-60 ${destructive ? 'bg-red-600' : 'bg-neutral-950'}`}>{busy ? 'Processando...' : submitLabel}</button></div>;
}

function LoadMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  if (shown >= total) return null;
  return <div className="flex items-center justify-center gap-3 pt-2"><span className="text-xs font-semibold text-neutral-500">Exibindo {shown} de {total}</span><button type="button" onClick={onMore} className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-black">Mostrar mais</button></div>;
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof LayoutDashboard; label: string; value: number | string }) {
  return <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-amber-600" /><p className="mt-4 text-xs font-bold uppercase tracking-wider text-neutral-400">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-2xl bg-neutral-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-black">{title}</h2><div className="mt-4">{children}</div></div>;
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div><p className="text-sm font-black uppercase tracking-[0.18em] text-amber-600">Portal do anunciante</p><h1 className="mt-2 text-3xl font-black">{title}</h1><p className="mt-2 text-sm text-neutral-500">{description}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-12 text-center text-sm font-semibold text-neutral-400">{text}</div>;
}

function ActionList({ snapshot, onTab }: { snapshot: AdvertiserPortalSnapshot; onTab: (tab: PortalTab) => void }) {
  const actions: Array<{ text: string; tab: PortalTab }> = [];
  if (snapshot.proposals.some((item) => ['sent', 'negotiating', 'final_offer'].includes(item.status))) actions.push({ text: 'Responder proposta comercial', tab: 'proposals' });
  if (snapshot.campaigns.some((item) => item.payment && ['pending', 'processing', 'failed'].includes(item.payment.status))) actions.push({ text: 'Regularizar pagamento', tab: 'finance' });
  if (snapshot.campaigns.some((item) => item.creatives.length === 0 || item.creatives.some((creative) => creative.status === 'rejected'))) actions.push({ text: 'Enviar ou corrigir criativo', tab: 'creatives' });
  if (actions.length === 0) return <p className="text-sm text-neutral-500">Nenhuma pendência. Suas campanhas seguem o fluxo automático.</p>;
  return <div className="space-y-2">{actions.map((action) => <button key={action.text} type="button" onClick={() => onTab(action.tab)} className="flex w-full items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-left text-sm font-bold hover:bg-neutral-100"><span>{action.text}</span><ArrowLeft className="h-4 w-4 rotate-180 text-neutral-400" /></button>)}</div>;
}

function ProposalCard({ proposal, busy, onAccept, onCounter, onReject }: { key?: string; proposal: AdvertisingProposal; busy: boolean; onAccept: (proposal: AdvertisingProposal) => Promise<void>; onCounter: (proposal: AdvertisingProposal) => void; onReject: (proposal: AdvertisingProposal) => void }) {
  const version = proposal.version;
  const actionable = ['sent', 'negotiating', 'final_offer'].includes(proposal.status);
  const counterAllowed = ['sent', 'negotiating'].includes(proposal.status);
  const expired = !!proposal.valid_until && new Date(proposal.valid_until).getTime() < Date.now();
  return <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">{expired && actionable ? 'Expirada' : proposalLabels[proposal.status] || proposal.status}</span><h2 className="mt-3 text-xl font-black">Proposta v{proposal.current_version}</h2><p className="mt-1 text-sm text-neutral-500">Válida até {date(proposal.valid_until)}</p></div><div className="rounded-2xl bg-neutral-950 px-5 py-4 text-white"><p className="text-xs uppercase tracking-wider text-white/45">Investimento</p><p className="mt-1 text-2xl font-black text-amber-300">{money(proposal.total_amount)}</p></div></div>{version && <div className="mt-5 grid gap-3 sm:grid-cols-3"><MiniMetric label="Início" value={date(version.starts_on)} /><MiniMetric label="Término" value={date(version.ends_on)} /><MiniMetric label="Duração" value={`${version.duration_days} dias`} /></div>}{version?.terms && <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-600">{version.terms}</p>}{!!proposal.negotiations?.length && <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4"><p className="text-xs font-black uppercase tracking-wider text-neutral-400">Histórico da negociação</p>{proposal.negotiations.map((item) => <div key={item.id} className="rounded-xl bg-neutral-50 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold">{item.actor_type === 'advertiser' ? 'Você' : 'Equipe GSA'}{item.proposed_amount ? ` · ${money(item.proposed_amount)}` : ''}</p><time className="text-xs text-neutral-400">{dateTime(item.created_at)}</time></div><p className="mt-1 whitespace-pre-wrap text-neutral-500">{item.message}</p></div>)}</div>}{actionable && !expired && <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => void onAccept(proposal)} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-60">{busy ? 'Processando...' : 'Aceitar proposta'}</button>{counterAllowed && <button type="button" disabled={busy} onClick={() => onCounter(proposal)} className="rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-black hover:bg-neutral-50">Fazer contraproposta</button>}<button type="button" disabled={busy} onClick={() => onReject(proposal)} className="rounded-xl border border-red-200 px-5 py-2.5 text-sm font-black text-red-700">Recusar</button></div>}{expired && actionable && <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">O prazo terminou. Solicite uma nova versão à equipe GSA.</p>}</article>;
}

function CampaignCard({ campaign }: { key?: string; campaign: AdvertisingCampaign }) {
  const totals = (campaign.metrics || []).reduce((acc, row) => ({ served: acc.served + Number(row.served || 0), clicks: acc.clicks + Number(row.clicks || 0) }), { served: 0, clicks: 0 });
  return <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-black text-neutral-700">{campaignLabels[campaign.status] || campaign.status}</span><h2 className="mt-3 text-xl font-black">{campaign.name}</h2></div><Megaphone className="h-6 w-6 text-amber-600" /></div><div className="mt-5 grid grid-cols-2 gap-3"><MiniMetric label="Início" value={date(campaign.starts_at)} /><MiniMetric label="Término" value={date(campaign.ends_at)} /><MiniMetric label="Entregues" value={totals.served} /><MiniMetric label="Cliques" value={totals.clicks} /></div><p className="mt-4 text-xs font-bold uppercase tracking-wider text-neutral-400">{campaign.creatives.length} criativo(s)</p></article>;
}

function useCreativeAssetUrl(creative: AdvertisingCreative) {
  const [url, setUrl] = useState<string | null>(() => safeHttpsUrl(creative.asset_url));
  useEffect(() => {
    let active = true;
    const supplied = safeHttpsUrl(creative.asset_url);
    if (supplied) { setUrl(supplied); return () => { active = false; }; }
    if (!creative.storage_path || creative.kind === 'text') { setUrl(null); return () => { active = false; }; }
    void supabase.storage.from('gsa-ad-creatives').createSignedUrl(creative.storage_path, 600).then(({ data }) => { if (active) setUrl(safeHttpsUrl(data?.signedUrl)); });
    return () => { active = false; };
  }, [creative.asset_url, creative.kind, creative.storage_path]);
  return url;
}

function CreativeRow({ campaign, creative, busy, onEdit }: { key?: string; campaign: AdvertisingCampaign; creative: AdvertisingCreative; busy: boolean; onEdit: (creative: AdvertisingCreative) => void }) {
  const assetUrl = useCreativeAssetUrl(creative);
  return <article className="rounded-2xl border border-neutral-200 bg-white p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{campaign.name}</p><p className="mt-1 break-words font-black">{creative.headline || creative.storage_path || 'Criativo textual'}</p><p className="mt-1 text-sm text-neutral-500">Status: {creative.status}</p>{creative.rejection_reason && <p className="mt-2 text-sm font-semibold text-red-600">Motivo: {creative.rejection_reason}</p>}</div>{['draft', 'rejected'].includes(creative.status) && <button type="button" disabled={busy} onClick={() => onEdit(creative)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"><Pencil className="h-4 w-4" /> Editar e enviar</button>}</div><div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950">{creative.kind === 'image' && assetUrl && <img src={assetUrl} alt={creative.alt_text || creative.headline || 'Criativo enviado'} className="max-h-80 w-full object-contain" />}{creative.kind === 'video' && assetUrl && <video src={assetUrl} controls preload="metadata" className="max-h-80 w-full" aria-label={creative.alt_text || creative.headline || 'Criativo enviado em vídeo'} />}{creative.kind === 'text' && <div className="bg-white p-5"><p className="text-lg font-black">{creative.headline || 'Sem título'}</p><p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{creative.body}</p></div>}{creative.kind !== 'text' && !assetUrl && <div className="p-8 text-center text-sm font-semibold text-white/60">Carregando prévia...</div>}</div>{safeHttpsUrl(creative.target_url) && <a href={safeHttpsUrl(creative.target_url)!} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 break-all text-xs font-bold text-blue-700 underline"><ExternalLink className="h-3.5 w-3.5 shrink-0" /> {creative.target_url}</a>}</article>;
}

function DraftCreativePreview({ file, objectUrl, headline, body, alt, target }: { file: File | null; objectUrl: string | null; headline: string; body: string; alt: string; target: string }) {
  const targetUrl = safeHttpsUrl(target);
  return <div className="overflow-hidden rounded-2xl border border-neutral-200"><div className="bg-neutral-950">{file && objectUrl && ALLOWED_IMAGE_TYPES.has(file.type) && <img src={objectUrl} alt={alt || 'Prévia sem descrição'} className="max-h-96 w-full object-contain" />}{file && objectUrl && ALLOWED_VIDEO_TYPES.has(file.type) && <video src={objectUrl} controls muted preload="metadata" className="max-h-96 w-full" aria-label={alt || 'Prévia do vídeo'} />}{!file && <div className="bg-white p-5"><p className="text-lg font-black">{headline || 'Título do anúncio'}</p><p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{body || 'Texto do anúncio'}</p></div>}</div><div className="bg-neutral-50 p-4 text-xs"><p><span className="font-black">Descrição:</span> {alt || 'Não informada'}</p><p className={`mt-2 break-all ${target && !targetUrl ? 'font-bold text-red-600' : ''}`}><span className="font-black">Destino:</span> {targetUrl || (target ? 'URL inválida; use HTTPS' : 'Sem URL')}</p></div></div>;
}

function PaymentCard({ campaign }: { key?: string; campaign: AdvertisingCampaign }) {
  const payment = campaign.payment!;
  const checkoutUrl = safeHttpsUrl(payment.checkout_url);
  return <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{campaign.name}</p><h2 className="mt-2 text-2xl font-black">{money(payment.amount)}</h2><p className="mt-1 text-sm text-neutral-500">Status: {paymentLabels[payment.status]} · vencimento {date(payment.due_at)}</p></div><CircleDollarSign className={`h-9 w-9 ${payment.status === 'paid' ? 'text-emerald-600' : payment.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`} /></div>{checkoutUrl && ['pending', 'processing', 'failed'].includes(payment.status) && <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-black text-white">Abrir pagamento <ExternalLink className="h-4 w-4" /></a>}{payment.pix_code && ['pending', 'processing', 'failed'].includes(payment.status) && <div className="mt-4 rounded-xl bg-neutral-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">PIX copia e cola</p><code className="mt-2 block break-all text-xs">{payment.pix_code}</code></div>}{!checkoutUrl && !payment.pix_code && ['pending', 'processing', 'failed'].includes(payment.status) && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">A equipe GSA enviará as instruções de pagamento e registrará a confirmação neste portal.</p>}{payment.status === 'failed' && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">O pagamento não foi concluído. Use as instruções acima ou fale com a equipe GSA.</p>}{payment.status === 'paid' && <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Pagamento confirmado em {date(payment.paid_at)}.</p>}{payment.status === 'refunded' && <p className="mt-4 rounded-xl bg-neutral-100 p-4 text-sm font-semibold text-neutral-700">Pagamento estornado. A campanha não será veiculada.</p>}{payment.status === 'cancelled' && <p className="mt-4 rounded-xl bg-neutral-100 p-4 text-sm font-semibold text-neutral-700">Cobrança cancelada.</p>}</article>;
}
