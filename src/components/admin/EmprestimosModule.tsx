import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Emprestimo, EmprestimoHistorico } from '../../types';
import { formatCurrency, formatDate, handleError } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { notificationService } from '../../lib/notificationService';
import { logService } from '../../lib/logService';
import { AdminWhatsAppButton } from './ui/AdminWhatsAppButton';
import { whatsappNotificationService } from '../../lib/whatsappNotificationService';
import { Modal } from '../ui/Modal';
import { calcularParcela, getEmprestimoStatusInfo, registrarHistoricoEmprestimo } from '../../utils/emprestimoUtils';
import { calcularPerfilRisco, getPerfilRiscoInfo } from '../../utils/riskProfile';
import { Landmark, Upload, FileText, CheckCircle, XCircle, Send, Percent, Clock, Trash2, History, User, MapPin, Calculator, ShieldCheck, Download, Filter, Printer, Search, Plus, ChevronRight } from 'lucide-react';
import { maskCPF, maskPhone, maskCurrency, handleCurrencyInputChange } from '../../lib/utils';
import { sessionService } from '../../lib/sessionService';

const getAdminSessionForRpc = () => {
  const session = sessionService.getCurrentSession();
  if (!session?.sessaoId || !session?.sessionToken) {
    throw new Error('Sessao administrativa expirada. Faca login novamente.');
  }
  return session;
};

export function EmprestimosModule({ activeSubTab, initialItemId, onNavigate, colaboradorNome }: { activeSubTab?: string; initialItemId?: string; colaboradorNome?: string; onNavigate?: (module: string, tab?: string) => void }) {
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([]);
  const [selected, setSelected] = useState<Emprestimo | null>(null);
  const [historico, setHistorico] = useState<EmprestimoHistorico[]>([]);
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [parcelas, setParcelas] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [obs, setObs] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '' });
  const [proposta, setProposta] = useState({ valorAprovado: '', juros: '', maxParcelas: '', taxaServico: '', mensagem: '', validade: 7 });
  const [stats, setStats] = useState({ total: 0, ativos: 0, quitados: 0, pendentes: 0, inadimplencia: 0, receita: 0 });
  const [contratoFile, setContratoFile] = useState<File | null>(null);
  const [motivoPendencia, setMotivoPendencia] = useState('');
  const [valorQuitacao, setValorQuitacao] = useState('');
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [documentos, setDocumentos] = useState<any[]>([]);

useEffect(() => { fetchAll(); }, [activeSubTab]);
  useEffect(() => {
    if (initialItemId && emprestimos.length > 0) {
      const emp = emprestimos.find(e => e.id === initialItemId);
      if (emp) openDetail(emp);
    }
  }, [initialItemId, emprestimos]);

  // Real-time listener para o ADM
  useEffect(() => {
    const channel = supabase.channel('admin-emprestimos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emprestimos' }, (payload) => {
        fetchAll();
        // Se o empréstimo que mudou for o que está aberto no modal, atualizamos os dados dele
        if (selected && payload.new && (payload.new as any).id === selected.id) {
          refreshDetail((payload.new as any).id);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emprestimo_comentarios' }, (payload) => {
        if (selected && (payload.new as any).emprestimo_id === selected.id) {
          refreshDetail(selected.id);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emprestimo_historico' }, (payload) => {
        if (selected && (payload.new as any).emprestimo_id === selected.id) {
          refreshDetail(selected.id);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emprestimo_parcelas' }, (payload) => {
        if (selected && (payload.new as any).emprestimo_id === selected.id) {
          refreshDetail(selected.id);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emprestimo_documentos' }, (payload) => {
        if (selected && (payload.new as any).emprestimo_id === selected.id) {
          refreshDetail(selected.id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selected]);

  const refreshDetail = async (empId: string) => {
    const { data: emp } = await supabase.from('emprestimos').select('*, clientes(*), orcamentos(*)').eq('id', empId).single();
    if (emp) {
      const [perf, historicoRes, comentariosRes, parcelasRes, docsRes] = await Promise.all([
        calcularPerfilRisco(emp.cliente_id),
        supabase.from('emprestimo_historico').select('*').eq('emprestimo_id', emp.id).order('created_at', { ascending: false }),
        supabase.from('emprestimo_comentarios').select('*').eq('emprestimo_id', emp.id).order('created_at'),
        supabase.from('emprestimo_parcelas').select('*').eq('emprestimo_id', emp.id).order('numero_parcela'),
        supabase.from('emprestimo_documentos').select('*').eq('emprestimo_id', emp.id)
      ]);
      setSelected({ ...emp, perfil_risco: perf } as any);
      setHistorico((historicoRes.data || []) as any);
      setComentarios((comentariosRes.data || []) as any);
      setParcelas((parcelasRes.data || []) as any);
      setDocumentos((docsRes.data || []) as any);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    const statusMap: Record<string, string[]> = {
      solicitacoes: ['analise_inicial', 'pendencia_documentos'],
      propostas: ['proposta_enviada', 'aguardando_dados_bancarios', 'analise_final', 'proposta_expirada'],
      ativos: ['aprovado', 'ativo', 'pendencia_assinatura', 'analise_contrato', 'analise_quitacao', 'aguardando_pagamento_quitacao'],
      quitados: ['quitado'],
      cancelados: ['cancelado'],
    };
    const statuses = statusMap[activeSubTab || 'solicitacoes'] || statusMap['solicitacoes'];
    const { data } = await supabase.from('emprestimos').select('*, clientes(*), orcamentos(*)').in('status', statuses).order('created_at', { ascending: false });
    setEmprestimos((data || []) as any);

    // Stats
    const [ativos, parcelas, taxa] = await Promise.all([
      supabase.from('emprestimos').select('valor_aprovado,status').not('status', 'in', '("cancelado","proposta_expirada")'),
      supabase.from('emprestimo_parcelas').select('status'),
      supabase.from('emprestimos').select('taxa_servico').eq('status', 'quitado'),
    ]);
    const d = ativos.data || [];
    const p = parcelas.data || [];
    const vencidas = p.filter(x => x.status === 'vencida').length;
    const receita = (taxa.data || []).reduce((s: number, x: any) => s + (x.taxa_servico || 0), 0);
    setStats({
      total: d.filter((x: any) => ['aprovado','ativo','analise_quitacao','aguardando_pagamento_quitacao'].includes(x.status)).reduce((s: number, x: any) => s + (x.valor_aprovado || 0), 0),
      ativos: d.filter((x: any) => ['aprovado','ativo','analise_quitacao','aguardando_pagamento_quitacao'].includes(x.status)).length,
      quitados: d.filter((x: any) => x.status === 'quitado').length,
      pendentes: d.filter((x: any) => x.status === 'analise_inicial').length,
      inadimplencia: p.length > 0 ? Math.round((vencidas / p.length) * 100) : 0,
      receita,
    });
    setLoading(false);
  };

  const openDetail = async (emp: Emprestimo) => {
    try {
      setSelected(emp);
      setShowModal(true);
      setObs(emp.observacoes_admin || '');
      setProposta(prev => ({ ...prev, valorAprovado: (emp.valor_aprovado || emp.valor_solicitado).toString() }));
      
      const [perf, historicoRes, comentariosRes, parcelasRes, docsRes] = await Promise.all([
        calcularPerfilRisco(emp.cliente_id),
        supabase.from('emprestimo_historico').select('*').eq('emprestimo_id', emp.id).order('created_at', { ascending: false }),
        supabase.from('emprestimo_comentarios').select('*').eq('emprestimo_id', emp.id).order('created_at'),
        supabase.from('emprestimo_parcelas').select('*').eq('emprestimo_id', emp.id).order('numero_parcela'),
        supabase.from('emprestimo_documentos').select('*').eq('emprestimo_id', emp.id)
      ]);
      
      setSelected({ ...emp, perfil_risco: perf } as any);
      setHistorico((historicoRes.data || []) as any);
      setComentarios((comentariosRes.data || []) as any);
      setParcelas((parcelasRes.data || []) as any);
      setDocumentos((docsRes.data || []) as any);
    } catch (err) {
      console.error('Erro ao abrir detalhes do empréstimo:', err);
      // O modal já abriu com os dados básicos, então apenas logamos o erro
    }
  };

  const saveObs = async () => {
    if (!selected) return;
    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_emprestimo_salvar_observacao', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_observacoes_admin: obs
      });
      if (error) throw error;

      toast.success('Observacao salva!');
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });
      refreshDetail(selected.id);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar observacao.');
    }
  };

  const sendMsg = async () => {
    if (!newMsg.trim() || !selected) return;
    const msg = newMsg;
    setNewMsg('');
    try {
      const { data: userData } = await supabase.auth.getUser();
      const session = getAdminSessionForRpc();
      const { data: rpcData, error } = await supabase.rpc('gsa_admin_emprestimo_enviar_comentario', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_autor_id: userData.user?.id || null,
        p_mensagem: msg
      });
      if (error) throw error;

      await notificationService.notifyClient(
        selected.cliente_id,
        'Nova mensagem do suporte',
        `Voce recebeu uma nova mensagem referente ao emprestimo ${selected.codigo_emprestimo}.`,
        'emprestimos',
        'propostas',
        selected.id
      );

      const { data } = await supabase.from('emprestimo_comentarios').select('*').eq('emprestimo_id', selected.id).order('created_at');
      setComentarios((data || []) as any);

      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({ comentario_id: rpcData?.comentario_id }), ator_tipo: 'admin', ator_nome: 'Administrador' });
    } catch (err) {
      toast.error('Erro ao enviar mensagem.');
    }
  };

  const enviarProposta = async () => {
    if (!selected || !proposta.valorAprovado || !proposta.juros || !proposta.maxParcelas || !proposta.taxaServico) {
      toast.error('Preencha todos os campos.');
      return;
    }

    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_emprestimo_enviar_proposta', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_valor_aprovado: parseFloat(proposta.valorAprovado),
        p_juros_total_percentual: parseFloat(proposta.juros),
        p_max_parcelas_liberado: parseInt(proposta.maxParcelas),
        p_taxa_servico: parseFloat(proposta.taxaServico),
        p_proposta_mensagem: proposta.mensagem,
        p_validade_dias: proposta.validade
      });
      if (error) throw error;

      await notificationService.notifyClient(selected.cliente_id, 'Proposta de Emprestimo', 'Sua proposta esta disponivel. Acesse Meus Emprestimos para ver.', 'emprestimos', 'propostas', selected.id);
      toast.success('Proposta enviada!');
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });

      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar proposta.');
    }
  };

  const enviarContrato = async () => {
    if (!contratoFile || !selected) {
      toast.error('Selecione o arquivo do contrato.');
      return;
    }
    const sanitizedName = contratoFile.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
    const uploadPath = `contratos/${selected.id}/${Date.now()}-${sanitizedName}`;
    const { error } = await supabase.storage.from('emprestimos').upload(uploadPath, contratoFile);
    if (error) {
      toast.error('Erro ao enviar contrato.');
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('emprestimos').getPublicUrl(uploadPath);

    try {
      const session = getAdminSessionForRpc();
      const { error: rpcError } = await supabase.rpc('gsa_admin_emprestimo_enviar_contrato', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_contrato_url: publicUrl
      });
      if (rpcError) throw rpcError;

      await notificationService.notifyClient(selected.cliente_id, 'Contrato Disponivel', 'Seu contrato de emprestimo esta disponivel para assinatura.', 'emprestimos', 'ativos', selected.id);
      toast.success('Contrato enviado!');
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });

      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao registrar contrato.');
    }
  };

  const aprovar = async () => {
    if (!selected) return;
    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_emprestimo_aprovar', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id
      });
      if (error) throw error;

      const taxa = Number(data?.taxa_servico ?? selected.taxa_servico ?? 0);
      const isTaxaZero = Boolean(data?.taxa_zero ?? taxa === 0);

      if (isTaxaZero) {
        await notificationService.notifyClient(selected.cliente_id, 'Emprestimo Aprovado!', 'Seu emprestimo foi aprovado com taxa de servico isenta! Aguarde a ativacao pelo administrador.', 'emprestimos', 'sistema');
        toast.success(data?.already_processed ? 'Emprestimo ja estava aprovado.' : 'Aprovado! Taxa isenta e fatura marcada como paga.');
      } else {
        await notificationService.notifyClient(selected.cliente_id, 'Emprestimo Aprovado!', `Seu emprestimo foi aprovado! Pague a taxa de servico de ${formatCurrency(taxa)} para liberar as parcelas.`, 'financeiro', 'sistema');
        toast.success(data?.already_processed ? 'Emprestimo ja estava aprovado.' : 'Aprovado e fatura gerada!');
      }

      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({ isTaxaZero }), ator_tipo: 'admin', ator_nome: 'Administrador' });
      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao aprovar emprestimo.');
    }
  };

  const ativar = async () => {
    if (!selected) return;
    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_emprestimo_atualizar_status', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_status: 'ativo',
        p_motivo: null
      });
      if (error) throw error;

      await notificationService.notifyClient(selected.cliente_id, 'Emprestimo Ativo!', 'Seu emprestimo foi ativado e as parcelas estao disponiveis no financeiro.', 'emprestimos', 'ativos', selected.id);
      toast.success('Emprestimo ativado com sucesso!');
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });
      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao ativar emprestimo.');
    }
  };

  const solicitarPendencia = async () => {
    if (!selected || !motivoPendencia) {
      toast.error('Informe o motivo.');
      return;
    }
    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_emprestimo_atualizar_status', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_status: 'pendencia_documentos',
        p_motivo: motivoPendencia
      });
      if (error) throw error;

      await notificationService.notifyClient(selected.cliente_id, 'Pendencia no Emprestimo', `Ha uma pendencia no seu emprestimo: ${motivoPendencia}`, 'emprestimos', 'sistema');
      toast.success('Pendencia enviada!');
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });
      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao solicitar pendencia.');
    }
  };

  const reprovarAssinatura = async () => {
    if (!selected) return;
    if (!motivoPendencia) {
      toast.error('Descreva por que a assinatura foi reprovada no campo abaixo.');
      return;
    }
    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_emprestimo_atualizar_status', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_status: 'pendencia_assinatura',
        p_motivo: motivoPendencia
      });
      if (error) throw error;

      await notificationService.notifyClient(selected.cliente_id, 'Assinatura Reprovada', `Sua assinatura no contrato foi recusada: ${motivoPendencia}. Por favor, assine novamente no seu portal.`, 'emprestimos', 'sistema');
      toast.success('Assinatura reprovada e cliente notificado.');
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });
      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao reprovar assinatura.');
    }
  };

  const cancelar = () => {
    if (!selected) return;
    setIsCancelModalOpen(true);
  };

  const confirmarCancelamento = async () => {
    if (!selected) return;
    setIsCancelModalOpen(false);
    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_emprestimo_atualizar_status', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_status: 'cancelado',
        p_motivo: null
      });
      if (error) throw error;

      await notificationService.notifyClient(selected.cliente_id, 'Emprestimo Nao Aprovado', 'Seu emprestimo nao foi aprovado neste momento. Voce podera tentar solicitar novamente em 30 dias.', 'emprestimos', 'sistema');
      toast.success('Cancelado e cliente notificado!');
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });
      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao cancelar emprestimo.');
    }
  };

  const aprovarDocumento = async (docId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_emprestimo_atualizar_documento', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_documento_id: docId,
        p_status: 'aprovado',
        p_motivo: null
      });
      if (error) throw error;
      toast.success('Documento aprovado');
      refreshDetail(selected!.id);
    } catch(err: any) {
      toast.error(err.message || 'Erro ao aprovar documento');
    }
  };

  const reprovarDocumento = async (docId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const motivo = window.prompt('Motivo da reprovacao (o cliente recebera essa mensagem):');
    if (!motivo) return;

    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_emprestimo_atualizar_documento', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_documento_id: docId,
        p_status: 'rejeitado',
        p_motivo: motivo
      });
      if (error) throw error;

      await notificationService.notifyClient(selected!.cliente_id, 'Problema com Documento', `Seu documento nao foi aceito. Motivo: ${motivo}. Acesse o sistema e envie novamente.`, 'emprestimos', 'sistema');

      toast.success('Documento reprovado e cliente notificado');
      refreshDetail(selected!.id);
      fetchAll();
    } catch(err: any) {
      toast.error(err.message || 'Erro ao reprovar documento');
    }
  };

  const enviarOfertaQuitacao = async () => {
    if (!selected || !valorQuitacao) {
      toast.error('Informe o valor');
      return;
    }
    const v = parseFloat(valorQuitacao);
    if (isNaN(v) || v <= 0) {
      toast.error('Valor invalido');
      return;
    }

    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_emprestimo_enviar_oferta_quitacao', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_valor_quitacao_acordo: v
      });
      if (error) throw error;

      if (!data?.already_processed) {
        await notificationService.notifyClient(selected.cliente_id, 'Oferta de Quitacao', 'O valor para quitacao total foi aprovado.', 'emprestimos', 'ativos', selected.id);
      }

      toast.success(data?.already_processed ? 'Esta quitacao ja possui uma oferta enviada.' : 'Oferta enviada!');
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });
      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar oferta.');
    }
  };

  const riscoInfo = getPerfilRiscoInfo(selected?.perfil_risco);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Header com Ações */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <h2 className="text-xl font-black text-neutral-900 uppercase tracking-tight">Gestão de Empréstimos</h2>
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Controle total de solicitações, propostas e contratos</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar por cliente ou código..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white ring-1 ring-neutral-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-neutral-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all w-64"
            />
          </div>
          <button 
            onClick={() => onNavigate?.('orcamentos')}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-black transition-all shadow-lg shadow-black/10 group"
          >
            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" /> Solicitar Orçamento
          </button>
        </div>
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Emprestado', value: formatCurrency(stats.total), icon: '💰', color: 'indigo', bg: 'bg-indigo-50' },
          { label: 'Contratos Ativos', value: stats.ativos, icon: '📊', color: 'emerald', bg: 'bg-emerald-50' },
          { label: 'Contratos Quitados', value: stats.quitados, icon: '✅', color: 'teal', bg: 'bg-teal-50' },
          { label: 'Novas Solicitações', value: stats.pendentes, icon: '📋', color: 'amber', bg: 'bg-amber-50' },
          { label: 'Índice Inadimplência', value: `${stats.inadimplencia}%`, icon: '⚠️', color: stats.inadimplencia > 10 ? 'red' : 'neutral', bg: stats.inadimplencia > 10 ? 'bg-red-50' : 'bg-neutral-50' },
          { label: 'Receita Operacional', value: formatCurrency(stats.receita), icon: '💵', color: 'purple', bg: 'bg-purple-50' },
        ].map((s, idx) => (
          <div key={s.label} className={`${s.bg} rounded-[2rem] p-6 ring-1 ring-black/5 shadow-sm transition-all hover:scale-[1.02] duration-300`} style={{ animationDelay: `${idx * 100}ms` }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">{s.icon}</span>
              <div className={`h-2 w-2 rounded-full bg-${s.color}-500 animate-pulse`} />
            </div>
            <p className={`text-xl font-black text-${s.color}-600 tracking-tight`}>{s.value}</p>
            <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : emprestimos.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl ring-1 ring-neutral-200">
          <Landmark className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-neutral-400">Nenhum empréstimo nesta categoria</p>
        </div>
      ) : (
        <div className="space-y-3">
          {emprestimos
            .filter(e => {
              if (!search) return true;
              const s = search.toLowerCase();
              return e.codigo_emprestimo.toLowerCase().includes(s) || (e as any).clientes?.nome.toLowerCase().includes(s);
            })
            .map(emp => {
              const info = getEmprestimoStatusInfo(emp.status);
              const cli = (emp as any).clientes;
              return (
                <div key={emp.id} onClick={() => openDetail(emp)} className="bg-white rounded-2xl p-5 ring-1 ring-neutral-200 hover:shadow-lg hover:ring-indigo-300 transition-all cursor-pointer flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-2xl ${info.bg} flex items-center justify-center text-xl`}>
                      {emp.status === 'ativo' ? '💰' : emp.status === 'pendencia_assinatura' ? '📝' : '📋'}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-tighter group-hover:text-indigo-500 transition-colors">{emp.codigo_emprestimo}</p>
                      <p className="text-sm font-black text-neutral-900 uppercase tracking-tight">{cli?.nome || 'Cliente'}</p>
                      <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">{formatDate(emp.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-lg font-black text-indigo-600 tracking-tight">{formatCurrency(emp.valor_aprovado || emp.valor_solicitado)}</p>
                      <p className="text-[9px] font-black text-neutral-400 uppercase">Total Estimado</p>
                    </div>
                    <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ring-1 ${info.bg} ${info.color} ring-current/10`}>{info.label}</span>
                    <ChevronRight className="h-5 w-5 text-neutral-200 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Modal Detalhes */}
      {showModal && selected && (
        <Modal 
          isOpen={true} 
          title={`Gestão de Empréstimo: ${selected.codigo_emprestimo}`} 
          onClose={() => setShowModal(false)} 
          size="full"
        >
          <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4">
            
            {/* Header Status & Risco */}
            <div className="flex flex-col lg:flex-row items-stretch gap-6">
              <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#1a1a1a] p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="space-y-2 relative z-10">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-lg ring-1 ring-emerald-400/20">
                      {selected.codigo_emprestimo}
                    </span>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${getEmprestimoStatusInfo(selected.status).bg} ${getEmprestimoStatusInfo(selected.status).color}`}>
                      {getEmprestimoStatusInfo(selected.status).label}
                    </span>
                  </div>
                  <h2 className="text-3xl font-black tracking-tight">{(selected as any).clientes?.nome}</h2>
                  <p className="text-neutral-400 text-xs font-bold uppercase tracking-widest">Solicitado em {formatDate(selected.created_at)}</p>
                </div>

                <div className="flex items-center gap-6 relative z-10">
                  <div className="bg-white/10 p-1 rounded-2xl backdrop-blur-sm">
                    <AdminWhatsAppButton 
                      telefone={(selected as any).clientes?.telefone}
                      mensagem={whatsappNotificationService.gerarMensagemWhatsApp({
                        tipo: 'emprestimo',
                        clienteNome: (selected as any).clientes?.nome,
                        codigo: selected.codigo_emprestimo,
                        status: getEmprestimoStatusInfo(selected.status).label,
                        valorTotal: formatCurrency(selected.valor_aprovado || selected.valor_solicitado)
                      })}
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Valor Total</p>
                    <p className="text-3xl font-black text-emerald-400">{formatCurrency(selected.valor_aprovado || selected.valor_solicitado)}</p>
                  </div>
                </div>
              </div>

              <div className={`w-full lg:w-80 p-8 rounded-[2.5rem] ring-1 transition-all ${riscoInfo.bg} ${riscoInfo.color} ring-current/20 shadow-xl flex flex-col justify-center items-center text-center gap-4 relative overflow-hidden group`}>
                <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="h-16 w-16 rounded-3xl bg-white/20 flex items-center justify-center text-3xl shadow-inner relative z-10">
                  {riscoInfo.icon}
                </div>
                <div className="relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Score de Crédito GSA</p>
                  <p className="text-2xl font-black tracking-tighter">RISCO {riscoInfo.label}</p>
                  <div className="mt-3 h-1.5 w-full bg-current/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-current transition-all duration-1000" 
                      style={{ width: riscoInfo.label === 'BAIXO' ? '85%' : riscoInfo.label === 'MÉDIO' ? '50%' : '15%' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Coluna Esquerda: Dados e Documentos */}
              <div className="lg:col-span-2 space-y-8">
                
                {/* Seção 1: Dados Pessoais & Endereço */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-[2rem] ring-1 ring-black/5 shadow-sm space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                      <User className="h-4 w-4" /> Dados Pessoais
                    </h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">CPF</p>
                          <p className="text-sm font-bold text-neutral-800">{maskCPF((selected as any).clientes?.cpf) || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">RG</p>
                          <p className="text-sm font-bold text-neutral-800">{((selected as any).clientes?.observacoes || '').match(/RG:\s*(.*)/)?.[1]?.split('\n')[0] || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Data Nasc.</p>
                          <p className="text-sm font-bold text-neutral-800">{formatDate((selected as any).clientes?.data_nascimento) || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Telefone</p>
                          <p className="text-sm font-bold text-neutral-800">{maskPhone((selected as any).clientes?.telefone) || '—'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">E-mail</p>
                        <p className="text-sm font-bold text-neutral-800">{(selected as any).clientes?.email || '—'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[2rem] ring-1 ring-black/5 shadow-sm space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Endereço Residencial
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Logradouro</p>
                        <p className="text-sm font-bold text-neutral-800">
                          {(selected as any).clientes?.endereco || '—'}
                          {(selected as any).clientes?.numero ? `, ${(selected as any).clientes.numero}` : ''}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Bairro</p>
                        <p className="text-sm font-bold text-neutral-800">{(selected as any).clientes?.bairro || '—'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Cidade/UF</p>
                          <p className="text-sm font-bold text-neutral-800">{(selected as any).clientes?.cidade || '—'}/{(selected as any).clientes?.estado || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">CEP</p>
                          <p className="text-sm font-bold text-neutral-800">{(selected as any).clientes?.cep || '—'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção 2: Documentação */}
                <div className="bg-white p-8 rounded-[2rem] ring-1 ring-black/5 shadow-sm space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Documentação Anexada pelo Cliente
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {documentos && documentos.length > 0 && documentos.map((doc: any, i: number) => (
                      <div key={i} className="flex flex-col relative group">
                        <a 
                          href={doc.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex flex-col gap-3 p-4 rounded-t-2xl bg-neutral-50 ring-1 ring-neutral-200 hover:ring-indigo-400 hover:bg-indigo-50 transition-all flex-1"
                        >
                          <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-neutral-400 uppercase truncate leading-none mb-1">{doc.tipo?.replace('_', ' ') || 'Documento'}</p>
                            <p className="text-[9px] font-black text-indigo-600 uppercase group-hover:underline">Visualizar ↗</p>
                          </div>
                          {doc.status && (
                            <span className={`absolute top-2 right-2 text-[8px] font-bold px-2 py-1 rounded-full ${
                              doc.status === 'aprovado' ? 'bg-emerald-100 text-emerald-700' : 
                              doc.status === 'rejeitado' ? 'bg-red-100 text-red-700' : 
                              doc.status === 'reenviado' ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {doc.status === 'rejeitado' ? 'REPROVADO' : doc.status.toUpperCase()}
                            </span>
                          )}
                        </a>
                        {(!doc.status || doc.status === 'enviado' || doc.status === 'pendente' || doc.status === 'reenviado') && (
                          <div className="flex ring-1 ring-neutral-200 rounded-b-2xl overflow-hidden border-t-0">
                            <button onClick={(e) => aprovarDocumento(doc.id, e)} className="flex-1 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold text-[9px] uppercase transition-colors">Aprovar</button>
                            <button onClick={(e) => reprovarDocumento(doc.id, e)} className="flex-1 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-bold text-[9px] uppercase transition-colors border-l border-neutral-200">Reprovar</button>
                          </div>
                        )}
                        {(doc.status === 'aprovado' || doc.status === 'rejeitado') && (
                          <div className={`text-center py-2 text-[9px] font-bold uppercase rounded-b-2xl border-t-0 ring-1 ${doc.status === 'aprovado' ? 'bg-emerald-100/50 text-emerald-700 ring-emerald-200' : 'bg-red-100/50 text-red-700 ring-red-200'}`}>
                            {doc.status === 'rejeitado' ? 'REPROVADO' : doc.status}
                          </div>
                        )}
                      </div>
                    ))}
                    {(!documentos || documentos.length === 0) && (
                      <div className="col-span-full py-8 text-center border-2 border-dashed border-neutral-100 rounded-2xl">
                        <p className="text-xs font-bold text-neutral-300 uppercase tracking-widest">Nenhum documento anexado</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Seção 3: Histórico */}
                <div className="bg-white p-8 rounded-[2rem] ring-1 ring-black/5 shadow-sm space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                    <History className="h-4 w-4" /> Histórico de Ações & Auditoria
                  </h3>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {historico.length > 0 ? historico.map(h => (
                      <div key={h.id} className="flex gap-4 p-4 rounded-2xl bg-neutral-50 ring-1 ring-neutral-100 transition-all hover:bg-white hover:shadow-md">
                        <div className="h-2 w-2 rounded-full bg-indigo-500 mt-2 shrink-0 animate-pulse" />
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{h.tipo_acao.replace('_', ' ')}</p>
                            <p className="text-[9px] font-black text-neutral-300 uppercase">{formatDate(h.created_at)}</p>
                          </div>
                          <p className="text-sm font-bold text-neutral-700 leading-relaxed">{h.descricao}</p>
                          <p className="text-[10px] font-black text-indigo-500 uppercase mt-2">Agente: {h.usuario_tipo}</p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-center py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Nenhum registro no histórico</p>
                    )}
                  </div>
                </div>

                {/* Seção 4: Chat */}
                  <div className="bg-white p-8 rounded-[2rem] ring-1 ring-black/5 shadow-sm space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                      <Send className="h-4 w-4" /> Chat de Negociação com o Cliente
                    </h3>
                    <div className="space-y-4">
                      <div className="bg-neutral-50 rounded-2xl p-4 h-[300px] overflow-y-auto space-y-4 custom-scrollbar">
                        {comentarios.length > 0 ? comentarios.map(c => (
                          <div key={c.id} className={`flex ${c.autor_tipo === 'admin' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-4 rounded-2xl text-sm font-medium ${c.autor_tipo === 'admin' ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-200' : 'bg-white ring-1 ring-neutral-200 text-neutral-700 rounded-tl-none shadow-sm'}`}>
                              <p className="leading-relaxed">{c.mensagem}</p>
                              <p className={`text-[9px] mt-2 font-black uppercase tracking-widest ${c.autor_tipo === 'admin' ? 'text-indigo-200' : 'text-neutral-400'}`}>
                                {formatDate(c.created_at)} — {c.autor_tipo === 'admin' ? 'VOCÊ' : 'CLIENTE'}
                              </p>
                            </div>
                          </div>
                        )) : (
                          <div className="h-full flex flex-col items-center justify-center text-neutral-300 space-y-2">
                            <Send className="h-8 w-8 opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma mensagem trocada</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <input 
                          value={newMsg} 
                          onChange={e => setNewMsg(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && sendMsg()}
                          placeholder="Digite sua resposta para o cliente..." 
                          className="flex-1 bg-neutral-50 border border-neutral-100 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                        />
                        <button 
                          onClick={sendMsg}
                          disabled={!newMsg.trim()}
                          className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Send className="h-6 w-6" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              {/* Coluna Direita: Ações & Financeiro */}
              <div className="space-y-8">
                
                {/* Card Financeiro Resumo */}
                <div className="bg-white p-8 rounded-[2rem] ring-1 ring-black/5 shadow-sm space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                    <Calculator className="h-4 w-4" /> Resumo da Solicitação
                  </h3>
                  <div className="space-y-4">
                    <div className="p-6 bg-indigo-50 rounded-[1.5rem] ring-1 ring-indigo-100">
                      <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">Valor Original Solicitado</p>
                      <p className="text-3xl font-black text-indigo-700">{formatCurrency(selected.valor_solicitado)}</p>
                    </div>
                    <div className="p-6 bg-emerald-50 rounded-[1.5rem] ring-1 ring-emerald-100">
                      <p className="text-[10px] font-black text-emerald-400 uppercase mb-1">Parcelas Desejadas</p>
                      <p className="text-3xl font-black text-emerald-700">{selected.parcelas_escolhidas || '—'}x</p>
                    </div>
                  </div>
                </div>

                {/* Ações por Status */}
                <div className="bg-[#1a1a1a] p-8 rounded-[2rem] shadow-xl text-white space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" /> Ações Administrativas
                  </h3>

                  {selected.status === 'analise_inicial' && (
                    <div className="space-y-5 animate-in slide-in-from-top-4 duration-500">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Valor Aprovado (R$)</label>
                        <input 
                          value={maskCurrency(proposta.valorAprovado)} 
                          onChange={e => handleCurrencyInputChange(e.target.value, (val) => setProposta({ ...proposta, valorAprovado: val.toString() }))} 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold" 
                          placeholder="0,00" 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Juros (%)</label>
                          <input value={proposta.juros} onChange={e => setProposta({ ...proposta, juros: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold" placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Máx Parcelas</label>
                          <input value={proposta.maxParcelas} onChange={e => setProposta({ ...proposta, maxParcelas: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold" placeholder="12" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Taxa de Serviço (R$)</label>
                        <input 
                          value={maskCurrency(proposta.taxaServico)} 
                          onChange={e => handleCurrencyInputChange(e.target.value, (val) => setProposta({ ...proposta, taxaServico: val.toString() }))} 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold" 
                          placeholder="0,00" 
                        />
                      </div>
                      {proposta.juros && proposta.maxParcelas && (
                        <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-[11px] font-bold text-emerald-400">
                          Simulação: {proposta.maxParcelas}x de {formatCurrency(calcularParcela(parseFloat(proposta.valorAprovado) || 0, parseFloat(proposta.juros) || 0, parseInt(proposta.maxParcelas) || 1).valorParcela)}
                        </div>
                      )}
                      <textarea value={proposta.mensagem} onChange={e => setProposta({ ...proposta, mensagem: e.target.value })} placeholder="Mensagem para o cliente..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold resize-none" rows={3} />
                      <button onClick={enviarProposta} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98]">
                        Enviar Proposta Oficial
                      </button>
                    </div>
                  )}

                  {selected.status === 'analise_final' && (
                    <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-xs font-bold text-neutral-400 mb-3 uppercase tracking-widest">Upload de Contrato PDF</p>
                        <label className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
                          <Upload className="h-5 w-5 text-emerald-500" />
                          <span className="text-xs text-neutral-300 truncate">{contratoFile ? contratoFile.name : 'Selecionar Contrato...'}</span>
                          <input type="file" accept=".pdf" className="hidden" onChange={e => setContratoFile(e.target.files?.[0] || null)} />
                        </label>
                      </div>
                      <button onClick={enviarContrato} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-600/20">
                        Publicar Contrato
                      </button>
                    </div>
                  )}

                  {selected.status === 'analise_contrato' && (
                    <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                      {selected.assinatura_url && (
                        <div className="p-6 bg-white rounded-3xl ring-1 ring-black/5">
                          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">Assinatura Digital</p>
                          <img src={selected.assinatura_url} alt="Assinatura" className="w-full h-24 object-contain mb-2" />
                          <p className="text-[10px] text-neutral-400 text-center font-bold">Assinado eletronicamente em {formatDate(selected.data_assinatura!)}</p>
                        </div>
                      )}
                      <div className="space-y-3">
                        <button onClick={aprovar} className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-500/20">
                          Aprovar & Gerar Fatura Taxa
                        </button>
                        <button onClick={reprovarAssinatura} className="w-full py-4 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-600/20 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all">
                          Reprovar e Solicitar Nova Assinatura
                        </button>
                      </div>
                    </div>
                  )}

                  {selected.status === 'aprovado' && (
                    <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                      <div className="p-6 bg-amber-50 rounded-3xl ring-1 ring-amber-100 flex items-center gap-4">
                        <Clock className="h-6 w-6 text-amber-600" />
                        <div>
                          <p className="text-[10px] font-black text-amber-900 uppercase">Aguardando Pagamento da Taxa</p>
                          <p className="text-xs font-bold text-amber-700">O empréstimo já foi aprovado. Assim que a taxa for paga, ative-o abaixo.</p>
                        </div>
                      </div>
                      <button onClick={ativar} className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
                        Ativar Empréstimo Agora
                      </button>
                    </div>
                  )}

                  {['ativo', 'quitado', 'analise_quitacao', 'aguardando_pagamento_quitacao'].includes(selected.status) && (
                    <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                      <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" /> Acompanhamento de Pagamentos
                        </h4>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                          {parcelas.length === 0 ? (
                            <p className="text-xs text-neutral-400">Nenhuma parcela gerada.</p>
                          ) : parcelas.map((p) => (
                            <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border ${p.status === 'paga' ? 'bg-emerald-500/10 border-emerald-500/20' : p.status === 'vencida' ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/10'}`}>
                              <div className="flex items-center gap-3">
                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-black ${p.status === 'paga' ? 'bg-emerald-500/20 text-emerald-400' : p.status === 'vencida' ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-neutral-300'}`}>
                                  {p.numero_parcela}
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-white">{formatCurrency(p.valor)}</p>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Venc: {formatDate(p.data_vencimento)}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className={`text-[9px] font-black uppercase tracking-widest ${p.status === 'paga' ? 'text-emerald-400' : p.status === 'vencida' ? 'text-red-400' : 'text-amber-400'}`}>
                                  {p.status}
                                </span>
                                {p.data_pagamento && (
                                  <p className="text-[9px] text-neutral-500 mt-1">Pago em: {formatDate(p.data_pagamento)}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {selected.status === 'analise_quitacao' && (
                    <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                      <div className="p-6 bg-amber-500/10 rounded-3xl border border-amber-500/20">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">Solicitação de Quitação</p>
                        <p className="text-sm font-bold text-neutral-300">O cliente deseja quitar o empréstimo. Avalie e informe o valor final com desconto (se houver).</p>
                        <div className="mt-4">
                          <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-1">Valor Restante (Original)</p>
                          <p className="text-xl font-black text-white">{formatCurrency(parcelas.filter(p => p.status !== 'paga').reduce((sum, p) => sum + p.valor, 0))}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Valor da Oferta de Quitação (R$)</label>
                        <input 
                          value={maskCurrency(valorQuitacao)} 
                          onChange={e => handleCurrencyInputChange(e.target.value, (val) => setValorQuitacao(val.toString()))} 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold" 
                          placeholder="0,00" 
                        />
                      </div>
                      <button onClick={enviarOfertaQuitacao} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                        Enviar Oferta de Quitação
                      </button>
                    </div>
                  )}

                  {selected.status === 'aguardando_pagamento_quitacao' && (
                    <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                      <div className="p-6 bg-indigo-500/10 rounded-3xl border border-indigo-500/20">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Aguardando Pagamento</p>
                        <p className="text-sm font-bold text-neutral-300">Oferta enviada ao cliente para quitação total:</p>
                        <p className="text-3xl font-black text-white mt-2">{formatCurrency(selected.valor_quitacao_acordo || 0)}</p>
                      </div>
                    </div>
                  )}

                  {/* Ações Globais: Pendência e Observações */}
                  <div className="pt-6 border-t border-white/5 space-y-4">
                    <div className="space-y-3">
                      <input value={motivoPendencia} onChange={e => setMotivoPendencia(e.target.value)} placeholder="Descreva a pendência..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-amber-500 outline-none transition-all font-bold" />
                      <button onClick={solicitarPendencia} className="w-full py-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-500 border border-amber-600/30 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
                        Solicitar Correção/Doc
                      </button>
                    </div>

                    <div className="space-y-3 pt-4">
                      <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Observações Administrativas</p>
                      <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-white/20 outline-none transition-all font-bold resize-none" />
                      <button onClick={saveObs} className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                        Salvar Nota
                      </button>
                    </div>
                  </div>

                  {selected.status !== 'cancelado' && (
                    <button onClick={cancelar} className="w-full py-4 text-red-500/60 hover:text-red-500 font-black text-[10px] uppercase tracking-widest transition-all">
                      Reprovar Empréstimo
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {isCancelModalOpen && selected && (
        <Modal
          isOpen={true}
          title="Confirmar Não Aprovação"
          onClose={() => setIsCancelModalOpen(false)}
        >
          <div className="space-y-6">
            <div className="p-4 bg-red-50 rounded-2xl ring-1 ring-red-100 flex items-start gap-4">
              <span className="text-2xl mt-1">⚠️</span>
              <div>
                <h4 className="font-bold text-red-900 mb-1">Deseja mesmo cancelar/reprovar esta solicitação?</h4>
                <p className="text-sm text-red-700">Esta ação não pode ser desfeita. O cliente será notificado que o empréstimo não foi aprovado, mas que poderá solicitar novamente daqui a 30 dias.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setIsCancelModalOpen(false)} 
                className="flex-1 rounded-xl border border-neutral-200 py-3 font-bold text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                Voltar
              </button>
              <button 
                onClick={confirmarCancelamento} 
                className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white shadow-lg shadow-red-600/20 hover:bg-red-700 transition-colors"
              >
                Confirmar Não Aprovação
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
