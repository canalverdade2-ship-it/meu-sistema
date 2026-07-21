import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Image as ImageIcon,
  Landmark,
  MessageCircle,
  RefreshCcw,
  Search,
  Tags,
  UserRound,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { callAdminRpc } from '../../lib/adminRpc';
import { formatCurrency, formatDateTime } from '../../lib/utils';

interface ClassifiedsModuleProps {
  initialTab?: string;
  initialItemId?: string;
  colaboradorId?: string;
  colaboradorNome?: string | null;
}

type Tab = 'anuncios' | 'mensagens' | 'financeiro';

type PagedResult = {
  items: any[];
  total: number;
  page: number;
  page_size: number;
};

type ClassifiedDetail = {
  anuncio: Record<string, any>;
  anunciante: Record<string, any>;
  midias: Array<Record<string, any>>;
  ajustes: Array<Record<string, any>>;
};

const PAGE_SIZE = 40;

const configByTab: Record<Tab, { resource: string; status: string; label: string; icon: typeof Tags }> = {
  anuncios: { resource: 'classificados_anuncios', status: 'aguardando_revisao', label: 'Anúncios pendentes', icon: Tags },
  mensagens: { resource: 'classificados_mensagens', status: 'pendente', label: 'Mensagens pendentes', icon: MessageCircle },
  financeiro: { resource: 'classificados_transacoes', status: 'pendente_pagamento', label: 'Transações pendentes', icon: Landmark },
};

const fieldLabels: Record<string, string> = {
  titulo: 'Título',
  categoria: 'Categoria',
  descricao: 'Descrição',
  preco: 'Preço',
  cep: 'CEP',
  cidade: 'Cidade',
  estado: 'Estado',
  bairro: 'Bairro',
  midias: 'Imagens do anúncio',
  area: 'Área',
  quartos: 'Quartos',
  banheiros: 'Banheiros',
  vagas: 'Vagas',
  tipo: 'Tipo',
  marca: 'Marca / Modelo',
  modelo: 'Modelo',
  ano: 'Ano',
  quilometragem: 'Quilometragem',
  cambio: 'Câmbio',
  combustivel: 'Combustível',
  condicao: 'Condição',
};

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 'Não informado';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

function ReviewField({
  field,
  label,
  value,
  selected,
  onToggle,
  wide = false,
}: {
  field: string;
  label: string;
  value: unknown;
  selected: boolean;
  onToggle: (field: string) => void;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${selected ? 'border-amber-400 bg-amber-50' : 'border-neutral-200 bg-white'} ${wide ? 'md:col-span-2' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">{label}</p>
          <p className="mt-1 break-words text-sm font-bold text-neutral-900">{displayValue(value)}</p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-black text-amber-800">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(field)}
            className="h-4 w-4 rounded border-neutral-300 accent-amber-500"
          />
          Ajustar
        </label>
      </div>
    </div>
  );
}

export function ClassifiedsModule({ initialTab = 'anuncios', initialItemId }: ClassifiedsModuleProps) {
  const normalizedInitial = (['anuncios', 'mensagens', 'financeiro'].includes(initialTab) ? initialTab : 'anuncios') as Tab;
  const [activeTab, setActiveTab] = useState<Tab>(normalizedInitial);
  const [result, setResult] = useState<PagedResult>({ items: [], total: 0, page: 1, page_size: PAGE_SIZE });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClassifiedDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [adjustmentNote, setAdjustmentNote] = useState('');

  useEffect(() => {
    if (['anuncios', 'mensagens', 'financeiro'].includes(initialTab)) setActiveTab(initialTab as Tab);
  }, [initialTab]);

  useEffect(() => {
    setPage(1);
    setAppliedSearch('');
    setSearch('');
  }, [activeTab]);

  const load = useCallback(async () => {
    setLoading(true);
    const config = configByTab[activeTab];
    try {
      const data = await callAdminRpc<PagedResult>('gsa_admin_list_resource', {
        p_resource: config.resource,
        p_page: page,
        p_page_size: PAGE_SIZE,
        p_search: appliedSearch || null,
        p_status: config.status,
      });
      setResult({
        items: Array.isArray(data?.items) ? data.items : [],
        total: Number(data?.total || 0),
        page: Number(data?.page || page),
        page_size: Number(data?.page_size || PAGE_SIZE),
      });
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível carregar os classificados.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, appliedSearch, page]);

  useEffect(() => { void load(); }, [load]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setSelectedFields([]);
    setAdjustmentNote('');
    try {
      const data = await callAdminRpc<any>('gsa_admin_get_classified_detail', { p_anuncio_id: id });
      setDetail({
        anuncio: data?.anuncio || {},
        anunciante: data?.anunciante || {},
        midias: Array.isArray(data?.midias) ? data.midias : [],
        ajustes: Array.isArray(data?.ajustes) ? data.ajustes : [],
      });
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível carregar todos os dados do anúncio.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    if (processingId) return;
    setDetail(null);
    setSelectedFields([]);
    setAdjustmentNote('');
  };

  const toggleField = (field: string) => {
    setSelectedFields((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field]);
  };

  const act = async (entity: 'anuncio' | 'mensagem', item: any, action: 'aprovar' | 'rejeitar') => {
    let reason: string | null = null;
    if (action === 'rejeitar') {
      reason = adjustmentNote.trim();
      if (!reason) {
        toast.error('Informe o motivo da rejeição.');
        return;
      }
    }
    setProcessingId(item.id);
    try {
      await callAdminRpc('gsa_admin_classified_action', {
        p_entity: entity,
        p_id: item.id,
        p_related_id: entity === 'mensagem' ? item.proposta_id : null,
        p_action: action,
        p_reason: reason,
      });
      toast.success(action === 'aprovar' ? 'Registro aprovado e auditado.' : 'Registro rejeitado e auditado.');
      if (entity === 'anuncio') closeDetail();
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível concluir a moderação.');
    } finally {
      setProcessingId(null);
    }
  };

  const requestAdjustments = async () => {
    if (!detail?.anuncio?.id) return;
    if (selectedFields.length === 0) {
      toast.error('Marque pelo menos um campo que precisa ser corrigido.');
      return;
    }
    if (adjustmentNote.trim().length < 5) {
      toast.error('Explique ao anunciante o que deve ser corrigido.');
      return;
    }
    setProcessingId(detail.anuncio.id);
    try {
      await callAdminRpc('gsa_admin_request_classified_adjustments', {
        p_anuncio_id: detail.anuncio.id,
        p_campos: selectedFields,
        p_observacao: adjustmentNote.trim(),
      });
      toast.success('Ajustes enviados ao anunciante.');
      closeDetail();
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível solicitar os ajustes.');
    } finally {
      setProcessingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const tabs = Object.entries(configByTab) as Array<[Tab, (typeof configByTab)[Tab]]>;
  const highlighted = useMemo(() => initialItemId ? result.items.find((item) => item.id === initialItemId) : null, [initialItemId, result.items]);
  const ad = detail?.anuncio || {};
  const details = (ad.detalhes && typeof ad.detalhes === 'object' && !Array.isArray(ad.detalhes)) ? ad.detalhes : {};
  const pendingAdjustment = detail?.ajustes?.find((item) => item.status === 'pendente');

  return (
    <div className="space-y-6 pb-10">
      <header className="rounded-[2rem] bg-neutral-950 p-6 text-white shadow-xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Moderação segura</p><h1 className="mt-2 text-2xl font-black">Gestão de Classificados</h1><p className="mt-2 text-sm text-white/55">Análise completa dos dados, imagens e histórico enviado pelo anunciante.</p></div>
          <button type="button" onClick={() => void load()} disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-neutral-900 disabled:opacity-60"><RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-neutral-200 bg-white p-2">
        {tabs.map(([id, config]) => { const Icon = config.icon; return <button key={id} type="button" onClick={() => setActiveTab(id)} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold ${activeTab === id ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-neutral-500 hover:bg-neutral-50'}`}><Icon className="h-4 w-4" />{config.label}</button>; })}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setPage(1); setAppliedSearch(search.trim()); } }} placeholder="Pesquisar nos registros" className="w-full rounded-xl border border-neutral-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-500" /></div>
        <button type="button" onClick={() => { setPage(1); setAppliedSearch(search.trim()); }} className="rounded-xl bg-indigo-600 px-5 text-sm font-black text-white">Buscar</button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {loading ? <div className="flex min-h-[320px] items-center justify-center"><RefreshCcw className="h-8 w-8 animate-spin text-indigo-600" /></div> : result.items.length === 0 ? <div className="p-14 text-center text-neutral-400">Nenhum registro pendente.</div> : <div className="divide-y divide-neutral-100">{result.items.map((item) => (
          <article key={item.id} className={`p-5 ${highlighted?.id === item.id ? 'bg-indigo-50/70 ring-1 ring-inset ring-indigo-200' : ''}`}>
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div className="min-w-0">
                {activeTab === 'anuncios' && <><p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">{item.categoria || 'Anúncio'}</p><h2 className="mt-1 truncate font-black text-neutral-900">{item.titulo || `Anúncio ${String(item.id).slice(0, 8)}`}</h2><p className="mt-1 text-sm text-neutral-500">{item.preco != null ? formatCurrency(Number(item.preco)) : 'Preço não informado'} · {item.created_at ? formatDateTime(item.created_at) : 'sem data'}</p></>}
                {activeTab === 'mensagens' && <><p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Mensagem para moderação</p><p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-neutral-800">{item.conteudo || item.mensagem || 'Mensagem sem conteúdo.'}</p></>}
                {activeTab === 'financeiro' && <><p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Transação pendente</p><h2 className="mt-1 font-black text-neutral-900">Valor: {formatCurrency(Number(item.valor_final || 0))}</h2></>}
              </div>
              {activeTab === 'anuncios' ? (
                <button type="button" onClick={() => void openDetail(item.id)} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-xs font-black text-white"><Eye className="h-4 w-4" /> Analisar todos os dados</button>
              ) : activeTab !== 'financeiro' ? (
                <div className="flex shrink-0 gap-2"><button type="button" disabled={processingId === item.id} onClick={() => void act('mensagem', item, 'rejeitar')} className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-black text-red-700">Rejeitar</button><button type="button" disabled={processingId === item.id} onClick={() => void act('mensagem', item, 'aprovar')} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white">Aprovar</button></div>
              ) : null}
            </div>
          </article>
        ))}</div>}
      </section>

      <div className="flex items-center justify-between"><p className="text-xs font-bold text-neutral-400">Página {page} de {totalPages} · {result.total} registro(s)</p><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-neutral-200 p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-neutral-200 p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>

      {(detailLoading || detail) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] bg-neutral-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-4 sm:px-7">
              <div><h2 className="text-xl font-black text-neutral-950">Análise completa do anúncio</h2><p className="text-xs font-semibold text-neutral-500">Marque “Ajustar” em qualquer campo que precise ser corrigido.</p></div>
              <button type="button" onClick={closeDetail} className="rounded-full bg-neutral-100 p-2 text-neutral-600"><X className="h-5 w-5" /></button>
            </div>

            {detailLoading ? (
              <div className="flex min-h-[420px] items-center justify-center"><RefreshCcw className="h-9 w-9 animate-spin text-indigo-600" /></div>
            ) : detail ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                  <div className="space-y-6">
                    <section>
                      <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-neutral-500">Dados principais</h3>
                      <div className="grid gap-3 md:grid-cols-2">
                        <ReviewField field="titulo" label="Título" value={ad.titulo} selected={selectedFields.includes('titulo')} onToggle={toggleField} />
                        <ReviewField field="categoria" label="Categoria" value={ad.categoria} selected={selectedFields.includes('categoria')} onToggle={toggleField} />
                        <ReviewField field="preco" label="Preço" value={ad.preco != null ? formatCurrency(Number(ad.preco)) : null} selected={selectedFields.includes('preco')} onToggle={toggleField} />
                        <ReviewField field="status" label="Situação atual" value={ad.status} selected={false} onToggle={() => undefined} />
                        <ReviewField field="descricao" label="Descrição completa" value={ad.descricao} selected={selectedFields.includes('descricao')} onToggle={toggleField} wide />
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-neutral-500">Localização enviada</h3>
                      <div className="grid gap-3 md:grid-cols-2">
                        <ReviewField field="cep" label="CEP" value={details.cep} selected={selectedFields.includes('cep')} onToggle={toggleField} />
                        <ReviewField field="estado" label="Estado" value={ad.estado} selected={selectedFields.includes('estado')} onToggle={toggleField} />
                        <ReviewField field="cidade" label="Cidade" value={ad.cidade} selected={selectedFields.includes('cidade')} onToggle={toggleField} />
                        <ReviewField field="bairro" label="Bairro" value={ad.bairro} selected={selectedFields.includes('bairro')} onToggle={toggleField} />
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-neutral-500">Todos os detalhes específicos</h3>
                      {Object.entries(details).filter(([key]) => key !== 'cep').length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-5 text-sm font-semibold text-neutral-400">Nenhum detalhe específico foi enviado.</div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {Object.entries(details).filter(([key]) => key !== 'cep').map(([key, value]) => (
                            <ReviewField key={key} field={`detalhes.${key}`} label={fieldLabels[key] || key.replace(/_/g, ' ')} value={value} selected={selectedFields.includes(`detalhes.${key}`)} onToggle={toggleField} />
                          ))}
                        </div>
                      )}
                    </section>

                    <section>
                      <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-black uppercase tracking-wider text-neutral-500">Imagens enviadas ({detail.midias.length})</h3><label className="flex cursor-pointer items-center gap-2 text-xs font-black text-amber-800"><input type="checkbox" checked={selectedFields.includes('midias')} onChange={() => toggleField('midias')} className="h-4 w-4 accent-amber-500" /> Solicitar novas imagens</label></div>
                      {detail.midias.length === 0 ? (
                        <div className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-red-300 bg-red-50 text-sm font-bold text-red-700"><ImageIcon className="mr-2 h-5 w-5" /> Nenhuma imagem vinculada ao anúncio</div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                          {detail.midias.map((media, index) => <a key={media.id || media.url} href={media.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white"><div className="aspect-[4/3] overflow-hidden bg-neutral-100"><img src={media.url} alt={`Imagem ${index + 1}`} className="h-full w-full object-cover transition group-hover:scale-105" /></div><p className="px-3 py-2 text-xs font-black text-neutral-600">{index === 0 ? 'Capa' : `Imagem ${index + 1}`}</p></a>)}
                        </div>
                      )}
                    </section>
                  </div>

                  <aside className="space-y-4">
                    <div className="rounded-3xl bg-neutral-950 p-5 text-white"><UserRound className="mb-3 h-6 w-6 text-amber-400" /><p className="text-[10px] font-black uppercase tracking-wider text-white/45">Anunciante</p><p className="mt-1 text-lg font-black">{displayValue(detail.anunciante.nome)}</p><p className="mt-2 break-all text-xs text-white/60">{displayValue(detail.anunciante.email)}</p><p className="mt-1 text-xs text-white/60">{displayValue(detail.anunciante.telefone)}</p><p className="mt-3 text-xs font-bold text-amber-300">Cadastro: {displayValue(detail.anunciante.status)}</p></div>
                    <div className="rounded-3xl border border-neutral-200 bg-white p-5"><p className="text-xs font-black uppercase tracking-wider text-neutral-400">Informações da publicação</p><dl className="mt-3 space-y-2 text-sm"><div><dt className="text-xs text-neutral-400">Comissão aceita</dt><dd className="font-black">{displayValue(ad.comissao_percentual)}%</dd></div><div><dt className="text-xs text-neutral-400">Criado em</dt><dd className="font-bold">{ad.created_at ? formatDateTime(ad.created_at) : 'Não informado'}</dd></div><div><dt className="text-xs text-neutral-400">Atualizado em</dt><dd className="font-bold">{ad.updated_at ? formatDateTime(ad.updated_at) : 'Não informado'}</dd></div></dl></div>
                    {pendingAdjustment && <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-black uppercase tracking-wider text-amber-700">Ajuste pendente anterior</p><p className="mt-2 text-sm font-semibold text-amber-950">{pendingAdjustment.observacao}</p></div>}
                    <div className="rounded-3xl border border-neutral-200 bg-white p-5"><label className="text-xs font-black uppercase tracking-wider text-neutral-500">Orientação ou motivo</label><textarea value={adjustmentNote} onChange={(event) => setAdjustmentNote(event.target.value)} rows={6} placeholder="Explique claramente o que o anunciante deve corrigir..." className="mt-3 w-full resize-none rounded-2xl border border-neutral-200 p-3 text-sm outline-none focus:border-amber-500" /><p className="mt-2 text-xs font-semibold text-neutral-400">Campos marcados: {selectedFields.length}</p></div>
                  </aside>
                </div>
              </div>
            ) : null}

            {detail && !detailLoading && (
              <div className="grid gap-2 border-t border-neutral-200 bg-white p-4 sm:grid-cols-3 sm:px-7">
                <button type="button" disabled={!!processingId} onClick={() => void act('anuncio', ad, 'rejeitar')} className="flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-black text-red-700 disabled:opacity-50"><XCircle className="h-4 w-4" /> Rejeitar anúncio</button>
                <button type="button" disabled={!!processingId} onClick={() => void requestAdjustments()} className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-black disabled:opacity-50"><Wrench className="h-4 w-4" /> Solicitar ajustes</button>
                <button type="button" disabled={!!processingId} onClick={() => void act('anuncio', ad, 'aprovar')} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Aprovar e publicar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
