import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  Banknote,
  CheckCircle2,
  Clock3,
  Coins,
  Link2,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Star,
  ToggleLeft,
  ToggleRight,
  UserRoundCheck,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { callAdminRpc } from '../../lib/adminRpc';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDateTime } from '../../lib/utils';

type AffiliateAdminTab = 'programas' | 'afiliados' | 'saques' | 'pontos';

type AffiliateProgram = {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  caminho_padrao?: string | null;
  base_tipo?: string | null;
  percentual: number;
  janela_atribuicao_dias: number;
  carencia_dias: number;
  saque_minimo: number;
  pontos_por_real?: number;
  ativo: boolean;
};

type AffiliateRecord = {
  id: string;
  cliente_id?: string;
  nome_divulgacao: string;
  codigo_publico?: string;
  status: 'ativo' | 'suspenso' | 'encerrado' | string;
  pix_tipo?: string | null;
  pix_chave_mascarada?: string | null;
  created_at?: string;
  cliques?: number;
  conversoes?: number;
  comissao_total?: number;
  saldo_disponivel?: number;
};

type AffiliatePayout = {
  id: string;
  afiliado_id?: string;
  afiliado_nome?: string;
  codigo_publico?: string;
  valor: number;
  status: 'solicitado' | 'aprovado' | 'pago' | 'rejeitado' | 'cancelado' | string;
  pix_tipo?: string | null;
  pix_chave?: string | null;
  solicitado_em?: string;
  aprovado_em?: string | null;
  pago_em?: string | null;
};

type AffiliateSummary = {
  afiliados_ativos: number;
  cliques: number;
  vendas_atribuidas: number;
  comissoes_pendentes: number;
  comissoes_disponiveis: number;
  saques_pendentes: number;
};

type AffiliateAdminSnapshot = {
  success?: boolean;
  summary?: Partial<AffiliateSummary>;
  programs?: AffiliateProgram[];
  programas?: AffiliateProgram[];
  affiliates?: AffiliateRecord[];
  afiliados?: AffiliateRecord[];
  payouts?: AffiliatePayout[];
  saques?: AffiliatePayout[];
};

const STATUS_STYLE: Record<string, string> = {
  ativo: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  suspenso: 'bg-amber-50 text-amber-700 ring-amber-200',
  encerrado: 'bg-neutral-100 text-neutral-600 ring-neutral-200',
  solicitado: 'bg-amber-50 text-amber-700 ring-amber-200',
  aprovado: 'bg-blue-50 text-blue-700 ring-blue-200',
  pago: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejeitado: 'bg-rose-50 text-rose-700 ring-rose-200',
  cancelado: 'bg-neutral-100 text-neutral-600 ring-neutral-200',
};

function asNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSnapshot(payload: AffiliateAdminSnapshot | null) {
  const summary = payload?.summary || {};
  return {
    summary: {
      afiliados_ativos: asNumber(summary.afiliados_ativos),
      cliques: asNumber(summary.cliques),
      vendas_atribuidas: asNumber(summary.vendas_atribuidas),
      comissoes_pendentes: asNumber(summary.comissoes_pendentes),
      comissoes_disponiveis: asNumber(summary.comissoes_disponiveis),
      saques_pendentes: asNumber(summary.saques_pendentes),
    },
    programs: payload?.programs || payload?.programas || [],
    affiliates: payload?.affiliates || payload?.afiliados || [],
    payouts: payload?.payouts || payload?.saques || [],
  };
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ${STATUS_STYLE[status] || STATUS_STYLE.encerrado}`}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}

function ProgramEditor({ program, onSaved }: { program: AffiliateProgram; onSaved: () => Promise<void> | void }) {
  const [draft, setDraft] = useState(program);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(program), [program]);

  const save = async () => {
    setSaving(true);
    try {
      await callAdminRpc('gsa_admin_update_affiliate_program', {
        p_program_id: program.id,
        p_patch: {
          descricao: draft.descricao || null,
          caminho_padrao: draft.caminho_padrao || '/',
          base_tipo: draft.base_tipo || 'venda_bruta',
          percentual: asNumber(draft.percentual),
          janela_atribuicao_dias: asNumber(draft.janela_atribuicao_dias),
          carencia_dias: asNumber(draft.carencia_dias),
          saque_minimo: asNumber(draft.saque_minimo),
          pontos_por_real: asNumber(draft.pontos_por_real ?? 1),
          ativo: draft.ativo,
        },
      });

      // Direct fallback to supabase table update in case RPC is cached
      await supabase.from('gsa_afiliado_programas').update({
        percentual: asNumber(draft.percentual),
        janela_atribuicao_dias: asNumber(draft.janela_atribuicao_dias),
        carencia_dias: asNumber(draft.carencia_dias),
        saque_minimo: asNumber(draft.saque_minimo),
        pontos_por_real: asNumber(draft.pontos_por_real ?? 1),
        descricao: draft.descricao || null,
        caminho_padrao: draft.caminho_padrao || '/',
        ativo: draft.ativo,
      }).eq('id', program.id);

      toast.success(`Programa ${draft.nome} atualizado.`);
      await onSaved();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível atualizar o programa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">{draft.codigo}</p>
          <h3 className="mt-1 text-lg font-black text-neutral-950">{draft.nome}</h3>
        </div>
        <button
          type="button"
          onClick={() => setDraft((current) => ({ ...current, ativo: !current.ativo }))}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black transition ${draft.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}
          aria-pressed={draft.ativo}
        >
          {draft.ativo ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
          {draft.ativo ? 'Ativo' : 'Pausado'}
        </button>
      </div>

      <label className="mt-4 block text-xs font-bold text-neutral-600">
        Descrição pública
        <textarea
          rows={2}
          value={draft.descricao || ''}
          onChange={(event) => setDraft((current) => ({ ...current, descricao: event.target.value }))}
          className="mt-1.5 w-full resize-none rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <NumberField label="Comissão (%)" value={draft.percentual} min={0.01} max={50} step={0.01} onChange={(value) => setDraft((current) => ({ ...current, percentual: value }))} />
        <NumberField label="Pontos / R$ 1 (pts)" value={draft.pontos_por_real ?? 1} min={0} max={100} step={0.1} onChange={(value) => setDraft((current) => ({ ...current, pontos_por_real: value }))} />
        <NumberField label="Janela (dias)" value={draft.janela_atribuicao_dias} min={1} max={365} onChange={(value) => setDraft((current) => ({ ...current, janela_atribuicao_dias: value }))} />
        <NumberField label="Carência (dias)" value={draft.carencia_dias} min={0} max={365} onChange={(value) => setDraft((current) => ({ ...current, carencia_dias: value }))} />
        <NumberField label="Saque mín. (R$)" value={draft.saque_minimo} min={0} max={100000} step={1} onChange={(value) => setDraft((current) => ({ ...current, saque_minimo: value }))} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-neutral-600">
          Página padrão
          <input
            value={draft.caminho_padrao || ''}
            onChange={(event) => setDraft((current) => ({ ...current, caminho_padrao: event.target.value }))}
            placeholder="/loja"
            className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        <label className="text-xs font-bold text-neutral-600">
          Base de cálculo
          <select
            value={draft.base_tipo || 'venda_bruta'}
            onChange={(event) => setDraft((current) => ({ ...current, base_tipo: event.target.value }))}
            className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="venda_bruta">Venda bruta</option>
            <option value="venda_liquida">Venda líquida</option>
            <option value="receita_gsa">Receita da GSA</option>
            <option value="valor_pago">Valor efetivamente pago</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-indigo-600 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar regras
      </button>
    </article>
  );
}

function NumberField({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step?: number }) {
  return (
    <label className="text-xs font-bold text-neutral-600">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(asNumber(event.target.value))}
        className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-bold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
    </label>
  );
}

export function AffiliateAdminModule() {
  const [tab, setTab] = useState<AffiliateAdminTab>('programas');
  const [snapshot, setSnapshot] = useState(() => normalizeSnapshot(null));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [workingId, setWorkingId] = useState<string | null>(null);

  // Global Points Config State
  const [pointsRate, setPointsRate] = useState<number>(100); // 100 pts = R$ 1.00
  const [minPointsRedeem, setMinPointsRedeem] = useState<number>(100);
  const [pointsActive, setPointsActive] = useState<boolean>(true);
  const [savingPointsConfig, setSavingPointsConfig] = useState(false);

  const loadPointsSettings = useCallback(async () => {
    try {
      const { data } = await supabase.from('system_settings').select('key, value');
      if (data) {
        const get = (key: string, fallback: string) => data.find((s) => s.key === key)?.value ?? fallback;
        const taxa = parseFloat(get('afiliado_pontos_resgate_taxa', '0.01'));
        setPointsRate(taxa > 0 ? Math.round(1 / taxa) : 100);
        setMinPointsRedeem(parseInt(get('afiliado_pontos_minimo_resgate', '100'), 10));
        setPointsActive(get('afiliado_pontos_ativo', 'true') === 'true');
      }
    } catch (err) {
      console.warn('Erro ao carregar configurações de pontos:', err);
    }
  }, []);

  const savePointsSettings = async () => {
    setSavingPointsConfig(true);
    try {
      const taxa = pointsRate > 0 ? (1 / pointsRate).toFixed(4) : '0.01';
      const settings = [
        { key: 'afiliado_pontos_resgate_taxa', value: taxa },
        { key: 'afiliado_pontos_minimo_resgate', value: String(minPointsRedeem) },
        { key: 'afiliado_pontos_ativo', value: String(pointsActive) },
      ];

      for (const item of settings) {
        await supabase.from('system_settings').upsert({ key: item.key, value: item.value });
      }

      toast.success('Configurações globais do programa de pontos salvas!');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar configurações de pontos.');
    } finally {
      setSavingPointsConfig(false);
    }
  };

  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      await loadPointsSettings();
      try {
        const data = await callAdminRpc<AffiliateAdminSnapshot>('gsa_admin_affiliate_snapshot');
        setSnapshot(normalizeSnapshot(data));
      } catch (rpcErr) {
        console.warn('gsa_admin_affiliate_snapshot RPC fallthrough, buscando via tabelas:', rpcErr);
        const [programsRes, affiliatesRes, saquesRes] = await Promise.all([
          supabase.from('gsa_afiliado_programas').select('*').order('nome', { ascending: true }),
          supabase.from('gsa_afiliados').select('*').order('created_at', { ascending: false }),
          supabase.from('gsa_afiliado_saques').select('*, gsa_afiliados(nome_divulgacao, codigo_publico)').order('created_at', { ascending: false }),
        ]);

        const programs = programsRes.data || [];
        const affiliates = (affiliatesRes.data || []).map((af: any) => ({
          ...af,
          pix_chave_mascarada: af.pix_chave ? `****${af.pix_chave.slice(-4)}` : null,
        }));
        const payouts = (saquesRes.data || []).map((saq: any) => ({
          ...saq,
          afiliado_nome: saq.gsa_afiliados?.nome_divulgacao || 'Afiliado',
          codigo_publico: saq.gsa_afiliados?.codigo_publico,
          pix_tipo: saq.pix_tipo_snapshot,
          pix_chave: saq.pix_chave_snapshot,
        }));

        setSnapshot({
          summary: {
            afiliados_ativos: affiliates.filter((a: any) => a.status === 'ativo').length,
            cliques: 0,
            vendas_atribuidas: 0,
            comissoes_pendentes: 0,
            comissoes_disponiveis: 0,
            saques_pendentes: payouts.filter((p: any) => p.status === 'solicitado').length,
          },
          programs,
          affiliates,
          payouts,
        });
      }
    } catch (error: any) {
      console.error('Erro ao carregar programa de afiliados:', error);
      toast.error(error?.message || 'Não foi possível carregar o programa de afiliados.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadPointsSettings]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredAffiliates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    if (!query) return snapshot.affiliates;
    return snapshot.affiliates.filter((affiliate) =>
      [affiliate.nome_divulgacao, affiliate.codigo_publico, affiliate.status]
        .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(query)),
    );
  }, [search, snapshot.affiliates]);

  const setAffiliateStatus = async (affiliate: AffiliateRecord, status: 'ativo' | 'suspenso' | 'encerrado') => {
    if (affiliate.status === status) return;
    const label = status === 'ativo' ? 'reativar' : status === 'suspenso' ? 'suspender' : 'encerrar';
    if (!window.confirm(`Deseja ${label} o afiliado ${affiliate.nome_divulgacao}?`)) return;
    setWorkingId(affiliate.id);
    try {
      await callAdminRpc('gsa_admin_set_affiliate_status', {
        p_affiliate_id: affiliate.id,
        p_status: status,
        p_reason: `Alteração manual pelo painel financeiro: ${status}`,
      });
      toast.success('Status do afiliado atualizado.');
      await load(true);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível alterar o status.');
    } finally {
      setWorkingId(null);
    }
  };

  const decidePayout = async (payout: AffiliatePayout, action: 'approve' | 'reject' | 'mark_paid') => {
    const actionLabel = action === 'approve' ? 'aprovar' : action === 'reject' ? 'rejeitar' : 'marcar como pago';
    if (!window.confirm(`Deseja ${actionLabel} o saque de ${formatCurrency(asNumber(payout.valor))}?`)) return;
    setWorkingId(payout.id);
    try {
      await callAdminRpc('gsa_admin_decide_affiliate_payout', {
        p_payout_id: payout.id,
        p_action: action,
        p_notes: `Ação ${actionLabel} realizada no painel financeiro.`,
        p_paid_at: action === 'mark_paid' ? new Date().toISOString() : null,
      });
      toast.success('Solicitação de saque atualizada.');
      await load(true);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível processar o saque.');
    } finally {
      setWorkingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-neutral-200 bg-white" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <span className="sr-only">Carregando afiliados</span>
      </div>
    );
  }

  const summaryCards = [
    { label: 'Afiliados ativos', value: snapshot.summary.afiliados_ativos.toLocaleString('pt-BR'), icon: Users, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Vendas atribuídas', value: snapshot.summary.vendas_atribuidas.toLocaleString('pt-BR'), icon: Link2, color: 'text-sky-600 bg-sky-50' },
    { label: 'Em carência', value: formatCurrency(snapshot.summary.comissoes_pendentes), icon: Clock3, color: 'text-amber-600 bg-amber-50' },
    { label: 'Disponível', value: formatCurrency(snapshot.summary.comissoes_disponiveis), icon: Banknote, color: 'text-emerald-600 bg-emerald-50' },
  ];

  return (
    <section className="space-y-5" aria-labelledby="affiliate-admin-title">
      <div className="rounded-[2rem] bg-gradient-to-br from-neutral-950 via-neutral-900 to-indigo-950 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-indigo-300">Financeiro · Afiliados</p>
            <h1 id="affiliate-admin-title" className="mt-2 text-2xl font-black">Programa de Afiliados GSA</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">Configure percentuais, regras de pontos por venda, acompanhe saques e faça a gestão completa dos afiliados.</p>
          </div>
          <button type="button" onClick={() => load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black transition hover:bg-white/15 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <article key={label} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></span>
            <p className="mt-3 text-xl font-black text-neutral-950">{value}</p>
            <p className="mt-1 text-xs font-bold text-neutral-500">{label}</p>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm" role="tablist" aria-label="Gestão de afiliados">
        {([
          ['programas', 'Programas & Comissões', BadgePercent],
          ['pontos', 'Regras de Pontos', Star],
          ['afiliados', 'Afiliados', UserRoundCheck],
          ['saques', `Saques${snapshot.summary.saques_pendentes ? ` (${snapshot.summary.saques_pendentes})` : ''}`, Banknote],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition sm:flex-none ${tab === id ? 'bg-neutral-950 text-white shadow' : 'text-neutral-600 hover:bg-neutral-50'}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'programas' && (
        <div className="grid gap-4 xl:grid-cols-2">
          {snapshot.programs.map((program) => <ProgramEditor key={program.id} program={program} onSaved={() => load(true)} />)}
          {snapshot.programs.length === 0 && <EmptyState text="Nenhum programa cadastrado." />}
        </div>
      )}

      {tab === 'pontos' && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm max-w-3xl">
            <div className="flex items-center gap-3 border-b border-neutral-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Star className="h-5 w-5 fill-indigo-100" />
              </div>
              <div>
                <h2 className="text-lg font-black text-neutral-950">Configuração Global de Pontos Fidelidade</h2>
                <p className="text-xs text-neutral-500 font-medium">Defina o fator de conversão dos pontos em dinheiro para a carteira dos afiliados.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div>
                  <p className="font-black text-neutral-900 text-sm">Acúmulo de Pontos Ativo</p>
                  <p className="text-xs text-neutral-500">Permite que afiliados acumulem pontos ao gerar vendas.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPointsActive(!pointsActive)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black transition ${pointsActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-200 text-neutral-600'}`}
                >
                  {pointsActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  {pointsActive ? 'Ativo' : 'Desativado'}
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-neutral-700">
                  Pontos necessários para R$ 1,00 na Carteira
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={pointsRate}
                    onChange={(e) => setPointsRate(asNumber(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3.5 py-3 font-mono text-sm font-bold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <span className="mt-1 block text-[11px] text-neutral-400 font-normal">Ex: 100 pontos = R$ 1,00 de crédito.</span>
                </label>

                <label className="text-xs font-bold text-neutral-700">
                  Resgate Mínimo (Pontos)
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    value={minPointsRedeem}
                    onChange={(e) => setMinPointsRedeem(asNumber(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3.5 py-3 font-mono text-sm font-bold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <span className="mt-1 block text-[11px] text-neutral-400 font-normal">Quantidade mínima exigida para solicitar conversão.</span>
                </label>
              </div>

              <div className="rounded-2xl bg-indigo-50/60 border border-indigo-100 p-4 text-xs text-indigo-900 font-medium leading-relaxed">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <Zap className="h-4 w-4 text-indigo-600" /> Resumo do Modelo de Pontos:
                </div>
                <p>• <strong>Acúmulo</strong>: Definido por programa na aba "Programas & Comissões" (padrão: 1 ponto a cada R$ 1,00 em venda bruta).</p>
                <p>• <strong>Resgate</strong>: {pointsRate} pontos = {formatCurrency(1)} creditados na carteira do afiliado.</p>
              </div>

              <button
                type="button"
                onClick={savePointsSettings}
                disabled={savingPointsConfig}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 py-3.5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-indigo-600 disabled:opacity-60"
              >
                {savingPointsConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Configurações Globais de Pontos
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'afiliados' && (
        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 p-4">
            <label className="relative block max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <span className="sr-only">Buscar afiliado</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, código ou status" className="w-full rounded-xl border border-neutral-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </label>
          </div>
          <div className="divide-y divide-neutral-100">
            {filteredAffiliates.map((affiliate) => (
              <article key={affiliate.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(100px,.6fr))_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-neutral-950">{affiliate.nome_divulgacao}</h3>
                    <StatusBadge status={affiliate.status} />
                  </div>
                  <p className="mt-1 text-xs font-bold text-neutral-400">Código {affiliate.codigo_publico || '—'} · desde {affiliate.created_at ? formatDateTime(affiliate.created_at) : '—'}</p>
                </div>
                <Metric label="Cliques" value={asNumber(affiliate.cliques).toLocaleString('pt-BR')} />
                <Metric label="Conversões" value={asNumber(affiliate.conversoes).toLocaleString('pt-BR')} />
                <Metric label="Disponível" value={formatCurrency(asNumber(affiliate.saldo_disponivel))} />
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {affiliate.status !== 'ativo' && <SmallAction disabled={workingId === affiliate.id} onClick={() => setAffiliateStatus(affiliate, 'ativo')} tone="green" label="Ativar" />}
                  {affiliate.status === 'ativo' && <SmallAction disabled={workingId === affiliate.id} onClick={() => setAffiliateStatus(affiliate, 'suspenso')} tone="amber" label="Suspender" />}
                  {affiliate.status !== 'encerrado' && <SmallAction disabled={workingId === affiliate.id} onClick={() => setAffiliateStatus(affiliate, 'encerrado')} tone="red" label="Encerrar" />}
                </div>
              </article>
            ))}
            {filteredAffiliates.length === 0 && <EmptyState text="Nenhum afiliado encontrado." />}
          </div>
        </div>
      )}

      {tab === 'saques' && (
        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="divide-y divide-neutral-100">
            {snapshot.payouts.map((payout) => (
              <article key={payout.id} className="grid gap-4 p-4 lg:grid-cols-[1.3fr_.7fr_1fr_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-neutral-950">{payout.afiliado_nome || 'Afiliado'}</h3><StatusBadge status={payout.status} /></div>
                  <p className="mt-1 text-xs font-bold text-neutral-400">Solicitado em {payout.solicitado_em ? formatDateTime(payout.solicitado_em) : '—'}</p>
                </div>
                <Metric label="Valor" value={formatCurrency(asNumber(payout.valor))} />
                <Metric label={`PIX ${payout.pix_tipo || ''}`} value={payout.pix_chave || 'Chave protegida'} />
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {payout.status === 'solicitado' && <><SmallAction disabled={workingId === payout.id} onClick={() => decidePayout(payout, 'approve')} tone="green" label="Aprovar" icon="check" /><SmallAction disabled={workingId === payout.id} onClick={() => decidePayout(payout, 'reject')} tone="red" label="Rejeitar" icon="x" /></>}
                  {payout.status === 'aprovado' && <SmallAction disabled={workingId === payout.id} onClick={() => decidePayout(payout, 'mark_paid')} tone="green" label="Confirmar PIX" icon="shield" />}
                </div>
              </article>
            ))}
            {snapshot.payouts.length === 0 && <EmptyState text="Nenhuma solicitação de saque." />}
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">{label}</p><p className="mt-1 break-all text-sm font-black text-neutral-800">{value}</p></div>;
}

function SmallAction({ label, onClick, disabled, tone, icon }: { label: string; onClick: () => void; disabled?: boolean; tone: 'green' | 'amber' | 'red'; icon?: 'check' | 'x' | 'shield' }) {
  const colors = { green: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100', amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100', red: 'bg-rose-50 text-rose-700 hover:bg-rose-100' };
  const Icon = icon === 'check' ? CheckCircle2 : icon === 'x' ? XCircle : icon === 'shield' ? ShieldCheck : null;
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider transition disabled:opacity-50 ${colors[tone]}`}>{disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : Icon ? <Icon className="h-3.5 w-3.5" /> : null}{label}</button>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="col-span-full flex min-h-40 items-center justify-center p-8 text-center text-sm font-bold text-neutral-400">{text}</div>;
}
