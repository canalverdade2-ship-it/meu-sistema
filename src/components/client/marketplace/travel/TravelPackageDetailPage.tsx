import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Calendar, Clock, Check, Info, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { navigate } from '../../../../routing/navigationService';
import { routes } from '../../../../routing/routeCatalog';
import { formatCurrency } from '../../../../lib/utils';
import { toast } from 'react-hot-toast';

interface TravelPackageDetailPageProps {
  slug: string;
  onBack: () => void;
  clientId?: string;
  onRequireAuth?: () => void;
}

export function TravelPackageDetailPage({ slug, onBack, clientId, onRequireAuth }: TravelPackageDetailPageProps) {
  const [pkg, setPkg] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPackage() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('viagens_pacotes')
          .select(`
            *,
            viagens_pacote_imagens(url, is_capa, ordem)
          `)
          .eq('slug', slug)
          .single();

        if (error) throw error;
        
        // Ordenar imagens
        if (data && data.viagens_pacote_imagens) {
          data.viagens_pacote_imagens.sort((a: any, b: any) => {
            if (a.is_capa) return -1;
            if (b.is_capa) return 1;
            return a.ordem - b.ordem;
          });
        }
        
        setPkg(data);
      } catch (err) {
        console.error('Erro ao buscar pacote:', err);
        toast.error('Pacote não encontrado.');
        onBack();
      } finally {
        setLoading(false);
      }
    }
    fetchPackage();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f1ea] flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#0c2340] mb-4" />
        <p className="text-[#0c2340] font-bold">Carregando pacote...</p>
      </div>
    );
  }

  if (!pkg) return null;

  const coverImg = pkg.viagens_pacote_imagens?.[0]?.url || 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200';
  const gallery = pkg.viagens_pacote_imagens?.slice(1) || [];

  return (
    <div className="bg-[#f4f1ea] min-h-screen font-sans pb-32">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0c2340]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 flex items-center justify-between h-16">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative h-[60vh] min-h-[400px] w-full bg-[#0c2340]">
        <img src={coverImg} alt={pkg.titulo} className="w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c2340] via-[#0c2340]/40 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-5 pb-12">
          <div className="max-w-7xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="px-3 py-1 rounded-full bg-[#38bdf8]/20 text-[#38bdf8] text-xs font-black uppercase tracking-wider backdrop-blur-md">
                  {pkg.categoria}
                </span>
                <span className="px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold backdrop-blur-md flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {pkg.dias} dias
                </span>
              </div>
              <h1 className="text-4xl sm:text-6xl font-black text-white leading-tight mb-2 max-w-4xl" style={{ fontFamily: '"Cinzel", serif' }}>
                {pkg.titulo}
              </h1>
              <div className="flex items-center gap-4 text-white/70 mt-4">
                <div className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {pkg.origem} → {pkg.destino}</div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-12">
            
            {/* INCLUSÕES */}
            <section className="bg-white rounded-3xl p-8 shadow-sm">
              <h3 className="text-2xl font-black text-[#0c2340] mb-6">O que está incluso</h3>
              {pkg.inclusoes && Array.isArray(pkg.inclusoes) && pkg.inclusoes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {pkg.inclusoes.map((item: string, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-[#e6f4f1] flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="h-3.5 w-3.5 text-[#0d7a71]" />
                      </div>
                      <span className="text-neutral-700 font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-500">Detalhes de inclusão não informados.</p>
              )}
            </section>

            {/* ITINERÁRIO */}
            {pkg.itinerario && Array.isArray(pkg.itinerario) && pkg.itinerario.length > 0 && (
              <section className="bg-white rounded-3xl p-8 shadow-sm">
                <h3 className="text-2xl font-black text-[#0c2340] mb-6">Itinerário Previsto</h3>
                <div className="space-y-6">
                  {pkg.itinerario.map((dia: any, i: number) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="h-10 w-10 rounded-full bg-[#0c2340] text-white flex items-center justify-center font-black">
                          {dia.dia || (i + 1)}
                        </div>
                        {i < pkg.itinerario.length - 1 && <div className="w-0.5 h-full bg-neutral-100 my-2" />}
                      </div>
                      <div className="pt-2 pb-6 flex-1">
                        <h4 className="text-lg font-bold text-[#1a1a1a] mb-2">{dia.titulo}</h4>
                        <p className="text-neutral-600 text-sm leading-relaxed">{dia.descricao}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* GALERIA */}
            {gallery.length > 0 && (
              <section>
                <h3 className="text-2xl font-black text-[#0c2340] mb-6 flex items-center gap-2">
                  <ImageIcon className="h-6 w-6" /> Galeria
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {gallery.map((img: any, i: number) => (
                    <div key={i} className="aspect-square rounded-2xl overflow-hidden bg-neutral-100">
                      <img src={img.url} alt="" className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-black/5">
              <div className="mb-6">
                <span className="text-neutral-500 text-sm font-bold uppercase tracking-wider">A partir de</span>
                <div className="text-4xl font-black text-[#0c2340] my-2">{formatCurrency(pkg.preco_venda)}</div>
                <p className="text-neutral-500 text-sm">Por pessoa em acomodação dupla</p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-sm font-medium text-neutral-700 bg-neutral-50 p-3 rounded-xl">
                  <Calendar className="h-5 w-5 text-[#38bdf8]" />
                  <span>Datas flexíveis (Sob consulta)</span>
                </div>
                {pkg.parcelamento_maximo > 1 && (
                  <div className="flex items-center gap-3 text-sm font-medium text-neutral-700 bg-neutral-50 p-3 rounded-xl">
                    <Info className="h-5 w-5 text-[#38bdf8]" />
                    <span>Em até {pkg.parcelamento_maximo}x no cartão GSA</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  if (!clientId && onRequireAuth) {
                    onRequireAuth();
                  } else {
                    navigate(routes.marketplace.travelPackages.orcamento() + `?pacote=${pkg.id}`);
                  }
                }}
                className="w-full py-4 rounded-xl bg-[#0c2340] text-white font-black hover:bg-[#134e78] transition-colors shadow-lg hover:-translate-y-1"
              >
                Solicitar Reserva
              </button>

              <p className="text-center text-xs text-neutral-400 mt-4">
                Sujeito a disponibilidade. O preço final será confirmado na elaboração da proposta.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
