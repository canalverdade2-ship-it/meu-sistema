import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileImage,
  MailPlus,
  Megaphone,
  MessageSquareText,
  RefreshCw,
  Search,
  ShieldCheck,
  WalletCards,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type {
  AdvertisingAdminOverview,
  AdvertisingCampaign,
  AdvertisingCreative,
  AdvertisingPayment,
  AdvertisingProposal,
  AdvertisingRequest,
  AdvertisingRequestStatus,
} from '../../types/advertising';

type AdminTab = 'requests' | 'proposals' | 'campaigns' | 'creatives' | 'payments' | 'inventory';

const TABS: Array<{ id: AdminTab; label: string; icon: typeof Megaphone }> = [
  { id: 'requests', label: 'Solicitações', icon: Megaphone },
  { id: 'proposals', label: 'Propostas', icon: MessageSquareText },
  { id: 'campaigns', label: 'Campanhas', icon: CalendarClock },
  { id: 'creatives', label: 'Criativos', icon: FileImage },
  { id: 'payments', label: 'Pagamentos', icon: WalletCards },
  { id: 'inventory', label: 'Inventário', icon: BarChart3 },
];

const REQUEST_LABELS: Record<AdvertisingRequestStatus, string> = {
  draft: 'Rascunho', submitted: 'Recebida', under_review: 'Em análise', awaiting_information: 'Aguardando informações',
  proposal_sent: 'Proposta enviada', negotiation_requested: 'Em negociação', accepted: 'Aceita', rejected: 'Recusada', cancelled: 'Cancelada',
};

const EMPTY_OVERVIEW: AdvertisingAdminOverview = { requests: [], proposals: [], campaigns: [], placements: [] };

function currency(value: number | string | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return 'A definir';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value));
}

function defaultDate(offsetDays: number) {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

export function AdvertisingAdminModule() {
  const [overview, setOverview] = useState<AdvertisingAdminOverview>(EMPTY_OVERVIEW);
  const [tab, setTab] = useState<AdminTab>('requests');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [actionId, setActionId] = useState<string | null>(null);
  const [proposalRequest, setProposalRequest] = useState<AdvertisingRequest | null>(null);
  const [amount, setAmount] = useState('');
  const [startsOn, setStartsOn] = useState(defaultDate(7));
  const [endsOn, setEndsOn] = useState(defaultDate(36));
  const [validUntil, setValidUntil] = useState(defaultDate(7));
  const [frequencyModel, setFrequencyModel] = useState('once_per_day');
  const [frequencyValue, setFrequencyValue] = useState('1');
  const [impressionLimit, setImpressionLimit] = useState('');
  const [terms, setTerms] = useState('A publicação depende da confirmação do pagamento e da aprovação do criativo.');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('gsa_admin_advertising_overview');
      if (error) throw error;
      setOverview((data || EMPTY_OVERVIEW) as AdvertisingAdminOverview);
    } catch (error) {
      console.error('Falha ao carregar operação de anúncios:', error);
      toast.error('Não foi possível carregar o módulo de anúncios.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return overview.requests.filter((request) => {
      if (status !== 'all' && request.status !== status) return false;
      if (!term) return true;
      return [request.protocol, request.company_name, request.segment, request.contact_name, request.contact_email]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [overview.requests, search, status]);

  const summary = useMemo(() => {
    const payments = overview.campaigns.map((campaign) => campaign.payment).filter(Boolean) as AdvertisingPayment[];
    const metrics = overview.campaigns.flatMap((campaign) => campaign.metrics || []);
    return {
      requests: overview.requests.length,
      proposals: overview.proposals.filter((proposal) => ['sent', 'negotiating', 'final_offer'].includes(proposal.status)).length,
      active: overview.campaigns.filter((campaign) => campaign.status === 'active').length,
      revenue: payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      served: metrics.reduce((sum, row) => sum + Number(row.served || 0), 0),
    };
  }, [overview]);

  const updateStatus = async (requestId: string, nextStatus: AdvertisingRequestStatus) => {
    setActionId(requestId);
    try {
      const { error } = await supabase.rpc('gsa_admin_update_ad_request_status', { p_request_id: requestId, p_status: nextStatus });
      if (error) throw error;
      toast.success(`Solicitação atualizada para ${REQUEST_LABELS[nextStatus]}.`);
      await load();
    } catch (error) {
      console.error('Falha ao atualizar solicitação:', error);
      toast.error('Não foi possível atualizar a solicitação.');
    } finally {
      setActionId(null);
    }
  };

  const openProposal = (request: AdvertisingRequest) => {
    const existing = overview.proposals.find((proposal) => proposal.request_id === request.id);
    setProposalRequest(request);
    setAmount(String(existing?.total_amount || request.intended_budget || ''));
    setStartsOn(existing?.version?.starts_on || request.desired_start_date || defaultDate(7));
    setEndsOn(existing?.version?.ends_on || request.desired_end_date || defaultDate(36));
    setValidUntil(defaultDate(7));
    setFrequencyModel(existing?.version?.frequency_model || 'once_per_day');
    setFrequencyValue(String(existing?.version?.frequency_value || 1));
    setImpressionLimit(existing?.version?.impression_limit ? String(existing.version.impression_limit) : '');
    setTerms(existing?.version?.terms || 'A publicação depende da confirmação do pagamento e da aprovação do criativo.');
  };

  const inviteAdvertiser = async (requestId: string, quiet = false) => {
    const { data, error } = await supabase.functions.invoke<{ success: boolean; already_linked?: boolean }>('gsa-advertiser-admin', {
      body: { action: 'invite', request_id: requestId },
    });
    if (error || !data?.success) {
      if (!quiet) toast.error('A proposta foi criada, mas o convite do portal não pôde ser enviado.');
      return false;
    }
    if (!quiet) toast.success(data.already_linked ? 'Portal do anunciante já estava liberado.' : 'Convite do portal enviado.');
    return true;
  };

  const createProposal = async (event: FormEvent) => {
    event.preventDefault();
    if (!proposalRequest) return;
    setActionId(proposalRequest.id);
    try {
      const { data, error } = await supabase.rpc('gsa_admin_create_ad_proposal', {
        p_request_id: proposalRequest.id,
        p_payload: {
          amount: Number(amount),
          starts_on: startsOn,
          ends_on: endsOn,
          valid_until: `${validUntil}T23:59:59-03:00`,
          formats: proposalRequest.desired_formats,
          placement_codes: proposalRequest.desired_pages,
          frequency_model: frequencyModel,
          frequency_value: frequencyModel === 'unlimited' ? null : Number(frequencyValue || 1),
          impression_limit: impressionLimit ? Number(impressionLimit) : null,
          terms,
        },
      });
      if (error || !data?.success) throw error || new Error('Falha ao criar proposta');
      const invited = await inviteAdvertiser(proposalRequest.id, true);
      toast.success(invited ? `Proposta v${data.version} criada e portal liberado.` : `Proposta v${data.version} criada. Convite pendente.`);
      setProposalRequest(null);
      setTab('proposals');
      await load();
    } catch (error) {
      console.error('Falha ao criar proposta:', error);
      toast.error('Não foi possível criar a proposta.');
    } finally {
      setActionId(null);
    }
  };

  const reviewCreative = async (creative: AdvertisingCreative, approved: boolean) => {
    const reason = approved ? null : window.prompt('Informe o motivo da reprovação:');
    if (!approved && !reason?.trim()) return;
    setActionId(creative.id);
    try {
      const { error } = await supabase.rpc('gsa_admin_review_ad_creative', {
        p_creative_id: creative.id,
        p_approved: approved,
        p_reason: reason,
      });
      if (error) throw error;
      toast.success(approved ? 'Criativo aprovado.' : 'Criativo devolvido para correção.');
      await load();
    } catch (error) {
      console.error('Falha ao analisar criativo:', error);
      toast.error('Não foi possível analisar o criativo.');
    } finally {
      setActionId(null);
    }
  };

  const markPayment = async (payment: AdvertisingPayment, nextStatus: AdvertisingPayment['status']) => {
    const reference = nextStatus === 'paid' && !payment.provider_reference
      ? window.prompt('Referência do pagamento ou comprovante:', `MANUAL-${Date.now()}`)
      : payment.provider_reference;
    if (nextStatus === 'paid' && !reference?.trim()) return;
    setActionId(payment.id);
    try {
      const { error } = await supabase.rpc('gsa_admin_mark_ad_payment', {
        p_payment_id: payment.id,
        p_status: nextStatus,
        p_provider_reference: reference || null,
        p_payment_method: nextStatus === 'paid' ? 'manual' : payment.payment_method,
      });
      if (error) throw error;
      toast.success(`Pagamento atualizado para ${nextStatus}.`);
      await load();
    } catch (error) {
      console.error('Falha ao atualizar pagamento:', error);
      toast.error('Não foi possível atualizar o pagamento.');
    } finally {
      setActionId(null);
    }
  };

  const creativeRows = overview.campaigns.flatMap((campaign) => campaign.creatives.map((creative) => ({ campaign, creative })));
  const paymentRows = overview.campaigns.filter((campaign) => campaign.payment).map((campaign) => ({ campaign, payment: campaign.payment! }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-amber-600"><Megaphone className="h-4 w-4" /> GSA Anúncios</div><h1 className="mt-2 text-3xl font-black tracking-tight text-neutral-950">Operação publicitária</h1><p className="mt-2 max-w-3xl text-sm text-neutral-500">Da solicitação à entrega: proposta, portal, pagamento, criativos, agenda e resultados.</p></div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold text-neutral-700 shadow-sm hover:bg-neutral-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><SummaryCard icon={Megaphone} label="Solicitações" value={summary.requests} /><SummaryCard icon={MessageSquareText} label="Propostas pendentes" value={summary.proposals} /><SummaryCard icon={ShieldCheck} label="Campanhas ativas" value={summary.active} /><SummaryCard icon={CircleDollarSign} label="Receita confirmada" value={currency(summary.revenue)} /><SummaryCard icon={BarChart3} label="Entregas" value={summary.served} /></div>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-neutral-200 bg-white p-2">{TABS.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black ${tab === id ? 'bg-neutral-950 text-white' : 'text-neutral-500 hover:bg-neutral-50'}`}><Icon className="h-4 w-4" /> {label}</button>)}</div>

      {loading ? <div className="rounded-3xl border border-neutral-200 bg-white p-16 text-center text-sm font-semibold text-neutral-500" role="status">Carregando operação...</div> : <>
        {tab === 'requests' && <div className="space-y-4"><div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 md:flex-row"><label className="relative flex-1"><span className="sr-only">Buscar solicitações</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-neutral-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empresa, protocolo, contato ou segmento" className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-amber-400" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold"><option value="all">Todos os status</option>{Object.entries(REQUEST_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>{filteredRequests.length === 0 ? <Empty text="Nenhuma solicitação encontrada." /> : filteredRequests.map((request) => <RequestCard key={request.id} request={request} busy={actionId === request.id} onStatus={updateStatus} onProposal={openProposal} onInvite={inviteAdvertiser} hasProposal={overview.proposals.some((proposal) => proposal.request_id === request.id)} />)}</div>}

        {tab === 'proposals' && (overview.proposals.length === 0 ? <Empty text="Nenhuma proposta criada." /> : <div className="space-y-4">{overview.proposals.map((proposal) => <ProposalRow key={proposal.id} proposal={proposal} request={overview.requests.find((request) => request.id === proposal.request_id)} onEdit={(request) => request && openProposal(request)} onInvite={() => void inviteAdvertiser(proposal.request_id)} />)}</div>)}

        {tab === 'campaigns' && (overview.campaigns.length === 0 ? <Empty text="Nenhuma campanha criada." /> : <div className="grid gap-4 xl:grid-cols-2">{overview.campaigns.map((campaign) => <CampaignRow key={campaign.id} campaign={campaign} />)}</div>)}

        {tab === 'creatives' && (creativeRows.length === 0 ? <Empty text="Nenhum criativo enviado." /> : <div className="space-y-4">{creativeRows.map(({ campaign, creative }) => <CreativeReviewRow key={creative.id} campaign={campaign} creative={creative} busy={actionId === creative.id} onReview={reviewCreative} />)}</div>)}

        {tab === 'payments' && (paymentRows.length === 0 ? <Empty text="Nenhuma cobrança criada." /> : <div className="space-y-4">{paymentRows.map(({ campaign, payment }) => <PaymentRow key={payment.id} campaign={campaign} payment={payment} busy={actionId === payment.id} onMark={markPayment} />)}</div>)}

        {tab === 'inventory' && <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-400"><tr><th className="px-5 py-4">Código</th><th className="px-5 py-4">Posição</th><th className="px-5 py-4">Módulo</th><th className="px-5 py-4">Formato</th><th className="px-5 py-4">Capacidade</th><th className="px-5 py-4">Status</th></tr></thead><tbody className="divide-y divide-neutral-100">{overview.placements.map((placement) => <tr key={placement.id}><td className="px-5 py-4 font-black">{placement.code}</td><td className="px-5 py-4">{placement.name}</td><td className="px-5 py-4">{placement.module}</td><td className="px-5 py-4">{placement.format}</td><td className="px-5 py-4">{placement.capacity}</td><td className="px-5 py-4">{placement.active ? 'Ativa' : 'Inativa'}</td></tr>)}</tbody></table></div></div>}
      </>}

      {proposalRequest && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Criar proposta"><form onSubmit={createProposal} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-amber-600">{proposalRequest.protocol}</p><h2 className="mt-2 text-2xl font-black">Proposta para {proposalRequest.company_name}</h2></div><button type="button" onClick={() => setProposalRequest(null)} className="rounded-full p-2 hover:bg-neutral-100"><X className="h-5 w-5" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Valor<input required type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label><label className="text-sm font-bold">Válida até<input required type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label><label className="text-sm font-bold">Início<input required type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label><label className="text-sm font-bold">Término<input required type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label><label className="text-sm font-bold">Frequência<select value={frequencyModel} onChange={(event) => setFrequencyModel(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3"><option value="once_per_session">Uma vez por sessão</option><option value="once_per_day">Uma vez por dia</option><option value="interval_hours">Intervalo em horas</option><option value="daily_limit">Limite diário</option><option value="unlimited">Sem limite por visitante</option></select></label><label className="text-sm font-bold">Valor da frequência<input type="number" min="1" disabled={frequencyModel === 'unlimited'} value={frequencyValue} onChange={(event) => setFrequencyValue(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3 disabled:bg-neutral-100" /></label><label className="text-sm font-bold sm:col-span-2">Limite total de impressões<input type="number" min="1" value={impressionLimit} onChange={(event) => setImpressionLimit(event.target.value)} placeholder="Sem limite" className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label><label className="text-sm font-bold sm:col-span-2">Termos<textarea rows={4} value={terms} onChange={(event) => setTerms(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label></div><div className="mt-5 rounded-2xl bg-neutral-50 p-4 text-sm"><p className="font-black">Posições incluídas</p><p className="mt-1 text-neutral-500">{proposalRequest.desired_pages.join(', ')}</p><p className="mt-3 font-black">Formatos</p><p className="mt-1 text-neutral-500">{proposalRequest.desired_formats.join(', ')}</p></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setProposalRequest(null)} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-bold">Cancelar</button><button disabled={actionId === proposalRequest.id} className="rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">{actionId === proposalRequest.id ? 'Criando...' : 'Criar e enviar proposta'}</button></div></form></div>}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Megaphone; label: string; value: number | string }) {
  return <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-amber-600" /><p className="mt-4 text-xs font-bold uppercase tracking-wider text-neutral-400">{label}</p><p className="mt-1 truncate text-xl font-black">{value}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-14 text-center text-sm font-semibold text-neutral-400">{text}</div>;
}

function RequestCard({ request, busy, onStatus, onProposal, onInvite, hasProposal }: { request: AdvertisingRequest; busy: boolean; onStatus: (id: string, status: AdvertisingRequestStatus) => Promise<void>; onProposal: (request: AdvertisingRequest) => void; onInvite: (id: string) => Promise<boolean>; hasProposal: boolean }) {
  return <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-4 lg:flex-row"><div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">{request.protocol}</span><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">{REQUEST_LABELS[request.status]}</span></div><h2 className="mt-3 text-xl font-black">{request.company_name}</h2><p className="mt-1 text-sm text-neutral-500">{request.segment} · {request.contact_name} · {request.contact_email}</p></div><div className="rounded-2xl bg-neutral-950 px-5 py-4 text-white"><p className="text-xs uppercase tracking-wider text-white/45">Orçamento pretendido</p><p className="mt-1 text-xl font-black text-amber-300">{currency(request.intended_budget)}</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-3"><Info icon={BadgeDollarSign} label="Objetivo" value={request.objective} /><Info icon={CalendarClock} label="Período" value={`${formatDate(request.desired_start_date)} a ${formatDate(request.desired_end_date)}`} /><Info icon={CheckCircle2} label="Criativo" value={request.needs_creative_service ? 'Produção pela GSA' : 'Fornecido pelo anunciante'} /></div><div className="mt-5 flex flex-wrap gap-2 border-t border-neutral-100 pt-5"><button onClick={() => onProposal(request)} className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-black text-white">{hasProposal ? 'Nova versão da proposta' : 'Criar proposta'}</button>{hasProposal && <button onClick={() => void onInvite(request.id)} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 px-4 py-2 text-xs font-black text-amber-700"><MailPlus className="h-3.5 w-3.5" /> Liberar portal</button>}{request.status === 'submitted' && <button disabled={busy} onClick={() => void onStatus(request.id, 'under_review')} className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-black">Iniciar análise</button>}{!['rejected', 'cancelled', 'accepted'].includes(request.status) && <button disabled={busy} onClick={() => void onStatus(request.id, 'rejected')} className="rounded-full border border-red-200 px-4 py-2 text-xs font-black text-red-700">Recusar</button>}</div></article>;
}

function ProposalRow({ proposal, request, onEdit, onInvite }: { proposal: AdvertisingProposal; request?: AdvertisingRequest; onEdit: (request?: AdvertisingRequest) => void; onInvite: () => void }) {
  return <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-black text-neutral-700">{proposal.status}</span><h2 className="mt-3 text-xl font-black">{proposal.company_name || request?.company_name} · versão {proposal.current_version}</h2><p className="mt-1 text-sm text-neutral-500">Válida até {formatDate(proposal.valid_until)} · {proposal.version?.duration_days || 0} dias</p></div><p className="text-2xl font-black text-amber-700">{currency(proposal.total_amount)}</p></div>{proposal.version?.terms && <p className="mt-4 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600">{proposal.version.terms}</p>}<div className="mt-5 flex flex-wrap gap-2"><button onClick={() => onEdit(request)} className="rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-black text-white">Criar nova versão</button><button onClick={onInvite} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-xs font-black">Reenviar acesso ao portal</button></div></article>;
}

function CampaignRow({ campaign }: { campaign: AdvertisingCampaign }) {
  const totals = campaign.metrics.reduce((acc, row) => ({ served: acc.served + Number(row.served || 0), clicks: acc.clicks + Number(row.clicks || 0) }), { served: 0, clicks: 0 });
  return <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-black text-neutral-700">{campaign.status}</span><h2 className="mt-3 text-xl font-black">{campaign.name}</h2><p className="mt-1 text-sm text-neutral-500">{campaign.advertiser_name}</p></div><Megaphone className="h-6 w-6 text-amber-600" /></div><div className="mt-5 grid grid-cols-2 gap-3"><Mini label="Início" value={formatDate(campaign.starts_at)} /><Mini label="Término" value={formatDate(campaign.ends_at)} /><Mini label="Entregas" value={totals.served} /><Mini label="Cliques" value={totals.clicks} /></div></article>;
}

function CreativeReviewRow({ campaign, creative, busy, onReview }: { campaign: AdvertisingCampaign; creative: AdvertisingCreative; busy: boolean; onReview: (creative: AdvertisingCreative, approved: boolean) => Promise<void> }) {
  return <article className="flex flex-col justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{campaign.name}</p><p className="mt-1 font-black">{creative.headline || creative.storage_path || 'Criativo textual'}</p><p className="mt-1 text-sm text-neutral-500">{creative.kind} · {creative.status}</p>{creative.rejection_reason && <p className="mt-2 text-sm text-red-600">{creative.rejection_reason}</p>}</div>{creative.status === 'pending_review' && <div className="flex gap-2"><button disabled={busy} onClick={() => void onReview(creative, true)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white">Aprovar</button><button disabled={busy} onClick={() => void onReview(creative, false)} className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-black text-red-700">Reprovar</button></div>}</article>;
}

function PaymentRow({ campaign, payment, busy, onMark }: { campaign: AdvertisingCampaign; payment: AdvertisingPayment; busy: boolean; onMark: (payment: AdvertisingPayment, status: AdvertisingPayment['status']) => Promise<void> }) {
  return <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{campaign.name}</p><h2 className="mt-2 text-2xl font-black">{currency(payment.amount)}</h2><p className="mt-1 text-sm text-neutral-500">{payment.status} · vencimento {formatDate(payment.due_at)}</p></div><CircleDollarSign className={`h-9 w-9 ${payment.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`} /></div><div className="mt-5 flex flex-wrap gap-2">{payment.status !== 'paid' && <button disabled={busy} onClick={() => void onMark(payment, 'paid')} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white">Confirmar pagamento</button>}{payment.status === 'paid' && <button disabled={busy} onClick={() => void onMark(payment, 'refunded')} className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-black text-red-700">Registrar estorno</button>}</div></article>;
}

function Info({ icon: Icon, label, value }: { icon: typeof Megaphone; label: string; value: string }) {
  return <div className="flex gap-3 rounded-2xl bg-neutral-50 p-4"><Icon className="mt-0.5 h-5 w-5 text-amber-600" /><div><p className="text-xs font-black uppercase tracking-wider text-neutral-400">{label}</p><p className="mt-1 text-sm font-semibold text-neutral-700">{value}</p></div></div>;
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-2xl bg-neutral-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{label}</p><p className="mt-1 font-black">{value}</p></div>;
}
