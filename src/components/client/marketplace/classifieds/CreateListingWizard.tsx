import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Building2, Car, Boxes, Upload, CheckCircle2, AlertTriangle, Tags } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { navigate } from '../../../../routing/navigationService';
import { routes } from '../../../../routing/routeCatalog';
import { toast } from 'react-hot-toast';

interface WizardProps {
  clientId: string;
  onBack: () => void;
}

export function CreateListingWizard({ clientId, onBack }: WizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [commissions, setCommissions] = useState<any>({});
  
  const [formData, setFormData] = useState({
    categoria: '',
    titulo: '',
    descricao: '',
    preco: '',
    estado: 'SP',
    cidade: '',
    bairro: '',
    detalhes: {} as any,
    midias: [] as { url: string, tipo: string, ordem: number }[],
    termoAceito: false
  });

  useEffect(() => {
    fetchCommissions();
  }, []);

  const fetchCommissions = async () => {
    const { data } = await supabase.from('classificados_comissoes_config').select('*');
    if (data) {
      const commMap: any = {};
      data.forEach(d => { commMap[d.categoria] = d.percentual; });
      setCommissions(commMap);
    }
  };

  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const precoNum = parseFloat(formData.preco.replace(/\./g, '').replace(',', '.'));
      const comissao = commissions[formData.categoria] || 0;

      const { data, error } = await supabase.rpc('rpc_criar_anuncio_classificado', {
        p_cliente_id: clientId,
        p_categoria: formData.categoria,
        p_titulo: formData.titulo,
        p_descricao: formData.descricao,
        p_preco: precoNum,
        p_cidade: formData.cidade,
        p_estado: formData.estado,
        p_bairro: formData.bairro,
        p_detalhes: formData.detalhes,
        p_comissao_aceita: comissao,
        p_midias: formData.midias
      });

      if (error || !data?.success) {
        throw error || new Error(data?.error || 'Erro desconhecido');
      }

      toast.success('Anúncio criado e enviado para moderação!');
      navigate(routes.marketplace.classifieds.meusAnuncios());
    } catch (err: any) {
      toast.error('Erro ao criar anúncio: ' + err.message);
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
                { id: 'geral', icon: Boxes, title: 'Geral', desc: 'Outros produtos e equipamentos' }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { setFormData({ ...formData, categoria: cat.id }); handleNext(); }}
                  className={`flex items-center p-6 rounded-2xl border-2 transition-all text-left ${formData.categoria === cat.id ? 'border-[#1a1a1a] bg-neutral-100' : 'border-black/5 bg-white hover:border-black/20'}`}
                >
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center mr-4 ${formData.categoria === cat.id ? 'bg-[#1a1a1a] text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                    <cat.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-neutral-900">{cat.title}</h3>
                    <p className="text-sm text-neutral-500">{cat.desc}</p>
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
                  onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Ex: Apartamento 3 Quartos em Pinheiros"
                  className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-2">Descrição</label>
                <textarea 
                  value={formData.descricao}
                  onChange={e => setFormData({ ...formData, descricao: e.target.value })}
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
                  onChange={e => setFormData({ ...formData, preco: e.target.value })}
                  placeholder="0,00"
                  className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all text-xl font-bold"
                />
              </div>
            </div>

            <div className="mt-10 flex gap-4">
              <button onClick={handlePrev} className="px-6 py-3 rounded-full font-bold text-neutral-600 hover:bg-black/5">Voltar</button>
              <button 
                onClick={handleNext} 
                disabled={!formData.titulo || !formData.descricao || !formData.preco}
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
              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-2">Estado</label>
                <input type="text" value={formData.estado} onChange={e => setFormData({ ...formData, estado: e.target.value })} maxLength={2} className="w-full bg-white border border-black/10 rounded-xl px-4 py-3" />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-2">Cidade</label>
                <input type="text" value={formData.cidade} onChange={e => setFormData({ ...formData, cidade: e.target.value })} className="w-full bg-white border border-black/10 rounded-xl px-4 py-3" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-bold text-neutral-900 mb-2">Bairro</label>
                <input type="text" value={formData.bairro} onChange={e => setFormData({ ...formData, bairro: e.target.value })} className="w-full bg-white border border-black/10 rounded-xl px-4 py-3" />
              </div>
            </div>

            {/* Campos Dinâmicos por Categoria */}
            {formData.categoria === 'imoveis' && (
              <div className="grid grid-cols-2 gap-4 border-t border-black/10 pt-6">
                <div>
                  <label className="block text-sm font-bold text-neutral-900 mb-2">Área (m²)</label>
                  <input type="number" onChange={e => setFormData({ ...formData, detalhes: { ...formData.detalhes, area: e.target.value } })} className="w-full bg-white border border-black/10 rounded-xl px-4 py-3" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-900 mb-2">Quartos</label>
                  <input type="number" onChange={e => setFormData({ ...formData, detalhes: { ...formData.detalhes, quartos: e.target.value } })} className="w-full bg-white border border-black/10 rounded-xl px-4 py-3" />
                </div>
              </div>
            )}
            
            {formData.categoria === 'veiculos' && (
              <div className="grid grid-cols-2 gap-4 border-t border-black/10 pt-6">
                <div>
                  <label className="block text-sm font-bold text-neutral-900 mb-2">Marca/Modelo</label>
                  <input type="text" onChange={e => setFormData({ ...formData, detalhes: { ...formData.detalhes, marca: e.target.value } })} className="w-full bg-white border border-black/10 rounded-xl px-4 py-3" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-900 mb-2">Ano</label>
                  <input type="text" onChange={e => setFormData({ ...formData, detalhes: { ...formData.detalhes, ano: e.target.value } })} className="w-full bg-white border border-black/10 rounded-xl px-4 py-3" />
                </div>
              </div>
            )}

            <div className="mt-10 flex gap-4">
              <button onClick={handlePrev} className="px-6 py-3 rounded-full font-bold text-neutral-600 hover:bg-black/5">Voltar</button>
              <button 
                onClick={handleNext} 
                disabled={!formData.cidade}
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
            <p className="text-neutral-500 mb-8">Adicione fotos de alta qualidade. (Mocked para demonstração)</p>
            
            <div className="border-2 border-dashed border-black/20 rounded-3xl p-10 flex flex-col items-center justify-center text-center bg-white mb-6">
              <Upload className="h-10 w-10 text-neutral-400 mb-4" />
              <p className="font-bold text-neutral-900 mb-1">Arraste fotos aqui</p>
              <p className="text-sm text-neutral-500 mb-6">ou clique para selecionar arquivos</p>
              <button 
                onClick={() => {
                  const url = prompt('Cole a URL de uma imagem para testar:');
                  if (url) {
                    setFormData({ ...formData, midias: [...formData.midias, { url, tipo: 'image', ordem: formData.midias.length }] });
                  }
                }}
                className="px-6 py-2 bg-neutral-100 text-neutral-700 font-bold rounded-full text-sm"
              >
                Simular Upload
              </button>
            </div>
            
            {formData.midias.length > 0 && (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {formData.midias.map((m, i) => (
                  <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0">
                    <img src={m.url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-10 flex gap-4">
              <button onClick={handlePrev} className="px-6 py-3 rounded-full font-bold text-neutral-600 hover:bg-black/5">Voltar</button>
              <button 
                onClick={handleNext} 
                className="flex-1 bg-[#1a1a1a] text-white py-3 rounded-full font-bold hover:bg-black"
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
                <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${formData.termoAceito ? 'bg-black border-black' : 'border-neutral-300 group-hover:border-black/50'}`}>
                  {formData.termoAceito && <CheckCircle2 className="h-4 w-4 text-white" />}
                </div>
                <span className="text-sm font-bold text-neutral-900">
                  Li e aceito os termos de uso e comissionamento da GSA Classificados.
                </span>
              </label>
            </div>

            <div className="mt-10 flex gap-4">
              <button onClick={handlePrev} className="px-6 py-3 rounded-full font-bold text-neutral-600 hover:bg-black/5" disabled={loading}>Voltar</button>
              <button 
                onClick={handleSubmit}
                disabled={!formData.termoAceito || loading}
                className="flex-1 bg-black text-white py-3 rounded-full font-black uppercase tracking-wider hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? 'Processando...' : 'Publicar Anúncio'}
              </button>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}
