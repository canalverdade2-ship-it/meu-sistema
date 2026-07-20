import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { toast } from 'react-hot-toast';
import { Send, CheckCircle } from 'lucide-react';
import { formatDateTime } from '../../lib/utils';

interface SupportConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  suporte: any;
  onUpdate: () => void;
  autorId: string;
  autorTipo: 'prestador' | 'admin';
}

export function SupportConversationModal({ isOpen, onClose, suporte, onUpdate, autorId, autorTipo }: SupportConversationModalProps) {
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);

  const [currentSuporte, setCurrentSuporte] = useState(suporte);

  useEffect(() => {
    setCurrentSuporte(suporte);
  }, [suporte]);

  useEffect(() => {
    if (isOpen && currentSuporte) {
      fetchMensagens();
      
      const messagesChannel = supabase
        .channel(`suporte_mensagens_${currentSuporte.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'suporte_mensagens',
          filter: `suporte_id=eq.${currentSuporte.id}`
        }, (payload) => {
          setMensagens((prev) => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        })
        .subscribe();

      const statusChannel = supabase
        .channel(`suporte_status_${currentSuporte.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'prestador_suporte_demandas',
          filter: `id=eq.${currentSuporte.id}`
        }, (payload) => {
          setCurrentSuporte(payload.new);
          if (payload.new.status === 'fechado') {
            toast.success('Este suporte foi finalizado.');
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(messagesChannel);
        supabase.removeChannel(statusChannel);
      };
    }
  }, [isOpen, currentSuporte?.id, autorTipo]);

  const fetchMensagens = async () => {
    if (!currentSuporte) return;
    const { data, error } = await supabase
      .from('suporte_mensagens')
      .select('*')
      .eq('suporte_id', currentSuporte.id)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Erro ao buscar mensagens:', error);
      return;
    }
    setMensagens(data || []);
  };

  const handleEnviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaMensagem.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('suporte_mensagens').insert({
        suporte_id: suporte.id,
        autor_id: autorId,
        autor_tipo: autorTipo,
        mensagem: novaMensagem
      });

      if (error) throw error;
      
      setNovaMensagem('');
      // fetchMensagens(); // Not needed due to real-time subscription
      toast.success('Mensagem enviada!');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConcluirSuporte = async () => {
    setConfirmModal(true);
  };

  const confirmConcluirSuporte = async () => {
    try {
      const { data, error } = await supabase
        .from('prestador_suporte_demandas')
        .update({ status: 'fechado' })
        .eq('id', suporte.id)
        .select();
      
      if (error) {
        console.error('Erro detalhado Supabase:', error);
        throw error;
      }
      
      toast.success('Suporte fechado!');
      setConfirmModal(false);
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Erro ao concluir suporte:', error);
      toast.error('Erro ao concluir suporte. Verifique o console.');
    }
  };

  const ultimaMensagem = mensagens[mensagens.length - 1];
  const aguardandoResposta = ultimaMensagem && ultimaMensagem.autor_tipo === 'prestador';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Suporte: ${suporte.demanda?.titulo || 'Chamado'}`}>
      <div className="flex flex-col h-[400px]">
        <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-neutral-50 rounded-lg mb-4">
          {mensagens.map((m) => (
            <div key={m.id} className={`flex ${m.autor_tipo === 'admin' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-lg ${m.autor_tipo === 'admin' ? 'bg-blue-600 text-white' : 'bg-white border border-neutral-200'}`}>
                <p className="text-sm">{m.mensagem}</p>
                <span className={`text-[10px] block mt-1 ${m.autor_tipo === 'admin' ? 'text-blue-100' : 'text-neutral-400'}`}>
                  {formatDateTime(m.created_at)}
                </span>
              </div>
            </div>
          ))}
          {aguardandoResposta && autorTipo === 'prestador' && (
            <div className="text-center text-xs text-neutral-500 italic">Aguardando resposta do administrativo...</div>
          )}
        </div>
        
        {suporte.status !== 'fechado' && (
          <form onSubmit={handleEnviarMensagem} className="flex gap-2">
            <input
              type="text"
              value={novaMensagem}
              onChange={(e) => setNovaMensagem(e.target.value)}
              className="flex-1 rounded-lg border p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder="Digite sua mensagem..."
            />
            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </form>
        )}

        {suporte.status !== 'fechado' && autorTipo === 'admin' && (
          <button onClick={handleConcluirSuporte} className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-700">
            <CheckCircle className="h-4 w-4" />
            Finalizar Suporte
          </button>
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal}
        onClose={() => setConfirmModal(false)}
        title="Finalizar Suporte"
      >
        <div className="space-y-4">
          <p className="text-neutral-600">
            Tem certeza que deseja finalizar este suporte?
          </p>
          <div className="flex gap-4 pt-4">
            <button
              onClick={() => setConfirmModal(false)}
              className="flex-1 rounded-xl border border-neutral-200 py-3 font-bold text-neutral-600 hover:bg-neutral-50"
            >
              Cancelar
            </button>
            <button
              onClick={confirmConcluirSuporte}
              className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-700"
            >
              Confirmar
            </button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}
