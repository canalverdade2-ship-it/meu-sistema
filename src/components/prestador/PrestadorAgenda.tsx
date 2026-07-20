import React, { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, XCircle, Plus, FileText, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import { notificationService } from '../../lib/notificationService';
import { logService } from '../../lib/logService';

interface PrestadorAgendaProps {
  prestadorId: string;
  initialItemId?: string;
}

export function PrestadorAgenda({ prestadorId, initialItemId }: PrestadorAgendaProps) {
  const [activeTab, setActiveTab] = useState<'agendados' | 'concluidos'>('agendados');
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [demandasAtivas, setDemandasAtivas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (initialItemId && agendamentos.length > 0) {
      const agendamento = agendamentos.find(a => a.id === initialItemId);
      if (agendamento) {
        setActiveTab(agendamento.status === 'concluido' ? 'concluidos' : 'agendados');
        
        setTimeout(() => {
          const element = document.getElementById(`agendamento-${initialItemId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedItemId(initialItemId);
            setTimeout(() => setHighlightedItemId(null), 3000);
          }
        }, 400);
      }
    }
  }, [initialItemId, agendamentos.length]);
  
  // Form state
  const [demandaId, setDemandaId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
    fetchDemandasAtivas();

    const channel = supabase
      .channel(`prestador-agendamentos-${prestadorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_agendamentos', filter: `prestador_id=eq.${prestadorId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_demandas', filter: `prestador_id=eq.${prestadorId}` }, () => {
        fetchDemandasAtivas();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [prestadorId]);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('prestador_agendamentos')
        .select('*, demanda:prestador_demandas(id, titulo, status)')
        .eq('prestador_id', prestadorId)
        .order('data_inicio', { ascending: true });

      if (error) throw error;
      setAgendamentos(data || []);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      toast.error('Erro ao carregar agendamentos.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDemandasAtivas = async () => {
    try {
      const { data, error } = await supabase
        .from('prestador_demandas')
        .select('id, titulo, status')
        .eq('prestador_id', prestadorId)
        .eq('status', 'ativa');

      if (error) throw error;
      setDemandasAtivas(data || []);
    } catch (error) {
      console.error('Erro ao buscar demandas ativas:', error);
    }
  };

  const handleCreateAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demandaId || !dataInicio || !dataFim) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }

    if (new Date(dataFim) <= new Date(dataInicio)) {
      toast.error('A data de fim deve ser posterior à data de início.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('prestador_agendamentos')
        .insert({
          prestador_id: prestadorId,
          demanda_id: demandaId,
          data_inicio: new Date(dataInicio).toISOString(),
          data_fim: new Date(dataFim).toISOString(),
          observacoes,
          status: 'agendado'
        });

      if (error) throw error;

      await logService.logAction({
        ator_tipo: 'prestador',
        ator_id: prestadorId,
        acao: 'CRIAR_AGENDAMENTO',
        detalhes: `Criou um agendamento para a demanda #${demandaId.slice(0, 8)}: ${dataInicio} até ${dataFim}`
      });

      toast.success('Agendamento criado com sucesso!');
      setIsModalOpen(false);
      resetForm();
      fetchData();

      // Notify admin
      const demandaSel = demandasAtivas.find(d => d.id === demandaId);
      await notificationService.notifyAdmin(
        '📅 Novo Agendamento do Prestador',
        `Um prestador criou um novo agendamento para a demanda "${demandaSel?.titulo || demandaId}". Período: ${new Date(dataInicio).toLocaleString('pt-BR')} até ${new Date(dataFim).toLocaleString('pt-BR')}.`,
        'servicos',
        'demanda_entregue',
        { prioridade: 'normal' }
      );
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast.error('Erro ao criar agendamento.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConcluirAgendamento = async (id: string) => {
    if (!confirm('Deseja marcar este agendamento como concluído?')) return;
    try {
      const { error } = await supabase
        .from('prestador_agendamentos')
        .update({ status: 'concluido' })
        .eq('id', id);

      if (error) throw error;

      // Notify admin
      const ag = agendamentos.find(a => a.id === id);
      await notificationService.notifyAdmin(
        '✅ Agendamento Concluído',
        `Um agendamento foi concluído pelo prestador. Demanda: "${ag?.demanda?.titulo || id}".`,
        'servicos',
        'demanda_entregue',
        { prioridade: 'normal' }
      );

      toast.success('Agendamento concluído!');
      
      await logService.logAction({
        ator_tipo: 'prestador',
        ator_id: prestadorId,
        acao: 'CONCLUIR_AGENDAMENTO',
        detalhes: `Marcou o agendamento #${id.slice(0, 8)} como concluído`
      });

      fetchData();
    } catch (error) {
      console.error('Erro ao concluir agendamento:', error);
      toast.error('Erro ao concluir agendamento.');
    }
  };

  const handleExcluirAgendamento = async (id: string) => {
    try {
      const { error } = await supabase
        .from('prestador_agendamentos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await logService.logAction({
        ator_tipo: 'prestador',
        ator_id: prestadorId,
        acao: 'EXCLUIR_AGENDAMENTO',
        detalhes: `Excluiu o agendamento #${id.slice(0, 8)}`
      });

      toast.success('Agendamento excluído!');
      setConfirmDeleteId(null);
      fetchData();
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error);
      toast.error('Erro ao excluir agendamento.');
    }
  };

  const resetForm = () => {
    setDemandaId('');
    setDataInicio('');
    setDataFim('');
    setObservacoes('');
  };

  const agendados = agendamentos.filter(a => a.status === 'agendado');
  const concluidos = agendamentos.filter(a => a.status === 'concluido');

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1a1a1a] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex border-b border-neutral-200">
          <button
            onClick={() => setActiveTab('agendados')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'agendados' ? 'border-[#1a1a1a] text-[#1a1a1a]' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Agendados ({agendados.length})
          </button>
          <button
            onClick={() => setActiveTab('concluidos')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'concluidos' ? 'border-[#1a1a1a] text-[#1a1a1a]' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Concluídos ({concluidos.length})
          </button>
        </div>

        {activeTab === 'agendados' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-black hover:shadow-md active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </button>
        )}
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
        {activeTab === 'agendados' && (
          agendados.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">
              Nenhum agendamento encontrado.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {agendados.map((agendamento) => (
                <div 
                  id={`agendamento-${agendamento.id}`}
                  key={agendamento.id} 
                  className={`p-4 transition-all duration-500 ${
                    highlightedItemId === agendamento.id 
                      ? 'bg-indigo-50/50 ring-2 ring-indigo-500 scale-[1.01] z-10 shadow-lg rounded-xl' 
                      : 'hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="rounded-full bg-blue-100 p-2 text-blue-600 mt-1">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-neutral-900">
                          {agendamento.demanda ? agendamento.demanda.titulo : 'Demanda não encontrada'}
                        </h4>
                        <div className="mt-1 flex items-center gap-4 text-sm text-neutral-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {new Date(agendamento.data_inicio).toLocaleString('pt-BR')} - {new Date(agendamento.data_fim).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        {agendamento.observacoes && (
                          <p className="mt-2 text-sm text-neutral-600 bg-neutral-100 p-2 rounded-lg">
                            {agendamento.observacoes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleConcluirAgendamento(agendamento.id)}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Marcar como Concluído"
                      >
                        <CheckCircle className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(agendamento.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir Agendamento"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'concluidos' && (
          concluidos.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">
              Nenhum agendamento concluído.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {concluidos.map((agendamento) => (
                <div 
                  id={`agendamento-${agendamento.id}`}
                  key={agendamento.id} 
                  className={`p-4 transition-all duration-500 opacity-75 ${
                    highlightedItemId === agendamento.id 
                      ? 'bg-indigo-50/50 ring-2 ring-indigo-500 scale-[1.01] z-10 shadow-lg rounded-xl' 
                      : 'hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 mt-1">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-neutral-900 line-through">
                          {agendamento.demanda ? agendamento.demanda.titulo : 'Demanda não encontrada'}
                        </h4>
                        <div className="mt-1 flex items-center gap-4 text-sm text-neutral-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {new Date(agendamento.data_inicio).toLocaleString('pt-BR')} - {new Date(agendamento.data_fim).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        {agendamento.observacoes && (
                          <p className="mt-2 text-sm text-neutral-600 bg-neutral-100 p-2 rounded-lg">
                            {agendamento.observacoes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setConfirmDeleteId(agendamento.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir Agendamento"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Modal Novo Agendamento */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title="Novo Agendamento"
        size="wide"
      >
        <form onSubmit={handleCreateAgendamento} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Demanda Ativa *
            </label>
            <select
              required
              value={demandaId}
              onChange={(e) => setDemandaId(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm focus:border-[#1a1a1a] focus:outline-none focus:ring-1 focus:ring-[#1a1a1a]"
            >
              <option value="">Selecione uma demanda</option>
              {demandasAtivas.map((demanda) => (
                <option key={demanda.id} value={demanda.id}>
                  {demanda.titulo}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Data/Hora Início *
              </label>
              <input
                type="datetime-local"
                required
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm focus:border-[#1a1a1a] focus:outline-none focus:ring-1 focus:ring-[#1a1a1a]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Data/Hora Fim *
              </label>
              <input
                type="datetime-local"
                required
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm focus:border-[#1a1a1a] focus:outline-none focus:ring-1 focus:ring-[#1a1a1a]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Observações
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm focus:border-[#1a1a1a] focus:outline-none focus:ring-1 focus:ring-[#1a1a1a]"
              placeholder="Adicione notas ou detalhes sobre o agendamento..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
              className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-black hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Salvando...' : 'Salvar Agendamento'}
            </button>
          </div>
        </form>
      </Modal>
    </div>

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Excluir Agendamento"
        size="wide"
      >
        <div className="space-y-5">
          <div className="rounded-2xl bg-amber-50 p-5 border border-amber-100 flex items-start gap-4">
            <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900">Confirmar exclusão do agendamento?</p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                Esta ação não pode ser desfeita. O agendamento será removido permanentemente.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="flex-1 rounded-xl border border-neutral-200 py-3 text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => confirmDeleteId && handleExcluirAgendamento(confirmDeleteId)}
              className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-black text-white shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Excluir Agendamento
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
