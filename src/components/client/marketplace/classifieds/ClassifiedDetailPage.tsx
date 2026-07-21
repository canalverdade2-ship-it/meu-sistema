import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Shield, CheckCircle2, Phone, Calendar, Info, Share2, Heart, MessageCircle } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { navigate } from '../../../../routing/navigationService';
import { routes } from '../../../../routing/routeCatalog';

interface ClassifiedDetailPageProps {
  slug: string;
  onBack: () => void;
  clientId?: string;
}

export function ClassifiedDetailPage({ slug, onBack, clientId }: ClassifiedDetailPageProps) {
  const [ad, setAd] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdDetails();
  }, [slug]);

  const fetchAdDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('classificados_anuncios')
        .select(`
          *,
          classificados_anuncio_midias(url, tipo, ordem)
        `)
        .eq('slug', slug)
        .single();
        
      if (error) throw error;
      
      // Ordenar mídias
      if (data && data.classificados_anuncio_midias) {
        data.classificados_anuncio_midias.sort((a: any, b: any) => a.ordem - b.ordem);
      }
      
      setAd(data);
    } catch (err) {
      console.error('Error fetching ad details:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-[#1a1a1a] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold text-neutral-900 mb-4">Anúncio não encontrado</h2>
        <button onClick={onBack} className="text-neutral-500 hover:text-black">Voltar</button>
      </div>
    );
  }

  const isOwner = clientId === ad.cliente_id;
  const coverImage = ad.classificados_anuncio_midias?.find((m: any) => m.tipo === 'image')?.url;
  const gallery = ad.classificados_anuncio_midias?.filter((m: any) => m.tipo === 'image') || [];

  return (
    <div className="bg-[#FAF9F6] min-h-screen pb-24">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 border-b border-black/[0.06] bg-[#FAF9F6]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 flex items-center justify-between h-16">
          <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-[#1a1a1a] transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar aos Classificados</span>
          </button>
          
          <div className="flex items-center gap-4">
            <button className="h-10 w-10 rounded-full border border-black/10 flex items-center justify-center text-neutral-500 hover:bg-white transition-colors">
              <Share2 className="h-4 w-4" />
            </button>
            <button className="h-10 w-10 rounded-full border border-black/10 flex items-center justify-center text-neutral-500 hover:bg-white hover:text-red-500 transition-colors">
              <Heart className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-5 pt-8">
        <div className="grid lg:grid-cols-[1fr_400px] gap-10">
          
          {/* Lado Esquerdo - Mídias e Detalhes */}
          <div>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 bg-black text-white text-xs font-bold uppercase tracking-wider rounded-full">
                {ad.categoria}
              </span>
              <span className="text-sm font-medium text-neutral-500 flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Publicado em {new Date(ad.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-[#1a1a1a] tracking-tight leading-tight mb-4">
              {ad.titulo}
            </h1>
            
            <div className="flex items-center gap-2 text-neutral-500 font-medium mb-8">
              <MapPin className="h-5 w-5" />
              {ad.bairro ? `${ad.bairro}, ` : ''}{ad.cidade} - {ad.estado}
            </div>

            {/* Galeria */}
            <div className="rounded-3xl overflow-hidden bg-neutral-200 aspect-[4/3] md:aspect-[16/9] mb-4">
              {coverImage ? (
                 <img src={coverImage} alt={ad.titulo} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-neutral-400 font-bold">Sem imagem</span>
                </div>
              )}
            </div>

            {gallery.length > 1 && (
              <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
                {gallery.map((media: any, idx: number) => (
                  <button key={idx} className="shrink-0 w-24 h-24 rounded-2xl overflow-hidden border-2 border-transparent focus:border-black transition-all">
                    <img src={media.url} alt={`Galeria ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Descrição e Detalhes */}
            <div className="mt-12">
              <h3 className="text-2xl font-bold text-[#1a1a1a] mb-6">Descrição</h3>
              <div className="prose prose-neutral max-w-none text-neutral-600 whitespace-pre-wrap">
                {ad.descricao}
              </div>
            </div>
            
            {Object.keys(ad.detalhes || {}).length > 0 && (
              <div className="mt-12">
                <h3 className="text-2xl font-bold text-[#1a1a1a] mb-6">Características</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(ad.detalhes).map(([key, value]) => (
                    <div key={key} className="bg-white p-4 rounded-2xl border border-black/5">
                      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">{key}</div>
                      <div className="text-base font-bold text-neutral-900">{String(value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Lado Direito - Sidebar Sticky */}
          <div>
            <div className="sticky top-24 space-y-6">
              
              {/* Box de Preço e Ação */}
              <div className="bg-white rounded-3xl p-8 border border-black/5 shadow-xl shadow-black/[0.02]">
                <div className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-2">Valor da Oportunidade</div>
                <div className="text-4xl font-black text-[#1a1a1a] mb-8">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ad.preco)}
                </div>
                
                {isOwner ? (
                  <button 
                    onClick={() => navigate(routes.marketplace.classifieds.editarAnuncio(ad.id))}
                    className="w-full py-4 bg-neutral-100 text-neutral-700 font-bold rounded-full hover:bg-neutral-200 transition-colors"
                  >
                    Gerenciar meu anúncio
                  </button>
                ) : (
                  <div className="space-y-4">
                    <button 
                      onClick={() => {
                        if (!clientId) {
                          const returnTo = encodeURIComponent(routes.marketplace.classifieds.geralItem(slug));
                          navigate(`${routes.login.root()}?returnTo=${returnTo}`);
                        } else {
                          const supportUrl = new URL(routes.client.support(), window.location.origin);
                          supportUrl.searchParams.set('origem', 'classificado');
                          supportUrl.searchParams.set('anuncio', String(ad.id));
                          supportUrl.searchParams.set('titulo', String(ad.titulo || '').slice(0, 120));
                          navigate(`${supportUrl.pathname}${supportUrl.search}`);
                        }
                      }}
                      className="w-full py-4 bg-black text-white font-black uppercase tracking-wider rounded-full hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="h-5 w-5" /> Solicitar mediação
                    </button>
                    <p className="text-xs text-center text-neutral-400 font-medium px-4">
                      Você será direcionado ao suporte GSA para registrar a proposta com mediação e proteção dos seus dados.
                    </p>
                  </div>
                )}
              </div>

              {/* Box de Garantia GSA */}
              <div className="bg-gradient-to-br from-[#1a1a1a] to-[#2d2411] rounded-3xl p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#e8a838]/20 blur-3xl rounded-full" />
                
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-[#e8a838]" />
                  </div>
                  <h4 className="font-bold text-lg">Garantia GSA</h4>
                </div>
                
                <ul className="space-y-4 relative z-10">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#e8a838] shrink-0" />
                    <span className="text-sm text-white/80 leading-snug">Vendedor e anúncio verificados pela nossa equipe.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#e8a838] shrink-0" />
                    <span className="text-sm text-white/80 leading-snug">Sem contato direto, protegendo seus dados pessoais.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#e8a838] shrink-0" />
                    <span className="text-sm text-white/80 leading-snug">O pagamento principal vai direto para o vendedor, sem taxas ocultas na compra.</span>
                  </li>
                </ul>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
