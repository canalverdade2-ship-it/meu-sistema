import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Link2,
  Loader2,
  PackagePlus,
  Plane,
  Plus,
  Receipt,
  RefreshCcw,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { callAdminRpc } from '../../lib/adminRpc';
import { formatCurrency } from '../../lib/utils';
import { Modal } from '../ui/Modal';

type AdminTab = 'solicitacoes' | 'pacotes' | 'propostas' | 'transacoes';

interface PagedResult {
  items: any[];
  total: number;
  page: number;
  page_size: number;
}

const PAGE_SIZE = 20;
const inputClass = 'w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';
const labelClass = 'mb-2 block text-xs font-black uppercase tracking-wider text-neutral-500';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function StatusBadge({ status }: { status?: string | null }) {
  const value = String(status || 'sem_status');
  const colors: Record<string, string> = {
    recebido: 'bg-blue-100 text-blue-700',
    em_analise: 'bg-amber-100 text-amber-700',
    buscando_opcoes: 'bg-violet-100 text-violet-700',
    propostas_disponiveis: 'bg-emerald-100 text-emerald-700',
    aguardando_cliente: 'bg-orange-100 text-orange-700',
    encerrado: 'bg-neutral-100 text-neutral-700',
    cancelado: 'bg-red-100 text-red-700',
    rascunho: 'bg-neutral-100 text-neutral-700',
    publicado: 'bg-emerald-100 text-emerald-700',
    disponibilidade_sob_consulta: 'bg-sky-100 text-sky-700',
    pausado: 'bg-amber-100 text-amber-700',
    esgotado: 'bg-red-100 text-red-700',
    enviada: 'bg-blue-100 text-blue-700',
    visualizada: 'bg-sky-100 text-sky-700',
    aceita: 'bg-emerald-100 text-emerald-700',
    recusada: 'bg-red-100 text-red-700',
    expirada: 'bg-neutral-100 text-neutral-600',
    pendente: 'bg-yellow-100 text-yellow-800',
    pagamento_confirmado: 'bg-blue-100 text-blue-800',
    viagem_confirmada: 'bg-emerald-100 text-emerald-800',
    concluida: 'bg-neutral-100 text-neutral-800',
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${colors[value] || 'bg-neutral-100 text-neutral-700'}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
      <p className="text-xs font-bold text-neutral-400">Página {page} de {totalPages} · {total} registros</p>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-xl border border-neutral-200 p-2 text-neutral-600 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="rounded-xl border border-neutral-200 p-2 text-neutral-600 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export function TravelAdminModule() {
  const [activeTab, setActiveTab] = useState<AdminTab>('solicitacoes');
  const tabs: Array<{ id: AdminTab; label: string; icon: React.ElementType }> = [
    { id: 'solicitacoes', label: 'Orçamentos', icon: Users },
    { id: 'pacotes', label: 'Pacotes', icon: Plane },
    { id: 'propostas', label: 'Propostas', icon: FileText },
    { id: 'transacoes', label: 'Reservas & Transações', icon: Receipt },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight text-neutral-900">
          <Plane className="h-6 w-6 text-indigo-600" /> Módulo de Viagens
        </h2>
        <p className="mt-1 text-neutral-500">Operações paginadas, auditadas e executadas de forma transacional no servidor.</p>
      </header>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm lg:grid-cols-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}>
              <Icon className="h-4 w-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
        {activeTab === 'solicitacoes' && <SolicitacoesTab />}
        {activeTab === 'pacotes' && <PacotesTab />}
        {activeTab === 'propostas' && <ReadOnlyList kind="propostas" title="Propostas enviadas" />}
        {activeTab === 'transacoes' && <ReadOnlyList kind="transacoes" title="Reservas e transações" />}
      </section>
    </div>
  );
}

function usePagedTravelList(kind: AdminTab) {
  const [result, setResult] = useState<PagedResult>({ items: [], total: 0, page: 1, page_size: PAGE_SIZE });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminRpc<PagedResult>('gsa_admin_travel_list', {
        p_kind: kind,
        p_page: page,
        p_page_size: PAGE_SIZE,
        p_search: appliedSearch || null,
      });
      setResult({
        items: Array.isArray(data?.items) ? data.items : [],
        total: Number(data?.total || 0),
        page: Number(data?.page || page),
        page_size: Number(data?.page_size || PAGE_SIZE),
      });
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Não foi possível carregar os registros.');
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, kind, page]);

  useEffect(() => { void load(); }, [load]);

  const applySearch = () => {
    setPage(1);
    setAppliedSearch(search.trim());
  };

  return { result, page, setPage, search, setSearch, loading, load, applySearch };
}

function Toolbar({
  title,
  subtitle,
  search,
  setSearch,
  applySearch,
  loading,
  refresh,
  action,
}: {
  title: string;
  subtitle: string;
  search: string;
  setSearch: (value: string) => void;
  applySearch: () => void;
  loading: boolean;
  refresh: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 space-y-4">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div><h3 className="text-lg font-bold">{title}</h3><p className="text-sm text-neutral-500">{subtitle}</p></div>
        <div className="flex gap-2">
          <button type="button" onClick={refresh} disabled={loading} className="flex items-center gap-2 rounded-xl bg-neutral-100 px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-200 disabled:opacity-50"><RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
          {action}
        </div>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') applySearch(); }} placeholder="Buscar por protocolo, cliente, origem ou destino" className={`${inputClass} pl-10`} /></div>
        <button type="button" onClick={applySearch} className="rounded-xl bg-indigo-600 px-5 text-sm font-black text-white hover:bg-indigo-700">Buscar</button>
      </div>
    </div>
  );
}

function SolicitacoesTab() {
  const list = usePagedTravelList('solicitacoes');
  const [selected, setSelected] = useState<any>(null);
  const [linkingLead, setLinkingLead] = useState<any>(null);
  const [savingProposal, setSavingProposal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [proposalForm, setProposalForm] = useState({ titulo: '', valor_total: '', parcelamento_permitido: '1', validade_horas: '48', prazo_pagamento_dias: '2', condicoes: '' });

  const openProposal = (quote: any) => {
    if (!quote.cliente_id) {
      setLinkingLead(quote);
      setClientSearch(quote.email || quote.telefone || quote.nome || '');
      setClientResults([]);
      return;
    }
    setSelected(quote);
    setProposalForm({
      titulo: quote.viagens_pacotes?.titulo || `Viagem para ${quote.destino}`,
      valor_total: quote.viagens_pacotes?.preco_venda ? String(quote.viagens_pacotes.preco_venda).replace('.', ',') : '',
      parcelamento_permitido: '1',
      validade_horas: '48',
      prazo_pagamento_dias: '2',
      condicoes: 'Valores sujeitos à disponibilidade até a confirmação do pagamento.',
    });
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await callAdminRpc('gsa_admin_travel_update_status', { p_entity: 'orcamento', p_id: id, p_status: status });
      toast.success('Status atualizado.');
      await list.load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível atualizar o status.');
    }
  };

  const searchClients = async () => {
    const value = clientSearch.trim();
    if (value.length < 3) return toast.error('Digite pelo menos 3 caracteres.');
    setSearchingClients(true);
    try {
      const data = await callAdminRpc<any[]>('gsa_admin_search_clients', { p_search: value, p_limit: 10 });
      setClientResults(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao pesquisar clientes.');
    } finally {
      setSearchingClients(false);
    }
  };

  const linkClient = async (client: any) => {
    try {
      await callAdminRpc('gsa_admin_travel_link_lead', { p_quote_id: linkingLead.id, p_client_id: client.id });
      toast.success(`Lead vinculado a ${client.nome}.`);
      const linked = { ...linkingLead, cliente_id: client.id };
      setLinkingLead(null);
      await list.load();
      openProposal(linked);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível vincular o cliente.');
    }
  };

  const createProposal = async () => {
    const total = Number(proposalForm.valor_total.replace(/\./g, '').replace(',', '.'));
    if (!proposalForm.titulo.trim() || !Number.isFinite(total) || total <= 0) return toast.error('Informe título e valor total válidos.');
    setSavingProposal(true);
    try {
      await callAdminRpc('gsa_admin_travel_create_proposal', {
        p_quote_id: selected.id,
        p_title: proposalForm.titulo.trim(),
        p_total: total,
        p_max_installments: Number(proposalForm.parcelamento_permitido || 1),
        p_acceptance_hours: Number(proposalForm.validade_horas || 48),
        p_payment_days: Number(proposalForm.prazo_pagamento_dias || 2),
        p_conditions: proposalForm.condicoes.trim() || null,
      });
      toast.success('Proposta criada e disponibilizada ao cliente.');
      setSelected(null);
      await list.load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível criar a proposta.');
    } finally {
      setSavingProposal(false);
    }
  };

  return (
    <div>
      <Toolbar title="Solicitações de orçamento" subtitle="Leads públicos e solicitações de clientes." {...list} refresh={() => void list.load()} />
      {list.loading ? <Loading /> : list.result.items.length === 0 ? <Empty text="Nenhuma solicitação encontrada." /> : (
        <div className="space-y-3">
          {list.result.items.map((quote) => (
            <article key={quote.id} className="rounded-2xl border border-neutral-200 p-4 sm:p-5">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2"><StatusBadge status={quote.status} /><span className="text-xs font-bold text-neutral-400">{quote.protocolo}</span>{!quote.cliente_id && <span className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase text-cyan-700">Lead público</span>}</div>
                  <h4 className="truncate text-lg font-black text-neutral-900">{quote.viagens_pacotes?.titulo || `${quote.origem} → ${quote.destino}`}</h4>
                  <p className="mt-1 text-sm text-neutral-500">{quote.nome || 'Cliente cadastrado'} · {quote.email || quote.telefone || 'Contato pelo cadastro'} · {formatDate(quote.created_at)}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select value={quote.status} onChange={(event) => void updateStatus(quote.id, event.target.value)} className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold">
                    <option value="recebido">Recebido</option><option value="em_analise">Em análise</option><option value="buscando_opcoes">Buscando opções</option><option value="propostas_disponiveis">Proposta disponível</option><option value="aguardando_cliente">Aguardando cliente</option><option value="encerrado">Encerrado</option><option value="cancelado">Cancelado</option>
                  </select>
                  <button type="button" onClick={() => openProposal(quote)} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700">{quote.cliente_id ? <Send className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}{quote.cliente_id ? 'Gerar proposta' : 'Vincular cliente'}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination page={list.page} total={list.result.total} onPage={list.setPage} />

      <Modal isOpen={Boolean(linkingLead)} onClose={() => setLinkingLead(null)} title="Vincular lead a cliente" size="lg">
        {linkingLead && <div className="space-y-5">
          <div className="rounded-2xl bg-cyan-50 p-4 text-sm text-cyan-900"><strong>{linkingLead.nome}</strong><br />{linkingLead.email} · {linkingLead.telefone}</div>
          <div className="flex gap-2"><input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void searchClients(); }} placeholder="Nome, e-mail, telefone ou código" className={inputClass} /><button type="button" onClick={() => void searchClients()} disabled={searchingClients} className="rounded-xl bg-indigo-600 px-5 font-black text-white disabled:opacity-60">{searchingClients ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Buscar'}</button></div>
          <div className="space-y-2">{clientResults.map((client) => <button type="button" key={client.id} onClick={() => void linkClient(client)} className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50"><div><p className="font-black text-neutral-900">{client.nome}</p><p className="text-sm text-neutral-500">{client.email || client.telefone} · {client.codigo_cliente}</p></div><span className="text-xs font-black uppercase text-indigo-600">Selecionar</span></button>)}</div>
        </div>}
      </Modal>

      <Modal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title="Gerar proposta de viagem" size="xl">
        {selected && <div className="space-y-5">
          <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600"><strong>{selected.protocolo}</strong> · {selected.origem} → {selected.destino} · {selected.adultos || 1} adulto(s)</div>
          <label className={labelClass}>Título da proposta<input value={proposalForm.titulo} onChange={(event) => setProposalForm((value) => ({ ...value, titulo: event.target.value }))} className={`${inputClass} mt-2`} /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Valor total<input value={proposalForm.valor_total} onChange={(event) => setProposalForm((value) => ({ ...value, valor_total: event.target.value }))} placeholder="0,00" className={`${inputClass} mt-2`} /></label><label className={labelClass}>Parcelamento máximo<input type="number" min="1" max="24" value={proposalForm.parcelamento_permitido} onChange={(event) => setProposalForm((value) => ({ ...value, parcelamento_permitido: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Validade do aceite (horas)<input type="number" min="1" value={proposalForm.validade_horas} onChange={(event) => setProposalForm((value) => ({ ...value, validade_horas: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Prazo para pagamento (dias)<input type="number" min="1" value={proposalForm.prazo_pagamento_dias} onChange={(event) => setProposalForm((value) => ({ ...value, prazo_pagamento_dias: event.target.value }))} className={`${inputClass} mt-2`} /></label></div>
          <label className={labelClass}>Condições<textarea rows={4} value={proposalForm.condicoes} onChange={(event) => setProposalForm((value) => ({ ...value, condicoes: event.target.value }))} className={`${inputClass} mt-2 h-auto`} /></label>
          <button type="button" onClick={() => void createProposal()} disabled={savingProposal} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-black text-white hover:bg-indigo-700 disabled:opacity-60">{savingProposal ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}{savingProposal ? 'Criando proposta...' : 'Enviar proposta ao cliente'}</button>
        </div>}
      </Modal>
    </div>
  );
}

function PacotesTab() {
  const list = usePagedTravelList('pacotes');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ titulo: '', categoria: 'nacional', origem: '', destino: '', data_ida: '', data_volta: '', dias: '', noites: '', preco_venda: '', parcelamento_maximo: '1', imagem_url: '' });

  const save = async () => {
    const price = Number(form.preco_venda.replace(/\./g, '').replace(',', '.'));
    if (!form.titulo.trim() || !form.destino.trim() || !Number.isFinite(price) || price <= 0) return toast.error('Informe título, destino e preço válidos.');
    setSaving(true);
    try {
      await callAdminRpc('gsa_admin_travel_create_package', { p_payload: { ...form, preco_venda: price } });
      toast.success('Pacote criado como rascunho.');
      setShowForm(false);
      setForm({ titulo: '', categoria: 'nacional', origem: '', destino: '', data_ida: '', data_volta: '', dias: '', noites: '', preco_venda: '', parcelamento_maximo: '1', imagem_url: '' });
      await list.load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível criar o pacote.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await callAdminRpc('gsa_admin_travel_update_status', { p_entity: 'pacote', p_id: id, p_status: status });
      toast.success('Pacote atualizado.');
      await list.load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível atualizar o pacote.');
    }
  };

  return <div>
    <Toolbar title="Catálogo de pacotes" subtitle="Cadastre ofertas e controle a publicação." {...list} refresh={() => void list.load()} action={<button type="button" onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"><Plus className="h-4 w-4" /> Novo pacote</button>} />
    {list.loading ? <Loading /> : list.result.items.length === 0 ? <Empty text="Nenhum pacote cadastrado." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.result.items.map((pkg) => {
      const images = Array.isArray(pkg.viagens_pacote_imagens) ? pkg.viagens_pacote_imagens : [];
      const cover = images.find((image: any) => image.is_capa)?.url || images[0]?.url;
      return <article key={pkg.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">{cover ? <img src={cover} alt={pkg.titulo} className="h-36 w-full object-cover" /> : <div className="flex h-36 items-center justify-center bg-neutral-100"><Plane className="h-10 w-10 text-neutral-300" /></div>}<div className="p-5"><div className="mb-2 flex items-center justify-between gap-2"><StatusBadge status={pkg.status} /><span className="text-xs font-bold uppercase text-neutral-400">{pkg.categoria}</span></div><h4 className="line-clamp-2 font-black text-neutral-900">{pkg.titulo}</h4><p className="mt-1 text-sm text-neutral-500">{pkg.destino} · {pkg.dias || '—'} dias</p><p className="mt-4 text-lg font-black text-indigo-700">{formatCurrency(pkg.preco_venda)}</p><select value={pkg.status} onChange={(event) => void updateStatus(pkg.id, event.target.value)} className="mt-4 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold"><option value="rascunho">Rascunho</option><option value="publicado">Publicado</option><option value="disponibilidade_sob_consulta">Sob consulta</option><option value="pausado">Pausado</option><option value="esgotado">Esgotado</option></select></div></article>;
    })}</div>}
    <Pagination page={list.page} total={list.result.total} onPage={list.setPage} />
    <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Novo pacote de viagem" size="xl"><div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Título<input value={form.titulo} onChange={(event) => setForm((value) => ({ ...value, titulo: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Categoria<select value={form.categoria} onChange={(event) => setForm((value) => ({ ...value, categoria: event.target.value }))} className={`${inputClass} mt-2`}><option value="nacional">Nacional</option><option value="internacional">Internacional</option><option value="excursao">Excursão</option></select></label><label className={labelClass}>Origem<input value={form.origem} onChange={(event) => setForm((value) => ({ ...value, origem: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Destino<input value={form.destino} onChange={(event) => setForm((value) => ({ ...value, destino: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Data de ida<input type="date" value={form.data_ida} onChange={(event) => setForm((value) => ({ ...value, data_ida: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Data de volta<input type="date" value={form.data_volta} onChange={(event) => setForm((value) => ({ ...value, data_volta: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Dias<input type="number" min="1" value={form.dias} onChange={(event) => setForm((value) => ({ ...value, dias: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Noites<input type="number" min="0" value={form.noites} onChange={(event) => setForm((value) => ({ ...value, noites: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Preço de venda<input value={form.preco_venda} onChange={(event) => setForm((value) => ({ ...value, preco_venda: event.target.value }))} placeholder="0,00" className={`${inputClass} mt-2`} /></label><label className={labelClass}>Parcelamento máximo<input type="number" min="1" max="24" value={form.parcelamento_maximo} onChange={(event) => setForm((value) => ({ ...value, parcelamento_maximo: event.target.value }))} className={`${inputClass} mt-2`} /></label></div><label className={labelClass}>URL da imagem de capa<input value={form.imagem_url} onChange={(event) => setForm((value) => ({ ...value, imagem_url: event.target.value }))} className={`${inputClass} mt-2`} /></label><button type="button" onClick={() => void save()} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-black text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackagePlus className="h-5 w-5" />}{saving ? 'Salvando...' : 'Criar pacote como rascunho'}</button></div></Modal>
  </div>;
}

function ReadOnlyList({ kind, title }: { kind: 'propostas' | 'transacoes'; title: string }) {
  const list = usePagedTravelList(kind);
  const subtitle = kind === 'propostas' ? 'Acompanhe validade, aceite e valores enviados.' : 'Acompanhe pagamentos, emissão e confirmação das viagens.';
  return <div><Toolbar title={title} subtitle={subtitle} {...list} refresh={() => void list.load()} />{list.loading ? <Loading /> : list.result.items.length === 0 ? <Empty text="Nenhum registro encontrado." /> : <div className="space-y-3">{list.result.items.map((item) => <article key={item.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-neutral-200 p-4 sm:flex-row sm:items-center"><div><div className="mb-2 flex flex-wrap gap-2"><StatusBadge status={item.status} /><span className="text-xs font-bold text-neutral-400">{formatDate(item.created_at)}</span></div><h4 className="font-black text-neutral-900">{item.cliente_nome || item.snapshot_completo?.titulo || item.protocolo || 'Registro de viagem'}</h4><p className="mt-1 text-sm text-neutral-500">{kind === 'propostas' ? `Validade: ${formatDate(item.prazo_aceitacao)}` : `Forma de pagamento: ${item.forma_pagamento || '—'}`}</p></div>{item.valor_total != null && <p className="text-lg font-black text-indigo-700">{formatCurrency(item.valor_total)}</p>}</article>)}</div>}<Pagination page={list.page} total={list.result.total} onPage={list.setPage} /></div>;
}

function Loading() {
  return <div className="flex justify-center p-10"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-neutral-500">{text}</p>;
}
