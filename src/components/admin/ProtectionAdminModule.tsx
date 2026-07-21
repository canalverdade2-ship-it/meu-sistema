import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import {
  Activity,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  HeartPulse,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  WalletCards,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { callAdminRpc } from '../../lib/adminRpc';
import { navigate } from '../../routing/navigationService';
import { formatCurrency, formatDateTime } from '../../lib/utils';

type Domain = 'saude' | 'seguros';
type Props = { domain: Domain; initialTab?: string; initialItemId?: string };
type Tab = 'dashboard' | 'parceiros' | 'produtos' | 'cotacoes' | 'propostas' | 'contratos' | 'assessorias' | 'comissoes' | 'documentos' | 'assistencias' | 'sinistros' | 'atendimentos';

type PagedResult = { items: any[]; total: number; page: number; page_size: number };

const PAGE_SIZE = 40;

const definitions = {
  saude: {
    label: 'GSA Saúde',
    accent: '#159988',
    icon: HeartPulse,
    contract: 'Contratações',
    tabs: ['dashboard', 'parceiros', 'produtos', 'cotacoes', 'propostas', 'contratos', 'assessorias', 'comissoes', 'documentos', 'atendimentos'] as Tab[],
  },
  seguros: {
    label: 'GSA Seguros',
    accent: '#3569e8',
    icon: ShieldCheck,
    contract: 'Apólices',
    tabs: ['dashboard', 'parceiros', 'produtos', 'cotacoes', 'propostas', 'contratos', 'assessorias', 'comissoes', 'assistencias', 'sinistros', 'documentos', 'atendimentos'] as Tab[],
  },
} as const;

const labels: Record<Tab, string> = {
  dashboard: 'Visão geral',
  parceiros: 'Parceiros',
  produtos: 'Catálogo',
  cotacoes: 'Cotações',
  propostas: 'Propostas',
  contratos: 'Contratações',
  assessorias: 'Assessorias',
  comissoes: 'Comissões',
  documentos: 'Documentos',
  assistencias: 'Assistências',
  sinistros: 'Sinistros',
  atendimentos: 'Atendimentos',
};

function resourceFor(domain: Domain, tab: Exclude<Tab, 'dashboard'>) {
  if (tab === 'contratos') return domain === 'saude' ? 'saude_contratos' : 'seguros_apolices';
  return `${domain}_${tab}`;
}

function statusOptions(tab: Tab) {
  const options: Partial<Record<Tab, string[]>> = {
    parceiros: ['ativo', 'inativo'],
    produtos: ['rascunho', 'publicado', 'pausado', 'arquivado'],
    cotacoes: ['recebida', 'em_analise', 'aguardando_dados', 'propostas_disponiveis', 'encerrada', 'cancelada'],
    propostas: ['rascunho', 'enviada', 'visualizada', 'aceita', 'recusada', 'expirada', 'cancelada'],
    contratos: ['em_implantacao', 'ativo', 'suspenso', 'encerrado', 'cancelado'],
    assessorias: ['oferecida', 'aceita', 'cobranca_pendente', 'paga', 'cancelada'],
    comissoes: ['prevista', 'confirmada', 'recebida', 'estornada', 'cancelada'],
    documentos: ['enviado', 'em_analise', 'aprovado', 'rejeitado'],
    assistencias: ['solicitada', 'encaminhada_seguradora', 'em_atendimento', 'concluida', 'cancelada'],
    sinistros: ['comunicado', 'documentacao_pendente', 'encaminhado_seguradora', 'em_analise', 'indenizado', 'negado', 'encerrado'],
    atendimentos: ['aberto', 'em_atendimento', 'aguardando_cliente', 'resolvido', 'encerrado'],
  };
  return options[tab] || [];
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div role="dialog" aria-modal="true" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8">{children}</div></div>;
}

export function ProtectionAdminModule({ domain, initialTab = 'dashboard', initialItemId }: Props) {
  const definition = definitions[domain];
  const Icon = definition.icon;
  const normalizedInitial = initialTab === 'apolices' ? 'contratos' : initialTab;
  const initial = definition.tabs.includes(normalizedInitial as Tab) ? normalizedInitial as Tab : 'dashboard';
  const [tab, setTab] = useState<Tab>(initial);

  useEffect(() => {
    const normalized = initialTab === 'apolices' ? 'contratos' : initialTab;
    setTab(definition.tabs.includes(normalized as Tab) ? normalized as Tab : 'dashboard');
  }, [definition.tabs, initialTab]);

  const openTab = (next: Tab) => {
    setTab(next);
    navigate(`/admin/${domain}/${next}`);
  };

  return (
    <div className="space-y-6 pb-10">
      <header className="rounded-[2rem] bg-neutral-950 p-6 text-white shadow-xl">
        <h1 className="flex items-center gap-3 text-2xl font-black"><span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ background: definition.accent }}><Icon className="h-6 w-6" /></span>{definition.label}</h1>
        <p className="mt-3 text-sm text-white/55">Operações paginadas, autorizadas por domínio e auditadas no servidor.</p>
      </header>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-sm">
        {definition.tabs.map((key) => <button key={key} type="button" onClick={() => openTab(key)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === key ? 'text-white shadow-sm' : 'text-neutral-500 hover:bg-neutral-50'}`} style={tab === key ? { background: definition.accent } : undefined}>{key === 'contratos' ? definition.contract : labels[key]}</button>)}
      </div>

      {tab === 'dashboard' ? <ProtectionDashboard domain={domain} accent={definition.accent} onOpen={openTab} /> : <ProtectionList domain={domain} tab={tab as Exclude<Tab, 'dashboard'>} accent={definition.accent} initialItemId={initialItemId} />}
    </div>
  );
}

function ProtectionDashboard({ domain, accent, onOpen }: { domain: Domain; accent: string; onOpen: (tab: Tab) => void }) {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const cards: Array<{ tab: Exclude<Tab, 'dashboard'>; label: string; icon: React.ElementType }> = [
    { tab: 'parceiros', label: 'Parceiros', icon: Building2 },
    { tab: 'produtos', label: 'Produtos', icon: FileCheck2 },
    { tab: 'cotacoes', label: 'Cotações', icon: Search },
    { tab: 'propostas', label: 'Propostas', icon: WalletCards },
    { tab: 'contratos', label: domain === 'saude' ? 'Contratações' : 'Apólices', icon: ShieldCheck },
    { tab: 'atendimentos', label: 'Atendimentos', icon: MessageCircle },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await Promise.all(cards.map(async (card) => {
        const result = await callAdminRpc<PagedResult>('gsa_admin_list_resource', {
          p_resource: resourceFor(domain, card.tab),
          p_page: 1,
          p_page_size: 1,
          p_search: null,
          p_status: null,
        });
        return [card.tab, Number(result?.total || 0)] as const;
      }));
      setCounts(Object.fromEntries(entries));
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível carregar os indicadores.');
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <PanelState icon={Loader2} text="Carregando indicadores..." spin />;

  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map((card) => { const CardIcon = card.icon; return <button key={card.tab} type="button" onClick={() => onOpen(card.tab)} className="rounded-2xl border border-neutral-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ color: accent, background: `${accent}12` }}><CardIcon className="h-5 w-5" /></span><strong className="text-3xl font-black">{counts[card.tab] || 0}</strong></div><p className="mt-5 font-bold text-neutral-600">{card.label}</p></button>; })}</div>;
}

function ProtectionList({ domain, tab, accent, initialItemId }: { domain: Domain; tab: Exclude<Tab, 'dashboard'>; accent: string; initialItemId?: string }) {
  const resource = resourceFor(domain, tab);
  const [result, setResult] = useState<PagedResult>({ items: [], total: 0, page: 1, page_size: PAGE_SIZE });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => { setPage(1); setSearch(''); setAppliedSearch(''); setEditing(null); setShowEditor(false); setShowProposal(false); }, [resource]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminRpc<PagedResult>('gsa_admin_list_resource', {
        p_resource: resource,
        p_page: page,
        p_page_size: PAGE_SIZE,
        p_search: appliedSearch || null,
        p_status: null,
      });
      setResult({ items: Array.isArray(data?.items) ? data.items : [], total: Number(data?.total || 0), page: Number(data?.page || page), page_size: Number(data?.page_size || PAGE_SIZE) });
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível carregar os registros.');
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, page, resource]);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (item: any, status: string) => {
    setProcessingId(item.id);
    try {
      await callAdminRpc('gsa_admin_update_resource_status', { p_resource: resource, p_id: item.id, p_status: status, p_reason: null });
      toast.success('Status atualizado e auditado.');
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível alterar o status.');
    } finally {
      setProcessingId(null);
    }
  };

  const canEdit = tab === 'parceiros' || tab === 'produtos';
  const canCreateProposal = tab === 'propostas';
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const highlighted = useMemo(() => initialItemId ? result.items.find((item) => item.id === initialItemId) : null, [initialItemId, result.items]);

  return <>
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-neutral-100 p-5 lg:flex-row lg:items-center">
        <div><h2 className="text-xl font-black">{tab === 'contratos' ? (domain === 'saude' ? 'Contratações' : 'Apólices') : labels[tab]}</h2><p className="mt-1 text-sm text-neutral-500">{result.total} registro(s), carregados por página.</p></div>
        <div className="flex flex-wrap gap-2"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setPage(1); setAppliedSearch(search.trim()); } }} placeholder="Pesquisar" className="w-full rounded-xl border border-neutral-200 py-2.5 pl-10 pr-3 text-sm" /></div><button type="button" onClick={() => { setPage(1); setAppliedSearch(search.trim()); }} className="rounded-xl border border-neutral-200 px-4 py-2.5"><Search className="h-4 w-4" /></button><button type="button" onClick={() => void load()} className="rounded-xl border border-neutral-200 px-4 py-2.5"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>{canEdit && <button type="button" onClick={() => { setEditing(null); setShowEditor(true); }} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white" style={{ background: accent }}><Plus className="h-4 w-4" /> Novo</button>}{canCreateProposal && <button type="button" onClick={() => setShowProposal(true)} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white" style={{ background: accent }}><Plus className="h-4 w-4" /> Nova proposta</button>}</div>
      </div>

      {loading ? <PanelState icon={Loader2} text="Carregando registros..." spin /> : result.items.length === 0 ? <PanelState icon={Search} text="Nenhum registro encontrado." /> : <div className="divide-y divide-neutral-100">{result.items.map((item) => <article key={item.id} className={`flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center ${highlighted?.id === item.id ? 'bg-indigo-50/70' : ''}`}><div className="min-w-0"><h3 className="truncate font-black text-neutral-900">{item.nome || item.titulo || item.protocolo || item.numero || `Registro ${String(item.id).slice(0, 8)}`}</h3><p className="mt-1 truncate text-sm text-neutral-500">{item.resumo || item.email || item.assunto || item.categoria || (item.created_at ? formatDateTime(item.created_at) : 'Sem descrição')}</p>{item.valor != null && <p className="mt-1 text-sm font-bold">{formatCurrency(Number(item.valor))}</p>}</div><div className="flex shrink-0 items-center gap-2">{item.status && statusOptions(tab).length > 0 && <select disabled={processingId === item.id} value={item.status} onChange={(event) => void updateStatus(item, event.target.value)} className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold disabled:opacity-50">{Array.from(new Set([item.status, ...statusOptions(tab)])).map((status) => <option key={status} value={status}>{String(status).replaceAll('_', ' ')}</option>)}</select>}{canEdit && <button type="button" onClick={() => { setEditing(item); setShowEditor(true); }} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-black">Editar</button>}</div></article>)}</div>}
    </section>

    <div className="flex items-center justify-between"><p className="text-xs font-bold text-neutral-400">Página {page} de {totalPages}</p><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-neutral-200 p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-neutral-200 p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>

    {showEditor && <EntityEditor domain={domain} tab={tab as 'parceiros' | 'produtos'} item={editing} accent={accent} onClose={() => setShowEditor(false)} onSaved={async () => { setShowEditor(false); await load(); }} />}
    {showProposal && <ProposalEditor domain={domain} accent={accent} onClose={() => setShowProposal(false)} onSaved={async () => { setShowProposal(false); await load(); }} />}
  </>;
}

function EntityEditor({ domain, tab, item, accent, onClose, onSaved }: { domain: Domain; tab: 'parceiros' | 'produtos'; item: any; accent: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [partners, setPartners] = useState<any[]>([]);
  const [form, setForm] = useState<any>(item || (tab === 'parceiros' ? { nome: '', status: 'ativo', comissao_tipo: 'porcentagem', comissao_valor: 0 } : { nome: '', slug: '', categoria: domain === 'saude' ? 'individual-familiar' : 'auto', status: 'rascunho', destaque: false }));

  useEffect(() => {
    if (tab !== 'produtos') return;
    void callAdminRpc<PagedResult>('gsa_admin_list_resource', { p_resource: `${domain}_parceiros`, p_page: 1, p_page_size: 250, p_search: null, p_status: 'ativo' }).then((data) => setPartners(data.items || [])).catch(() => setPartners([]));
  }, [domain, tab]);

  const save = async () => {
    if (!form.nome?.trim()) return toast.error('Informe o nome.');
    setSaving(true);
    try {
      await callAdminRpc('gsa_admin_save_protection_entity', {
        p_domain: domain,
        p_kind: tab === 'parceiros' ? 'parceiro' : 'produto',
        p_id: item?.id || null,
        p_payload: form,
      });
      toast.success('Registro salvo e auditado.');
      await onSaved();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível salvar o registro.');
    } finally {
      setSaving(false);
    }
  };

  const field = (name: string, label: string, type = 'text') => <label className="block text-sm font-bold">{label}<input type={type} value={form[name] ?? ''} onChange={(event) => setForm({ ...form, [name]: type === 'number' ? Number(event.target.value) : event.target.value })} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label>;

  const categoriesList = domain === 'saude' 
    ? [
        'Plano Individual / Familiar',
        'Plano Coletivo por Adesão',
        'Plano PME / Empresarial',
        'Plano Odontológico',
        'Telemedicina',
        'Seguro Viagem Saúde',
        'Seguro de Vida & Invalidez',
        'Outros'
      ]
    : [
        'Auto & Veículos',
        'Vida & Acidentes Pessoais',
        'Residencial & Patrimônio',
        'Empresarial & Condomínio',
        'Saúde & Odonto',
        'Viagem Internacional',
        'Celular & Portáteis',
        'Fiança Locatícia',
        'Crédito & Garantia',
        'Responsabilidade Civil',
        'Agronegócio',
        'Outros'
      ];

  return <Overlay onClose={onClose}><div className="flex items-center justify-between"><h2 className="text-2xl font-black">{item ? 'Editar' : 'Novo'} {tab === 'parceiros' ? 'parceiro' : 'produto'}</h2><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2">{field('nome', 'Nome *')}{tab === 'parceiros' ? <>{field('documento', 'CNPJ/registro')}{field('site', 'Site')}{field('contato', 'Contato')}{field('comissao_valor', 'Comissão acordada', 'number')}<label className="block text-sm font-bold sm:col-span-2">Observações<textarea value={form.observacoes || ''} onChange={(event) => setForm({ ...form, observacoes: event.target.value })} rows={4} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label></> : <><label className="block text-sm font-bold">Parceiro<select value={form.parceiro_id || ''} onChange={(event) => setForm({ ...form, parceiro_id: event.target.value || null })} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3"><option value="">Selecione</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.nome}</option>)}</select></label><label className="block text-sm font-bold">Categoria *<select value={form.categoria || ''} onChange={(event) => setForm({ ...form, categoria: event.target.value })} className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"><option value="">Selecione uma Categoria</option>{categoriesList.map((cat) => <option key={cat} value={cat}>{cat}</option>)}</select></label>{field('imagem_url', 'URL da imagem')}{field('preco_referencia', domain === 'saude' ? 'Mensalidade de referência' : 'Prêmio de referência', 'number')}<label className="block text-sm font-bold sm:col-span-2">Resumo<textarea value={form.resumo || ''} onChange={(event) => setForm({ ...form, resumo: event.target.value })} rows={4} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label><label className="flex items-center gap-3 text-sm font-bold sm:col-span-2"><input type="checkbox" checked={Boolean(form.destaque)} onChange={(event) => setForm({ ...form, destaque: event.target.checked })} /> Destacar no catálogo</label></>}</div><div className="mt-8 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-neutral-200 px-5 py-3 font-bold">Cancelar</button><button type="button" disabled={saving} onClick={() => void save()} className="rounded-xl px-6 py-3 font-black text-white disabled:opacity-50" style={{ background: accent }}>{saving ? 'Salvando...' : 'Salvar'}</button></div></Overlay>;
}

function ProposalEditor({ domain, accent, onClose, onSaved }: { domain: Domain; accent: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ cotacao_id: '', parceiro_id: '', produto_id: '', titulo: '', valor: '', franquia: '', taxa_assessoria_gsa: 0, validade_dias: 5 });

  useEffect(() => {
    void Promise.all([
      callAdminRpc<PagedResult>('gsa_admin_list_resource', { p_resource: `${domain}_cotacoes`, p_page: 1, p_page_size: 250, p_search: null, p_status: null }),
      callAdminRpc<PagedResult>('gsa_admin_list_resource', { p_resource: `${domain}_parceiros`, p_page: 1, p_page_size: 250, p_search: null, p_status: 'ativo' }),
      callAdminRpc<PagedResult>('gsa_admin_list_resource', { p_resource: `${domain}_produtos`, p_page: 1, p_page_size: 250, p_search: null, p_status: 'publicado' }),
    ]).then(([quoteData, partnerData, productData]) => { setQuotes((quoteData.items || []).filter((quote) => !['encerrada', 'cancelada'].includes(quote.status))); setPartners(partnerData.items || []); setProducts(productData.items || []); }).catch((error) => toast.error(error?.message || 'Não foi possível carregar os dados da proposta.')).finally(() => setLoading(false));
  }, [domain]);

  const save = async () => {
    const amount = Number(form.valor);
    if (!form.cotacao_id || !form.parceiro_id || !Number.isFinite(amount) || amount <= 0) return toast.error('Selecione cotação, parceiro e informe o valor.');
    setSaving(true);
    try {
      await callAdminRpc('gsa_admin_create_protection_proposal', { p_domain: domain, p_payload: { ...form, valor: amount } });
      toast.success('Proposta criada de forma transacional.');
      await onSaved();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível criar a proposta.');
    } finally {
      setSaving(false);
    }
  };

  const input = (name: string, label: string, type = 'text') => <label className="block text-sm font-bold">{label}<input type={type} value={form[name] ?? ''} onChange={(event) => setForm({ ...form, [name]: event.target.value })} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label>;

  return <Overlay onClose={onClose}><div className="flex items-center justify-between"><h2 className="text-2xl font-black">Nova proposta</h2><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div>{loading ? <PanelState icon={Loader2} text="Carregando dados..." spin /> : <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold sm:col-span-2">Cotação<select value={form.cotacao_id} onChange={(event) => setForm({ ...form, cotacao_id: event.target.value })} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3"><option value="">Selecione</option>{quotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.protocolo || String(quote.id).slice(0, 8)} · {quote.categoria || quote.status}</option>)}</select></label><label className="text-sm font-bold">Parceiro<select value={form.parceiro_id} onChange={(event) => setForm({ ...form, parceiro_id: event.target.value, produto_id: '' })} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3"><option value="">Selecione</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.nome}</option>)}</select></label><label className="text-sm font-bold">Produto<select value={form.produto_id} onChange={(event) => setForm({ ...form, produto_id: event.target.value })} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3"><option value="">Opcional</option>{products.filter((product) => !form.parceiro_id || product.parceiro_id === form.parceiro_id).map((product) => <option key={product.id} value={product.id}>{product.nome}</option>)}</select></label>{input('titulo', 'Título')}{input('valor', domain === 'saude' ? 'Mensalidade da operadora' : 'Prêmio da seguradora', 'number')}{domain === 'seguros' && input('franquia', 'Franquia', 'number')}{input('taxa_assessoria_gsa', 'Taxa de assessoria GSA', 'number')}{input('validade_dias', 'Validade em dias', 'number')}</div>}<div className="mt-8 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-neutral-200 px-5 py-3 font-bold">Cancelar</button><button type="button" disabled={saving || loading} onClick={() => void save()} className="rounded-xl px-6 py-3 font-black text-white disabled:opacity-50" style={{ background: accent }}>{saving ? 'Salvando...' : 'Enviar proposta'}</button></div></Overlay>;
}

function PanelState({ icon: Icon, text, spin }: { icon: React.ElementType; text: string; spin?: boolean }) {
  return <div className="p-14 text-center"><Icon className={`mx-auto h-9 w-9 text-neutral-300 ${spin ? 'animate-spin' : ''}`} /><p className="mt-4 font-bold text-neutral-500">{text}</p></div>;
}
