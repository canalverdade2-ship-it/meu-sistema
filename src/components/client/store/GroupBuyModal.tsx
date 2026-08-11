import React, { useState } from 'react';
import { X, Users, Gift, Loader2, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GroupBuyModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  productUrl: string;
}

export function GroupBuyModal({ isOpen, onClose, product, productUrl }: GroupBuyModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nomePresenteado: '',
    dataEvento: '',
    mensagem: '',
  });
  const [linkGerado, setLinkGerado] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulando chamada para o N8N que criaria o link de pagamento dividido
    setTimeout(() => {
      setLinkGerado(`${productUrl}?vaquinha_id=${Math.random().toString(36).substring(7)}`);
      setStep(2);
      setLoading(false);
    }, 1500);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(linkGerado);
    alert('Link copiado! Agora é só enviar no grupo do WhatsApp.');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 z-[1001] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white relative">
              <button onClick={onClose} className="absolute top-4 right-4 rounded-full p-2 text-white/70 hover:bg-white/10 transition-colors">
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-black">Vaquinha de Presente</h3>
              </div>
              <p className="text-white/80 text-sm">Compre em grupo e divida o valor com os amigos.</p>
            </div>

            <div className="p-6">
              {step === 1 ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex gap-4 p-3 bg-neutral-50 rounded-xl border border-neutral-100 mb-6">
                    <img src={product.imagem_url} alt={product.nome} className="w-16 h-16 object-cover rounded-lg bg-white" />
                    <div>
                      <p className="text-sm font-bold text-neutral-800 line-clamp-2">{product.nome}</p>
                      <p className="text-xs text-neutral-500 mt-1">Valor total a ser dividido</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Quem vai receber o presente?</label>
                    <div className="relative">
                      <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
                      <input 
                        type="text" 
                        required
                        value={formData.nomePresenteado}
                        onChange={e => setFormData({...formData, nomePresenteado: e.target.value})}
                        placeholder="Nome do felizardo(a)" 
                        className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Data da surpresa/evento</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
                      <input 
                        type="date" 
                        required
                        value={formData.dataEvento}
                        onChange={e => setFormData({...formData, dataEvento: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Mensagem para os participantes</label>
                    <textarea 
                      required
                      value={formData.mensagem}
                      onChange={e => setFormData({...formData, mensagem: e.target.value})}
                      placeholder="Ex: Galera, vamos nos juntar para comprar isso de aniversário..." 
                      className="w-full p-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none h-24"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-70"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Gerar Link da Vaquinha'}
                  </button>
                </form>
              ) : (
                <div className="flex flex-col items-center text-center py-6">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                    <Check className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-black text-neutral-800 mb-2">Vaquinha Criada!</h4>
                  <p className="text-sm text-neutral-600 mb-6">
                    Agora é só compartilhar o link no grupo do WhatsApp. Cada um paga sua parte pelo próprio celular de forma segura.
                  </p>
                  
                  <div className="w-full p-3 bg-neutral-100 rounded-xl border border-neutral-200 mb-4 break-all text-xs font-mono text-neutral-500 text-left">
                    {linkGerado}
                  </div>

                  <button 
                    onClick={copyLink}
                    className="w-full bg-[#17345f] text-white font-bold py-4 rounded-xl shadow-md hover:bg-[#0c2340] transition-colors"
                  >
                    Copiar Link para Compartilhar
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Temporary Check component since I forgot to import it in this file
const Check = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);
