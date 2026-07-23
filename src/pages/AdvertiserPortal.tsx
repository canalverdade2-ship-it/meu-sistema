import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileImage,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  MessageSquareText,
  RefreshCw,
  Send,
  UploadCloud,
  User,
  WalletCards,
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

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);
type Tab = 'overview' | 'requests' | 'proposals' | 'campaigns' | 'creatives' | 'finance' | 'reports' | 'profile';

const REQUEST_LABELS: Record<string, string> = {
  submitted: 'Recebida', under_review: 'Em análise pela GSA', awaiting_information: 'Aguardando informações', proposal_sent: 'Proposta enviada',
  negotiation_requested: 'Em negociação', accepted: 'Aceita', rejected: 'Recusada', cancelled: 'Cancelada',
};
const PROPOSAL_LABELS: Record<string, string> = {
  draft: 'Rascunho', sent: 'Aguardando resposta', negotiating: 'Em negociação', final_offer: 'Oferta final', accepted: 'Aceita', rejected: 'Recusada', expired: 'Expirada', cancelled: 'Cancelada',
};
const CAMPAIGN_LABELS: Record<string, string> = {
  draft: 'Rascunho', payment_pending: 'Aguardando pagamento', payment_overdue: 'Pagamento vencido', creative_review: 'Criativo em análise', scheduled: 'Agendada', active: 'Ativa', paused: 'Pausada', completed: 'Concluída', cancelled: 'Cancelada',
};
const PAYMENT_LABELS: Record<AdvertisingPaymentStatus, string> = {
  pending: 'Pendente', processing: 'Em processamento', paid: 'Pago', failed: 'Falhou', overdue: 'Vencido', refunded: 'Estornado', cancelled: 'Cancelado',
};

function money(value: unknown) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0)); }
function date(value?: string | null) { if (!value) return 'A definir'; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? 'Data inválida' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(parsed); }
function message(error: unknown, fallback: string) { return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : fallback; }
function safeName(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120) || 'criativo'; }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function isHttps(value: string) { if (!value) return true; try { return new URL(value).protocol === 'https:'; } catch { return false; } }

async function mediaMetadata(file: File) {
  const url = URL.createObjectURL(file);
  try {
    if (IMAGE_TYPES.has(file.type)) {
      return await new Promise<{ width: number; height: number; duration: null }>((resolve, reject) => {
        const image = new Image(); image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight, duration: null }); image.onerror = () => reject(new Error('Imagem inválida.')); image.src = url;
      });
    }
    return await new Promise<{ width: number; height: number; duration: number }>((resolve, reject) => {
      const video = document.createElement('video'); video.preload = 'metadata'; video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight, duration: Number(video.duration.toFixed(2)) }); video.onerror = () => reject(new Error('Vídeo inválido.')); video.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

export function AdvertiserPortal() {
  const initialProtocol = useMemo(() => new URLSearchParams(window.location.search).get('protocolo') || '', []);
  const [snapshot, setSnapshot] = useState<AdvertiserPortalSnapshot | null>(null);
  const [checking, setChecking] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [accessMode, setAccessMode] = useState<'protocol' | 'email'>('protocol');
  const [protocol, setProtocol] = useState(initialProtocol.toUpperCase());
  const [validated, setValidated] = useState(false);
  const [validating, setValidating] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [company, setCompany] = useState('');
  const [documentValue, setDocumentValue] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [counterProposal, setCounterProposal] = useState<AdvertisingProposal | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [rejectProposal, setRejectProposal] = useState<AdvertisingProposal | null>(null);
  const [rejectMessage, setRejectMessage] = useState('');
  const [creativeCampaignId, setCreativeCampaignId] = useState('');
  const [creativeFile, setCreativeFile] = useState<File | null>(null);
  const [creativeHeadline, setCreativeHeadline] = useState('');
  const [creativeBody, setCreativeBody] = useState('');
  const [creativeAlt, setCreativeAlt] = useState('');
  const [creativeTarget, setCreativeTarget] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setChecking(true);
    try { setSnapshot(await advertiserAccess.getSnapshot()); }
    catch (error) { console.error('Falha ao carregar portal:', error); setSnapshot(null); toast.error(message(error, 'Não foi possível carregar o portal do anunciante.')); }
    finally { setChecking(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 15_000);
    const { data } = supabase.auth.onAuthStateChange(() => void load(true));
    return () => { window.clearInterval(interval); data.subscription.unsubscribe(); };
  }, [load]);

  useEffect(() => {
    if (!snapshot?.advertiser) return;
    const advertiser = snapshot.advertiser;
    setCompany(advertiser.company_name || advertiser.legal_name || '');
    setDocumentValue(advertiser.document || '');
    setContactName(advertiser.contact_name || advertiser.responsible_name || '');
    setEmail(advertiser.contact_email || advertiser.responsible_email || '');
    setPhone(advertiser.contact_phone || advertiser.responsible_phone || '');
  }, [snapshot]);

  useEffect(() => { if (initialProtocol && !validated) void validateProtocol(initialProtocol); }, [initialProtocol]);

  const validateProtocol = async (value = protocol) => {
    const normalized = value.trim().toUpperCase();
    if (normalized.length < 8) return toast.error('Informe um protocolo válido.');
    setValidating(true); setValidated(false);
    try {
      const { data, error } = await supabase.functions.invoke('gsa-advertiser-access', { body: { action: 'validate', protocol: normalized } });
      const result = data as { success?: boolean; request?: Record<string, string> } | null;
      if (error || !result?.success || !result.request) throw error || new Error('Protocolo não encontrado.');
      setProtocol(normalized); setCompany(result.request.company_name || ''); setDocumentValue(result.request.document || ''); setContactName(result.request.contact_name || ''); setEmail(result.request.contact_email || ''); setPhone(result.request.contact_phone || ''); setValidated(true);
      toast.success('Protocolo validado no banco de dados.');
    } catch (error) { console.error('Validação do protocolo falhou:', error); toast.error(message(error, 'Protocolo não encontrado ou indisponível.')); }
    finally { setValidating(false); }
  };

  const register = async (event: FormEvent) => {
    event.preventDefault();
    if (!validated) return toast.error('Valide o protocolo antes do cadastro.');
    if (password.length < 8) return toast.error('A senha deve ter ao menos 8 caracteres.');
    if (password !== passwordConfirm) return toast.error('As senhas não coincidem.');
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('gsa-advertiser-access', { body: { action: 'register', protocol, document: documentValue, email: email.trim().toLowerCase(), password } });
      const result = data as { success?: boolean; account_exists?: boolean } | null;
      if (error || !result?.success) throw error || new Error('Cadastro não confirmado pelo servidor.');
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (signInError) {
        if (result.account_exists) { await advertiserAccess.requestMagicLink(email); setAccessMode('email'); toast.success('A conta já existia. Enviamos um link seguro de acesso.'); return; }
        throw signInError;
      }
      toast.success('Cadastro concluído e vinculado ao protocolo.');
      await load(true);
    } catch (error) { console.error('Cadastro falhou:', error); toast.error(message(error, 'Não foi possível concluir o cadastro.')); }
    finally { setSending(false); }
  };

  const requestMagicLink = async (event: FormEvent) => {
    event.preventDefault(); setSending(true);
    try { await advertiserAccess.requestMagicLink(email); toast.success('Link seguro enviado ao e-mail cadastrado.'); }
    catch (error) { toast.error(message(error, 'Não foi possível enviar o link. Confirme se o acesso foi liberado pela GSA.')); }
    finally { setSending(false); }
  };

  const logout = async () => { await advertiserAccess.signOut(); setSnapshot(null); navigate('/'); };

  const proposalRpc = async (name: string, payload: Record<string, unknown>, success: string) => {
    const { data, error } = await supabase.rpc(name, payload);
    if (error || data?.success === false) throw error || new Error(data?.error || 'Operação recusada pelo servidor.');
    toast.success(success); await load(true); return data;
  };

  const accept = async (proposal: AdvertisingProposal) => {
    if (!isUuid(proposal.id)) return toast.error('Proposta inválida. Atualize o portal.');
    setActionId(proposal.id);
    try { await proposalRpc('gsa_advertiser_accept_proposal', { p_proposal_id: proposal.id }, 'Proposta aceita e campanha criada no sistema.'); setTab('finance'); }
    catch (error) { toast.error(message(error, 'Não foi possível aceitar a proposta.')); }
    finally { setActionId(null); }
  };

  const sendCounter = async (event: FormEvent) => {
    event.preventDefault(); if (!counterProposal) return;
    const amount = Number(counterAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0 || counterMessage.trim().length < 3) return toast.error('Informe valor e mensagem válidos.');
    setActionId(counterProposal.id);
    try { await proposalRpc('gsa_advertiser_counter_proposal', { p_proposal_id: counterProposal.id, p_amount: amount, p_message: counterMessage.trim() }, 'Contraproposta gravada e enviada à GSA.'); setCounterProposal(null); setCounterAmount(''); setCounterMessage(''); }
    catch (error) { toast.error(message(error, 'Não foi possível enviar a contraproposta.')); }
    finally { setActionId(null); }
  };

  const reject = async (event: FormEvent) => {
    event.preventDefault(); if (!rejectProposal) return; setActionId(rejectProposal.id);
    try { await proposalRpc('gsa_advertiser_reject_proposal', { p_proposal_id: rejectProposal.id, p_message: rejectMessage.trim() || null }, 'Proposta recusada.'); setRejectProposal(null); setRejectMessage(''); }
    catch (error) { toast.error(message(error, 'Não foi possível recusar a proposta.')); }
    finally { setActionId(null); }
  };

  const uploadCreative = async (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot || !creativeCampaignId) return toast.error('Selecione a campanha.');
    const campaign = snapshot.campaigns.find((item) => item.id === creativeCampaignId);
    if (!campaign || ['completed', 'cancelled'].includes(campaign.status)) return toast.error('Esta campanha não aceita criativos.');
    const target = creativeTarget.trim();
    if (target && !isHttps(target)) return toast.error('A URL de destino deve ser HTTPS.');
    if (!creativeFile && (creativeHeadline.trim().length < 3 || creativeBody.trim().length < 3)) return toast.error('Envie mídia ou informe título e texto.');
    if (creativeFile && !IMAGE_TYPES.has(creativeFile.type) && !VIDEO_TYPES.has(creativeFile.type)) return toast.error('Formato não permitido.');
    if (creativeFile && creativeFile.size > (VIDEO_TYPES.has(creativeFile.type) ? 50 : 10) * 1024 * 1024) return toast.error('Arquivo acima do limite permitido.');
    if (creativeFile && creativeAlt.trim().length < 3) return toast.error('Informe a descrição acessível.');

    setUploading(true); let uploadedPath: string | null = null;
    try {
      let kind: AdvertisingCreative['kind'] = 'text'; let storagePath: string | null = null; let width: number | null = null; let height: number | null = null; let duration: number | null = null;
      if (creativeFile) {
        kind = VIDEO_TYPES.has(creativeFile.type) ? 'video' : 'image';
        const metadata = await mediaMetadata(creativeFile); width = metadata.width; height = metadata.height; duration = metadata.duration;
        storagePath = `${snapshot.advertiser.id}/${creativeCampaignId}/${crypto.randomUUID()}-${safeName(creativeFile.name)}`;
        const { error } = await supabase.storage.from('gsa-ad-creatives').upload(storagePath, creativeFile, { cacheControl: '3600', upsert: false, contentType: creativeFile.type });
        if (error) throw error; uploadedPath = storagePath;
      }
      const { data, error } = await supabase.rpc('gsa_advertiser_save_creative', { p_creative_id: null, p_campaign_id: creativeCampaignId, p_kind: kind, p_storage_path: storagePath, p_target_url: target || null, p_headline: creativeHeadline.trim() || null, p_body: creativeBody.trim() || null, p_alt_text: creativeAlt.trim() || null, p_width: width, p_height: height, p_duration_seconds: duration });
      if (error || !data?.creative_id) throw error || new Error('Criativo não foi salvo.');
      const { error: submitError } = await supabase.rpc('gsa_advertiser_submit_creative', { p_creative_id: data.creative_id });
      if (submitError) throw submitError;
      toast.success('Criativo enviado para análise.'); setCreativeFile(null); setCreativeHeadline(''); setCreativeBody(''); setCreativeAlt(''); setCreativeTarget(''); await load(true);
    } catch (error) {
      if (uploadedPath) await supabase.storage.from('gsa-ad-creatives').remove([uploadedPath]);
      toast.error(message(error, 'Não foi possível enviar o criativo.'));
    } finally { setUploading(false); }
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const { data, error } = await supabase.rpc('gsa_advertiser_update_profile', { p_payload: { company_name: company.trim(), document: documentValue, contact_name: contactName.trim(), contact_email: email.trim().toLowerCase(), contact_phone: phone } });
      if (error || data?.success === false) throw error || new Error('Perfil não atualizado.');
      toast.success('Perfil atualizado no banco.'); await load(true);
    } catch (error) { toast.error(message(error, 'Não foi possível atualizar o perfil.')); }
  };

  const metrics = useMemo(() => (snapshot?.campaigns || []).flatMap((campaign) => campaign.metrics || []).reduce((total, row) => ({ served: total.served + Number(row.served || 0), viewable: total.viewable + Number(row.viewable_impressions || 0), clicks: total.clicks + Number(row.clicks || 0), video: total.video + Number(row.video_completions || 0) }), { served: 0, viewable: 0, clicks: 0, video: 0 }), [snapshot]);

  if (checking) return <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-sm font-bold text-white/60">Carregando portal do anunciante...</div>;

  if (!snapshot) return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-5 text-white">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-neutral-900 p-6 shadow-2xl sm:p-10">
        <button type="button" onClick={() => navigate('/anuncios')} className="mb-6 flex items-center gap-2 text-sm font-bold text-white/60"><ArrowLeft className="h-4 w-4" /> Voltar aos anúncios</button>
        <div className="mb-6 flex items-center gap-3"><div className="rounded-2xl bg-amber-400 p-3 text-neutral-950"><Megaphone className="h-6 w-6" /></div><div><h1 className="text-xl font-black">Portal do Anunciante</h1><p className="text-xs text-white/50">Acesso conectado ao Supabase</p></div></div>
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-black/30 p-1"><button type="button" onClick={() => setAccessMode('protocol')} className={`rounded-lg py-2 text-xs font-black ${accessMode === 'protocol' ? 'bg-amber-400 text-neutral-950' : 'text-white/60'}`}><KeyRound className="mr-1 inline h-4 w-4" />Primeiro acesso</button><button type="button" onClick={() => setAccessMode('email')} className={`rounded-lg py-2 text-xs font-black ${accessMode === 'email' ? 'bg-amber-400 text-neutral-950' : 'text-white/60'}`}><Mail className="mr-1 inline h-4 w-4" />Entrar por e-mail</button></div>
        {accessMode === 'protocol' ? (!validated ? <form onSubmit={(e) => { e.preventDefault(); void validateProtocol(); }} className="space-y-4"><Input dark label="Protocolo" value={protocol} onChange={(value) => setProtocol(value.toUpperCase())} placeholder="ADS-20260722-XXXXXXXXXXXX" /><button disabled={validating} className="w-full rounded-xl bg-amber-400 py-3 font-black text-neutral-950">{validating ? 'Validando no banco...' : 'Validar protocolo'}</button></form> : <form onSubmit={register} className="space-y-3"><div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-300">Protocolo validado: {protocol}</div><Input dark label="Empresa" value={company} onChange={setCompany} disabled /><Input dark label="CPF/CNPJ" value={documentValue} onChange={setDocumentValue} disabled /><Input dark label="Responsável" value={contactName} onChange={setContactName} disabled /><Input dark label="E-mail" value={email} onChange={setEmail} disabled /><Input dark label="Telefone" value={phone} onChange={setPhone} disabled /><Input dark label="Senha" type="password" value={password} onChange={setPassword} /><Input dark label="Confirmar senha" type="password" value={passwordConfirm} onChange={setPasswordConfirm} /><button disabled={sending} className="w-full rounded-xl bg-amber-400 py-3 font-black text-neutral-950">{sending ? 'Vinculando conta...' : 'Concluir cadastro'}</button></form>) : <form onSubmit={requestMagicLink} className="space-y-4"><Input dark label="E-mail cadastrado" type="email" value={email} onChange={setEmail} /><button disabled={sending} className="w-full rounded-xl bg-amber-400 py-3 font-black text-neutral-950">{sending ? 'Enviando...' : 'Enviar link seguro'}</button></form>}
      </div>
    </main>
  );

  const tabs: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'overview', label: 'Visão geral', icon: LayoutDashboard }, { id: 'requests', label: 'Solicitações', icon: ClipboardList }, { id: 'proposals', label: 'Propostas', icon: MessageSquareText }, { id: 'campaigns', label: 'Campanhas', icon: Megaphone }, { id: 'creatives', label: 'Criativos', icon: FileImage }, { id: 'finance', label: 'Financeiro', icon: WalletCards }, { id: 'reports', label: 'Relatórios', icon: BarChart3 }, { id: 'profile', label: 'Perfil', icon: User },
  ];

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <header className="border-b bg-neutral-950 px-5 py-4 text-white"><div className="mx-auto flex max-w-7xl items-center justify-between"><div className="flex items-center gap-3"><Megaphone className="h-6 w-6 text-amber-300" /><div><h1 className="font-black">Portal do Anunciante</h1><p className="text-xs text-white/50">{snapshot.advertiser.trade_name || snapshot.advertiser.legal_name}</p></div></div><div className="flex gap-2"><button onClick={() => void load(true)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Atualizar"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></button><button onClick={() => void logout()} className="flex items-center gap-1 rounded-lg p-2 text-sm font-bold hover:bg-white/10"><LogOut className="h-4 w-4" />Sair</button></div></div></header>
      <div className="mx-auto grid max-w-7xl gap-6 p-5 lg:grid-cols-[240px_1fr]">
        <aside className="h-fit rounded-2xl border bg-white p-2">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold ${tab === id ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}><Icon className="h-4 w-4" />{label}</button>)}</aside>
        <section className="space-y-5">
          {tab === 'overview' && <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Solicitações', snapshot.requests.length], ['Propostas', snapshot.proposals.length], ['Campanhas', snapshot.campaigns.length], ['Cliques', metrics.clicks]].map(([label, value]) => <Card key={String(label)}><p className="text-xs font-bold uppercase text-neutral-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></Card>)}</div><Card><h2 className="font-black">Fluxo conectado</h2><p className="mt-2 text-sm text-neutral-600">Os dados exibidos nesta tela são carregados pela RPC <code>gsa_advertiser_portal_snapshot</code>. Não há propostas, campanhas ou pagamentos simulados no navegador.</p></Card></>}
          {tab === 'requests' && <ListEmpty empty={!snapshot.requests.length} text="Nenhuma solicitação vinculada.">{snapshot.requests.map((request) => <Card key={request.id}><div className="flex justify-between gap-3"><div><p className="font-mono text-xs font-bold text-amber-700">{request.protocol}</p><h2 className="font-black">{request.company_name}</h2><p className="mt-2 text-sm text-neutral-600">{request.objective}</p></div><span className="h-fit rounded-full bg-neutral-100 px-3 py-1 text-xs font-black">{REQUEST_LABELS[request.status] || request.status}</span></div></Card>)}</ListEmpty>}
          {tab === 'proposals' && <ListEmpty empty={!snapshot.proposals.length} text="Nenhuma proposta disponível.">{snapshot.proposals.map((proposal) => <Card key={proposal.id}><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-black">Proposta v{proposal.current_version}</h2><p className="text-sm text-neutral-500">Válida até {date(proposal.valid_until)} · {PROPOSAL_LABELS[proposal.status]}</p></div><p className="text-xl font-black">{money(proposal.total_amount)}</p></div>{proposal.version?.terms && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-sm">{proposal.version.terms}</p>}{proposal.negotiations?.length ? <div className="mt-3 space-y-2">{proposal.negotiations.map((item) => <p key={item.id} className="rounded-xl border p-3 text-sm"><strong>{item.actor_type === 'admin' ? 'GSA' : 'Você'}:</strong> {item.message}{item.proposed_amount ? ` — ${money(item.proposed_amount)}` : ''}</p>)}</div> : null}{['sent', 'negotiating', 'final_offer'].includes(proposal.status) && <div className="mt-4 flex flex-wrap gap-2"><button disabled={actionId === proposal.id} onClick={() => void accept(proposal)} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white">Aceitar</button><button onClick={() => { setCounterProposal(proposal); setCounterAmount(String(proposal.total_amount)); }} className="rounded-lg border px-4 py-2 text-xs font-bold">Contraproposta</button><button onClick={() => setRejectProposal(proposal)} className="rounded-lg border border-red-200 px-4 py-2 text-xs font-bold text-red-700">Recusar</button></div>}</Card>)}</ListEmpty>}
          {tab === 'campaigns' && <ListEmpty empty={!snapshot.campaigns.length} text="Nenhuma campanha criada.">{snapshot.campaigns.map((campaign) => <Card key={campaign.id}><div className="flex justify-between gap-3"><div><h2 className="font-black">{campaign.name}</h2><p className="text-sm text-neutral-500">{date(campaign.starts_at)} até {date(campaign.ends_at)}</p></div><span className="h-fit rounded-full bg-neutral-100 px-3 py-1 text-xs font-black">{CAMPAIGN_LABELS[campaign.status]}</span></div></Card>)}</ListEmpty>}
          {tab === 'creatives' && <div className="space-y-5"><Card><h2 className="font-black">Enviar criativo</h2><form onSubmit={uploadCreative} className="mt-4 space-y-3"><select required value={creativeCampaignId} onChange={(e) => setCreativeCampaignId(e.target.value)} className="w-full rounded-xl border px-3 py-2"><option value="">Selecione a campanha</option>{snapshot.campaigns.filter((campaign) => !['completed', 'cancelled'].includes(campaign.status)).map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={(e) => setCreativeFile(e.target.files?.[0] || null)} className="w-full rounded-xl border p-2" /><Input label="Título" value={creativeHeadline} onChange={setCreativeHeadline} /><textarea value={creativeBody} onChange={(e) => setCreativeBody(e.target.value)} placeholder="Texto do anúncio" rows={3} className="w-full rounded-xl border px-3 py-2" /><Input label="Descrição acessível" value={creativeAlt} onChange={setCreativeAlt} /><Input label="URL de destino HTTPS" value={creativeTarget} onChange={setCreativeTarget} /><button disabled={uploading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-3 font-black text-white"><UploadCloud className="h-4 w-4" />{uploading ? 'Enviando...' : 'Enviar para análise'}</button></form></Card>{snapshot.campaigns.flatMap((campaign) => campaign.creatives || []).map((creative) => <Card key={creative.id}><div className="flex justify-between"><div><h2 className="font-black">{creative.headline || creative.kind}</h2><p className="text-sm text-neutral-500">{creative.status}</p>{creative.rejection_reason && <p className="mt-2 text-sm text-red-600">{creative.rejection_reason}</p>}</div>{creative.status === 'approved' && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}</div></Card>)}</div>}
          {tab === 'finance' && <ListEmpty empty={!snapshot.campaigns.some((campaign) => campaign.payment)} text="Nenhuma cobrança disponível.">{snapshot.campaigns.filter((campaign) => campaign.payment).map((campaign) => <Card key={campaign.id}><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-black">{campaign.name}</h2><p className="text-sm text-neutral-500">Vencimento: {date(campaign.payment?.due_at)}</p></div><div className="text-right"><p className="text-xl font-black">{money(campaign.payment?.amount)}</p><p className="text-xs font-bold">{campaign.payment ? PAYMENT_LABELS[campaign.payment.status] : ''}</p></div></div>{campaign.payment?.checkout_url && <a href={campaign.payment.checkout_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded-lg bg-amber-400 px-4 py-2 text-xs font-black">Abrir pagamento</a>}{campaign.payment?.pix_code && <div className="mt-4 break-all rounded-xl bg-neutral-50 p-3 text-xs">{campaign.payment.pix_code}</div>}</Card>)}</ListEmpty>}
          {tab === 'reports' && <><div className="grid gap-3 sm:grid-cols-4">{[['Exibições', metrics.served], ['Visualizações', metrics.viewable], ['Cliques', metrics.clicks], ['Vídeos concluídos', metrics.video]].map(([label, value]) => <Card key={String(label)}><p className="text-xs font-bold uppercase text-neutral-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></Card>)}</div>{snapshot.campaigns.map((campaign) => <Card key={campaign.id}><h2 className="font-black">{campaign.name}</h2><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Data</th><th>Exibições</th><th>Visualizações</th><th>Cliques</th></tr></thead><tbody>{(campaign.metrics || []).map((row) => <tr key={`${row.placement_id}-${row.metric_date}`}><td>{date(row.metric_date)}</td><td>{row.served}</td><td>{row.viewable_impressions}</td><td>{row.clicks}</td></tr>)}</tbody></table></div></Card>)}</>}
          {tab === 'profile' && <Card><h2 className="font-black">Meu perfil</h2><form onSubmit={saveProfile} className="mt-4 grid gap-3 sm:grid-cols-2"><Input label="Empresa" value={company} onChange={setCompany} /><Input label="CPF/CNPJ" value={documentValue} onChange={setDocumentValue} disabled /><Input label="Responsável" value={contactName} onChange={setContactName} /><Input label="E-mail" type="email" value={email} onChange={setEmail} disabled /><Input label="Telefone" value={phone} onChange={setPhone} /><button className="flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-3 font-black text-white sm:col-span-2"><Send className="h-4 w-4" />Salvar no banco</button></form></Card>}
        </section>
      </div>

      {counterProposal && <Modal title="Enviar contraproposta" onClose={() => setCounterProposal(null)}><form onSubmit={sendCounter} className="space-y-3"><Input label="Valor proposto" type="number" value={counterAmount} onChange={setCounterAmount} /><textarea required value={counterMessage} onChange={(e) => setCounterMessage(e.target.value)} placeholder="Mensagem" rows={4} className="w-full rounded-xl border px-3 py-2" /><button disabled={actionId === counterProposal.id} className="w-full rounded-xl bg-neutral-950 py-3 font-black text-white">Enviar contraproposta</button></form></Modal>}
      {rejectProposal && <Modal title="Recusar proposta" onClose={() => setRejectProposal(null)}><form onSubmit={reject} className="space-y-3"><textarea value={rejectMessage} onChange={(e) => setRejectMessage(e.target.value)} placeholder="Motivo (opcional)" rows={4} className="w-full rounded-xl border px-3 py-2" /><button disabled={actionId === rejectProposal.id} className="w-full rounded-xl bg-red-600 py-3 font-black text-white">Confirmar recusa</button></form></Modal>}
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) { return <article className="rounded-2xl border bg-white p-5 shadow-sm">{children}</article>; }
function ListEmpty({ empty, text, children }: { empty: boolean; text: string; children: React.ReactNode }) { return <div className="space-y-3">{empty ? <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm font-bold text-neutral-400">{text}</div> : children}</div>; }
function Input({ label, value, onChange, type = 'text', placeholder, disabled, dark }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; disabled?: boolean; dark?: boolean }) { return <label className={`block text-sm font-bold ${dark ? 'text-white/70' : ''}`}>{label}<input required type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className={`mt-1 w-full rounded-xl border px-3 py-2 font-normal outline-none disabled:opacity-60 ${dark ? 'border-white/10 bg-neutral-950 text-white' : 'bg-white'}`} /></label>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-lg rounded-3xl bg-white p-6"><div className="mb-5 flex justify-between"><h2 className="text-xl font-black">{title}</h2><button onClick={onClose} type="button">×</button></div>{children}</div></div>; }
