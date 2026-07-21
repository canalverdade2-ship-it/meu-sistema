import React, { useState, useEffect } from 'react';
import { AlertTriangle, Tags, PlusCircle, Clock, ChevronRight, Eye, Wrench } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { navigate } from '../../../../routing/navigationService';
import { routes } from '../../../../routing/routeCatalog';
import { EditClassifiedListingPage } from './EditClassifiedListingPage';

const fieldLabels: Record<string, string> = {
  titulo: 'Título', categoria: 'Categoria', descricao: 'Descrição', preco: 'Preço', cep: 'CEP',
  cidade: 'Cidade', estado: 'Estado', bairro: 'Bairro', midias: 'Imagens',
};

export function MyClassifiedsPage({ clientId }: { clientId: string }) {
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { void fetchMyAds(); }, [clientId]);

  const fetchMyAds = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('classificados_anuncios')
        .select(`
          id, slug, titulo, preco, status, categoria, created_at,
          classificados_propostas(id),
          classificados_ajustes(id, campos, observacao, status, created_at)
        `)
        .eq('cliente_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAds(data || []);
    } catch (err) { console.error('Erro ao carregar anúncios do cliente:', err); }
    finally { setLoading(false); }
  };

  const getStatusBadge = (status: string) => {
    const configs: any = {
      rascunho: { color: 'bg-neutral-100 text-neutral-600', label: 'Rascunho' },
      aguardando_revisao: { color: 'bg-amber-100 text-amber-700', label: 'Em revisão' },
      ajustes_solicitados: { color: 'bg-orange-100 text-orange-800', label: 'Ajustes solicitados' },
      aprovado: { color: 'bg-emerald-100 text-emerald-700', label: 'Aprovado' },
      publicado: { color: 'bg-blue-100 text-blue-700', label: 'Publicado' },
      rejeitado: { color: 'bg-red-100 text-red-700', label: 'Rejeitado' },
      vendido: { color: 'bg-purple-100 text-purple-700', label: 'Vendido' },
    };
    const c = configs[status] || { color: 'bg-neutral-100 text-neutral-600', label: status };
    return <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${c.color}`}>{c.label}</span>;
  };

  if (editingId) return <EditClassifiedListingPage clientId={clientId} anuncioId={editingId} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div><h2 className="text-2xl font-black text-[#1a1a1a]">Meus Classificados</h2><p className="text-neutral-500">Gerencie seus anúncios, ajustes e propostas.</p></div>
        <button onClick={() => navigate(routes.marketplace.classifieds.anunciar())} className="flex items-center gap-2 px-6 py-3 bg-[#1a1a1a] text-white rounded-full font-bold"><PlusCircle className="h-4 w-4" /> Novo Anúncio</button>
      </div>

      <div className="bg-white rounded-3xl border border-black/5 overflow-hidden">
        {loading ? <div className="p-10 flex justify-center"><div className="animate-spin h-8 w-8 border-4 border-[#1a1a1a] border-t-transparent rounded-full" /></div> : ads.length === 0 ? (
          <div className="p-16 flex flex-col items-center text-center"><Tags className="h-12 w-12 text-neutral-300 mb-4" /><h3 className="text-xl font-bold mb-2">Você ainda não tem anúncios</h3><p className="text-neutral-500 mb-6">Crie seu primeiro anúncio e alcance compradores qualificados.</p><button onClick={() => navigate(routes.marketplace.classifieds.anunciar())} className="px-6 py-3 bg-black text-white rounded-full font-bold">Criar Primeiro Anúncio</button></div>
        ) : (
          <div className="divide-y divide-black/5">
            {ads.map((ad) => {
              const pending = (ad.classificados_ajustes || []).filter((item: any) => item.status === 'pendente').sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
              const fields = Array.isArray(pending?.campos) ? pending.campos : [];
              return (
                <div key={ad.id} className="p-6 hover:bg-neutral-50 transition-colors">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2"><span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{ad.categoria}</span>{getStatusBadge(ad.status)}</div>
                      <h4 className="text-lg font-bold text-neutral-900 truncate">{ad.titulo}</h4>
                      <div className="flex items-center gap-4 mt-2 text-sm text-neutral-500 font-medium"><span className="text-black font-bold">{new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(ad.preco)}</span><span>•</span><span className="flex items-center gap-1.5 text-blue-600"><Clock className="h-4 w-4" /> {ad.classificados_propostas?.length || 0} propostas</span></div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
                      <button onClick={() => {
                        if (ad.status === 'publicado') {
                          if (ad.categoria === 'imoveis') navigate(routes.marketplace.classifieds.imovel(ad.slug));
                          else if (ad.categoria === 'veiculos') navigate(routes.marketplace.classifieds.veiculo(ad.slug));
                          else navigate(routes.marketplace.classifieds.geralItem(ad.slug));
                        } else setEditingId(ad.id);
                      }} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold flex justify-center items-center gap-2 ${ad.status === 'ajustes_solicitados' ? 'bg-orange-600 text-white' : 'border border-black/10 text-neutral-700'}`}>
                        {ad.status === 'publicado' ? <Eye className="h-4 w-4" /> : ad.status === 'ajustes_solicitados' ? <Wrench className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                        <span>{ad.status === 'publicado' ? 'Ver anúncio' : ad.status === 'ajustes_solicitados' ? 'Corrigir agora' : 'Gerenciar'}</span>
                      </button>
                      <button onClick={() => navigate(routes.marketplace.classifieds.negociacoes())} className="flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white"><ChevronRight className="h-5 w-5" /></button>
                    </div>
                  </div>
                  {pending && (
                    <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                      <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" /><div><p className="font-black text-orange-950">A GSA solicitou correções neste anúncio</p><p className="mt-1 text-sm font-semibold text-orange-900">{pending.observacao}</p><div className="mt-3 flex flex-wrap gap-2">{fields.map((field: string) => <span key={field} className="rounded-full bg-white px-3 py-1 text-xs font-black text-orange-800 ring-1 ring-orange-200">{field.startsWith('detalhes.') ? field.replace('detalhes.','').replace(/_/g,' ') : fieldLabels[field] || field}</span>)}</div></div></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
