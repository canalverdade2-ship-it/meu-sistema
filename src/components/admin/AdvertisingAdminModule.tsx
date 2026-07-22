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
  BadgeDollarSign,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  FileImage,
  MailPlus,
  Megaphone,
  MessageSquareText,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type {
  AdvertisingAdminOverview,
  AdvertisingCampaign,
  AdvertisingCampaignStatus,
  AdvertisingCreative,
  AdvertisingPayment,
  AdvertisingPaymentStatus,
  AdvertisingPlacement,
  AdvertisingProposal,
  AdvertisingProposalStatus,
  AdvertisingRequest,
  AdvertisingRequestStatus,
} from '../../types/advertising';

type AdminTab = 'requests' | 'proposals' | 'campaigns' | 'creatives' | 'payments' | 'inventory';
type ProposalActionStatus = Extract<AdvertisingProposalStatus, 'final_offer' | 'rejected' | 'cancelled'>;

const PAGE_SIZE = 20;
const TERMINAL_PROPOSAL_STATUSES: AdvertisingProposalStatus[] = ['accepted', 'rejected', 'expired', 'cancelled'];
const EDITABLE_PROPOSAL_STATUSES: AdvertisingProposalStatus[] = ['draft', 'sent', 'negotiating'];

const TABS: Array<{ id: AdminTab; label: string; icon: typeof Megaphone }> = [
  { id: 'requests', label: 'Solicitações', icon: Megaphone },
  { id: 'proposals', label: 'Propostas', icon: MessageSquareText },
  { id: 'campaigns', label: 'Campanhas', icon: CalendarClock },
  { id: 'creatives', label: 'Criativos', icon: FileImage },
  { id: 'payments', label: 'Pagamentos', icon: WalletCards },
  { id: 'inventory', label: 'Inventário', icon: BarChart3 },
];

const REQUEST_LABELS: Record<AdvertisingRequestStatus, string> = {
  draft: 'Rascunho',
  submitted: 'Recebida',
  under_review: 'Em análise',
  awaiting_information: 'Aguardando informações',
  proposal_sent: 'Proposta enviada',
  negotiation_requested: 'Em negociação',
  accepted: 'Aceita',
  rejected: 'Recusada',
  cancelled: 'Cancelada',
};

const PROPOSAL_LABELS: Record<AdvertisingProposalStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviada',
  negotiating: 'Em negociação',
  final_offer: 'Oferta final',
  accepted: 'Aceita',
  rejected: 'Recusada',
  expired: 'Expirada',
  cancelled: 'Cancelada',
};

const CAMPAIGN_LABELS: Record<AdvertisingCampaignStatus, string> = {
  draft: 'Rascunho',
  payment_pending: 'Aguardando pagamento',
  creative_review: 'Criativo em análise',
  scheduled: 'Agendada',
  active: 'Ativa',
  paused: 'Pausada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

const PAYMENT_LABELS: Record<AdvertisingPaymentStatus, string> = {
  pending: 'Pendente',
  processing: 'Em processamento',
  paid: 'Pago',
  failed: 'Falhou',
  refunded: 'Estornado',
  cancelled: 'Cancelado',
};

const EMPTY_OVERVIEW: AdvertisingAdminOverview = { requests: [], proposals: [], campaigns: [], placements: [] };

function currency(value: number | string | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return 'A definir';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Data inválida';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(parsed);
}

function formatDateTime(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

function defaultDate(offsetDays: number) {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

function toDateTimeLocal(value?: string | null) {
  const parsed = value ? new Date(value) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const safe = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const offset = safe.getTimezoneOffset() * 60_000;
  return new Date(safe.getTime() - offset).toISOString().slice(0, 16);
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
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}

export function AdvertisingAdminModule() {
  const [overview, setOverview] = useState<AdvertisingAdminOverview>(EMPTY_OVERVIEW);
  const [tab, setTab] = useState<AdminTab>('requests');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
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
  const [finalOffer, setFinalOffer] = useState(false);

  const [reviewDialog, setReviewDialog] = useState<{ creative: AdvertisingCreative; approved: boolean } | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [paymentDialog, setPaymentDialog] = useState<{ payment: AdvertisingPayment; status: AdvertisingPaymentStatus } | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('manual');
  const [paymentConfiguration, setPaymentConfiguration] = useState<AdvertisingPayment | null>(null);
  const [configurationProvider, setConfigurationProvider] = useState('manual');
  const [configurationReference, setConfigurationReference] = useState('');
  const [configurationCheckoutUrl, setConfigurationCheckoutUrl] = useState('');
  const [configurationPixCode, setConfigurationPixCode] = useState('');
  const [configurationDueAt, setConfigurationDueAt] = useState(toDateTimeLocal());
  const [proposalAction, setProposalAction] = useState<{ proposal: AdvertisingProposal; status: ProposalActionStatus } | null>(null);
  const [proposalActionMessage, setProposalActionMessage] = useState('');
  const [campaignAction, setCampaignAction] = useState<{ campaign: AdvertisingCampaign; status: AdvertisingCampaignStatus } | null>(null);
  const [placementDialog, setPlacementDialog] = useState<AdvertisingPlacement | null>(null);
  const [placementActive, setPlacementActive] = useState(true);
  const [placementCapacity, setPlacementCapacity] = useState('1');
  const [placementExclusive, setPlacementExclusive] = useState(false);
  const [placementPrice, setPlacementPrice] = useState('0');
  const [placementDevices, setPlacementDevices] = useState<string[]>([]);

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
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [tab, search, status]);

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
      toast.error(messageFromError(error, 'Não foi possível atualizar a solicitação.'));
    } finally {
      setActionId(null);
    }
  };

  const openProposal = (request: AdvertisingRequest) => {
    const existing = overview.proposals.find((proposal) => proposal.request_id === request.id);
    if (existing && TERMINAL_PROPOSAL_STATUSES.includes(existing.status)) {
      toast.error('Esta proposta está encerrada e não pode receber uma nova versão.');
      return;
    }
    if (['accepted', 'rejected', 'cancelled'].includes(request.status)) {
      toast.error('A solicitação está encerrada.');
      return;
    }
    const lastCounter = [...(existing?.negotiations || [])].reverse().find((item) => item.actor_type === 'advertiser' && item.proposed_amount);
    setProposalRequest(request);
    setAmount(String(lastCounter?.proposed_amount || existing?.total_amount || request.intended_budget || ''));
    setStartsOn(existing?.version?.starts_on || request.desired_start_date || defaultDate(7));
    setEndsOn(existing?.version?.ends_on || request.desired_end_date || defaultDate(36));
    setValidUntil(defaultDate(7));
    setFrequencyModel(existing?.version?.frequency_model || 'once_per_day');
    setFrequencyValue(String(existing?.version?.frequency_value || 1));
    setImpressionLimit(existing?.version?.impression_limit ? String(existing.version.impression_limit) : '');
    setTerms(existing?.version?.terms || 'A publicação depende da confirmação do pagamento e da aprovação do criativo.');
    setFinalOffer(existing?.status === 'negotiating');
  };

  const inviteAdvertiser = async (requestId: string, quiet = false) => {
    const { data, error } = await supabase.functions.invoke<{ success: boolean; already_linked?: boolean }>('gsa-advertiser-admin', {
      body: { action: 'invite', request_id: requestId },
    });
    if (error || !data?.success) {
      if (!quiet) toast.error('O acesso ao portal não pôde ser enviado.');
      return false;
    }
    if (!quiet) toast.success(data.already_linked ? 'Portal do anunciante já estava liberado.' : 'Convite do portal enviado.');
    return true;
  };

  const createProposal = async (event: FormEvent) => {
    event.preventDefault();
    if (!proposalRequest) return;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error('Informe um valor de proposta válido.');
      return;
    }
    if (endsOn < startsOn) {
      toast.error('A data de término não pode ser anterior ao início.');
      return;
    }
    setActionId(proposalRequest.id);
    try {
      const { data, error } = await supabase.rpc('gsa_admin_create_ad_proposal', {
        p_request_id: proposalRequest.id,
        p_payload: {
          amount: numericAmount,
          starts_on: startsOn,
          ends_on: endsOn,
          valid_until: `${validUntil}T23:59:59-03:00`,
          formats: proposalRequest.desired_formats,
          placement_codes: proposalRequest.desired_pages,
          frequency_model: frequencyModel,
          frequency_value: frequencyModel === 'unlimited' ? null : Number(frequencyValue || 1),
          impression_limit: impressionLimit ? Number(impressionLimit) : null,
          terms: terms.trim(),
          final_offer: finalOffer,
        },
      });
      if (error || !data?.success) throw error || new Error('Falha ao criar proposta');
      const invited = await inviteAdvertiser(proposalRequest.id, true);
      toast.success(invited
        ? `Proposta v${data.version} criada e portal liberado.`
        : `Proposta v${data.version} criada. Convite pendente.`);
      setProposalRequest(null);
      setTab('proposals');
      await load();
    } catch (error) {
      console.error('Falha ao criar proposta:', error);
      toast.error(messageFromError(error, 'Não foi possível criar a proposta.'));
    } finally {
      setActionId(null);
    }
  };

  const reviewCreative = async (event: FormEvent) => {
    event.preventDefault();
    if (!reviewDialog) return;
    const reason = reviewReason.trim();
    if (!reviewDialog.approved && reason.length < 5) {
      toast.error('Explique o ajuste necessário com pelo menos 5 caracteres.');
      return;
    }
    setActionId(reviewDialog.creative.id);
    try {
      const { error } = await supabase.rpc('gsa_admin_review_ad_creative', {
        p_creative_id: reviewDialog.creative.id,
        p_approved: reviewDialog.approved,
        p_reason: reviewDialog.approved ? null : reason,
      });
      if (error) throw error;
      toast.success(reviewDialog.approved ? 'Criativo aprovado.' : 'Criativo devolvido para correção.');
      setReviewDialog(null);
      setReviewReason('');
      await load();
    } catch (error) {
      console.error('Falha ao analisar criativo:', error);
      toast.error(messageFromError(error, 'Não foi possível analisar o criativo.'));
    } finally {
      setActionId(null);
    }
  };

  const openPaymentAction = (payment: AdvertisingPayment, nextStatus: AdvertisingPaymentStatus) => {
    setPaymentDialog({ payment, status: nextStatus });
    setPaymentReference(payment.provider_reference || (nextStatus === 'paid' ? `MANUAL-${Date.now()}` : ''));
    setPaymentMethod(payment.payment_method || 'manual');
  };

  const markPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!paymentDialog) return;
    const reference = paymentReference.trim();
    if (paymentDialog.status === 'paid' && !reference) {
      toast.error('Informe a referência ou o comprovante do pagamento.');
      return;
    }
    setActionId(paymentDialog.payment.id);
    try {
      const { error } = await supabase.rpc('gsa_admin_mark_ad_payment', {
        p_payment_id: paymentDialog.payment.id,
        p_status: paymentDialog.status,
        p_provider_reference: reference || paymentDialog.payment.provider_reference || null,
        p_payment_method: paymentDialog.status === 'paid' ? paymentMethod.trim() || 'manual' : paymentDialog.payment.payment_method,
      });
      if (error) throw error;
      toast.success(`Pagamento atualizado para ${PAYMENT_LABELS[paymentDialog.status]}.`);
      setPaymentDialog(null);
      await load();
    } catch (error) {
      console.error('Falha ao atualizar pagamento:', error);
      toast.error(messageFromError(error, 'Não foi possível atualizar o pagamento.'));
    } finally {
      setActionId(null);
    }
  };

  const openPaymentConfiguration = (payment: AdvertisingPayment) => {
    setPaymentConfiguration(payment);
    setConfigurationProvider(payment.provider || 'manual');
    setConfigurationReference(payment.provider_reference || '');
    setConfigurationCheckoutUrl(payment.checkout_url || '');
    setConfigurationPixCode(payment.pix_code || '');
    setConfigurationDueAt(toDateTimeLocal(payment.due_at));
  };

  const configurePayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!paymentConfiguration) return;
    const provider = configurationProvider.trim().toLowerCase();
    const reference = configurationReference.trim();
    const checkoutUrl = configurationCheckoutUrl.trim();
    const pixCode = configurationPixCode.trim();
    if (!provider || !reference) {
      toast.error('Informe o provedor e a referência da cobrança.');
      return;
    }
    if (!checkoutUrl && !pixCode) {
      toast.error('Informe uma URL de checkout HTTPS ou um código PIX.');
      return;
    }
    if (checkoutUrl && !safeHttpsUrl(checkoutUrl)) {
      toast.error('A URL de checkout deve ser HTTPS e válida.');
      return;
    }
    const dueAt = new Date(configurationDueAt);
    if (Number.isNaN(dueAt.getTime())) {
      toast.error('Informe um vencimento válido.');
      return;
    }
    setActionId(paymentConfiguration.id);
    try {
      const { data, error } = await supabase.rpc('gsa_admin_configure_ad_payment', {
        p_payment_id: paymentConfiguration.id,
        p_provider: provider,
        p_provider_reference: reference,
        p_checkout_url: checkoutUrl || null,
        p_pix_code: pixCode || null,
        p_due_at: dueAt.toISOString(),
      });
      if (error || data?.success === false) throw error || new Error('A configuração foi recusada pelo servidor.');
      toast.success('Cobrança configurada e pronta para conciliação.');
      setPaymentConfiguration(null);
      await load();
    } catch (error) {
      console.error('Falha ao configurar cobrança:', error);
      toast.error(messageFromError(error, 'Não foi possível configurar a cobrança.'));
    } finally {
      setActionId(null);
    }
  };

  const openPlacement = (placement: AdvertisingPlacement) => {
    setPlacementDialog(placement);
    setPlacementActive(placement.active);
    setPlacementCapacity(String(placement.capacity));
    setPlacementExclusive(placement.exclusive);
    setPlacementPrice(String(placement.base_daily_price));
    setPlacementDevices(placement.devices || []);
  };

  const updatePlacement = async (event: FormEvent) => {
    event.preventDefault();
    if (!placementDialog) return;
    const capacity = Number(placementCapacity);
    const baseDailyPrice = Number(placementPrice);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) {
      toast.error('A capacidade deve ser um número inteiro entre 1 e 1.000.');
      return;
    }
    if (!Number.isFinite(baseDailyPrice) || baseDailyPrice < 0) {
      toast.error('Informe um preço diário válido.');
      return;
    }
    if (placementDevices.length === 0) {
      toast.error('Selecione pelo menos um dispositivo.');
      return;
    }
    setActionId(placementDialog.id);
    try {
      const { data, error } = await supabase.rpc('gsa_admin_update_ad_placement', {
        p_placement_id: placementDialog.id,
        p_payload: {
          active: placementActive,
          capacity,
          exclusive: placementExclusive,
          base_daily_price: baseDailyPrice,
          devices: placementDevices,
        },
      });
      if (error || data?.success === false) throw error || new Error('A configuração foi recusada pelo servidor.');
      toast.success('Posição publicitária atualizada.');
      setPlacementDialog(null);
      await load();
    } catch (error) {
      console.error('Falha ao atualizar posição:', error);
      toast.error(messageFromError(error, 'Não foi possível atualizar a posição.'));
    } finally {
      setActionId(null);
    }
  };

  const updateProposalAction = async (event: FormEvent) => {
    event.preventDefault();
    if (!proposalAction) return;
    const message = proposalActionMessage.trim();
    if (message.length < 3) {
      toast.error('Registre uma justificativa com pelo menos 3 caracteres.');
      return;
    }
    setActionId(proposalAction.proposal.id);
    try {
      const { data, error } = await supabase.rpc('gsa_admin_update_ad_proposal_status', {
        p_proposal_id: proposalAction.proposal.id,
        p_status: proposalAction.status,
        p_message: message,
      });
      if (error || data?.success === false) throw error || new Error('A operação foi recusada pelo servidor.');
      toast.success(`Proposta atualizada para ${PROPOSAL_LABELS[proposalAction.status]}.`);
      setProposalAction(null);
      setProposalActionMessage('');
      await load();
    } catch (error) {
      console.error('Falha ao atualizar proposta:', error);
      toast.error(messageFromError(error, 'Não foi possível atualizar a proposta.'));
    } finally {
      setActionId(null);
    }
  };

  const updateCampaignAction = async () => {
    if (!campaignAction) return;
    setActionId(campaignAction.campaign.id);
    try {
      const { data, error } = await supabase.rpc('gsa_admin_update_ad_campaign_status', {
        p_campaign_id: campaignAction.campaign.id,
        p_status: campaignAction.status,
      });
      if (error || data?.success === false) throw error || new Error('A operação foi recusada pelo servidor.');
      toast.success(`Campanha atualizada para ${CAMPAIGN_LABELS[campaignAction.status]}.`);
      setCampaignAction(null);
      await load();
    } catch (error) {
      console.error('Falha ao atualizar campanha:', error);
      toast.error(messageFromError(error, 'Não foi possível atualizar a campanha.'));
    } finally {
      setActionId(null);
    }
  };

  const creativeRows = overview.campaigns.flatMap((campaign) =>
    (campaign.creatives || []).map((creative) => ({ campaign, creative })),
  );
  const paymentRows = overview.campaigns
    .filter((campaign) => campaign.payment)
    .map((campaign) => ({ campaign, payment: campaign.payment! }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-amber-600"><Megaphone className="h-4 w-4" /> GSA Anúncios</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-neutral-950">Operação publicitária</h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-500">Da solicitação à entrega: proposta, portal, pagamento, criativos, agenda e resultados.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Atualizar operação publicitária" className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold text-neutral-700 shadow-sm hover:bg-neutral-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard icon={Megaphone} label="Solicitações" value={summary.requests} />
        <SummaryCard icon={MessageSquareText} label="Propostas pendentes" value={summary.proposals} />
        <SummaryCard icon={ShieldCheck} label="Campanhas ativas" value={summary.active} />
        <SummaryCard icon={CircleDollarSign} label="Receita confirmada" value={currency(summary.revenue)} />
        <SummaryCard icon={BarChart3} label="Entregas" value={summary.served} />
      </div>

      <div role="tablist" aria-label="Seções do módulo de anúncios" className="flex gap-2 overflow-x-auto rounded-2xl border border-neutral-200 bg-white p-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black ${tab === id ? 'bg-neutral-950 text-white' : 'text-neutral-500 hover:bg-neutral-50'}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-3xl border border-neutral-200 bg-white p-16 text-center text-sm font-semibold text-neutral-500" role="status">Carregando operação...</div>
      ) : (
        <>
          {tab === 'requests' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 md:flex-row">
                <label className="relative flex-1">
                  <span className="sr-only">Buscar solicitações</span>
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empresa, protocolo, contato ou segmento" className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-amber-400" />
                </label>
                <label>
                  <span className="sr-only">Filtrar por status</span>
                  <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold">
                    <option value="all">Todos os status</option>
                    {Object.entries(REQUEST_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </label>
              </div>
              {filteredRequests.length === 0 ? <Empty text="Nenhuma solicitação encontrada." /> : filteredRequests.slice(0, visibleCount).map((request) => {
                const proposal = overview.proposals.find((item) => item.request_id === request.id);
                return <RequestCard key={request.id} request={request} proposal={proposal} busy={actionId === request.id} onStatus={updateStatus} onProposal={openProposal} onInvite={inviteAdvertiser} />;
              })}
              <LoadMore shown={Math.min(visibleCount, filteredRequests.length)} total={filteredRequests.length} onMore={() => setVisibleCount((count) => count + PAGE_SIZE)} />
            </div>
          )}

          {tab === 'proposals' && (overview.proposals.length === 0 ? <Empty text="Nenhuma proposta criada." /> : (
            <div className="space-y-4">
              {overview.proposals.slice(0, visibleCount).map((proposal) => (
                <ProposalRow
                  key={proposal.id}
                  proposal={proposal}
                  request={overview.requests.find((request) => request.id === proposal.request_id)}
                  busy={actionId === proposal.id}
                  onEdit={(request) => request && openProposal(request)}
                  onInvite={() => void inviteAdvertiser(proposal.request_id)}
                  onAction={(status) => { setProposalAction({ proposal, status }); setProposalActionMessage(''); }}
                />
              ))}
              <LoadMore shown={Math.min(visibleCount, overview.proposals.length)} total={overview.proposals.length} onMore={() => setVisibleCount((count) => count + PAGE_SIZE)} />
            </div>
          ))}

          {tab === 'campaigns' && (overview.campaigns.length === 0 ? <Empty text="Nenhuma campanha criada." /> : (
            <div className="grid gap-4 xl:grid-cols-2">
              {overview.campaigns.slice(0, visibleCount).map((campaign) => <CampaignRow key={campaign.id} campaign={campaign} busy={actionId === campaign.id} onAction={(status) => setCampaignAction({ campaign, status })} />)}
              <div className="xl:col-span-2"><LoadMore shown={Math.min(visibleCount, overview.campaigns.length)} total={overview.campaigns.length} onMore={() => setVisibleCount((count) => count + PAGE_SIZE)} /></div>
            </div>
          ))}

          {tab === 'creatives' && (creativeRows.length === 0 ? <Empty text="Nenhum criativo enviado." /> : (
            <div className="space-y-4">
              {creativeRows.slice(0, visibleCount).map(({ campaign, creative }) => (
                <CreativeReviewRow key={creative.id} campaign={campaign} creative={creative} busy={actionId === creative.id} onReview={(approved) => { setReviewDialog({ creative, approved }); setReviewReason(''); }} />
              ))}
              <LoadMore shown={Math.min(visibleCount, creativeRows.length)} total={creativeRows.length} onMore={() => setVisibleCount((count) => count + PAGE_SIZE)} />
            </div>
          ))}

          {tab === 'payments' && (paymentRows.length === 0 ? <Empty text="Nenhuma cobrança criada." /> : (
            <div className="space-y-4">
              {paymentRows.slice(0, visibleCount).map(({ campaign, payment }) => <PaymentRow key={payment.id} campaign={campaign} payment={payment} busy={actionId === payment.id} onMark={(nextStatus) => openPaymentAction(payment, nextStatus)} onConfigure={() => openPaymentConfiguration(payment)} />)}
              <LoadMore shown={Math.min(visibleCount, paymentRows.length)} total={paymentRows.length} onMore={() => setVisibleCount((count) => count + PAGE_SIZE)} />
            </div>
          ))}

          {tab === 'inventory' && (
            <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-400"><tr><th className="px-5 py-4">Código</th><th className="px-5 py-4">Posição</th><th className="px-5 py-4">Módulo</th><th className="px-5 py-4">Formato</th><th className="px-5 py-4">Capacidade</th><th className="px-5 py-4">Diária</th><th className="px-5 py-4">Status</th><th className="px-5 py-4"><span className="sr-only">Ações</span></th></tr></thead>
                  <tbody className="divide-y divide-neutral-100">{overview.placements.map((placement) => <tr key={placement.id}><td className="px-5 py-4 font-black">{placement.code}</td><td className="px-5 py-4">{placement.name}</td><td className="px-5 py-4">{placement.module}</td><td className="px-5 py-4">{placement.format}</td><td className="px-5 py-4">{placement.capacity}{placement.exclusive ? ' (exclusiva)' : ''}</td><td className="px-5 py-4">{currency(placement.base_daily_price)}</td><td className="px-5 py-4">{placement.active ? 'Ativa' : 'Inativa'}</td><td className="px-5 py-4"><button type="button" disabled={actionId === placement.id} onClick={() => openPlacement(placement)} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-black hover:bg-neutral-50">Gerenciar</button></td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {proposalRequest && (
        <AccessibleModal title={`Proposta para ${proposalRequest.company_name}`} description={`Solicitação ${proposalRequest.protocol}`} onClose={() => setProposalRequest(null)}>
          <form onSubmit={createProposal}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor"><input required type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="form-control" /></Field>
              <Field label="Válida até"><input required type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} className="form-control" /></Field>
              <Field label="Início"><input required type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} className="form-control" /></Field>
              <Field label="Término"><input required type="date" min={startsOn} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} className="form-control" /></Field>
              <Field label="Frequência"><select value={frequencyModel} onChange={(event) => setFrequencyModel(event.target.value)} className="form-control"><option value="once_per_session">Uma vez por sessão</option><option value="once_per_day">Uma vez por dia</option><option value="interval_hours">Intervalo em horas</option><option value="daily_limit">Limite diário</option><option value="unlimited">Sem limite por visitante</option></select></Field>
              <Field label="Valor da frequência"><input type="number" min="1" disabled={frequencyModel === 'unlimited'} value={frequencyValue} onChange={(event) => setFrequencyValue(event.target.value)} className="form-control disabled:bg-neutral-100" /></Field>
              <Field label="Limite total de impressões" className="sm:col-span-2"><input type="number" min="1" value={impressionLimit} onChange={(event) => setImpressionLimit(event.target.value)} placeholder="Sem limite" className="form-control" /></Field>
              <Field label="Termos" className="sm:col-span-2"><textarea required minLength={10} rows={4} value={terms} onChange={(event) => setTerms(event.target.value)} className="form-control" /></Field>
            </div>
            {overview.proposals.find((item) => item.request_id === proposalRequest.id)?.status === 'negotiating' && (
              <label className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
                <input type="checkbox" checked={finalOffer} onChange={(event) => setFinalOffer(event.target.checked)} className="mt-0.5 h-4 w-4" />
                Marcar esta versão como oferta final. O anunciante ainda poderá aceitar ou recusar, mas não enviar outra contraproposta.
              </label>
            )}
            <div className="mt-5 rounded-2xl bg-neutral-50 p-4 text-sm"><p className="font-black">Posições incluídas</p><p className="mt-1 break-words text-neutral-500">{proposalRequest.desired_pages.join(', ') || 'Nenhuma'}</p><p className="mt-3 font-black">Formatos</p><p className="mt-1 break-words text-neutral-500">{proposalRequest.desired_formats.join(', ') || 'Nenhum'}</p></div>
            <ModalActions onCancel={() => setProposalRequest(null)} busy={actionId === proposalRequest.id} submitLabel={finalOffer ? 'Enviar oferta final' : 'Criar e enviar proposta'} busyLabel="Criando..." />
          </form>
        </AccessibleModal>
      )}

      {reviewDialog && (
        <AccessibleModal title={reviewDialog.approved ? 'Aprovar criativo' : 'Solicitar correção'} description="Confira todo o material e o destino antes de concluir a revisão." onClose={() => setReviewDialog(null)}>
          <form onSubmit={reviewCreative}>
            <CreativePreview creative={reviewDialog.creative} />
            {!reviewDialog.approved && <Field label="Motivo da reprovação" className="mt-5"><textarea autoFocus required minLength={5} maxLength={1000} rows={4} value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} placeholder="Explique de forma objetiva o que precisa ser corrigido." className="form-control" /></Field>}
            {reviewDialog.approved && <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Ao aprovar, esta versão do arquivo e seus textos ficam liberados para veiculação.</p>}
            <ModalActions onCancel={() => setReviewDialog(null)} busy={actionId === reviewDialog.creative.id} submitLabel={reviewDialog.approved ? 'Confirmar aprovação' : 'Devolver para correção'} busyLabel="Salvando..." destructive={!reviewDialog.approved} />
          </form>
        </AccessibleModal>
      )}

      {paymentDialog && (
        <AccessibleModal title={`Atualizar pagamento para ${PAYMENT_LABELS[paymentDialog.status]}`} description={`${currency(paymentDialog.payment.amount)} · vencimento ${formatDate(paymentDialog.payment.due_at)}`} onClose={() => setPaymentDialog(null)}>
          <form onSubmit={markPayment}>
            {paymentDialog.status === 'paid' && <div className="grid gap-4 sm:grid-cols-2"><Field label="Referência ou comprovante"><input autoFocus required maxLength={200} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} className="form-control" /></Field><Field label="Meio de pagamento"><input required maxLength={80} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="form-control" /></Field></div>}
            {paymentDialog.status !== 'paid' && <p className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">Confirme somente se o novo estado corresponde à situação registrada no provedor financeiro.</p>}
            <ModalActions onCancel={() => setPaymentDialog(null)} busy={actionId === paymentDialog.payment.id} submitLabel="Confirmar alteração" busyLabel="Salvando..." destructive={['failed', 'refunded', 'cancelled'].includes(paymentDialog.status)} />
          </form>
        </AccessibleModal>
      )}

      {paymentConfiguration && (
        <AccessibleModal title="Configurar cobrança" description={`${currency(paymentConfiguration.amount)} · vincule uma referência conciliável pelo webhook`} onClose={() => setPaymentConfiguration(null)}>
          <form onSubmit={configurePayment}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Provedor"><input autoFocus required maxLength={80} value={configurationProvider} onChange={(event) => setConfigurationProvider(event.target.value)} placeholder="asaas, mercadopago, manual..." className="form-control" /></Field>
              <Field label="Referência no provedor"><input required maxLength={200} value={configurationReference} onChange={(event) => setConfigurationReference(event.target.value)} className="form-control" /></Field>
              <Field label="Vencimento" className="sm:col-span-2"><input required type="datetime-local" value={configurationDueAt} onChange={(event) => setConfigurationDueAt(event.target.value)} className="form-control" /></Field>
              <Field label="URL de checkout HTTPS" className="sm:col-span-2"><input type="url" inputMode="url" maxLength={2048} value={configurationCheckoutUrl} onChange={(event) => setConfigurationCheckoutUrl(event.target.value)} placeholder="https://..." className="form-control" /></Field>
              <Field label="PIX copia e cola" className="sm:col-span-2"><textarea rows={4} maxLength={1000} value={configurationPixCode} onChange={(event) => setConfigurationPixCode(event.target.value)} className="form-control" /></Field>
            </div>
            <p className="mt-4 rounded-2xl bg-neutral-50 p-4 text-xs font-semibold text-neutral-600">Informe ao menos uma forma de pagamento: checkout HTTPS ou PIX. A referência deve ser exatamente a mesma enviada pelo provedor nos eventos financeiros.</p>
            <ModalActions onCancel={() => setPaymentConfiguration(null)} busy={actionId === paymentConfiguration.id} submitLabel="Salvar configuração" busyLabel="Salvando..." />
          </form>
        </AccessibleModal>
      )}

      {placementDialog && (
        <AccessibleModal title="Gerenciar posição publicitária" description={`${placementDialog.code} · ${placementDialog.name}`} onClose={() => setPlacementDialog(null)}>
          <form onSubmit={updatePlacement}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Capacidade"><input autoFocus required type="number" min="1" max="1000" step="1" value={placementCapacity} onChange={(event) => setPlacementCapacity(event.target.value)} className="form-control" /></Field>
              <Field label="Preço base diário"><input required type="number" min="0" step="0.01" value={placementPrice} onChange={(event) => setPlacementPrice(event.target.value)} className="form-control" /></Field>
            </div>
            <fieldset className="mt-5 rounded-2xl border border-neutral-200 p-4"><legend className="px-1 text-sm font-black">Dispositivos</legend><div className="mt-2 flex flex-wrap gap-4">{['desktop', 'tablet', 'mobile'].map((device) => <label key={device} className="inline-flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={placementDevices.includes(device)} onChange={(event) => setPlacementDevices((current) => event.target.checked ? [...new Set([...current, device])] : current.filter((item) => item !== device))} className="h-4 w-4" /> {device === 'desktop' ? 'Computador' : device === 'tablet' ? 'Tablet' : 'Celular'}</label>)}</div></fieldset>
            <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-4 text-sm font-bold"><input type="checkbox" checked={placementActive} onChange={(event) => setPlacementActive(event.target.checked)} className="mt-0.5 h-4 w-4" /><span>Posição ativa<span className="mt-1 block text-xs font-normal text-neutral-500">Pode ser incluída em novas propostas.</span></span></label><label className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-4 text-sm font-bold"><input type="checkbox" checked={placementExclusive} onChange={(event) => setPlacementExclusive(event.target.checked)} className="mt-0.5 h-4 w-4" /><span>Inventário exclusivo<span className="mt-1 block text-xs font-normal text-neutral-500">Não permite campanhas concorrentes no mesmo período.</span></span></label></div>
            <ModalActions onCancel={() => setPlacementDialog(null)} busy={actionId === placementDialog.id} submitLabel="Salvar posição" busyLabel="Salvando..." />
          </form>
        </AccessibleModal>
      )}

      {proposalAction && (
        <AccessibleModal title={`${PROPOSAL_LABELS[proposalAction.status]} proposta`} description={`${proposalAction.proposal.company_name || 'Anunciante'} · versão ${proposalAction.proposal.current_version}`} onClose={() => setProposalAction(null)}>
          <form onSubmit={updateProposalAction}>
            <Field label={proposalAction.status === 'final_offer' ? 'Mensagem da oferta final' : 'Justificativa'}><textarea autoFocus required minLength={3} maxLength={1000} rows={4} value={proposalActionMessage} onChange={(event) => setProposalActionMessage(event.target.value)} className="form-control" /></Field>
            <ModalActions onCancel={() => setProposalAction(null)} busy={actionId === proposalAction.proposal.id} submitLabel="Confirmar" busyLabel="Salvando..." destructive={proposalAction.status !== 'final_offer'} />
          </form>
        </AccessibleModal>
      )}

      {campaignAction && (
        <AccessibleModal title={`${CAMPAIGN_LABELS[campaignAction.status]} campanha`} description={campaignAction.campaign.name} onClose={() => setCampaignAction(null)}>
          <p className={`rounded-2xl p-4 text-sm font-semibold ${campaignAction.status === 'cancelled' ? 'bg-red-50 text-red-800' : 'bg-neutral-50 text-neutral-700'}`}>{campaignAction.status === 'cancelled' ? 'O cancelamento interrompe a veiculação e é uma ação terminal.' : 'A alteração será registrada no histórico operacional.'}</p>
          <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setCampaignAction(null)} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-bold">Voltar</button><button type="button" onClick={() => void updateCampaignAction()} disabled={actionId === campaignAction.campaign.id} className={`rounded-xl px-5 py-2.5 text-sm font-black text-white disabled:opacity-60 ${campaignAction.status === 'cancelled' ? 'bg-red-600' : 'bg-neutral-950'}`}>{actionId === campaignAction.campaign.id ? 'Salvando...' : 'Confirmar'}</button></div>
        </AccessibleModal>
      )}
    </div>
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
    const frame = window.requestAnimationFrame(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>('[autofocus], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]');
      first?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')) as HTMLElement[];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div><h2 id={titleId} className="text-2xl font-black">{title}</h2>{description && <p id={descriptionId} className="mt-2 text-sm text-neutral-500">{description}</p>}</div><button type="button" onClick={onClose} aria-label="Fechar diálogo" className="shrink-0 rounded-full p-2 hover:bg-neutral-100"><X className="h-5 w-5" /></button></div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Megaphone; label: string; value: number | string }) {
  return <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-amber-600" /><p className="mt-4 text-xs font-bold uppercase tracking-wider text-neutral-400">{label}</p><p className="mt-1 truncate text-xl font-black">{value}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-14 text-center text-sm font-semibold text-neutral-400">{text}</div>;
}

function LoadMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  if (total <= shown) return null;
  return <div className="flex items-center justify-center gap-3 pt-2"><span className="text-xs font-semibold text-neutral-500">Exibindo {shown} de {total}</span><button type="button" onClick={onMore} className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-black hover:bg-neutral-50">Mostrar mais</button></div>;
}

function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={`block text-sm font-bold ${className}`}>{label}<div className="mt-2 [&_.form-control]:w-full [&_.form-control]:rounded-xl [&_.form-control]:border [&_.form-control]:border-neutral-200 [&_.form-control]:px-4 [&_.form-control]:py-3 [&_.form-control]:outline-none [&_.form-control]:focus:border-amber-400 [&_.form-control]:focus:ring-2 [&_.form-control]:focus:ring-amber-100">{children}</div></label>;
}

function ModalActions({ onCancel, busy, submitLabel, busyLabel, destructive = false }: { onCancel: () => void; busy: boolean; submitLabel: string; busyLabel: string; destructive?: boolean }) {
  return <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-bold">Cancelar</button><button type="submit" disabled={busy} className={`rounded-xl px-5 py-2.5 text-sm font-black text-white disabled:opacity-60 ${destructive ? 'bg-red-600 hover:bg-red-500' : 'bg-neutral-950 hover:bg-neutral-800'}`}>{busy ? busyLabel : submitLabel}</button></div>;
}

function RequestCard({ request, proposal, busy, onStatus, onProposal, onInvite }: { key?: string; request: AdvertisingRequest; proposal?: AdvertisingProposal; busy: boolean; onStatus: (id: string, status: AdvertisingRequestStatus) => Promise<void>; onProposal: (request: AdvertisingRequest) => void; onInvite: (id: string) => Promise<boolean> }) {
  const requestClosed = ['accepted', 'rejected', 'cancelled'].includes(request.status);
  const proposalClosed = proposal ? TERMINAL_PROPOSAL_STATUSES.includes(proposal.status) : false;
  const canPropose = !requestClosed && !proposalClosed;
  return (
    <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row"><div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">{request.protocol}</span><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">{REQUEST_LABELS[request.status]}</span></div><h2 className="mt-3 text-xl font-black">{request.company_name}</h2><p className="mt-1 break-words text-sm text-neutral-500">{request.segment} · {request.contact_name} · {request.contact_email}</p></div><div className="rounded-2xl bg-neutral-950 px-5 py-4 text-white"><p className="text-xs uppercase tracking-wider text-white/45">Orçamento pretendido</p><p className="mt-1 text-xl font-black text-amber-300">{currency(request.intended_budget)}</p></div></div>
      <div className="mt-5 grid gap-3 md:grid-cols-3"><Info icon={BadgeDollarSign} label="Objetivo" value={request.objective} /><Info icon={CalendarClock} label="Período" value={`${formatDate(request.desired_start_date)} a ${formatDate(request.desired_end_date)}`} /><Info icon={CheckCircle2} label="Criativo" value={request.needs_creative_service ? 'Produção pela GSA' : 'Fornecido pelo anunciante'} /></div>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-neutral-100 pt-5">
        {canPropose && <button type="button" onClick={() => onProposal(request)} className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-black text-white">{proposal ? 'Nova versão da proposta' : 'Criar proposta'}</button>}
        {proposal && <button type="button" onClick={() => void onInvite(request.id)} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 px-4 py-2 text-xs font-black text-amber-700"><MailPlus className="h-3.5 w-3.5" /> Liberar portal</button>}
        {request.status === 'submitted' && <button type="button" disabled={busy} onClick={() => void onStatus(request.id, 'under_review')} className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-black">Iniciar análise</button>}
        {!requestClosed && <button type="button" disabled={busy} onClick={() => void onStatus(request.id, 'rejected')} className="rounded-full border border-red-200 px-4 py-2 text-xs font-black text-red-700">Recusar solicitação</button>}
        {proposalClosed && <span className="self-center text-xs font-semibold text-neutral-500">Proposta encerrada: {PROPOSAL_LABELS[proposal!.status]}</span>}
      </div>
    </article>
  );
}

function ProposalRow({ proposal, request, busy, onEdit, onInvite, onAction }: { key?: string; proposal: AdvertisingProposal; request?: AdvertisingRequest; busy: boolean; onEdit: (request?: AdvertisingRequest) => void; onInvite: () => void; onAction: (status: ProposalActionStatus) => void }) {
  const editable = EDITABLE_PROPOSAL_STATUSES.includes(proposal.status);
  const actionable = ['draft', 'sent', 'negotiating', 'final_offer'].includes(proposal.status);
  return (
    <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row"><div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-black text-neutral-700">{PROPOSAL_LABELS[proposal.status]}</span><h2 className="mt-3 text-xl font-black">{proposal.company_name || request?.company_name || 'Anunciante'} · versão {proposal.current_version}</h2><p className="mt-1 text-sm text-neutral-500">Válida até {formatDate(proposal.valid_until)} · {proposal.version?.duration_days || 0} dias</p></div><p className="text-2xl font-black text-amber-700">{currency(proposal.total_amount)}</p></div>
      {proposal.version?.terms && <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600">{proposal.version.terms}</p>}
      {!!proposal.negotiations?.length && <div className="mt-4 border-t border-neutral-100 pt-4"><p className="text-xs font-black uppercase tracking-wider text-neutral-400">Histórico da negociação</p><div className="mt-3 space-y-2">{proposal.negotiations.map((item) => <div key={item.id} className={`rounded-xl p-3 text-sm ${item.actor_type === 'advertiser' ? 'bg-amber-50' : 'bg-neutral-50'}`}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black">{item.actor_type === 'advertiser' ? 'Anunciante' : 'Equipe GSA'}{item.proposed_amount ? ` · ${currency(item.proposed_amount)}` : ''}</p><time className="text-xs text-neutral-400">{formatDateTime(item.created_at)}</time></div><p className="mt-1 whitespace-pre-wrap text-neutral-600">{item.message}</p></div>)}</div></div>}
      <div className="mt-5 flex flex-wrap gap-2">
        {editable && <button type="button" disabled={busy} onClick={() => onEdit(request)} className="rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-black text-white">{proposal.status === 'negotiating' ? 'Responder contraproposta' : 'Criar nova versão'}</button>}
        <button type="button" disabled={busy} onClick={onInvite} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-xs font-black">Reenviar acesso ao portal</button>
        {['sent', 'negotiating'].includes(proposal.status) && <button type="button" disabled={busy} onClick={() => onAction('final_offer')} className="rounded-xl border border-amber-300 px-4 py-2.5 text-xs font-black text-amber-800">Marcar oferta final</button>}
        {actionable && <button type="button" disabled={busy} onClick={() => onAction('rejected')} className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-black text-red-700">Recusar</button>}
        {actionable && <button type="button" disabled={busy} onClick={() => onAction('cancelled')} className="rounded-xl border border-neutral-300 px-4 py-2.5 text-xs font-black text-neutral-600">Cancelar</button>}
      </div>
    </article>
  );
}

function CampaignRow({ campaign, busy, onAction }: { key?: string; campaign: AdvertisingCampaign; busy: boolean; onAction: (status: AdvertisingCampaignStatus) => void }) {
  const totals = (campaign.metrics || []).reduce((acc, row) => ({ served: acc.served + Number(row.served || 0), clicks: acc.clicks + Number(row.clicks || 0) }), { served: 0, clicks: 0 });
  const terminal = ['completed', 'cancelled'].includes(campaign.status);
  return (
    <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-black text-neutral-700">{CAMPAIGN_LABELS[campaign.status]}</span><h2 className="mt-3 text-xl font-black">{campaign.name}</h2><p className="mt-1 text-sm text-neutral-500">{campaign.advertiser_name}</p></div><Megaphone className="h-6 w-6 text-amber-600" /></div>
      <div className="mt-5 grid grid-cols-2 gap-3"><Mini label="Início" value={formatDate(campaign.starts_at)} /><Mini label="Término" value={formatDate(campaign.ends_at)} /><Mini label="Entregas" value={totals.served} /><Mini label="Cliques" value={totals.clicks} /></div>
      {!terminal && <div className="mt-5 flex flex-wrap gap-2 border-t border-neutral-100 pt-5">{campaign.status === 'paused' ? <button type="button" disabled={busy} onClick={() => onAction('active')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white"><Play className="h-3.5 w-3.5" /> Retomar</button> : <button type="button" disabled={busy} onClick={() => onAction('paused')} className="inline-flex items-center gap-2 rounded-xl border border-amber-300 px-4 py-2.5 text-xs font-black text-amber-800"><Pause className="h-3.5 w-3.5" /> Pausar</button>}<button type="button" disabled={busy} onClick={() => onAction('cancelled')} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-xs font-black text-red-700"><XCircle className="h-3.5 w-3.5" /> Cancelar</button></div>}
    </article>
  );
}

function useCreativeAssetUrl(creative: AdvertisingCreative) {
  const [assetUrl, setAssetUrl] = useState<string | null>(() => safeHttpsUrl(creative.asset_url));
  const [assetError, setAssetError] = useState(false);
  useEffect(() => {
    let active = true;
    setAssetError(false);
    const supplied = safeHttpsUrl(creative.asset_url);
    if (supplied) { setAssetUrl(supplied); return () => { active = false; }; }
    if (!creative.storage_path || creative.kind === 'text') { setAssetUrl(null); return () => { active = false; }; }
    void supabase.storage.from('gsa-ad-creatives').createSignedUrl(creative.storage_path, 600).then(({ data, error }) => {
      if (!active) return;
      if (error || !data?.signedUrl) { setAssetUrl(null); setAssetError(true); return; }
      setAssetUrl(safeHttpsUrl(data.signedUrl));
    });
    return () => { active = false; };
  }, [creative.asset_url, creative.kind, creative.storage_path]);
  return { assetUrl, assetError };
}

function CreativePreview({ creative }: { creative: AdvertisingCreative }) {
  const { assetUrl, assetError } = useCreativeAssetUrl(creative);
  const targetUrl = safeHttpsUrl(creative.target_url);
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-950">
        {creative.kind === 'image' && assetUrl && <img src={assetUrl} alt={creative.alt_text || 'Prévia do criativo sem descrição fornecida'} className="max-h-[28rem] w-full object-contain" />}
        {creative.kind === 'video' && assetUrl && <video src={assetUrl} controls preload="metadata" className="max-h-[28rem] w-full" aria-label={creative.alt_text || creative.headline || 'Prévia do criativo em vídeo'} />}
        {creative.kind === 'text' && <div className="bg-white p-6"><p className="text-xl font-black">{creative.headline || 'Sem título'}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">{creative.body || 'Sem texto complementar'}</p></div>}
        {creative.kind !== 'text' && !assetUrl && <div className="flex min-h-44 items-center justify-center p-6 text-center text-sm font-semibold text-white/60">{assetError ? 'Não foi possível abrir o arquivo. Não aprove sem verificar o material.' : 'Carregando prévia segura...'}</div>}
      </div>
      <dl className="grid gap-3 rounded-2xl bg-neutral-50 p-4 text-sm sm:grid-cols-2"><div><dt className="text-xs font-black uppercase tracking-wider text-neutral-400">Tipo e dimensões</dt><dd className="mt-1 font-semibold">{creative.kind}{creative.width && creative.height ? ` · ${creative.width}×${creative.height}px` : ''}{creative.duration_seconds ? ` · ${creative.duration_seconds}s` : ''}</dd></div><div><dt className="text-xs font-black uppercase tracking-wider text-neutral-400">Texto acessível</dt><dd className={`mt-1 ${creative.alt_text ? 'font-semibold' : 'font-bold text-red-600'}`}>{creative.alt_text || 'Não informado'}</dd></div>{creative.headline && <div className="sm:col-span-2"><dt className="text-xs font-black uppercase tracking-wider text-neutral-400">Título</dt><dd className="mt-1 font-semibold">{creative.headline}</dd></div>}{creative.body && <div className="sm:col-span-2"><dt className="text-xs font-black uppercase tracking-wider text-neutral-400">Texto</dt><dd className="mt-1 whitespace-pre-wrap text-neutral-700">{creative.body}</dd></div>}<div className="sm:col-span-2"><dt className="text-xs font-black uppercase tracking-wider text-neutral-400">URL de destino</dt><dd className="mt-1 break-all">{targetUrl ? <a href={targetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-blue-700 underline decoration-blue-300 underline-offset-2">{targetUrl}<ExternalLink className="h-3.5 w-3.5 shrink-0" /></a> : <span className={creative.target_url ? 'font-bold text-red-600' : 'text-neutral-500'}>{creative.target_url ? 'URL bloqueada: apenas HTTPS é permitido' : 'Sem URL de destino'}</span>}</dd></div></dl>
    </div>
  );
}

function CreativeReviewRow({ campaign, creative, busy, onReview }: { key?: string; campaign: AdvertisingCampaign; creative: AdvertisingCreative; busy: boolean; onReview: (approved: boolean) => void }) {
  return <article className="rounded-2xl border border-neutral-200 bg-white p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{campaign.name}</p><p className="mt-1 break-words font-black">{creative.headline || creative.storage_path || 'Criativo textual'}</p><p className="mt-1 text-sm text-neutral-500">{creative.kind} · {creative.status}</p>{creative.rejection_reason && <p className="mt-2 text-sm text-red-600">{creative.rejection_reason}</p>}</div>{creative.status === 'pending_review' && <div className="flex shrink-0 gap-2"><button type="button" disabled={busy} onClick={() => onReview(true)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-60">Revisar e aprovar</button><button type="button" disabled={busy} onClick={() => onReview(false)} className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-black text-red-700 disabled:opacity-60">Revisar e reprovar</button></div>}</div><div className="mt-4"><CreativePreview creative={creative} /></div></article>;
}

function PaymentRow({ campaign, payment, busy, onMark, onConfigure }: { key?: string; campaign: AdvertisingCampaign; payment: AdvertisingPayment; busy: boolean; onMark: (status: AdvertisingPaymentStatus) => void; onConfigure: () => void }) {
  return (
    <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{campaign.name}</p><h2 className="mt-2 text-2xl font-black">{currency(payment.amount)}</h2><p className="mt-1 text-sm text-neutral-500">{PAYMENT_LABELS[payment.status]} · vencimento {formatDate(payment.due_at)}</p>{payment.provider_reference && <p className="mt-1 break-all text-xs text-neutral-400">Referência: {payment.provider_reference}</p>}</div><CircleDollarSign className={`h-9 w-9 ${payment.status === 'paid' ? 'text-emerald-600' : payment.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`} /></div>
      <div className="mt-5 flex flex-wrap gap-2">{['pending', 'processing', 'failed'].includes(payment.status) && <button type="button" disabled={busy} onClick={onConfigure} className="rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-black text-white">Configurar cobrança</button>}{payment.status === 'pending' && <button type="button" disabled={busy} onClick={() => onMark('processing')} className="rounded-xl border border-amber-300 px-4 py-2.5 text-xs font-black text-amber-800">Marcar em processamento</button>}{['pending', 'processing', 'failed'].includes(payment.status) && <button type="button" disabled={busy} onClick={() => onMark('paid')} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white">Confirmar pagamento</button>}{payment.status === 'processing' && <button type="button" disabled={busy} onClick={() => onMark('failed')} className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-black text-red-700">Registrar falha</button>}{payment.status === 'failed' && <button type="button" disabled={busy} onClick={() => onMark('pending')} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-xs font-black">Reabrir cobrança</button>}{['pending', 'processing', 'failed'].includes(payment.status) && <button type="button" disabled={busy} onClick={() => onMark('cancelled')} className="rounded-xl border border-neutral-300 px-4 py-2.5 text-xs font-black text-neutral-600">Cancelar cobrança</button>}{payment.status === 'paid' && <button type="button" disabled={busy} onClick={() => onMark('refunded')} className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-black text-red-700">Registrar estorno</button>}</div>
    </article>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Megaphone; label: string; value: string }) {
  return <div className="flex gap-3 rounded-2xl bg-neutral-50 p-4"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div className="min-w-0"><p className="text-xs font-black uppercase tracking-wider text-neutral-400">{label}</p><p className="mt-1 break-words text-sm font-semibold text-neutral-700">{value}</p></div></div>;
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-2xl bg-neutral-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{label}</p><p className="mt-1 font-black">{value}</p></div>;
}
