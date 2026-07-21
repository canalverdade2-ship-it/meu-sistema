import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Building2,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Star,
  Tags,
  Trash2,
  Upload,
} from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { navigate } from '../../../../routing/navigationService';
import { routes } from '../../../../routing/routeCatalog';
import { toast } from 'react-hot-toast';
import {
  CLASSIFIEDS_MAX_IMAGES,
  CLASSIFIEDS_MAX_IMAGE_SIZE_MB,
  UploadedClassifiedMedia,
  removeClassifiedImage,
  removeClassifiedImages,
  uploadClassifiedImage,
  validateClassifiedImage,
} from '../../../../lib/classifiedStorage';

interface WizardProps {
  clientId: string;
  onBack: () => void;
}

export function CreateListingWizard({ clientId, onBack }: WizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [removingPath, setRemovingPath] = useState<string | null>(null);
  const [commissions, setCommissions] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftIdRef = useRef(crypto.randomUUID());
  const uploadedPathsRef = useRef<string[]>([]);
  const submittedRef = useRef(false);

  const [formData, setFormData] = useState({
    categoria: '',
    titulo: '',
    descricao: '',
    preco: '',
    cep: '',
    estado: 'SP',
    cidade: '',
    bairro: '',
    detalhes: {} as Record<string, unknown>,
    midias: [] as UploadedClassifiedMedia[],
    termoAceito: false,
  });

  useEffect(() => {
    void fetchCommissions();

    return () => {
      if (!submittedRef.current && uploadedPathsRef.current.length > 0) {
        void removeClassifiedImages([...uploadedPathsRef.current]).catch((error) => {
          console.error('Erro ao limpar mídias temporárias dos classificados:', error);
        });
      }
    };
  }, []);

  useEffect(() => {
    uploadedPathsRef.current = formData.midias.map((media) => media.path);
  }, [formData.midias]);

  const fetchCommissions = async () => {
    const { data, error } = await supabase
      .from('classificados_comissoes_config')
      .select('categoria, percentual');

    if (error) {
      console.error('Erro ao carregar comissões dos classificados:', error);
      toast.error('Não foi possível carregar a configuração de comissão.');
      return;
    }

    const commissionMap: Record<string, number> = {};
    (data || []).forEach((item) => {
      commissionMap[item.categoria] = Number(item.percentual);
    });
    setCommissions(commissionMap);
  };

  const fetchCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    
    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData(current => ({
          ...current,
          estado: data.uf,
          cidade: data.localidade,
          bairro: data.bairro || current.bairro,
        }));
      } else {
        toast.error('CEP não encontrado.');
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      toast.error('Erro ao buscar o CEP.');
    } finally {
      setLoadingCep(false);
    }
  };

  const handleNext = () => setStep((current) => current + 1);
  const handlePrev = () => setStep((current) => current - 1);

  const normalizeMediaOrder = (items: UploadedClassifiedMedia[]) =>
    items.map((item, index) => ({ ...item, ordem: index }));

  const handleFiles = async (files: FileList | File[]) => {
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0) return;

    if (formData.midias.length + selectedFiles.length > CLASSIFIEDS_MAX_IMAGES) {
      toast.error(`Você pode adicionar no máximo ${CLASSIFIEDS_MAX_IMAGES} fotos por anúncio.`);
      return;
    }

    try {
      selectedFiles.forEach(validateClassifiedImage);
      setUploading(true);

      const uploaded: UploadedClassifiedMedia[] = [];
      try {
        for (const file of selectedFiles) {
          const media = await uploadClassifiedImage({
            clientId,
            draftId: draftIdRef.current,
            file,
            order: formData.midias.length + uploaded.length,
          });
          uploaded.push(media);
        }
      } catch (error) {
        if (uploaded.length > 0) {
          await removeClassifiedImages(uploaded.map((item) => item.path)).catch((cleanupError) => {
            console.error('Erro ao desfazer uploads parciais:', cleanupError);
          });
        }
        throw error;
      }

      setFormData((current) => ({
        ...current,
        midias: normalizeMediaOrder([...current.midias, ...uploaded]),
      }));
      toast.success(`${uploaded.length} foto(s) enviada(s) com sucesso.`);
    } catch (error: any) {
      console.error('Erro no upload das imagens dos classificados:', error);
      toast.error(error?.message || 'Não foi possível enviar as imagens.');
    } finally {
      setUploading(false);
      setIsDragging(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveMedia = async (media: UploadedClassifiedMedia) => {
    try {
      setRemovingPath(media.path);
      await removeClassifiedImage(media.path);
      setFormData((current) => ({
        ...current,
        midias: normalizeMediaOrder(current.midias.filter((item) => item.path !== media.path)),
      }));
      toast.success('Foto removida.');
    } catch (error: any) {
      console.error('Erro ao remover imagem dos classificados:', error);
      toast.error(error?.message || 'Não foi possível remover a foto.');
    } finally {
      setRemovingPath(null);
    }
  };

  const moveMedia = (index: number, direction: -1 | 1) => {
    setFormData((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.midias.length) return current;
      const reordered = [...current.midias];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      return { ...current, midias: normalizeMediaOrder(reordered) };
    });
  };

  const makePrimary = (index: number) => {
    setFormData((current) => {
      if (index <= 0 || index >= current.midias.length) return current;
      const reordered = [...current.midias];
      const [selected] = reordered.splice(index, 1);
      reordered.unshift(selected);
      return { ...current, midias: normalizeMediaOrder(reordered) };
    });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      if (uploading || formData.midias.length === 0) {
        throw new Error('Adicione pelo menos uma foto antes de publicar o anúncio.');
      }

      const precoNum = Number.parseFloat(formData.preco.replace(/\./g, '').replace(',', '.'));
      if (!Number.isFinite(precoNum) || precoNum <= 0) {
        throw new Error('Informe um preço válido para o anúncio.');
      }

      const comissao = Number(commissions[formData.categoria]);
      if (!Number.isFinite(comissao) || comissao <= 0) {
        throw new Error('A comissão desta categoria não está configurada. Entre em contato com a GSA.');
      }

      const { data, error } = await supabase.rpc('rpc_criar_anuncio_classificado', {
        p_cliente_id: clientId,
        p_categoria: formData.categoria,
        p_titulo: formData.titulo.trim(),
        p_descricao: formData.descricao.trim(),
        p_preco: precoNum,
        p_cidade: formData.cidade.trim(),
        p_estado: formData.estado.trim().toUpperCase(),
        p_bairro: formData.bairro.trim(),
        p_detalhes: formData.detalhes,
        p_comissao_aceita: comissao,
        p_midias: formData.midias.map(({ url, tipo, ordem }) => ({ url, tipo, ordem })),
      });

      const result = Array.isArray(data) ? data[0] : data;
      if (error || !result?.success) {
        throw error || new Error(result?.error || 'Não foi possível criar o anúncio.');
      }

      submittedRef.current = true;
      toast.success('Anúncio criado e enviado para moderação!');
      navigate(routes.marketplace.classifieds.meusAnuncios());
    } catch (error: any) {
      console.error('Erro ao criar anúncio classificado:', error);
      toast.error(error?.message || 'Erro ao criar anúncio.');
    } finally {
      setLoading(false);
    }
  };

  const currentCommission = commissions[formData.categoria] || 0;

  return (
    <div className="bg-[#FAF9F6] min-h-screen pb-24">
      <nav className="sticky top-0 z-50 border-b border-black/[0.06] bg-[#FAF9F6]/90 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-5 flex items-center justify-between h-16">
          <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-[#1a1a1a] transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <div className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-[#1a1a1a]" />
            <span className="font-black text-[#1a1a1a]">Novo Anúncio</span>
          </div>
          <div className="text-sm font-bold text-neutral-400">Passo {step} de 5</div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-5 pt-10">
        {step === 1 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="text-3xl font-black text-[#1a1a1a] mb-2">O que você quer anunciar?</h2>
            <p className="text-neutral-500 mb-8">Escolha a categoria que melhor descreve seu anúncio.</p>

            <div className="grid gap-4">
              {[
                { id: 'imoveis', icon: Building2, title: 'Imóvel', desc: 'Casas, apartamentos, terrenos' },
                { id: 'veiculos', icon: Car, title: 'Veículo', desc: 'Carros, motos, utilitários' },
                { id: 'geral', icon: Boxes, title: 'Geral', desc: 'Outros produtos e equipamentos' },
              ].map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setFormData({ ...formData, categoria: category.id });
                    handleNext();
                  }}
                  className={`flex items-center p-6 rounded-2xl border-2 transition-all text-left ${formData.categoria === category.id ? 'border-[#1a1a1a] bg-neutral-100' : 'border-black/5 bg-white hover:border-black/20'}`}
                >
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center mr-4 ${formData.categoria === category.id ? 'bg-[#1a1a1a] text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                    <category.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-neutral-900">{category.title}</h3>
                    <p className="text-sm text-neutral-500">{category.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="text-3xl font-black text-[#1a1a1a] mb-2">Informações Principais</h2>
            <p className="text-neutral-500 mb-8">Descreva seu anúncio de forma atrativa.</p>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-2">Título do Anúncio</label>
                <input
                  type="text"
                  value={formData.titulo}
                  onChange={(event) => setFormData({ ...formData, titulo: event.target.value })}
                  placeholder="Ex: Apartamento 3 Quartos em Pinheiros"
                  className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-2">Descrição</label>
                <textarea
                  value={formData.descricao}
                  onChange={(event) => setFormData({ ...formData, descricao: event.target.value })}
                  placeholder="Descreva os detalhes. ATENÇÃO: É proibido colocar números de telefone ou links de contato."
                  rows={5}
                  className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-2">Preço (R$)</label>
                <input
                  type="text"
                  value={formData.preco}
                  onChange={(event) => {
                    let v = event.target.value.replace(/\D/g, '');
                    if (!v) {
                      setFormData({ ...formData, preco: '' });
                      return;
                    }
                    const numValue = Number(v) / 100;
                    const formatted = numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    setFormData({ ...formData, preco: formatted });
                  }}
                  placeholder="0,00"
                  className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all text-xl font-bold"
                />
              </div>
            </div>

            <div className="mt-10 flex gap-4">
              <button onClick={handlePrev} className="px-6 py-3 rounded-full font-bold text-neutral-600 hover:bg-black/5">Voltar</button>
              <button
                onClick={handleNext}
                disabled={!formData.titulo.trim() || !formData.descricao.trim() || !formData.preco.trim()}
                className="flex-1 bg-[#1a1a1a] text-white py-3 rounded-full font-bold hover:bg-black disabled:opacity-50"
              >
                Próximo Passo
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="text-3xl font-black text-[#1a1a1a] mb-2">Localização e Detalhes</h2>
            <p className="text-neutral-500 mb-8">Onde está o item e características específicas.</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="col-span-2 relative">
                <label className="block text-sm font-bold text-neutral-900 mb-2">CEP (Opcional)</label>
                <div className="relative flex items-center">
                  <input 
                    type="text" 
                    value={formData.cep} 
                    onChange={(event) => {
                      let v = event.target.value.replace(/\D/g, '');
                      v = v.replace(/^(\d{5})(\d)/, '$1-$2');
                      setFormData({ ...formData, cep: v });
                    }} 
                    onBlur={(e) => fetchCep(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9} 
                    className="w-full bg-white border border-black/10 rounded-xl px-4 py-3" 
                  />
                  {loadingCep && <Loader2 className="absolute right-4 h-5 w-5 animate-spin text-neutral-400" />}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-2">Estado</label>
                <input type="text" value={formData.estado} onChange={(event) => setFormData({ ...formData, estado: event.target.value })} maxLength={2} className="w-full bg-white border border-black/10 rounded-xl px-4 py-3" />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-2">Cidade</label>
                <input type="text" value={formData.cidade} onChange={(event) => setFormData({ ...formData, cidade: event.target.value })} className="w-full bg-white border border-black/10 rounded-xl px-4 py-3" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-bold text-neutral-900 mb-2">Bairro</label>
                <input type="text" value={formData.bairro} onChange={(event) => setFormData({ ...formData, bairro: event.target.value })} className="w-full bg-white border border-black/10 rounded-xl px-4 py-3" />
              </div>
            </div>

            {formData.categoria === 'imoveis' && (
              <div className="grid grid-cols-2 gap-4 border-t border-black/10 pt-6">
                <div>
                  <label className="block text-sm font-bold text-neutral-900 mb-2">Área (m²)</label>
                  <input type="number" onChange={(event) => setFormData({ ...formData, detalhes: { ...formData.detalhes, area: event.target.value } })} className="w-full bg-white border border-black/10 rounded-xl px-4 py-3" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-900 mb-2">Quartos</label>
                  <input type="number" onChange={(event) => setFormData({ ...formData, detalhes: { ...formData.detalhes, quartos: event.target.value } })} className="w-full bg-white border border-black/10 rounded-xl px-4 py-3" />
                </div>
              </div>
            )}

            {formData.categoria === 'veiculos' && (
              <div className="grid grid-cols-2 gap-4 border-t border-black/10 pt-6">
                <div>
                  <label className="block text-sm font-bold text-neutral-900 mb-2">Marca/Modelo</label>
                  <input type="text" onChange={(event) => setFormData({ ...formData, detalhes: { ...formData.detalhes, marca: event.target.value } })} className="w-full bg-white border border-black/10 rounded-xl px-4 py-3" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-900 mb-2">Ano</label>
                  <input type="text" onChange={(event) => setFormData({ ...formData, detalhes: { ...formData.detalhes, ano: event.target.value } })} className="w-full bg-white border border-black/10 rounded-xl px-4 py-3" />
                </div>
              </div>
            )}

            <div className="mt-10 flex gap-4">
              <button onClick={handlePrev} className="px-6 py-3 rounded-full font-bold text-neutral-600 hover:bg-black/5">Voltar</button>
              <button
                onClick={handleNext}
                disabled={!formData.cidade.trim() || formData.estado.trim().length !== 2}
                className="flex-1 bg-[#1a1a1a] text-white py-3 rounded-full font-bold hover:bg-black disabled:opacity-50"
              >
                Próximo Passo
              </button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="text-3xl font-black text-[#1a1a1a] mb-2">Mídias do Anúncio</h2>
            <p className="text-neutral-500 mb-8">Adicione fotos reais do item. A primeira imagem será a capa do anúncio.</p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files) void handleFiles(event.target.files);
              }}
            />

            <div
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                void handleFiles(event.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center bg-white mb-6 transition-colors ${isDragging ? 'border-[#e8a838] bg-amber-50' : 'border-black/20'}`}
            >
              {uploading ? <Loader2 className="h-10 w-10 text-[#e8a838] mb-4 animate-spin" /> : <Upload className="h-10 w-10 text-neutral-400 mb-4" />}
              <p className="font-bold text-neutral-900 mb-1">{uploading ? 'Enviando fotos...' : 'Arraste fotos aqui'}</p>
              <p className="text-sm text-neutral-500 mb-2">ou selecione os arquivos no seu dispositivo</p>
              <p className="text-xs text-neutral-400 mb-6">JPG, PNG ou WEBP • até {CLASSIFIEDS_MAX_IMAGE_SIZE_MB} MB • máximo de {CLASSIFIEDS_MAX_IMAGES} fotos</p>
              <button
                type="button"
                disabled={uploading || formData.midias.length >= CLASSIFIEDS_MAX_IMAGES}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a1a1a] text-white font-bold rounded-full text-sm hover:bg-black disabled:opacity-50"
              >
                <ImagePlus className="h-4 w-4" /> Selecionar fotos
              </button>
            </div>

            {formData.midias.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-black text-neutral-900">Fotos adicionadas</h3>
                    <p className="text-xs text-neutral-500">Organize a ordem e escolha a imagem principal.</p>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">{formData.midias.length}/{CLASSIFIEDS_MAX_IMAGES}</span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {formData.midias.map((media, index) => (
                    <div key={media.path} className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                      <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
                        <img src={media.url} alt={`Foto ${index + 1} do anúncio`} className="h-full w-full object-cover" />
                        {index === 0 && (
                          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/85 px-3 py-1 text-xs font-black text-[#f5b82e]">
                            <Star className="h-3 w-3 fill-current" /> Capa
                          </div>
                        )}
                        <button
                          type="button"
                          disabled={removingPath === media.path || uploading}
                          onClick={() => void handleRemoveMedia(media)}
                          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-red-600 shadow transition hover:bg-white disabled:opacity-50"
                          title="Remover foto"
                        >
                          {removingPath === media.path ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>

                      <div className="p-3">
                        <p className="truncate text-xs font-bold text-neutral-700" title={media.nome}>{media.nome}</p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={index === 0 || uploading}
                              onClick={() => moveMedia(index, -1)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 text-neutral-600 hover:bg-neutral-50 disabled:opacity-30"
                              title="Mover para a esquerda"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={index === formData.midias.length - 1 || uploading}
                              onClick={() => moveMedia(index, 1)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 text-neutral-600 hover:bg-neutral-50 disabled:opacity-30"
                              title="Mover para a direita"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                          {index > 0 && (
                            <button
                              type="button"
                              disabled={uploading}
                              onClick={() => makePrimary(index)}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 hover:bg-amber-100"
                            >
                              <Star className="h-3.5 w-3.5" /> Definir capa
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-10 flex gap-4">
              <button onClick={handlePrev} disabled={uploading} className="px-6 py-3 rounded-full font-bold text-neutral-600 hover:bg-black/5 disabled:opacity-50">Voltar</button>
              <button
                onClick={handleNext}
                disabled={uploading || formData.midias.length === 0}
                className="flex-1 bg-[#1a1a1a] text-white py-3 rounded-full font-bold hover:bg-black disabled:opacity-50"
              >
                Revisar e Aceitar
              </button>
            </div>
          </motion.div>
        )}

        {step === 5 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="text-3xl font-black text-[#1a1a1a] mb-2">Termos e Comissão</h2>
            <p className="text-neutral-500 mb-8">Revise seu anúncio e aceite os termos da GSA.</p>

            <div className="bg-white rounded-3xl p-8 border border-black/5 shadow-xl shadow-black/[0.02] mb-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-16 w-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-black">{currentCommission}%</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-neutral-900">Taxa de Intermediação</h3>
                  <p className="text-sm text-neutral-500">Cobrada apenas no sucesso da venda.</p>
                </div>
              </div>

              <div className="space-y-4 bg-neutral-50 p-6 rounded-2xl border border-black/5 text-sm text-neutral-600 leading-relaxed">
                <p><strong>1.</strong> Ao publicar este anúncio, concordo em utilizar a intermediação exclusiva da GSA.</p>
                <p><strong>2.</strong> Não incluí números de telefone ou links externos na descrição.</p>
                <p><strong>3.</strong> Autorizo a GSA a moderar mensagens entre mim e os compradores interessados.</p>
                <p><strong>4.</strong> Concordo em pagar {currentCommission}% do valor final negociado assim que a transação for concluída (fatura gerada via sistema).</p>
              </div>

              <label className="flex items-start gap-4 mt-8 cursor-pointer group">
                <button
                  type="button"
                  onClick={() => setFormData((current) => ({ ...current, termoAceito: !current.termoAceito }))}
                  className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${formData.termoAceito ? 'bg-black border-black' : 'border-neutral-300 group-hover:border-black/50'}`}
                  aria-pressed={formData.termoAceito}
                >
                  {formData.termoAceito && <CheckCircle2 className="h-4 w-4 text-white" />}
                </button>
                <span className="text-sm font-bold text-neutral-900">
                  Li e aceito os termos de uso e comissionamento da GSA Classificados.
                </span>
              </label>
            </div>

            <div className="mt-10 flex gap-4">
              <button onClick={handlePrev} className="px-6 py-3 rounded-full font-bold text-neutral-600 hover:bg-black/5" disabled={loading}>Voltar</button>
              <button
                onClick={() => void handleSubmit()}
                disabled={!formData.termoAceito || loading || uploading || formData.midias.length === 0}
                className="flex-1 bg-black text-white py-3 rounded-full font-black uppercase tracking-wider hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Publicando...</> : <><ArrowRight className="h-4 w-4" /> Publicar Anúncio</>}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
