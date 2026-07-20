import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Loader2,
  PackagePlus,
  Plane,
  Plus,
  Receipt,
  RefreshCcw,
  Send,
  Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../../lib/utils';
import { Modal } from '../ui/Modal';

type AdminTab = 'solicitacoes' | 'pacotes' | 'propostas' | 'transacoes';

const inputClass =
  'w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';
const labelClass = 'mb-2 block text-xs font-black uppercase tracking-wider text-neutral-500';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function createSlug(title: string) {
  const base = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base || 'pacote'}-${crypto.randomUUID().slice(0, 6)}`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    recebido: 'bg-blue-100 text-blue-700',
    em_analise: 'bg-amber-100 text-amber-700',
    buscando_opcoes: 'bg-violet-100 text-violet-700',
    propostas_disponiveis: 'bg-emerald-100 text-emerald-700',
    aguardando_cliente: 'bg-orange-100 text-orange-700',
    proposta_aceita: 'bg-emerald-100 text-emerald-700',
    convertido_em_reserva: 'bg-indigo-100 text-indigo-700',
    encerrado: 'bg-neutral-100 text-neutral-700',
    cancelado: 'bg-red-100 text-red-700',
    rascunho: 'bg-neutral-100 text-neutral-700',
    publicada: 'bg-emerald-100 text-emerald-700',
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
    compra_fornecedor_pendente: 'bg-amber-100 text-amber-800',
    compra_fornecedor_em_andamento: 'bg-violet-100 text-violet-800',
    pacote_adquirido: 'bg-indigo-100 text-indigo-800',
    emissao_em_andamento: 'bg-purple-100 text-purple-800',
    documentos_disponiveis: 'bg-emerald-100 text-emerald-800',
    viagem_confirmada: 'bg-emerald-100 text-emerald-800',
    concluida: 'bg-neutral-100 text-neutral-800',
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${colors[status] || 'bg-neutral-100 text-neutral-700'}`}>
      {String(status || 'sem status').replace(/_/g, ' ')}
    </span>
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
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight text-neutral-900">
          <Plane className="h-6 w-6 text-indigo-600" /> Módulo de Viagens
        </h2>
        <p className="text-neutral-500">Gerencie o catálogo e acompanhe a jornada do orçamento até a emissão.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm lg:grid-cols-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}
            >
              <Icon className="h-4 w-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
        {activeTab === 'solicitacoes' && <SolicitacoesTab />}
        {activeTab === 'pacotes' && <PacotesTab />}
        {activeTab === 'propostas' && <PropostasTab />}
        {activeTab === 'transacoes' && <TransacoesTab />}
      </div>
    </div>
  );
}

function SolicitacoesTab() {
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [savingProposal, setSavingProposal] = useState(false);
  const [proposalForm, setProposalForm] = useState({
    titulo: '',
    valor_total: '',
    parcelamento_permitido: '1',
    validade_horas: '48',
    prazo_pagamento_dias: '2',
    condicoes: '',
  });

  const fetchSolicitacoes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('viagens_orcamentos')
        .select('*, viagens_pacotes(titulo, preco_venda)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSolicitacoes(data || []);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Erro ao buscar orçamentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSolicitacoes();
  }, []);

  const openProposal = (quote: any) => {
    if (!quote.cliente_id) {
      toast.error('Este orçamento foi enviado como visitante. Vincule o lead a um cliente antes de gerar a proposta.');
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
      const { error } = await supabase.from('viagens_orcamentos').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      setSolicitacoes((items) => items.map((item) => (item.id === id ? { ...item, status } : item)));
      toast.success('Status atualizado.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível atualizar o status.');
    }
  };

  const createProposal = async () => {
    if (!selected?.cliente_id) return;
    const value = Number(proposalForm.valor_total.replace(/\./g, '').replace(',', '.'));
    if (!proposalForm.titulo.trim() || !Number.isFinite(value) || value <= 0) {
      toast.error('Informe título e valor total válidos.');
      return;
    }

    let reservationId: string | null = null;
    try {
      setSavingProposal(true);
      const now = new Date();
      const acceptanceDeadline = new Date(now.getTime() + Number(proposalForm.validade_horas || 48) * 60 * 60 * 1000);
      const paymentDeadline = new Date(acceptanceDeadline.getTime() + Number(proposalForm.prazo_pagamento_dias || 2) * 24 * 60 * 60 * 1000);
      const snapshot = {
        titulo: proposalForm.titulo.trim(),
        origem: selected.origem,
        destino: selected.destino,
        data_ida: selected.data_ida,
        data_volta: selected.data_volta,
        adultos: selected.adultos,
        criancas: selected.criancas,
        bebes: selected.bebes,
        preferencia_hospedagem: selected.preferencia_hospedagem,
        observacoes: selected.observacoes,
        pacote_id: selected.pacote_id,
        protocolo_orcamento: selected.protocolo,
      };

      const { data: reservation, error: reservationError } = await supabase
        .from('viagens_solicitacoes_reserva')
        .insert({
          pacote_id: selected.pacote_id || null,
          cliente_id: selected.cliente_id,
          protocolo: `RES-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          adultos: selected.adultos || 1,
          criancas: selected.criancas || 0,
          bebes: selected.bebes || 0,
          snapshot_pacote: snapshot,
          status: 'proposta_disponivel',
          observacoes_cliente: selected.observacoes,
        })
        .select('id')
        .single();
      if (reservationError) throw reservationError;
      reservationId = reservation.id;

      const { error: proposalError } = await supabase.from('viagens_propostas').insert({
        reserva_id: reservation.id,
        cliente_id: selected.cliente_id,
        snapshot_completo: snapshot,
        valor_total: value,
        parcelamento_permitido: Number(proposalForm.parcelamento_permitido || 1),
        condicoes: proposalForm.condicoes.trim() || null,
        prazo_aceitacao: acceptanceDeadline.toISOString(),
        prazo_pagamento: paymentDeadline.toISOString(),
        status: 'enviada',
      });
      if (proposalError) throw proposalError;

      const { error: quoteError } = await supabase
        .from('viagens_orcamentos')
        .update({ status: 'propostas_disponiveis', updated_at: new Date().toISOString() })
        .eq('id', selected.id);
      if (quoteError) throw quoteError;

      toast.success('Proposta criada e disponibilizada ao cliente.');
      setSelected(null);
      await fetchSolicitacoes();
    } catch (error: any) {
      console.error(error);
      if (reservationId) {
        await supabase.from('viagens_solicitacoes_reserva').delete().eq('id', reservationId);
      }
      toast.error(error?.message || 'Não foi possível gerar a proposta.');
    } finally {
      setSavingProposal(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div><h3 className="text-lg font-bold">Solicitações de orçamento</h3><p className="text-sm text-neutral-500">Leads públicos e solicitações de clientes.</p></div>
        <button onClick={fetchSolicitacoes} className="flex items-center gap-2 rounded-xl bg-neutral-100 px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-200"><RefreshCcw className="h-4 w-4" /> Atualizar</button>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>
      ) : solicitacoes.length === 0 ? (
        <p className="py-10 text-center text-neutral-500">Nenhuma solicitação encontrada.</p>
      ) : (
        <div className="space-y-3">
          {solicitacoes.map((quote) => (
            <article key={quote.id} className="rounded-2xl border border-neutral-200 p-4 sm:p-5">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2"><StatusBadge status={quote.status} /><span className="text-xs font-bold text-neutral-400">{quote.protocolo}</span>{!quote.cliente_id && <span className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase text-cyan-700">Lead público</span>}</div>
                  <h4 className="truncate text-lg font-black text-neutral-900">{quote.viagens_pacotes?.titulo || `${quote.origem} → ${quote.destino}`}</h4>
                  <p className="mt-1 text-sm text-neutral-500">{quote.nome || 'Cliente cadastrado'} · {quote.email || quote.telefone || 'Contato pelo cadastro'} · {formatDate(quote.created_at)}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select value={quote.status} onChange={(event) => updateStatus(quote.id, event.target.value)} className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold">
                    <option value="recebido">Recebido</option><option value="em_analise">Em análise</option><option value="buscando_opcoes">Buscando opções</option><option value="propostas_disponiveis">Proposta disponível</option><option value="aguardando_cliente">Aguardando cliente</option><option value="encerrado">Encerrado</option><option value="cancelado">Cancelado</option>
                  </select>
                  <button onClick={() => openProposal(quote)} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"><Send className="h-4 w-4" /> Gerar proposta</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title="Gerar proposta de viagem" size="xl">
        {selected && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600"><strong>{selected.protocolo}</strong> · {selected.origem} → {selected.destino} · {selected.adultos || 1} adulto(s)</div>
            <label className={labelClass}>Título da proposta<input value={proposalForm.titulo} onChange={(event) => setProposalForm((value) => ({ ...value, titulo: event.target.value }))} className={`${inputClass} mt-2`} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>Valor total<input value={proposalForm.valor_total} onChange={(event) => setProposalForm((value) => ({ ...value, valor_total: event.target.value }))} placeholder="0,00" className={`${inputClass} mt-2`} /></label>
              <label className={labelClass}>Parcelamento máximo<input type="number" min="1" max="24" value={proposalForm.parcelamento_permitido} onChange={(event) => setProposalForm((value) => ({ ...value, parcelamento_permitido: event.target.value }))} className={`${inputClass} mt-2`} /></label>
              <label className={labelClass}>Validade do aceite (horas)<input type="number" min="1" value={proposalForm.validade_horas} onChange={(event) => setProposalForm((value) => ({ ...value, validade_horas: event.target.value }))} className={`${inputClass} mt-2`} /></label>
              <label className={labelClass}>Prazo para pagamento (dias)<input type="number" min="1" value={proposalForm.prazo_pagamento_dias} onChange={(event) => setProposalForm((value) => ({ ...value, prazo_pagamento_dias: event.target.value }))} className={`${inputClass} mt-2`} /></label>
            </div>
            <label className={labelClass}>Condições<textarea rows={4} value={proposalForm.condicoes} onChange={(event) => setProposalForm((value) => ({ ...value, condicoes: event.target.value }))} className={`${inputClass} mt-2 h-auto`} /></label>
            <button onClick={createProposal} disabled={savingProposal} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-black text-white hover:bg-indigo-700 disabled:opacity-60">{savingProposal ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}{savingProposal ? 'Criando proposta...' : 'Enviar proposta ao cliente'}</button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function PacotesTab() {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ titulo: '', categoria: 'nacional', origem: '', destino: '', data_ida: '', data_volta: '', dias: '', noites: '', preco_venda: '', parcelamento_maximo: '1', imagem_url: '' });

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('viagens_pacotes').select('id, titulo, slug, categoria, origem, destino, dias, noites, preco_venda, status, created_at, viagens_pacote_imagens(url, is_capa)').order('created_at', { ascending: false });
      if (error) throw error;
      setPackages(data || []);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar pacotes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPackages(); }, []);

  const savePackage = async () => {
    const price = Number(form.preco_venda.replace(/\./g, '').replace(',', '.'));
    if (!form.titulo.trim() || !form.destino.trim() || !Number.isFinite(price) || price <= 0) {
      toast.error('Informe título, destino e preço válidos.');
      return;
    }
    try {
      setSaving(true);
      const { data, error } = await supabase.from('viagens_pacotes').insert({
        titulo: form.titulo.trim(), slug: createSlug(form.titulo), categoria: form.categoria, origem: form.origem.trim() || null, destino: form.destino.trim(), data_ida: form.data_ida || null, data_volta: form.data_volta || null, dias: Number(form.dias) || null, noites: Number(form.noites) || null, preco_venda: price, parcelamento_maximo: Number(form.parcelamento_maximo) || 1, status: 'rascunho',
      }).select('id').single();
      if (error) throw error;
      if (form.imagem_url.trim()) {
        const { error: imageError } = await supabase.from('viagens_pacote_imagens').insert({ pacote_id: data.id, url: form.imagem_url.trim(), is_capa: true, ordem: 0 });
        if (imageError) throw imageError;
      }
      toast.success('Pacote criado como rascunho.');
      setShowForm(false);
      setForm({ titulo: '', categoria: 'nacional', origem: '', destino: '', data_ida: '', data_volta: '', dias: '', noites: '', preco_venda: '', parcelamento_maximo: '1', imagem_url: '' });
      await fetchPackages();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível criar o pacote.');
    } finally {
      setSaving(false);
    }
  };

  const updatePackageStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('viagens_pacotes').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return toast.error(error.message);
    setPackages((items) => items.map((item) => (item.id === id ? { ...item, status } : item)));
    toast.success('Pacote atualizado.');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4"><div><h3 className="text-lg font-bold">Catálogo de pacotes</h3><p className="text-sm text-neutral-500">Cadastre ofertas e controle a publicação.</p></div><button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"><Plus className="h-4 w-4" /> Novo pacote</button></div>
      {loading ? <div className="flex justify-center p-10"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div> : packages.length === 0 ? <p className="py-10 text-center text-neutral-500">Nenhum pacote cadastrado.</p> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {packages.map((pkg) => {
            const cover = pkg.viagens_pacote_imagens?.find((image: any) => image.is_capa)?.url || pkg.viagens_pacote_imagens?.[0]?.url;
            return <article key={pkg.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">{cover ? <img src={cover} alt={pkg.titulo} className="h-36 w-full object-cover" /> : <div className="flex h-36 items-center justify-center bg-neutral-100"><Plane className="h-10 w-10 text-neutral-300" /></div>}<div className="p-5"><div className="mb-2 flex items-center justify-between gap-2"><StatusBadge status={pkg.status} /><span className="text-xs font-bold uppercase text-neutral-400">{pkg.categoria}</span></div><h4 className="line-clamp-2 font-black text-neutral-900">{pkg.titulo}</h4><p className="mt-1 text-sm text-neutral-500">{pkg.destino} · {pkg.dias || '—'} dias</p><p className="mt-4 text-lg font-black text-indigo-700">{formatCurrency(pkg.preco_venda)}</p><select value={pkg.status} onChange={(event) => updatePackageStatus(pkg.id, event.target.value)} className="mt-4 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold"><option value="rascunho">Rascunho</option><option value="aguardando_revisao">Aguardando revisão</option><option value="publicado">Publicado</option><option value="disponibilidade_sob_consulta">Sob consulta</option><option value="pausado">Pausado</option><option value="esgotado">Esgotado</option><option value="arquivado">Arquivado</option></select></div></article>;
          })}
        </div>
      )}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Novo pacote de viagem" size="2xl">
        <div className="space-y-4"><label className={labelClass}>Título<input value={form.titulo} onChange={(event) => setForm((value) => ({ ...value, titulo: event.target.value }))} className={`${inputClass} mt-2`} /></label><div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Categoria<select value={form.categoria} onChange={(event) => setForm((value) => ({ ...value, categoria: event.target.value }))} className={`${inputClass} mt-2`}><option value="nacional">Nacional</option><option value="internacional">Internacional</option><option value="excursao">Excursão</option></select></label><label className={labelClass}>Preço de venda<input value={form.preco_venda} onChange={(event) => setForm((value) => ({ ...value, preco_venda: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Origem<input value={form.origem} onChange={(event) => setForm((value) => ({ ...value, origem: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Destino<input value={form.destino} onChange={(event) => setForm((value) => ({ ...value, destino: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Data de ida<input type="date" value={form.data_ida} onChange={(event) => setForm((value) => ({ ...value, data_ida: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Data de volta<input type="date" value={form.data_volta} onChange={(event) => setForm((value) => ({ ...value, data_volta: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Dias<input type="number" value={form.dias} onChange={(event) => setForm((value) => ({ ...value, dias: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Noites<input type="number" value={form.noites} onChange={(event) => setForm((value) => ({ ...value, noites: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Parcelas máximas<input type="number" min="1" value={form.parcelamento_maximo} onChange={(event) => setForm((value) => ({ ...value, parcelamento_maximo: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>URL da imagem de capa<input value={form.imagem_url} onChange={(event) => setForm((value) => ({ ...value, imagem_url: event.target.value }))} className={`${inputClass} mt-2`} /></label></div><button onClick={savePackage} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-black text-white disabled:opacity-60">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackagePlus className="h-5 w-5" />}{saving ? 'Salvando...' : 'Criar pacote'}</button></div>
      </Modal>
    </div>
  );
}

function PropostasTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { try { const { data, error } = await supabase.from('viagens_propostas').select('id, cliente_id, status, valor_total, prazo_aceitacao, prazo_pagamento, created_at, snapshot_completo, viagens_solicitacoes_reserva(protocolo)').order('created_at', { ascending: false }); if (error) throw error; setItems(data || []); } catch (error: any) { toast.error(error?.message || 'Erro ao carregar propostas.'); } finally { setLoading(false); } })(); }, []);
  return <div className="space-y-4"><div><h3 className="text-lg font-bold">Propostas enviadas</h3><p className="text-sm text-neutral-500">Acompanhe aceite e vencimentos.</p></div>{loading ? <div className="flex justify-center p-10"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div> : items.length === 0 ? <p className="py-10 text-center text-neutral-500">Nenhuma proposta encontrada.</p> : <div className="space-y-3">{items.map((proposal) => <article key={proposal.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-neutral-200 p-5 md:flex-row md:items-center"><div><div className="mb-2 flex items-center gap-2"><StatusBadge status={proposal.status} /><span className="text-xs text-neutral-400">{proposal.viagens_solicitacoes_reserva?.protocolo}</span></div><h4 className="font-black text-neutral-900">{proposal.snapshot_completo?.titulo || proposal.snapshot_completo?.destino || 'Proposta personalizada'}</h4><p className="mt-1 text-sm text-neutral-500">Aceite até {formatDate(proposal.prazo_aceitacao)}</p></div><div className="text-left md:text-right"><p className="text-xl font-black text-indigo-700">{formatCurrency(proposal.valor_total)}</p><p className="text-xs text-neutral-400">Pagamento até {formatDate(proposal.prazo_pagamento)}</p></div></article>)}</div>}</div>;
}

function TransacoesTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchItems = async () => { try { setLoading(true); const { data, error } = await supabase.from('viagens_transacoes').select('id, cliente_id, status, valor_pago, forma_pagamento, created_at, viagens_propostas(snapshot_completo), viagens_vouchers(id)').order('created_at', { ascending: false }); if (error) throw error; setItems(data || []); } catch (error: any) { toast.error(error?.message || 'Erro ao carregar transações.'); } finally { setLoading(false); } };
  useEffect(() => { fetchItems(); }, []);
  const updateStatus = async (id: string, status: string) => { const { error } = await supabase.from('viagens_transacoes').update({ status, updated_at: new Date().toISOString() }).eq('id', id); if (error) return toast.error(error.message); setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item)); toast.success('Etapa da viagem atualizada.'); };
  return <div className="space-y-4"><div className="flex items-center justify-between"><div><h3 className="text-lg font-bold">Reservas e transações</h3><p className="text-sm text-neutral-500">Controle pagamento, compra, emissão e conclusão.</p></div><button onClick={fetchItems} className="rounded-xl bg-neutral-100 p-2 text-neutral-600"><RefreshCcw className="h-4 w-4" /></button></div>{loading ? <div className="flex justify-center p-10"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div> : items.length === 0 ? <p className="py-10 text-center text-neutral-500">Nenhuma transação encontrada.</p> : <div className="space-y-3">{items.map((transaction) => <article key={transaction.id} className="rounded-2xl border border-neutral-200 p-5"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><div className="mb-2 flex items-center gap-2"><StatusBadge status={transaction.status} /><span className="text-xs text-neutral-400">{transaction.viagens_vouchers?.length || 0} voucher(s)</span></div><h4 className="font-black text-neutral-900">{transaction.viagens_propostas?.snapshot_completo?.titulo || transaction.viagens_propostas?.snapshot_completo?.destino || 'Viagem personalizada'}</h4><p className="mt-1 text-sm text-neutral-500">{formatCurrency(transaction.valor_pago)} · {transaction.forma_pagamento || 'pagamento não definido'} · {formatDate(transaction.created_at)}</p></div><select value={transaction.status} onChange={(event) => updateStatus(transaction.id, event.target.value)} className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold"><option value="pendente">Pendente</option><option value="pagamento_confirmado">Pagamento confirmado</option><option value="compra_fornecedor_pendente">Compra pendente</option><option value="compra_fornecedor_em_andamento">Compra em andamento</option><option value="pacote_adquirido">Pacote adquirido</option><option value="emissao_em_andamento">Emissão em andamento</option><option value="documentos_disponiveis">Documentos disponíveis</option><option value="viagem_confirmada">Viagem confirmada</option><option value="concluida">Concluída</option><option value="cancelada">Cancelada</option><option value="reembolso_em_analise">Reembolso em análise</option><option value="reembolsada">Reembolsada</option></select></div></article>)}</div>}</div>;
}
