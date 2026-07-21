import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Landmark, MessageCircle, RefreshCcw, Search, Tags, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { callAdminRpc } from '../../lib/adminRpc';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { supabase } from '../../lib/supabase';

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

const PAGE_SIZE = 40;

const configByTab: Record<Tab, { resource: string; status: string; label: string; icon: typeof Tags }> = {
  anuncios: { resource: 'classificados_anuncios', status: 'aguardando_revisao', label: 'Anúncios pendentes', icon: Tags },
  mensagens: { resource: 'classificados_mensagens', status: 'pendente', label: 'Mensagens pendentes', icon: MessageCircle },
  financeiro: { resource: 'classificados_transacoes', status: 'pendente_pagamento', label: 'Transações pendentes', icon: Landmark },
};

export function ClassifiedsModule({ initialTab = 'anuncios', initialItemId }: ClassifiedsModuleProps) {
  const normalizedInitial = (['anuncios', 'mensagens', 'financeiro'].includes(initialTab) ? initialTab : 'anuncios') as Tab;
  const [activeTab, setActiveTab] = useState<Tab>(normalizedInitial);
  const [result, setResult] = useState<PagedResult>({ items: [], total: 0, page: 1, page_size: PAGE_SIZE });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [detailsItem, setDetailsItem] = useState<any>(null);
  const [detailsMedia, setDetailsMedia] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  useEffect(() => {
    if (detailsItem && activeTab === 'anuncios') {
      setLoadingMedia(true);
      supabase
        .from('classificados_midias')
        .select('url, tipo, ordem')
        .eq('anuncio_id', detailsItem.id)
        .order('ordem', { ascending: true })
        .then(({ data, error }) => {
          if (error) console.error('Erro ao buscar mídias:', error);
          setDetailsMedia(data || []);
          setLoadingMedia(false);
        });
    } else {
      setDetailsMedia([]);
    }
  }, [detailsItem, activeTab]);

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
      const items = Array.isArray(data?.items) ? data.items : [];
      setResult({
        items,
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

  const act = async (entity: 'anuncio' | 'mensagem', item: any, action: 'aprovar' | 'rejeitar') => {
    let reason: string | null = null;
    if (entity === 'anuncio' && action === 'rejeitar') {
      reason = window.prompt('Motivo da rejeição do anúncio:')?.trim() || null;
      if (!reason) return;
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
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível concluir a moderação.');
    } finally {
      setProcessingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const tabs = Object.entries(configByTab) as Array<[Tab, (typeof configByTab)[Tab]]>;
  const highlighted = useMemo(() => initialItemId ? result.items.find((item) => item.id === initialItemId) : null, [initialItemId, result.items]);

  return (
    <div className="space-y-6 pb-10">
      <header className="rounded-[2rem] bg-neutral-950 p-6 text-white shadow-xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Moderação segura</p><h1 className="mt-2 text-2xl font-black">Gestão de Classificados</h1><p className="mt-2 text-sm text-white/55">Listagens paginadas e decisões registradas no servidor.</p></div>
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
                {activeTab === 'mensagens' && <><p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Mensagem para moderação</p><p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-neutral-800">{item.conteudo || item.mensagem || 'Mensagem sem conteúdo.'}</p><p className="mt-2 text-xs text-neutral-400">Proposta {String(item.proposta_id || '').slice(0, 8)} · {item.created_at ? formatDateTime(item.created_at) : 'sem data'}</p></>}
                {activeTab === 'financeiro' && <><p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Transação pendente</p><h2 className="mt-1 font-black text-neutral-900">Comissão GSA: {formatCurrency(Number(item.valor_comissao || 0))}</h2><p className="mt-1 text-sm text-neutral-500">Valor total: {formatCurrency(Number(item.valor_total || item.valor_proposta || 0))} · {item.created_at ? formatDateTime(item.created_at) : 'sem data'}</p></>}
              </div>
              {activeTab !== 'financeiro' && <div className="flex shrink-0 gap-2">
                {activeTab === 'anuncios' && <button type="button" onClick={() => setDetailsItem(item)} className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-100"><Search className="h-4 w-4" /> Detalhes</button>}
                <button type="button" disabled={processingId === item.id} onClick={() => void act(activeTab === 'anuncios' ? 'anuncio' : 'mensagem', item, 'rejeitar')} className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-black text-red-700 disabled:opacity-50 hover:bg-red-100"><XCircle className="h-4 w-4" /> Rejeitar</button>
                <button type="button" disabled={processingId === item.id} onClick={() => void act(activeTab === 'anuncios' ? 'anuncio' : 'mensagem', item, 'aprovar')} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50 hover:bg-emerald-700"><CheckCircle2 className="h-4 w-4" /> Aprovar</button>
              </div>}
            </div>
          </article>
        ))}</div>}
      </section>

      <div className="flex items-center justify-between"><p className="text-xs font-bold text-neutral-400">Página {page} de {totalPages} · {result.total} registro(s)</p><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-neutral-200 p-2 disabled:opacity-40 hover:bg-neutral-50"><ChevronLeft className="h-4 w-4" /></button><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-neutral-200 p-2 disabled:opacity-40 hover:bg-neutral-50"><ChevronRight className="h-4 w-4" /></button></div></div>

      {detailsItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setDetailsItem(null)}>
          <div className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-neutral-100 p-6">
              <h2 className="text-xl font-black text-neutral-900">Detalhes do Anúncio</h2>
              <button onClick={() => setDetailsItem(null)} className="rounded-full bg-neutral-100 p-2 text-neutral-500 hover:bg-neutral-200 transition-colors"><XCircle className="h-5 w-5" /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Título</p><p className="font-medium text-neutral-900">{detailsItem.titulo || '-'}</p></div>
                <div><p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Categoria</p><p className="font-medium text-neutral-900">{detailsItem.categoria || '-'}</p></div>
                <div><p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Preço</p><p className="font-medium text-indigo-700">{detailsItem.preco != null ? formatCurrency(Number(detailsItem.preco)) : '-'}</p></div>
                <div><p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Condição</p><p className="font-medium text-neutral-900">{detailsItem.condicao || '-'}</p></div>
                <div><p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">CEP</p><p className="font-medium text-neutral-900">{detailsItem.cep || '-'}</p></div>
                <div><p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Localização</p><p className="font-medium text-neutral-900">{detailsItem.cidade ? `${detailsItem.cidade} - ${detailsItem.estado}` : '-'}</p></div>
              </div>

              {detailsItem.detalhes && Object.keys(detailsItem.detalhes).length > 0 && (
                <div>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Detalhes Específicos</p>
                  <div className="grid grid-cols-2 gap-4 rounded-xl bg-neutral-50 p-4 border border-neutral-100">
                    {Object.entries(detailsItem.detalhes).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{key}</p>
                        <p className="font-medium text-neutral-900">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div><p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Descrição</p><p className="mt-2 whitespace-pre-wrap rounded-xl bg-neutral-50 p-4 text-sm text-neutral-700 leading-relaxed border border-neutral-100">{detailsItem.descricao || 'Sem descrição.'}</p></div>
              
              <div>
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Imagens do Anúncio</p>
                {loadingMedia ? (
                  <div className="flex h-32 items-center justify-center rounded-xl bg-neutral-50 border border-neutral-100">
                    <RefreshCcw className="h-6 w-6 animate-spin text-neutral-400" />
                  </div>
                ) : detailsMedia.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {detailsMedia.map((media, idx) => (
                      <div key={idx} className="relative aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                        <img src={media.url} alt={`Imagem ${idx + 1}`} className="h-full w-full object-cover" />
                        {idx === 0 && (
                          <div className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-black text-white backdrop-blur-md">CAPA</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-32 items-center justify-center rounded-xl bg-neutral-50 border border-neutral-100">
                    <p className="text-sm text-neutral-400">Nenhuma imagem encontrada.</p>
                  </div>
                )}
              </div>
            </div>
            <footer className="border-t border-neutral-100 bg-neutral-50 p-5 flex justify-end gap-3">
              <button onClick={() => setDetailsItem(null)} className="rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition-colors">Fechar</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
