import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeDollarSign, CalendarClock, CheckCircle2, CircleDollarSign, Clock3, Megaphone, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { AdvertisingRequest, AdvertisingRequestStatus } from '../../types/advertising';

const STATUS_LABELS: Record<AdvertisingRequestStatus, string> = {
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

const NEXT_ACTIONS: Array<{ status: AdvertisingRequestStatus; label: string }> = [
  { status: 'under_review', label: 'Iniciar análise' },
  { status: 'awaiting_information', label: 'Pedir informações' },
  { status: 'proposal_sent', label: 'Marcar proposta enviada' },
  { status: 'rejected', label: 'Recusar' },
];

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

export function AdvertisingAdminModule() {
  const [requests, setRequests] = useState<AdvertisingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('gsa_admin_list_ad_requests', { p_status: status === 'all' ? null : status });
      if (error) throw error;
      setRequests(Array.isArray(data) ? data as AdvertisingRequest[] : []);
    } catch (error) {
      console.error('Falha ao carregar solicitações de anúncios:', error);
      toast.error('Não foi possível carregar a fila de anúncios.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return requests;
    return requests.filter((request) => [request.protocol, request.company_name, request.segment, request.contact_name, request.contact_email]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [requests, search]);

  const summary = useMemo(() => ({
    total: requests.length,
    new: requests.filter((request) => request.status === 'submitted').length,
    review: requests.filter((request) => ['under_review', 'awaiting_information'].includes(request.status)).length,
    budget: requests.reduce((sum, request) => sum + Number(request.intended_budget || 0), 0),
  }), [requests]);

  const updateStatus = async (requestId: string, nextStatus: AdvertisingRequestStatus) => {
    setUpdatingId(requestId);
    try {
      const { error } = await supabase.rpc('gsa_admin_update_ad_request_status', { p_request_id: requestId, p_status: nextStatus });
      if (error) throw error;
      setRequests((current) => current.map((request) => request.id === requestId ? { ...request, status: nextStatus } : request));
      toast.success(`Solicitação atualizada para ${STATUS_LABELS[nextStatus]}.`);
    } catch (error) {
      console.error('Falha ao atualizar solicitação:', error);
      toast.error('Não foi possível atualizar a solicitação.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-amber-600"><Megaphone className="h-4 w-4" /> GSA Anúncios</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-neutral-950">Solicitações de publicidade</h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-500">Analise empresas, formatos, posições, período e investimento antes de criar uma proposta comercial.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold text-neutral-700 shadow-sm hover:bg-neutral-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Megaphone} label="Solicitações" value={String(summary.total)} />
        <SummaryCard icon={Clock3} label="Novas" value={String(summary.new)} />
        <SummaryCard icon={ShieldCheck} label="Em análise" value={String(summary.review)} />
        <SummaryCard icon={CircleDollarSign} label="Investimento declarado" value={currency(summary.budget)} />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 md:flex-row">
        <label className="relative flex-1"><span className="sr-only">Buscar solicitações</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-neutral-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empresa, protocolo, contato ou segmento" className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-amber-400" /></label>
        <label><span className="sr-only">Filtrar por status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none md:w-56"><option value="all">Todos os status</option>{Object.entries(STATUS_LABELS).filter(([key]) => key !== 'draft').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>

      {loading ? <div className="rounded-3xl border border-neutral-200 p-16 text-center text-sm font-semibold text-neutral-500" role="status">Carregando solicitações...</div> : filtered.length === 0 ? <div className="rounded-3xl border border-dashed border-neutral-300 p-16 text-center"><Megaphone className="mx-auto h-9 w-9 text-neutral-300" /><p className="mt-4 font-black text-neutral-700">Nenhuma solicitação encontrada</p><p className="mt-1 text-sm text-neutral-400">As solicitações públicas aparecerão aqui automaticamente.</p></div> : <div className="space-y-4">{filtered.map((request) => <article key={request.id} className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">{request.protocol}</span><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">{STATUS_LABELS[request.status]}</span></div><h2 className="mt-3 truncate text-xl font-black text-neutral-950">{request.company_name}</h2><p className="mt-1 text-sm text-neutral-500">{request.segment} · {request.company_size} · {request.contact_name}</p><p className="mt-1 text-sm text-neutral-500">{request.contact_email} · {request.contact_phone}</p></div>
          <div className="rounded-2xl bg-neutral-950 px-5 py-4 text-white lg:text-right"><p className="text-xs font-bold uppercase tracking-wider text-white/45">Investimento pretendido</p><p className="mt-1 text-xl font-black text-amber-300">{currency(request.intended_budget)}</p></div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <InfoBlock icon={BadgeDollarSign} title="Objetivo" value={request.objective} />
          <InfoBlock icon={CalendarClock} title="Período" value={`${request.desired_start_date || 'A definir'} até ${request.desired_end_date || 'A definir'}`} />
          <InfoBlock icon={CheckCircle2} title="Produção de criativo" value={request.needs_creative_service ? 'Solicitada à GSA' : 'Anunciante fornecerá'} />
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2"><div className="rounded-2xl bg-neutral-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-neutral-400">Formatos</p><div className="mt-2 flex flex-wrap gap-2">{request.desired_formats.map((item) => <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-neutral-600 ring-1 ring-neutral-200">{item}</span>)}</div></div><div className="rounded-2xl bg-neutral-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-neutral-400">Posições</p><div className="mt-2 flex flex-wrap gap-2">{request.desired_pages.map((item) => <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-neutral-600 ring-1 ring-neutral-200">{item}</span>)}</div></div></div>
        {request.notes && <div className="mt-4 rounded-2xl border border-neutral-100 p-4 text-sm leading-relaxed text-neutral-600"><strong className="text-neutral-800">Observações:</strong> {request.notes}</div>}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-neutral-100 pt-5">{NEXT_ACTIONS.filter((action) => action.status !== request.status).map((action) => <button key={action.status} onClick={() => void updateStatus(request.id, action.status)} disabled={updatingId === request.id} className={`rounded-full px-4 py-2 text-xs font-black transition disabled:opacity-50 ${action.status === 'rejected' ? 'border border-red-200 text-red-700 hover:bg-red-50' : 'bg-neutral-950 text-white hover:bg-neutral-800'}`}>{updatingId === request.id ? 'Atualizando...' : action.label}</button>)}</div>
      </article>)}</div>}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Megaphone; label: string; value: string }) {
  return <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-amber-100 p-2.5 text-amber-700"><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{label}</p><p className="mt-1 truncate text-xl font-black text-neutral-900">{value}</p></div></div></div>;
}

function InfoBlock({ icon: Icon, title, value }: { icon: typeof Megaphone; title: string; value: string }) {
  return <div className="flex gap-3 rounded-2xl border border-neutral-100 p-4"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="text-xs font-black uppercase tracking-wider text-neutral-400">{title}</p><p className="mt-1 text-sm font-semibold text-neutral-700">{value}</p></div></div>;
}
