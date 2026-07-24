import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Ban, Calculator, CheckCircle2, Clock3, Copy, CreditCard, Crown, KeyRound, Loader2, RefreshCw, Save, Search, Ticket, UserCheck, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { callAdminRpc } from '../../lib/adminRpc';

const TOOL_LABELS: Record<string, string> = {
  termination: 'Rescisão trabalhista',
  retirement: 'Aposentadoria INSS',
  vacation: 'Cálculo de férias',
};

type Product = {
  tool_id: string;
  nome: string;
  ativo: boolean;
  preco_centavos: number;
  duracao_acesso_minutos: number;
  liberar_cliente_com_fatura_paga: boolean;
  gratuito_inicio?: string | null;
  gratuito_fim?: string | null;
};

type Snapshot = {
  products: Product[];
  vouchers: any[];
  payments: any[];
  grants: any[];
};

function localInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isoOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100);
}

function dateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—';
}

export function CalculatorProAdminPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot>({ products: [], vouchers: [], payments: [], grants: [] });
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [tab, setTab] = useState<'products' | 'vouchers' | 'access' | 'payments'>('products');
  const [voucherForm, setVoucherForm] = useState({ tool_id: 'termination', expires_at: '', observacoes: '' });
  const [issuedVoucher, setIssuedVoucher] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [grantForm, setGrantForm] = useState({ cliente_id: '', tool_id: 'termination', valid_until: '', observacoes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminRpc<Snapshot>('gsa_admin_calculator_pro_snapshot');
      const normalized = {
        products: Array.isArray(data?.products) ? data.products : [],
        vouchers: Array.isArray(data?.vouchers) ? data.vouchers : [],
        payments: Array.isArray(data?.payments) ? data.payments : [],
        grants: Array.isArray(data?.grants) ? data.grants : [],
      };
      setSnapshot(normalized);
      setProducts(normalized.products.map((item) => ({ ...item })));
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível carregar as calculadoras Pro.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateProduct = (toolId: string, patch: Partial<Product>) => setProducts((current) => current.map((product) => product.tool_id === toolId ? { ...product, ...patch } : product));

  const saveProduct = async (product: Product) => {
    setSaving(product.tool_id);
    try {
      await callAdminRpc('gsa_admin_save_calculator_pro_product', {
        p_tool_id: product.tool_id,
        p_payload: {
          ativo: product.ativo,
          preco_centavos: Math.max(0, Math.round(Number(product.preco_centavos || 0))),
          duracao_acesso_minutos: Math.max(15, Math.round(Number(product.duracao_acesso_minutos || 15))),
          liberar_cliente_com_fatura_paga: product.liberar_cliente_com_fatura_paga,
          gratuito_inicio: product.gratuito_inicio || null,
          gratuito_fim: product.gratuito_fim || null,
        },
      });
      toast.success(`${TOOL_LABELS[product.tool_id]} atualizada.`);
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível salvar a calculadora.');
    } finally {
      setSaving(null);
    }
  };

  const createVoucher = async () => {
    setSaving('voucher');
    try {
      const result = await callAdminRpc<{ success: boolean; code: string }>('gsa_admin_create_calculator_pro_voucher', {
        p_tool_id: voucherForm.tool_id || null,
        p_expires_at: isoOrNull(voucherForm.expires_at),
        p_observacoes: voucherForm.observacoes || null,
      });
      setIssuedVoucher(result.code);
      setVoucherForm({ tool_id: 'termination', expires_at: '', observacoes: '' });
      toast.success('Voucher de uso único criado.');
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível criar o voucher.');
    } finally {
      setSaving(null);
    }
  };

  const toggleVoucher = async (voucher: any) => {
    try {
      await callAdminRpc('gsa_admin_set_calculator_pro_voucher_status', {
        p_voucher_id: voucher.id,
        p_status: voucher.status === 'active' ? 'cancelled' : 'active',
      });
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível alterar o voucher.');
    }
  };

  const searchClients = async () => {
    if (clientSearch.trim().length < 2) return toast.error('Digite ao menos dois caracteres.');
    setSearchingClients(true);
    try {
      const result = await callAdminRpc<any[]>('gsa_admin_search_calculator_pro_clients', { p_query: clientSearch.trim() });
      setClients(Array.isArray(result) ? result : []);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível localizar clientes.');
    } finally {
      setSearchingClients(false);
    }
  };

  const grantAccess = async () => {
    if (!grantForm.cliente_id || !grantForm.valid_until) return toast.error('Selecione o cliente e a validade.');
    setSaving('grant');
    try {
      await callAdminRpc('gsa_admin_grant_calculator_pro', {
        p_cliente_id: grantForm.cliente_id,
        p_tool_id: grantForm.tool_id,
        p_valid_until: isoOrNull(grantForm.valid_until),
        p_observacoes: grantForm.observacoes || null,
      });
      toast.success('Acesso Pro liberado manualmente.');
      setGrantForm({ cliente_id: '', tool_id: 'termination', valid_until: '', observacoes: '' });
      setClients([]);
      setClientSearch('');
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível liberar o acesso.');
    } finally {
      setSaving(null);
    }
  };

  const revokeGrant = async (grant: any) => {
    if (!window.confirm(`Revogar o acesso de ${grant.cliente_nome || 'este usuário'}?`)) return;
    try {
      await callAdminRpc('gsa_admin_revoke_calculator_pro_grant', { p_grant_id: grant.id, p_reason: 'Revogação manual pelo painel administrativo' });
      toast.success('Acesso revogado.');
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível revogar o acesso.');
    }
  };

  const activeGrants = useMemo(() => snapshot.grants.filter((grant) => grant.status === 'active' && (!grant.valid_until || new Date(grant.valid_until) > new Date())), [snapshot.grants]);

  if (loading) return <div className="flex min-h-[420px] items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-indigo-600" /></div>;

  return <div className="space-y-5">
    <div className="rounded-2xl border border-neutral-200 bg-[linear-gradient(135deg,#111827,#1f2937)] p-5 text-white sm:p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300/70">Produto digital GSA</p><h2 className="mt-2 flex items-center gap-3 text-2xl font-black"><Crown className="h-6 w-6 text-amber-300" />Calculadoras Pro</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">Preços, checkout InfinitePay, períodos gratuitos, benefício de clientes, vouchers e liberações manuais.</p></div><button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-neutral-900"><RefreshCw className="h-4 w-4" />Atualizar</button></div></div>

    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-neutral-200 bg-white p-2 lg:grid-cols-4">{[
      ['products','Configuração',Calculator],['vouchers','Vouchers',Ticket],['access','Liberações',UserCheck],['payments','Pagamentos',CreditCard],
    ].map(([id,label,Icon]) => { const I = Icon as typeof Calculator; return <button key={id as string} type="button" onClick={() => setTab(id as typeof tab)} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black ${tab === id ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-neutral-500 hover:bg-neutral-50'}`}><I className="h-4 w-4" />{label as string}</button>; })}</div>

    {tab === 'products' && <div className="grid gap-5 xl:grid-cols-3">{products.map((product) => <article key={product.tool_id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-indigo-500">{product.tool_id}</p><h3 className="mt-2 text-lg font-black text-neutral-900">{TOOL_LABELS[product.tool_id]}</h3></div><button type="button" onClick={() => updateProduct(product.tool_id, { ativo: !product.ativo })} className={`relative h-7 w-12 rounded-full ${product.ativo ? 'bg-emerald-500' : 'bg-neutral-300'}`}><span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform ${product.ativo ? 'translate-x-5' : ''}`} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><label className="text-xs font-black text-neutral-600">Preço do acesso (R$)<input type="number" min={0} step="0.01" value={(product.preco_centavos / 100).toFixed(2)} onChange={(event) => updateProduct(product.tool_id, { preco_centavos: Math.round(Number(event.target.value || 0) * 100) })} className="mt-2 min-h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm" /></label><label className="text-xs font-black text-neutral-600">Duração (minutos)<input type="number" min={15} value={product.duracao_acesso_minutos} onChange={(event) => updateProduct(product.tool_id, { duracao_acesso_minutos: Number(event.target.value) })} className="mt-2 min-h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm" /></label><label className="text-xs font-black text-neutral-600">Gratuito de<input type="datetime-local" value={localInput(product.gratuito_inicio)} onChange={(event) => updateProduct(product.tool_id, { gratuito_inicio: isoOrNull(event.target.value) })} className="mt-2 min-h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm" /></label><label className="text-xs font-black text-neutral-600">Gratuito até<input type="datetime-local" value={localInput(product.gratuito_fim)} onChange={(event) => updateProduct(product.tool_id, { gratuito_fim: isoOrNull(event.target.value) })} className="mt-2 min-h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm" /></label></div><label className="mt-4 flex items-start gap-3 rounded-xl bg-neutral-50 p-3 text-xs font-bold text-neutral-700"><input type="checkbox" checked={product.liberar_cliente_com_fatura_paga} onChange={(event) => updateProduct(product.tool_id, { liberar_cliente_com_fatura_paga: event.target.checked })} className="mt-0.5 h-4 w-4 accent-indigo-600" />Liberar automaticamente para cliente ativo, logado e com ao menos uma fatura paga.</label><button type="button" onClick={() => void saveProduct(product)} disabled={saving === product.tool_id} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-black text-white disabled:opacity-50">{saving === product.tool_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar configuração</button></article>)}</div>}

    {tab === 'vouchers' && <div className="grid gap-5 xl:grid-cols-[380px_1fr]"><section className="rounded-2xl border border-neutral-200 bg-white p-5"><h3 className="flex items-center gap-2 font-black"><KeyRound className="h-5 w-5 text-indigo-600" />Criar voucher de uma utilização</h3><div className="mt-5 space-y-4"><label className="block text-xs font-black text-neutral-600">Calculadora<select value={voucherForm.tool_id} onChange={(event) => setVoucherForm({ ...voucherForm, tool_id: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"><option value="termination">Rescisão</option><option value="retirement">Aposentadoria</option><option value="vacation">Férias</option><option value="">Qualquer calculadora</option></select></label><label className="block text-xs font-black text-neutral-600">Validade opcional<input type="datetime-local" value={voucherForm.expires_at} onChange={(event) => setVoucherForm({ ...voucherForm, expires_at: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm" /></label><label className="block text-xs font-black text-neutral-600">Observações<textarea rows={3} value={voucherForm.observacoes} onChange={(event) => setVoucherForm({ ...voucherForm, observacoes: event.target.value })} className="mt-2 w-full rounded-xl border border-neutral-200 p-3 text-sm" /></label><button type="button" onClick={() => void createVoucher()} disabled={saving === 'voucher'} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-black text-white"><Ticket className="h-4 w-4" />Gerar voucher</button></div>{issuedVoucher && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black text-emerald-800">Código exibido somente agora</p><div className="mt-2 flex gap-2"><code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-sm font-black text-emerald-900">{issuedVoucher}</code><button type="button" onClick={() => { void navigator.clipboard.writeText(issuedVoucher); toast.success('Código copiado.'); }} className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-white"><Copy className="h-4 w-4" /></button></div></div>}</section><section className="rounded-2xl border border-neutral-200 bg-white p-5"><h3 className="font-black">Vouchers emitidos</h3><div className="mt-4 space-y-3">{snapshot.vouchers.length === 0 && <p className="text-sm text-neutral-400">Nenhum voucher emitido.</p>}{snapshot.vouchers.map((voucher) => <article key={voucher.id} className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-sm font-black">••••••{voucher.code_hint}</p><p className="mt-1 text-xs text-neutral-500">{voucher.tool_id ? TOOL_LABELS[voucher.tool_id] : 'Qualquer calculadora'} · validade {dateTime(voucher.expires_at)}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${voucher.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>{voucher.status}</span>{['active','cancelled'].includes(voucher.status) && <button type="button" onClick={() => void toggleVoucher(voucher)} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-black">{voucher.status === 'active' ? 'Cancelar' : 'Reativar'}</button>}</div></article>)}</div></section></div>}

    {tab === 'access' && <div className="grid gap-5 xl:grid-cols-[420px_1fr]"><section className="rounded-2xl border border-neutral-200 bg-white p-5"><h3 className="flex items-center gap-2 font-black"><UserCheck className="h-5 w-5 text-indigo-600" />Liberação manual para cliente</h3><div className="mt-5 flex gap-2"><input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void searchClients()} placeholder="Nome, código, CPF ou CNPJ" className="min-h-11 min-w-0 flex-1 rounded-xl border border-neutral-200 px-3 text-sm" /><button type="button" onClick={() => void searchClients()} className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-950 text-white">{searchingClients ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button></div>{clients.length > 0 && <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">{clients.map((client) => <button key={client.id} type="button" onClick={() => setGrantForm({ ...grantForm, cliente_id: client.id })} className={`w-full rounded-xl border p-3 text-left ${grantForm.cliente_id === client.id ? 'border-indigo-300 bg-indigo-50' : 'border-neutral-200'}`}><strong className="block text-sm">{client.nome}</strong><span className="mt-1 block text-xs text-neutral-500">{client.codigo_cliente} · {client.status} · {client.has_paid_invoice ? 'possui fatura paga' : 'sem fatura paga'}</span></button>)}</div>}<div className="mt-4 space-y-4"><label className="block text-xs font-black text-neutral-600">Calculadora<select value={grantForm.tool_id} onChange={(event) => setGrantForm({ ...grantForm, tool_id: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm">{Object.entries(TOOL_LABELS).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="block text-xs font-black text-neutral-600">Liberado até<input type="datetime-local" value={grantForm.valid_until} onChange={(event) => setGrantForm({ ...grantForm, valid_until: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm" /></label><label className="block text-xs font-black text-neutral-600">Observações<textarea rows={3} value={grantForm.observacoes} onChange={(event) => setGrantForm({ ...grantForm, observacoes: event.target.value })} className="mt-2 w-full rounded-xl border border-neutral-200 p-3 text-sm" /></label><button type="button" onClick={() => void grantAccess()} disabled={saving === 'grant'} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-black text-white"><CheckCircle2 className="h-4 w-4" />Liberar acesso</button></div></section><section className="rounded-2xl border border-neutral-200 bg-white p-5"><h3 className="font-black">Acessos ativos</h3><div className="mt-4 space-y-3">{activeGrants.length === 0 && <p className="text-sm text-neutral-400">Nenhuma liberação ativa.</p>}{activeGrants.map((grant) => <article key={grant.id} className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">{grant.cliente_nome || 'Visitante'}</p><p className="mt-1 text-xs text-neutral-500">{TOOL_LABELS[grant.tool_id]} · {grant.source} · até {dateTime(grant.valid_until)}</p></div>{grant.source === 'manual' && <button type="button" onClick={() => void revokeGrant(grant)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700"><Ban className="h-4 w-4" />Revogar</button>}</article>)}</div></section></div>}

    {tab === 'payments' && <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"><div className="border-b border-neutral-200 p-5"><h3 className="flex items-center gap-2 font-black"><CreditCard className="h-5 w-5 text-indigo-600" />Pagamentos InfinitePay</h3><p className="mt-1 text-xs text-neutral-500">O acesso é concedido somente após verificação do pagamento no servidor.</p></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-neutral-50 text-[10px] font-black uppercase tracking-wider text-neutral-500"><tr><th className="px-4 py-3">Pedido</th><th className="px-4 py-3">Calculadora</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Data</th></tr></thead><tbody className="divide-y divide-neutral-100">{snapshot.payments.map((payment) => <tr key={payment.id}><td className="px-4 py-3 font-mono text-xs">{String(payment.order_nsu).slice(0,8)}…</td><td className="px-4 py-3 font-bold">{TOOL_LABELS[payment.tool_id]}</td><td className="px-4 py-3 text-neutral-500">{payment.cliente_nome || 'Visitante'}</td><td className="px-4 py-3 font-black">{money(payment.valor_centavos)}</td><td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${payment.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : payment.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{payment.status === 'paid' ? <CheckCircle2 className="h-3 w-3" /> : payment.status === 'failed' ? <XCircle className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}{payment.status}</span></td><td className="px-4 py-3 text-xs text-neutral-500">{dateTime(payment.paid_at || payment.created_at)}</td></tr>)}</tbody></table>{snapshot.payments.length === 0 && <p className="p-8 text-center text-sm text-neutral-400">Nenhum pagamento registrado.</p>}</div></section>}
  </div>;
}
