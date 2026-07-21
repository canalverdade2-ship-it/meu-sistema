import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileImage,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldCheck,
  UploadCloud,
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
  AdvertisingProposal,
} from '../types/advertising';

type PortalTab = 'overview' | 'proposals' | 'campaigns' | 'creatives' | 'finance' | 'reports';

const TABS: Array<{ id: PortalTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'proposals', label: 'Propostas', icon: MessageSquareText },
  { id: 'campaigns', label: 'Campanhas', icon: Megaphone },
  { id: 'creatives', label: 'Criativos', icon: FileImage },
  { id: 'finance', label: 'Financeiro', icon: WalletCards },
  { id: 'reports', label: 'Relatórios', icon: BarChart3 },
];

const proposalLabels: Record<string, string> = {
  draft: 'Rascunho', sent: 'Aguardando sua resposta', negotiating: 'Em negociação', final_offer: 'Oferta final',
  accepted: 'Aceita', rejected: 'Recusada', expired: 'Expirada', cancelled: 'Cancelada',
};

const campaignLabels: Record<string, string> = {
  draft: 'Rascunho', payment_pending: 'Aguardando pagamento', creative_review: 'Criativo em análise',
  scheduled: 'Agendada', active: 'Ativa', paused: 'Pausada', completed: 'Concluída', cancelled: 'Cancelada',
};

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function date(value?: string | null) {
  if (!value) return 'A definir';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value));
}

function safeFileName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120);
}

export function AdvertiserPortal() {
  const [snapshot, setSnapshot] = useState<AdvertiserPortalSnapshot | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [tab, setTab] = useState<PortalTab>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [counterProposal, setCounterProposal] = useState<AdvertisingProposal | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [creativeCampaignId, setCreativeCampaignId] = useState('');
  const [creativeFile, setCreativeFile] = useState<File | null>(null);
  const [creativeHeadline, setCreativeHeadline] = useState('');
  const [creativeBody, setCreativeBody] = useState('');
  const [creativeAlt, setCreativeAlt] = useState('');
  const [creativeTarget, setCreativeTarget] = useState('');
  const [uploading, setUploading] = useState(false);

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

  const sendMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    setSendingLink(true);
    try {
      await advertiserAccess.requestMagicLink(email);
      setLinkSent(true);
      toast.success('Link de acesso enviado.');
    } catch (error) {
      console.error('Falha ao solicitar link do anunciante:', error);
      toast.error('Não foi possível enviar o link. Confirme se o e-mail já foi liberado pela GSA.');
    } finally {
      setSendingLink(false);
    }
  };

  const logout = async () => {
    await advertiserAccess.signOut();
    setSnapshot(null);
    navigate('/');
  };

  const acceptProposal = async (proposalId: string) => {
    setActionId(proposalId);
    try {
      const { data, error } = await supabase.rpc('gsa_advertiser_accept_proposal', { p_proposal_id: proposalId });
      if (error || !data?.success) throw error || new Error('Falha ao aceitar proposta');
      toast.success('Proposta aceita. A campanha foi criada.');
      setTab('finance');
      await load(true);
    } catch (error) {
      console.error('Falha ao aceitar proposta:', error);
      toast.error('Não foi possível aceitar a proposta.');
    } finally {
      setActionId(null);
    }
  };

  const sendCounter = async (event: FormEvent) => {
    event.preventDefault();
    if (!counterProposal) return;
    setActionId(counterProposal.id);
    try {
      const { data, error } = await supabase.rpc('gsa_advertiser_counter_proposal', {
        p_proposal_id: counterProposal.id,
        p_amount: Number(counterAmount),
        p_message: counterMessage,
      });
      if (error || !data?.success) throw error || new Error('Falha ao enviar contraproposta');
      toast.success('Contraproposta enviada para a equipe GSA.');
      setCounterProposal(null);
      setCounterAmount('');
      setCounterMessage('');
      await load(true);
    } catch (error) {
      console.error('Falha ao enviar contraproposta:', error);
      toast.error('Não foi possível enviar a contraproposta.');
    } finally {
      setActionId(null);
    }
  };

  const uploadCreative = async (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot || !creativeCampaignId) return;
    if (!creativeFile && !creativeHeadline.trim()) {
      toast.error('Envie uma imagem ou vídeo, ou informe um título para criativo textual.');
      return;
    }
    setUploading(true);
    try {
      let storagePath = '';
      let kind: 'image' | 'video' | 'text' = 'text';
      if (creativeFile) {
        kind = creativeFile.type.startsWith('video/') ? 'video' : 'image';
        storagePath = `${snapshot.advertiser.id}/${creativeCampaignId}/${crypto.randomUUID()}-${safeFileName(creativeFile.name)}`;
        const { error: uploadError } = await supabase.storage.from('gsa-ad-creatives').upload(storagePath, creativeFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: creativeFile.type,
        });
        if (uploadError) throw uploadError;
      }

      const { data, error } = await supabase.rpc('gsa_advertiser_save_creative', {
        p_creative_id: null,
        p_campaign_id: creativeCampaignId,
        p_kind: kind,
        p_storage_path: storagePath || null,
        p_target_url: creativeTarget || null,
        p_headline: creativeHeadline || null,
        p_body: creativeBody || null,
        p_alt_text: creativeAlt || null,
        p_width: null,
        p_height: null,
        p_duration_seconds: null,
      });
      if (error || !data?.creative_id) throw error || new Error('Falha ao salvar criativo');
      const { error: submitError } = await supabase.rpc('gsa_advertiser_submit_creative', { p_creative_id: data.creative_id });
      if (submitError) throw submitError;

      toast.success('Criativo enviado para análise.');
      setCreativeFile(null);
      setCreativeHeadline('');
      setCreativeBody('');
      setCreativeAlt('');
      setCreativeTarget('');
      await load(true);
    } catch (error) {
      console.error('Falha ao enviar criativo:', error);
      toast.error('Não foi possível enviar o criativo.');
    } finally {
      setUploading(false);
    }
  };

  const submitExistingCreative = async (creative: AdvertisingCreative) => {
    setActionId(creative.id);
    try {
      const { error } = await supabase.rpc('gsa_advertiser_submit_creative', { p_creative_id: creative.id });
      if (error) throw error;
      toast.success('Criativo reenviado para análise.');
      await load(true);
    } catch (error) {
      console.error('Falha ao reenviar criativo:', error);
      toast.error('Não foi possível reenviar o criativo.');
    } finally {
      setActionId(null);
    }
  };

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-sm font-bold text-white/70" role="status">Carregando portal do anunciante...</div>;
  }

  if (!snapshot) {
    return (
      <main className="min-h-screen bg-neutral-950 px-5 py-12 text-white">
        <div className="mx-auto max-w-md">
          <button onClick={() => navigate('/anuncios')} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-white/60 hover:bg-white/10 hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar aos anúncios</button>
          <div className="mt-12 rounded-[2rem] border border-white/10 bg-white/[0.05] p-7 shadow-2xl sm:p-9">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-neutral-950"><Megaphone className="h-7 w-7" /></div>
            <h1 className="mt-6 text-3xl font-black">Portal do anunciante</h1>
            <p className="mt-3 text-sm leading-relaxed text-white/55">Use o e-mail liberado pela equipe GSA. O acesso é feito por link seguro, sem senha fixa.</p>
            {linkSent ? (
              <div className="mt-7 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5"><Mail className="h-6 w-6 text-emerald-300" /><p className="mt-3 font-black text-emerald-100">Confira seu e-mail</p><p className="mt-1 text-sm text-emerald-100/65">Abra o link recebido neste mesmo navegador para entrar.</p></div>
            ) : (
              <form onSubmit={sendMagicLink} className="mt-7 space-y-4">
                <label className="block text-sm font-bold">E-mail cadastrado<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-amber-300" placeholder="contato@empresa.com.br" /></label>
                <button disabled={sendingLink} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 font-black text-neutral-950 hover:bg-amber-300 disabled:opacity-60"><Send className="h-4 w-4" /> {sendingLink ? 'Enviando...' : 'Enviar link de acesso'}</button>
              </form>
            )}
          </div>
        </div>
      </main>
    );
  }

  const activeCampaigns = snapshot.campaigns.filter((campaign) => campaign.status === 'active').length;
  const pendingProposals = snapshot.proposals.filter((proposal) => ['sent', 'negotiating', 'final_offer'].includes(proposal.status)).length;
  const pendingPayments = snapshot.campaigns.filter((campaign) => campaign.payment && campaign.payment.status !== 'paid').length;

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">GSA Anúncios</p><p className="truncate font-black">{snapshot.advertiser.trade_name || snapshot.advertiser.legal_name}</p></div>
          <div className="flex items-center gap-2"><button onClick={() => void load(true)} disabled={refreshing} className="rounded-xl p-2.5 text-neutral-500 hover:bg-neutral-100"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></button><button onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-50"><LogOut className="h-4 w-4" /> Sair</button></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl bg-neutral-950 p-3 text-white lg:sticky lg:top-22">
          <nav className="flex gap-2 overflow-x-auto lg:flex-col">{TABS.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition ${tab === id ? 'bg-white text-neutral-950' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}><Icon className="h-4 w-4" /> {label}</button>)}</nav>
        </aside>

        <section className="min-w-0 space-y-6">
          {tab === 'overview' && <>
            <div><p className="text-sm font-black uppercase tracking-[0.18em] text-amber-600">Visão geral</p><h1 className="mt-2 text-3xl font-black">Acompanhe sua operação publicitária</h1><p className="mt-2 text-sm text-neutral-500">Propostas, pagamentos, criativos, campanhas e resultados no mesmo ambiente.</p></div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard icon={MessageSquareText} label="Propostas pendentes" value={pendingProposals} /><MetricCard icon={Megaphone} label="Campanhas ativas" value={activeCampaigns} /><MetricCard icon={WalletCards} label="Pagamentos pendentes" value={pendingPayments} /><MetricCard icon={BarChart3} label="Impressões entregues" value={metrics.served} /></div>
            <div className="grid gap-5 xl:grid-cols-2"><Panel title="Próximas ações"><ActionList snapshot={snapshot} onTab={setTab} /></Panel><Panel title="Desempenho acumulado"><div className="grid grid-cols-2 gap-3"><MiniMetric label="Entregues" value={metrics.served} /><MiniMetric label="Visíveis" value={metrics.viewable} /><MiniMetric label="Cliques" value={metrics.clicks} /><MiniMetric label="CTR" value={metrics.viewable ? `${((metrics.clicks / metrics.viewable) * 100).toFixed(2)}%` : '0%'} /></div></Panel></div>
          </>}

          {tab === 'proposals' && <>
            <SectionTitle title="Propostas comerciais" description="Aceite a proposta vigente ou envie uma contraproposta documentada." />
            {snapshot.proposals.length === 0 ? <Empty text="Nenhuma proposta disponível." /> : <div className="space-y-4">{snapshot.proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} busy={actionId === proposal.id} onAccept={acceptProposal} onCounter={(item) => { setCounterProposal(item); setCounterAmount(String(item.total_amount)); }} />)}</div>}
          </>}

          {tab === 'campaigns' && <>
            <SectionTitle title="Campanhas" description="O status muda automaticamente após pagamento, aprovação do criativo e início do período contratado." />
            {snapshot.campaigns.length === 0 ? <Empty text="As campanhas serão criadas quando uma proposta for aceita." /> : <div className="grid gap-4 xl:grid-cols-2">{snapshot.campaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}</div>}
          </>}

          {tab === 'creatives' && <>
            <SectionTitle title="Criativos" description="Envie imagens, vídeos ou conteúdo textual. Cada material passa por revisão antes da publicação." />
            <form onSubmit={uploadCreative} className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-bold">Campanha<select required value={creativeCampaignId} onChange={(event) => setCreativeCampaignId(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3"><option value="">Selecione</option>{snapshot.campaigns.filter((campaign) => !['completed', 'cancelled'].includes(campaign.status)).map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label><label className="text-sm font-bold">Arquivo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={(event) => setCreativeFile(event.target.files?.[0] || null)} className="mt-2 block w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm" /></label><label className="text-sm font-bold">Título<input value={creativeHeadline} onChange={(event) => setCreativeHeadline(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label><label className="text-sm font-bold">URL de destino<input type="url" value={creativeTarget} onChange={(event) => setCreativeTarget(event.target.value)} placeholder="https://" className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label><label className="text-sm font-bold md:col-span-2">Texto<textarea value={creativeBody} onChange={(event) => setCreativeBody(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label><label className="text-sm font-bold md:col-span-2">Descrição acessível<input value={creativeAlt} onChange={(event) => setCreativeAlt(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label></div><button disabled={uploading} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60"><UploadCloud className="h-4 w-4" /> {uploading ? 'Enviando...' : 'Enviar para análise'}</button></form>
            <div className="space-y-4">{snapshot.campaigns.flatMap((campaign) => campaign.creatives.map((creative) => ({ campaign, creative }))).map(({ campaign, creative }) => <CreativeRow key={creative.id} campaign={campaign} creative={creative} busy={actionId === creative.id} onSubmit={submitExistingCreative} />)}</div>
          </>}

          {tab === 'finance' && <>
            <SectionTitle title="Financeiro" description="A campanha só entra na fila de publicação depois que o pagamento é confirmado." />
            {snapshot.campaigns.filter((campaign) => campaign.payment).length === 0 ? <Empty text="Nenhuma cobrança criada." /> : <div className="space-y-4">{snapshot.campaigns.filter((campaign) => campaign.payment).map((campaign) => <PaymentCard key={campaign.id} campaign={campaign} />)}</div>}
          </>}

          {tab === 'reports' && <>
            <SectionTitle title="Relatórios" description="Métricas agregadas por campanha e dia, registradas pelo motor de veiculação." />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MetricCard icon={Megaphone} label="Entregues" value={metrics.served} /><MetricCard icon={ShieldCheck} label="Visíveis" value={metrics.viewable} /><MetricCard icon={BarChart3} label="Cliques" value={metrics.clicks} /><MetricCard icon={Clock3} label="Inícios de vídeo" value={metrics.videoStarts} /><MetricCard icon={CheckCircle2} label="Vídeos concluídos" value={metrics.videoCompletions} /></div>
            <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-400"><tr><th className="px-5 py-4">Campanha</th><th className="px-5 py-4">Data</th><th className="px-5 py-4">Entregues</th><th className="px-5 py-4">Visíveis</th><th className="px-5 py-4">Cliques</th><th className="px-5 py-4">CTR</th></tr></thead><tbody className="divide-y divide-neutral-100">{snapshot.campaigns.flatMap((campaign) => campaign.metrics.map((row) => <tr key={`${campaign.id}-${row.placement_id}-${row.metric_date}`}><td className="px-5 py-4 font-bold">{campaign.name}</td><td className="px-5 py-4">{date(row.metric_date)}</td><td className="px-5 py-4">{row.served}</td><td className="px-5 py-4">{row.viewable_impressions}</td><td className="px-5 py-4">{row.clicks}</td><td className="px-5 py-4">{row.viewable_impressions ? `${((row.clicks / row.viewable_impressions) * 100).toFixed(2)}%` : '0%'}</td></tr>))}</tbody></table></div></div>
          </>}
        </section>
      </div>

      {counterProposal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Enviar contraproposta"><form onSubmit={sendCounter} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><h2 className="text-2xl font-black">Enviar contraproposta</h2><p className="mt-2 text-sm text-neutral-500">A equipe GSA receberá o valor e sua justificativa no histórico da negociação.</p><label className="mt-5 block text-sm font-bold">Valor proposto<input type="number" min="1" step="0.01" required value={counterAmount} onChange={(event) => setCounterAmount(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label><label className="mt-4 block text-sm font-bold">Mensagem<textarea required minLength={3} rows={4} value={counterMessage} onChange={(event) => setCounterMessage(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setCounterProposal(null)} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-bold">Cancelar</button><button disabled={actionId === counterProposal.id} className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-black text-white">{actionId === counterProposal.id ? 'Enviando...' : 'Enviar'}</button></div></form></div>}
    </main>
  );
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
  if (snapshot.campaigns.some((item) => item.payment && item.payment.status !== 'paid')) actions.push({ text: 'Regularizar pagamento', tab: 'finance' });
  if (snapshot.campaigns.some((item) => item.creatives.length === 0 || item.creatives.some((creative) => creative.status === 'rejected'))) actions.push({ text: 'Enviar ou corrigir criativo', tab: 'creatives' });
  if (actions.length === 0) return <p className="text-sm text-neutral-500">Nenhuma pendência. Suas campanhas seguem o fluxo automático.</p>;
  return <div className="space-y-2">{actions.map((action) => <button key={action.text} onClick={() => onTab(action.tab)} className="flex w-full items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-left text-sm font-bold hover:bg-neutral-100"><span>{action.text}</span><ArrowLeft className="h-4 w-4 rotate-180 text-neutral-400" /></button>)}</div>;
}

function ProposalCard({ proposal, busy, onAccept, onCounter }: { key?: string; proposal: AdvertisingProposal; busy: boolean; onAccept: (id: string) => Promise<void>; onCounter: (proposal: AdvertisingProposal) => void }) {
  const version = proposal.version;
  const actionable = ['sent', 'negotiating', 'final_offer'].includes(proposal.status);
  return <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">{proposalLabels[proposal.status] || proposal.status}</span><h2 className="mt-3 text-xl font-black">Proposta v{proposal.current_version}</h2><p className="mt-1 text-sm text-neutral-500">Válida até {date(proposal.valid_until)}</p></div><div className="rounded-2xl bg-neutral-950 px-5 py-4 text-white"><p className="text-xs uppercase tracking-wider text-white/45">Investimento</p><p className="mt-1 text-2xl font-black text-amber-300">{money(proposal.total_amount)}</p></div></div>{version && <div className="mt-5 grid gap-3 sm:grid-cols-3"><MiniMetric label="Início" value={date(version.starts_on)} /><MiniMetric label="Término" value={date(version.ends_on)} /><MiniMetric label="Duração" value={`${version.duration_days} dias`} /></div>} {version?.terms && <p className="mt-4 rounded-2xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-600">{version.terms}</p>} {proposal.negotiations && proposal.negotiations.length > 0 && <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4">{proposal.negotiations.map((item) => <div key={item.id} className="rounded-xl bg-neutral-50 p-3 text-sm"><p className="font-bold">{item.actor_type === 'advertiser' ? 'Você' : 'Equipe GSA'} {item.proposed_amount ? `· ${money(item.proposed_amount)}` : ''}</p><p className="mt-1 text-neutral-500">{item.message}</p></div>)}</div>} {actionable && <div className="mt-5 flex flex-wrap gap-3"><button disabled={busy} onClick={() => void onAccept(proposal.id)} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-60">{busy ? 'Processando...' : 'Aceitar proposta'}</button><button disabled={busy} onClick={() => onCounter(proposal)} className="rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-black hover:bg-neutral-50">Fazer contraproposta</button></div>}</article>;
}

function CampaignCard({ campaign }: { key?: string; campaign: AdvertisingCampaign }) {
  const totals = campaign.metrics.reduce((acc, row) => ({ served: acc.served + Number(row.served || 0), clicks: acc.clicks + Number(row.clicks || 0) }), { served: 0, clicks: 0 });
  return <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-black text-neutral-700">{campaignLabels[campaign.status] || campaign.status}</span><h2 className="mt-3 text-xl font-black">{campaign.name}</h2></div><Megaphone className="h-6 w-6 text-amber-600" /></div><div className="mt-5 grid grid-cols-2 gap-3"><MiniMetric label="Início" value={date(campaign.starts_at)} /><MiniMetric label="Término" value={date(campaign.ends_at)} /><MiniMetric label="Entregues" value={totals.served} /><MiniMetric label="Cliques" value={totals.clicks} /></div><p className="mt-4 text-xs font-bold uppercase tracking-wider text-neutral-400">{campaign.creatives.length} criativo(s)</p></article>;
}

function CreativeRow({ campaign, creative, busy, onSubmit }: { key?: string; campaign: AdvertisingCampaign; creative: AdvertisingCreative; busy: boolean; onSubmit: (creative: AdvertisingCreative) => Promise<void> }) {
  return <article className="flex flex-col justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{campaign.name}</p><p className="mt-1 font-black">{creative.headline || creative.storage_path || 'Criativo textual'}</p><p className="mt-1 text-sm text-neutral-500">Status: {creative.status}</p>{creative.rejection_reason && <p className="mt-2 text-sm font-semibold text-red-600">Motivo: {creative.rejection_reason}</p>}</div>{['draft', 'rejected'].includes(creative.status) && <button disabled={busy} onClick={() => void onSubmit(creative)} className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60">{busy ? 'Enviando...' : 'Enviar para análise'}</button>}</article>;
}

function PaymentCard({ campaign }: { key?: string; campaign: AdvertisingCampaign }) {
  const payment = campaign.payment!;
  return <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{campaign.name}</p><h2 className="mt-2 text-2xl font-black">{money(payment.amount)}</h2><p className="mt-1 text-sm text-neutral-500">Status: {payment.status} · vencimento {date(payment.due_at)}</p></div><CircleDollarSign className={`h-9 w-9 ${payment.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`} /></div>{payment.checkout_url && <a href={payment.checkout_url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex rounded-xl bg-neutral-950 px-5 py-3 text-sm font-black text-white">Abrir pagamento</a>}{payment.pix_code && <div className="mt-4 rounded-xl bg-neutral-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">PIX copia e cola</p><code className="mt-2 block break-all text-xs">{payment.pix_code}</code></div>}{!payment.checkout_url && !payment.pix_code && payment.status !== 'paid' && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">A equipe GSA enviará as instruções de pagamento e registrará a confirmação neste portal.</p>}</article>;
}
