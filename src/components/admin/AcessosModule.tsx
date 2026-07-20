import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Shield, Key, Users, Settings, Trash2, CheckCircle, XCircle, UserPlus, Eye, Copy, Activity, User, History, Clock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { formatCurrency, formatDateTime, maskPhone, generateCode, generateSecureNumericCode, copyToClipboard } from '../../lib/utils';
import { useAdminNotifications } from '../../hooks/useAdminNotifications';
import { logService } from '../../lib/logService';
import { canDeleteRecord } from '../../lib/deleteRequest';
import { sessionService } from '../../lib/sessionService';
import { whatsappNotificationService } from '../../lib/whatsappNotificationService';
import { AdminWhatsAppButton } from './ui/AdminWhatsAppButton';
import { callAdminRpc } from '../../lib/adminRpc';

interface Funcao {
  id: string;
  nome: string;
  descricao?: string;
}

interface Colaborador {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  status: 'ativo' | 'suspenso';
  credencial_acesso: string;
  funcao_id?: string;
  funcoes?: Funcao;
  colaborador_modulos?: { modulo_id: string }[];
}

interface SolicitacaoExclusao {
  id: string;
  created_at: string;
  colaborador_id: string;
  tabela: string;
  registro_id: string;
  motivo: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  colaboradores?: { nome: string };
}


interface AcessosModuleProps {
  adminType?: string;
  colaboradorId?: string;
  colaboradorNome?: string;
}

export function AcessosModule({ adminType, colaboradorId, colaboradorNome }: AcessosModuleProps) {
  const { pendencies } = useAdminNotifications();
  const [activeTab, setActiveTab] = useState<'colaboradores' | 'funcoes' | 'solicitacoes' | 'logs'>('colaboradores');
  
  const tabs = [
    { id: 'colaboradores', label: 'Colaboradores', icon: Users },
    { id: 'funcoes', label: 'Funções & Cargos', icon: Settings },
    { id: 'solicitacoes', label: 'Exclusões', icon: Trash2 },
    { id: 'logs', label: 'Logs de Acesso', icon: History }
  ];
  
  // States for data
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoExclusao[]>([]);
  const [sessoes, setSessoes] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filtroDataLogs, setFiltroDataLogs] = useState<string>(new Date().toISOString().split('T')[0]);

  // States for Manual Clean
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearPeriod, setClearPeriod] = useState<string>('hoje');
  const [clearCustomStart, setClearCustomStart] = useState('');
  const [clearCustomEnd, setClearCustomEnd] = useState('');
  const [clearing, setClearing] = useState(false);

  // States for Modal Funções
  const [isFuncaoModalOpen, setIsFuncaoModalOpen] = useState(false);
  const [funcaoForm, setFuncaoForm] = useState({ id: '', nome: '', descricao: '' });

  // States for Modal Colaboradores
  const [isColaboradorModalOpen, setIsColaboradorModalOpen] = useState(false);
  const [colaboradorStep, setColaboradorStep] = useState<1 | 2>(1);
  const [colaboradorForm, setColaboradorForm] = useState({
    id: '', nome: '', email: '', telefone: '', funcao_id: '', credencial_acesso: ''
  });
  const [selectedModulos, setSelectedModulos] = useState<string[]>([]);
  
  // Available modules for assignment
  const modulosDisponiveis = [
    { id: 'dashboard', label: 'Dashboard Resumo' },
    { id: 'cadastro', label: 'Cadastro (App+CRM)' },
    { id: 'vendas', label: 'Vendas' },
    { id: 'prestadores', label: 'Prestadores' },
    { id: 'demandas', label: 'Gestão Interna' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'cobranca', label: 'Cobrança' },
    { id: 'fiscal', label: 'Fiscal' },
    { id: 'tickets', label: 'Tickets' },
    { id: 'area_vip', label: 'Gestão VIP' },
    { id: 'relatorios', label: 'Relatórios' },
    { id: 'configuracoes', label: 'Configurações' },
    { id: 'acessos', label: 'Gerenciar Acessos' },
    { id: 'sistema', label: 'Saúde do Sistema' }
  ];

  useEffect(() => {
    fetchData();
    
    const subColab = supabase.channel('admin-colab').on('postgres_changes', { event: '*', schema: 'public', table: 'colaboradores' }, fetchData).subscribe();
    const subFunc = supabase.channel('admin-func').on('postgres_changes', { event: '*', schema: 'public', table: 'funcoes' }, fetchData).subscribe();
    const subSol = supabase.channel('admin-sol').on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_exclusao' }, fetchData).subscribe();
    const subSessoes = supabase.channel('admin-sess').on('postgres_changes', { event: '*', schema: 'public', table: 'sistema_sessoes' }, fetchData).subscribe();

    return () => {
      supabase.removeChannel(subColab);
      supabase.removeChannel(subFunc);
      supabase.removeChannel(subSol);
      supabase.removeChannel(subSessoes);
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [fRes, cRes, sRes, lRes] = await Promise.all([
        supabase.from('funcoes').select('*').order('nome'),
        supabase.from('colaboradores').select('*, funcoes(nome), colaborador_modulos(modulo_id)').order('created_at', { ascending: false }),
        supabase.from('solicitacoes_exclusao').select('*, colaboradores(nome)').order('created_at', { ascending: false }),
        supabase.from('sistema_sessoes').select('*, sistema_logs(*)').order('criado_em', { ascending: false }).limit(2000)
      ]);

      if (fRes.error && fRes.error.code !== '42P01') console.error(fRes.error);
      if (cRes.error && cRes.error.code !== '42P01') console.error(cRes.error);
      if (sRes.error && sRes.error.code !== '42P01') console.error(sRes.error);
      if (lRes.error && lRes.error.code !== '42P01') console.error(lRes.error);

      setFuncoes(fRes.data || []);
      setColaboradores(cRes.data || []);
      setSolicitacoes(sRes.data || []);
      setSessoes(lRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- FUNÇÕES handlers ---
  const handleSaveFuncao = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (funcaoForm.id) {
        await supabase.from('funcoes').update({ nome: funcaoForm.nome, descricao: funcaoForm.descricao }).eq('id', funcaoForm.id);
        await logService.logAction({
          ator_tipo: adminType as any,
          ator_id: colaboradorId,
          ator_nome: colaboradorNome,
          acao: 'EDITAR_FUNCAO',
          detalhes: `Editou a função: ${funcaoForm.nome}`
        });
        toast.success('Função atualizada.');
      } else {
        await supabase.from('funcoes').insert([{ nome: funcaoForm.nome, descricao: funcaoForm.descricao }]);
        await logService.logAction({
          ator_tipo: adminType as any,
          ator_id: colaboradorId,
          ator_nome: colaboradorNome,
          acao: 'CRIAR_FUNCAO',
          detalhes: `Criou a função: ${funcaoForm.nome}`
        });
        toast.success('Função criada.');
      }
      setIsFuncaoModalOpen(false);
      setFuncaoForm({ id: '', nome: '', descricao: '' });
      fetchData();
    } catch (e) {
      toast.error('Erro ao salvar função');
    }
  };

  const handleEditFuncao = (f: any) => {
    setFuncaoForm({ id: f.id, nome: f.nome, descricao: f.descricao || '' });
    setIsFuncaoModalOpen(true);
  };

  const handleDeleteFuncao = async (id: string, nome: string) => {
    const canProceed = await canDeleteRecord('funcoes', id);
    if (!canProceed) return;

    if (!confirm(`Excluir a função "${nome}"?`)) return;
    try {
      const success = await callAdminRpc<boolean>('gsa_admin_delete_record_secure', {
        p_table: 'funcoes',
        p_id: id
      });

      if (!success) throw new Error('Acesso negado');
      await logService.logAction({
        ator_tipo: adminType as any,
        ator_id: colaboradorId,
        ator_nome: colaboradorNome,
        acao: 'EXCLUIR_FUNCAO',
        detalhes: `Excluiu a função: ${nome}`
      });
      toast.success('Excluído');
      fetchData();
    } catch (e) {
      toast.error('Erro ao excluir');
    }
  };

  // --- COLABORADORES handlers ---
  const handleOpenNewColaborador = () => {
    setColaboradorStep(1);
    const newCode = generateSecureNumericCode(8);
    setColaboradorForm({ id: '', nome: '', email: '', telefone: '', funcao_id: '', credencial_acesso: newCode });
    setSelectedModulos([]);
    setIsColaboradorModalOpen(true);
  };

  const handleEditColaborador = (c: any) => {
    setColaboradorStep(1);
    setColaboradorForm({
      id: c.id,
      nome: c.nome,
      email: c.email || '',
      telefone: c.telefone || '',
      funcao_id: c.funcao_id || '',
      credencial_acesso: c.credencial_acesso
    });
    setSelectedModulos(c.colaborador_modulos?.map((m: any) => m.modulo_id) || []);
    setIsColaboradorModalOpen(true);
  };

  const handeToggleModulo = (modId: string) => {
    if (selectedModulos.includes(modId)) {
      setSelectedModulos(selectedModulos.filter(m => m !== modId));
    } else {
      setSelectedModulos([...selectedModulos, modId]);
    }
  };

  const handleSaveColaborador = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let colabId = colaboradorForm.id;
      
      const payload = {
        nome: colaboradorForm.nome,
        email: colaboradorForm.email,
        telefone: colaboradorForm.telefone,
        funcao_id: colaboradorForm.funcao_id || null,
        credencial_acesso: colaboradorForm.credencial_acesso
      };

      if (colaboradorForm.id) {
        // Update user
        const { error: updErr } = await supabase.from('colaboradores').update(payload).eq('id', colabId);
        if (updErr) throw updErr;
        await logService.logAction({
          ator_tipo: adminType as any,
          ator_id: colaboradorId,
          ator_nome: colaboradorNome,
          acao: 'EDITAR_COLABORADOR',
          detalhes: `Editou os dados do colaborador: ${colaboradorForm.nome}`
        });
      } else {
        // Insert user
        const { data: insData, error: insErr } = await supabase.from('colaboradores').insert([payload]).select().single();
        if (insErr) throw insErr;
        colabId = insData.id;
        await logService.logAction({
          ator_tipo: adminType as any,
          ator_id: colaboradorId,
          ator_nome: colaboradorNome,
          acao: 'CRIAR_COLABORADOR',
          detalhes: `Cadastrou o novo colaborador: ${colaboradorForm.nome}`
        });
      }

      // Atualização atômica das permissões, com revogação das sessões antigas.
      await callAdminRpc('gsa_admin_replace_collaborator_modules', {
        p_colaborador_id: colabId,
        p_modulos: selectedModulos,
      });
      await logService.logAction({
        ator_tipo: adminType as any,
        ator_id: colaboradorId,
        ator_nome: colaboradorNome,
        acao: 'ATUALIZAR_PERMISSOES',
        detalhes: `Atualizou as permissões de acesso do colaborador ID: ${colabId}`
      });

      toast.success('Colaborador salvo com sucesso!');
      setIsColaboradorModalOpen(false);
      fetchData();
    } catch (err: any) {
      if (err.code === '23505') toast.error('E-mail ou Código já utilizado.');
      else toast.error('Erro ao salvar colaborador.');
    }
  };

  const handleToggleStatusColaborador = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'ativo' ? 'suspenso' : 'ativo';
      await supabase.from('colaboradores').update({ status: newStatus }).eq('id', id);
      await logService.logAction({
        ator_tipo: adminType as any,
        ator_id: colaboradorId,
        ator_nome: colaboradorNome,
        acao: 'ALTERAR_STATUS_COLAB',
        detalhes: `${newStatus === 'ativo' ? 'Reativou' : 'Suspendeu'} o acesso do colaborador ID: ${id}`
      });
      toast.success(`Colaborador ${newStatus === 'ativo' ? 'reativado' : 'suspenso'}.`);
      fetchData();
    } catch (e) {
      toast.error('Erro ao mudar status.');
    }
  };

  // --- SOLICITAÇÕES handlers ---
  const handleDeleteColaborador = async (id: string) => {
    const canProceed = await canDeleteRecord('colaboradores', id);
    if (!canProceed) return;

    if (!confirm('Excluir colaborador? Esta ação é irreversível.')) return;
    try {
      const success = await callAdminRpc<boolean>('gsa_admin_delete_record_secure', {
        p_table: 'colaboradores',
        p_id: id
      });

      if (!success) throw new Error('Acesso negado');
      await logService.logAction({
        ator_tipo: adminType as any,
        ator_id: colaboradorId,
        ator_nome: colaboradorNome,
        acao: 'EXCLUIR_COLABORADOR',
        detalhes: `Removeu permanentemente o colaborador ID: ${id}`
      });
      toast.success('Colaborador excluído.');
      setIsColaboradorModalOpen(false);
      fetchData();
    } catch (e) {
      toast.error('Erro ao excluir colaborador.');
    }
  };

  const handleAprovarSolicitacao = async (sol: any) => {
    if (!confirm('Você tem certeza que deseja aprovar e EXCLUIR definitivamente este registro?')) return;
    try {
      // 1. Execute the actual deletion based on table and ID
      const { error: delErr } = await supabase.from(sol.tabela).delete().eq('id', sol.registro_id);
      if (delErr) {
        toast.error(`Falha ao excluir na tabela ${sol.tabela} - registro pode estar vinculado a outros dados.`);
        // Note: we can still mark request as processed with error? Better just throw.
        throw delErr; 
      }

      // 2. Mark request as approved
      await supabase.from('solicitacoes_exclusao').update({ status: 'aprovado', data_decisao: new Date().toISOString() }).eq('id', sol.id);
      
      await logService.logAction({
        ator_tipo: adminType as any,
        ator_id: colaboradorId,
        ator_nome: colaboradorNome,
        acao: 'APROVAR_EXCLUSAO',
        detalhes: `Aprovou a exclusão do registro ${sol.registro_id} na tabela ${sol.tabela}`
      });

      toast.success('Exclusão efetivada globalmente.');
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao aprovar solicitação.');
    }
  };

  const handleRecusarSolicitacao = async (id: string) => {
    if (!confirm('Recusar a exclusão deste item?')) return;
    try {
      await supabase.from('solicitacoes_exclusao').update({ status: 'recusado', data_decisao: new Date().toISOString() }).eq('id', id);
      
      await logService.logAction({
        ator_tipo: adminType as any,
        ator_id: colaboradorId,
        ator_nome: colaboradorNome,
        acao: 'RECUSAR_EXCLUSAO',
        detalhes: `Recusou a solicitação de exclusão ID: ${id}`
      });

      toast.success('Solicitação recusada.');
      fetchData();
    } catch (e) {
       toast.error('Erro ao recusar solicitação.');
    }
  };

  const handleLimpezaManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm('Atenção: A exclusão limpará os dados de acessos e logs de forma irreversível! Pressione OK para deletar.')) return;
    setClearing(true);
    try {
      const today = new Date();
      let startDate: string | null = null;
      let endDate: string | null = null;

      if (clearPeriod === 'hoje') {
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      } else if (clearPeriod === '7_dias') {
        const d = new Date(today); d.setDate(d.getDate() - 7);
        startDate = d.toISOString();
      } else if (clearPeriod === '15_dias') {
        const d = new Date(today); d.setDate(d.getDate() - 15);
        startDate = d.toISOString();
      } else if (clearPeriod === '30_dias') {
        const d = new Date(today); d.setDate(d.getDate() - 30);
        startDate = d.toISOString();
      } else if (clearPeriod === 'personalizado') {
        if (clearCustomStart) startDate = new Date(clearCustomStart + 'T00:00:00').toISOString();
        if (clearCustomEnd) endDate = new Date(clearCustomEnd + 'T23:59:59').toISOString();
      }

      if (!startDate) {
        toast.error('Informe um período válido para limpeza.');
        return;
      }

      const session = sessionService.getCurrentSession();
      if (!session?.sessaoId || !session?.sessionToken) {
        toast.error('Sessão administrativa inválida.');
        return;
      }

      const { error } = await supabase.rpc('gsa_admin_clear_access_history', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_period: clearPeriod,
        p_start: startDate,
        p_end: endDate
      });

      if (error) throw error;
      
      toast.success('Limpeza de Logs concluída!');
      setIsClearModalOpen(false);
      fetchData();
    } catch (e) {
      toast.error('Erro ao efetuar limpeza.');
    } finally {
      setClearing(false);
    }
  };

  if (loading && funcoes.length === 0 && colaboradores.length === 0) {
    return <div className="p-12 text-center text-neutral-500">Verifique se as tabelas foram criadas com o script...</div>;
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      {/* Module Header */}
      <div className="bg-[#1a1a1a] p-3 md:p-4 rounded-[2rem] md:rounded-[2.5rem] text-white relative shadow-2xl mb-3">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-red-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col gap-3 md:gap-3">
          <div className="flex flex-row items-center justify-between gap-6 border-b border-white/5 pb-3">
            <div className="flex items-center gap-4">
              <div className="h-6 w-1 bg-red-500 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.6)]"></div>
              <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-black tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-neutral-100 to-neutral-400 whitespace-nowrap overflow-hidden">
                Gestão de Acessos
              </h1>
            </div>
            <Shield className="hidden md:block h-8 w-8 text-white/5" />
          </div>

          <div className="relative flex flex-col items-center md:items-start gap-3">
          <div className="flex flex-wrap justify-center md:justify-start gap-1.5 w-full">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const count = tab.id === 'colaboradores' ? colaboradores.length :
                            tab.id === 'funcoes' ? funcoes.length :
                            tab.id === 'solicitacoes' ? pendencies.acessos_exclusoes_pendentes :
                            sessoes.filter(s => s.status === 'ativo').length;

              return (
                <div key={tab.id} className="relative flex-none font-black translate-y-0 active:translate-y-1 transition-transform">
                  <button
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 md:px-4 rounded-xl transition-all text-[9px] sm:text-[10px] md:text-[11px] uppercase tracking-widest border
                      ${isActive 
                        ? 'bg-white text-red-600 shadow-[0_10px_20px_rgba(0,0,0,0.3)] border-white border-b-4 border-b-red-500' 
                        : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border-white/5'}`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    {count > 0 && (
                      <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-[8px] font-black text-white ring-2 ring-white/10 animate-pulse">
                        {count}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      </div>

      <main>
        {activeTab === 'colaboradores' && (
          <div className="space-y-4">
             <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                <div>
                  <h3 className="font-bold text-neutral-800">Equipe</h3>
                  <p className="text-sm text-neutral-500">Gerencie quem tem acesso ao painel.</p>
                </div>
                <button onClick={handleOpenNewColaborador} className="btn-primary flex items-center gap-2">
                  <UserPlus className="w-4 h-4"/> Novo Colaborador
                </button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {colaboradores.length === 0 ? (
                  <div className="col-span-full p-12 text-center text-neutral-500 bg-white border border-neutral-200 rounded-xl">Nenhum colaborador registrado.</div>
                ) : colaboradores.map(c => (
                  <div key={c.id} className="bg-white rounded-xl border border-neutral-200 shadow-sm p-5 relative flex flex-col">
                    <div className="absolute top-4 right-4">
                       <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full tracking-wider ${c.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                         {c.status}
                       </span>
                    </div>
                    
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4 text-xl font-bold">
                       {c.nome.charAt(0).toUpperCase()}
                    </div>
                    
                    <h4 className="font-bold text-lg text-neutral-900 leading-tight">{c.nome}</h4>
                    <p className="text-sm text-indigo-600 font-medium mb-3">{c.funcoes?.nome || 'Sem Cargo Definido'}</p>
                    
                    <div className="space-y-1.5 text-xs text-neutral-600 font-medium border-t border-neutral-100 pt-3 mb-4 flex-1">
                      <div className="flex justify-between items-center gap-2">
                         <span>Matrícula/Código:</span> 
                         <div className="flex items-center gap-2">
                           <span className="text-neutral-900 font-bold font-mono">{c.credencial_acesso}</span>
                           <button 
                              onClick={() => {
                                const code = c.credencial_acesso;
                                if (navigator.clipboard && window.isSecureContext) {
                                  navigator.clipboard.writeText(code).then(() => {
                                    toast.success('Código copiado!');
                                  }).catch(() => {
                                    const textArea = document.createElement("textarea");
                                    textArea.value = code;
                                    textArea.style.position = "fixed";
                                    textArea.style.left = "-9999px";
                                    textArea.style.top = "0";
                                    document.body.appendChild(textArea);
                                    textArea.focus();
                                    textArea.select();
                                    try {
                                      document.execCommand('copy');
                                      toast.success('Código copiado!');
                                    } catch (err) {
                                      toast.error('Erro ao copiar.');
                                    }
                                    document.body.removeChild(textArea);
                                  });
                                } else {
                                  const textArea = document.createElement("textarea");
                                  textArea.value = code;
                                  textArea.style.position = "fixed";
                                  textArea.style.left = "-9999px";
                                  textArea.style.top = "0";
                                  document.body.appendChild(textArea);
                                  textArea.focus();
                                  textArea.select();
                                  try {
                                    document.execCommand('copy');
                                    toast.success('Código copiado!');
                                  } catch (err) {
                                    toast.error('Erro ao copiar.');
                                  }
                                  document.body.removeChild(textArea);
                                }
                              }}
                              className="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="Copiar Credencial"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                         </div>
                      </div>
                      <div className="flex justify-between"><span>Acessos liberados:</span> <span className="text-neutral-900 font-bold">{c.colaborador_modulos?.length || 0} módulos</span></div>
                    </div>
                    
                    <div className="flex gap-2 pt-3 border-t border-neutral-100">
                      <button onClick={() => handleEditColaborador(c)} className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm font-medium transition-colors">
                        Editar Perfil
                      </button>
                      <button onClick={() => handleToggleStatusColaborador(c.id, c.status)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${c.status === 'ativo' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                        {c.status === 'ativo' ? 'Suspender' : 'Reativar'}
                      </button>
                      {c.telefone && (
                        <div className="flex items-center justify-center scale-90 origin-left">
                          <AdminWhatsAppButton
                            telefone={c.telefone}
                            mensagem={whatsappNotificationService.gerarMensagemWhatsApp({
                              tipo: 'acesso',
                              clienteNome: c.nome,
                              codigo: c.credencial_acesso,
                              status: c.status
                            })}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'funcoes' && (
          <div className="space-y-4">
             <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                <div>
                  <h3 className="font-bold text-neutral-800">Cargos/Funções</h3>
                  <p className="text-sm text-neutral-500">Crie os rótulos de cargos para facilitar a identificação da equipe.</p>
                </div>
                <button onClick={() => { setFuncaoForm({id:'',nome:'',descricao:''}); setIsFuncaoModalOpen(true); }} className="btn-primary flex items-center gap-2 bg-[#1a1a1a]">
                   Nova Função
                </button>
             </div>

             <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
               {/* Visão Mobile */}
               <div className="md:hidden divide-y divide-neutral-100">
                 {funcoes.length === 0 ? (
                   <div className="p-6 text-center text-neutral-500 text-sm">Nenhum cargo cadastrado.</div>
                 ) : funcoes.map(f => (
                   <div key={f.id} className="p-4 space-y-3">
                     <div className="flex justify-between items-start">
                       <div>
                         <span className="block text-xs font-bold text-neutral-400 uppercase mb-1">Nome da Função</span>
                         <span className="font-medium text-neutral-900">{f.nome}</span>
                       </div>
                       <div className="flex gap-2">
                         <button onClick={() => handleEditFuncao(f)} className="p-2 text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100"><Settings className="w-4 h-4"/></button>
                         <button onClick={() => handleDeleteFuncao(f.id, f.nome)} className="p-2 text-red-600 bg-red-50 rounded hover:bg-red-100"><Trash2 className="w-4 h-4"/></button>
                       </div>
                     </div>
                     <div>
                       <span className="block text-xs font-bold text-neutral-400 uppercase mb-1">Descrição</span>
                       <span className="text-neutral-500 text-sm">{f.descricao || '-'}</span>
                     </div>
                   </div>
                 ))}
               </div>

               {/* Visão Desktop */}
               <table className="hidden md:table w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-neutral-500 font-medium">
                    <tr>
                      <th className="px-6 py-3">Nome da Função</th>
                      <th className="px-6 py-3">Descrição Opcional</th>
                      <th className="px-6 py-3 w-32 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {funcoes.length === 0 ? (
                      <tr><td colSpan={3} className="px-6 py-8 text-center text-neutral-500">Nenhum cargo cadastrado.</td></tr>
                    ) : funcoes.map(f => (
                      <tr key={f.id} className="hover:bg-neutral-50">
                        <td className="px-6 py-4 font-medium text-neutral-900">{f.nome}</td>
                        <td className="px-6 py-4 text-neutral-500">{f.descricao || '-'}</td>
                        <td className="px-6 py-4 flex justify-end gap-2">
                           <button onClick={() => handleEditFuncao(f)} className="p-2 text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100"><Settings className="w-4 h-4"/></button>
                           <button onClick={() => handleDeleteFuncao(f.id, f.nome)} className="p-2 text-red-600 bg-red-50 rounded hover:bg-red-100"><Trash2 className="w-4 h-4"/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
             </div>
          </div>
        )}

        {activeTab === 'solicitacoes' && (
          <div className="space-y-4">
             <div className="flex justify-between items-center bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm">
                <div>
                  <h3 className="font-bold text-red-900">Central de Aprovação de Exclusões</h3>
                  <p className="text-sm text-red-700">Como segurança extra, exclusões de colaboradores caem aqui para você validar.</p>
                </div>
             </div>

             <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
               {/* Visão Mobile */}
               <div className="md:hidden divide-y divide-neutral-100">
                 {solicitacoes.length === 0 ? (
                   <div className="p-6 text-center text-neutral-500 text-sm">Nenhuma solicitação no sistema.</div>
                 ) : solicitacoes.map(s => (
                   <div key={s.id} className="p-4 space-y-3">
                     <div className="flex justify-between items-start">
                       <div>
                         <span className="block text-xs font-bold text-neutral-400 uppercase mb-1">Colaborador</span>
                         <span className="font-medium text-neutral-900">{s.colaboradores?.nome}</span>
                       </div>
                       <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                         s.status === 'pendente' ? 'bg-amber-100 text-amber-700' :
                         s.status === 'aprovado' ? 'bg-emerald-100 text-emerald-700' :
                         'bg-red-100 text-red-700'
                       }`}>
                         {s.status}
                       </span>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <span className="block text-xs font-bold text-neutral-400 uppercase mb-1">Data</span>
                         <span className="text-neutral-600 text-xs">{new Date(s.created_at).toLocaleString()}</span>
                       </div>
                       <div>
                         <span className="block text-xs font-bold text-neutral-400 uppercase mb-1">Módulo Afetado</span>
                         <span className="text-neutral-500 uppercase text-xs font-bold tracking-wider">{s.tabela}</span>
                       </div>
                     </div>
                     <div>
                       <span className="block text-xs font-bold text-neutral-400 uppercase mb-1">Justificativa</span>
                       <span className="text-neutral-600 italic text-sm">"{s.motivo}"</span>
                     </div>
                     <div className="pt-3 border-t border-neutral-100 flex justify-between items-center mt-2">
                       <span className="text-xs font-bold text-neutral-400 uppercase">Decisão</span>
                       <div className="flex gap-2">
                         {s.status === 'pendente' ? (
                           <>
                             <button onClick={() => handleAprovarSolicitacao(s)} className="px-3 py-1.5 text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100 text-xs font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3"/> APROVAR</button>
                             <button onClick={() => handleRecusarSolicitacao(s.id)} className="px-3 py-1.5 text-red-600 bg-red-50 rounded hover:bg-red-100 text-xs font-bold flex items-center gap-1"><XCircle className="w-3 h-3"/> RECUSAR</button>
                           </>
                         ) : (
                           <span className="text-xs text-neutral-400 font-medium px-2 py-1">Concluído</span>
                         )}
                       </div>
                     </div>
                   </div>
                 ))}
               </div>

               {/* Visão Desktop */}
               <table className="hidden md:table w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-neutral-500 font-medium">
                    <tr>
                      <th className="px-6 py-3">Data</th>
                      <th className="px-6 py-3">Colaborador</th>
                      <th className="px-6 py-3">Módulo afetado</th>
                      <th className="px-6 py-3">Justificativa</th>
                      <th className="px-6 py-3 w-40 text-center">Status</th>
                      <th className="px-6 py-3 w-32 text-right">Decisão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {solicitacoes.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-neutral-500">Nenhuma solicitação no sistema.</td></tr>
                    ) : solicitacoes.map(s => (
                      <tr key={s.id} className="hover:bg-neutral-50">
                        <td className="px-6 py-4 text-neutral-600">{new Date(s.created_at).toLocaleString()}</td>
                        <td className="px-6 py-4 font-medium text-neutral-900">{s.colaboradores?.nome}</td>
                        <td className="px-6 py-4 text-neutral-500 uppercase text-xs font-bold tracking-wider">{s.tabela}</td>
                        <td className="px-6 py-4 text-neutral-600 italic">"{s.motivo}"</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                            s.status === 'pendente' ? 'bg-amber-100 text-amber-700' :
                            s.status === 'aprovado' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 flex justify-end gap-2">
                           {s.status === 'pendente' ? (
                             <>
                               <button onClick={() => handleAprovarSolicitacao(s)} title="Efetivar Exclusão do Banco" className="p-2 text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100"><CheckCircle className="w-4 h-4"/></button>
                               <button onClick={() => handleRecusarSolicitacao(s.id)} title="Recusar e manter o registro" className="p-2 text-red-600 bg-red-50 rounded hover:bg-red-100"><XCircle className="w-4 h-4"/></button>
                             </>
                           ) : (
                             <span className="text-xs text-neutral-400 font-medium px-2 py-1">Concluído</span>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
             </div>
          </div>
        )}

        {activeTab === 'logs' && (() => {
          const sessoesFiltradas = sessoes.filter(sessao => {
            if (!filtroDataLogs) return true;
            return sessao.criado_em.startsWith(filtroDataLogs);
          });

          return (
          <div className="space-y-4">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                <div>
                  <h3 className="font-bold text-neutral-800 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-indigo-600" />
                    Gerenciamento de Sessões
                  </h3>
                  <p className="text-sm text-neutral-500">Monitore as sessões ativas e o histórico de auditoria agrupado.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 px-3 py-1.5 rounded-lg shadow-sm">
                    <History className="h-4 w-4 text-neutral-500" />
                    <input 
                      type="date" 
                      value={filtroDataLogs} 
                      onChange={e => setFiltroDataLogs(e.target.value)}
                      className="bg-transparent border-none text-sm font-bold text-neutral-800 outline-none w-auto cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm" title="Os dados são excluídos automaticamente no dia 1 de cada mês às 00:00.">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-700 hidden sm:inline">Limpeza Automática: Dia 1</span>
                    <span className="text-xs font-bold text-emerald-700 sm:hidden">Auto: Dia 1</span>
                  </div>

                  <button 
                    onClick={() => setIsClearModalOpen(true)}
                    className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg border border-red-100 shadow-sm transition-colors text-xs font-bold"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Limpeza Manual</span>
                  </button>
                </div>
             </div>

             <div className="space-y-3">
                {sessoesFiltradas.length === 0 ? (
                  <div className="bg-white p-8 text-center text-neutral-500 border border-neutral-200 rounded-xl shadow-sm">
                    Nenhuma sessão registrada {filtroDataLogs ? 'nesta data' : 'recentemente'}.
                  </div>
                ) : (
                  sessoesFiltradas.map(sessao => (
                    <div key={sessao.id} className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md">
                       <div 
                         className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                         onClick={() => { setSelectedSession(sessao); setIsSessionModalOpen(true); }}
                       >
                         <div className="flex items-center gap-4">
                           <div className="p-3 rounded-full bg-neutral-100 hidden sm:flex">
                             <History className="h-5 w-5 text-neutral-600" />
                           </div>
                           <div>
                             <div className="flex items-center gap-2 mb-1">
                               <h4 className="font-bold text-neutral-900">{sessao.ator_nome || 'Usuário'}</h4>
                               <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                 sessao.ator_tipo === 'admin' ? 'bg-indigo-100 text-indigo-700' :
                                 sessao.ator_tipo === 'colaborador' ? 'bg-amber-100 text-amber-700' :
                                 'bg-neutral-100 text-neutral-700'
                               }`}>
                                 {sessao.ator_tipo}
                               </span>
                               {sessao.status === 'ativo' ? (
                                 <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
                                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                   Online
                                 </span>
                               ) : (
                                 <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-600 border border-neutral-200">
                                   <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full"></div>
                                   {sessao.status === 'expirado_inatividade' ? 'Expirou' : 'Offline'}
                                 </span>
                               )}
                             </div>
                             <div className="text-xs text-neutral-500 flex flex-col sm:flex-row sm:gap-4 gap-1">
                               <span><strong>Início:</strong> {new Date(sessao.criado_em).toLocaleString('pt-BR')}</span>
                               {sessao.encerrado_em && <span><strong>Fim:</strong> {new Date(sessao.encerrado_em).toLocaleString('pt-BR')}</span>}
                               <span><strong>Ações Registradas:</strong> {sessao.sistema_logs?.filter((l: any) => l.acao !== 'LOGIN' && l.acao !== 'LOGOUT').length || 0}</span>
                             </div>
                           </div>
                         </div>
                         <button className="px-4 py-2 rounded-xl bg-neutral-50 text-neutral-600 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-900 hover:text-white transition-all">
                           Detalhes
                         </button>
                       </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })()}
        </main>

      {/* MODAL FUNÇÃO */}
      <Modal isOpen={isFuncaoModalOpen} onClose={() => setIsFuncaoModalOpen(false)} title={funcaoForm.id ? "Editar Função" : "Nova Função"} size="md">
        <form onSubmit={handleSaveFuncao} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome do Cargo</label>
            <input required type="text" value={funcaoForm.nome} onChange={e=>setFuncaoForm({...funcaoForm, nome: e.target.value})} className="input-field" placeholder="Ex: Analista de Cadastro..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descrição</label>
            <textarea value={funcaoForm.descricao} onChange={e=>setFuncaoForm({...funcaoForm, descricao: e.target.value})} className="input-field" rows={2} placeholder="Opcional..." />
          </div>
          <button type="submit" className="btn-primary w-full bg-[#1a1a1a]">Salvar</button>
        </form>
      </Modal>

      {/* MODAL COLABORADOR WIZARD */}
      <Modal 
        isOpen={isColaboradorModalOpen} 
        onClose={() => setIsColaboradorModalOpen(false)} 
        title={colaboradorForm.id ? "Editar Colaborador" : "Adicionar Colaborador"}
        size="auto"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1">
             <div className={`h-1.5 rounded-full ${colaboradorStep >= 1 ? 'bg-indigo-600' : 'bg-neutral-200'}`}></div>
             <p className={`text-xs mt-1.5 font-medium text-center ${colaboradorStep >= 1 ? 'text-indigo-600' : 'text-neutral-400'}`}>1. Dados Básicos</p>
          </div>
          <div className="flex-1">
             <div className={`h-1.5 rounded-full ${colaboradorStep >= 2 ? 'bg-indigo-600' : 'bg-neutral-200'}`}></div>
             <p className={`text-xs mt-1.5 font-medium text-center ${colaboradorStep >= 2 ? 'text-indigo-600' : 'text-neutral-400'}`}>2. Permissões de Acesso</p>
          </div>
        </div>

        <form onSubmit={colaboradorStep === 1 ? (e) => { e.preventDefault(); setColaboradorStep(2); } : handleSaveColaborador} className="space-y-5">
          {colaboradorStep === 1 ? (
             <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
               <div className="grid grid-cols-2 gap-4">
                 <div className="col-span-2">
                   <label className="block text-sm font-medium mb-1">Nome Completo *</label>
                   <input required type="text" value={colaboradorForm.nome} onChange={e=>setColaboradorForm({...colaboradorForm, nome: e.target.value})} className="input-field" placeholder="Ex: João da Silva" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium mb-1">E-mail</label>
                   <input type="email" value={colaboradorForm.email} onChange={e=>setColaboradorForm({...colaboradorForm, email: e.target.value})} className="input-field" placeholder="joao@gmail.com" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium mb-1">Telefone</label>
                   <input type="text" inputMode="numeric" pattern="[0-9]*" value={colaboradorForm.telefone} onChange={e=>setColaboradorForm({...colaboradorForm, telefone: maskPhone(e.target.value)})} className="input-field" placeholder="(00) 00000-0000" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium mb-1">Cargo / Função *</label>
                   <select required value={colaboradorForm.funcao_id} onChange={e=>setColaboradorForm({...colaboradorForm, funcao_id: e.target.value})} className="input-field">
                     <option value="">Selecione...</option>
                     {funcoes.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-medium mb-1">Código de Acesso (Gerado)</label>
                   <div className="relative">
                     <input type="text" readOnly value={colaboradorForm.credencial_acesso} className="input-field font-mono font-bold bg-neutral-50 tracking-widest text-center text-lg w-full" />
                   </div>
                   <p className="text-[10px] text-neutral-500 mt-1">O colaborador usará este código de 8 dígitos para logar na aba GESTÃO.</p>
                 </div>
               </div>
               
               <div className="pt-2 flex justify-between items-center gap-4">
                 {colaboradorForm.id ? (
                   <button 
                     type="button" 
                     onClick={() => handleDeleteColaborador(colaboradorForm.id)} 
                     className="text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors border border-transparent hover:border-red-100"
                   >
                     <Trash2 className="h-4 w-4" /> Excluir Colaborador
                   </button>
                 ) : (
                   <div />
                 )}
                 <button type="submit" className="btn-primary w-full md:w-auto px-8 gap-2">Próximo Passo &rarr;</button>
               </div>
             </div>
          ) : (
             <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                   <p className="text-sm font-medium text-neutral-900 mb-0">Quais telas <strong className="text-indigo-600">{colaboradorForm.nome}</strong> acessará?</p>
                   <button
                     type="button"
                     onClick={() => setSelectedModulos(modulosDisponiveis.map(m => m.id))}
                     className="text-xs font-bold tracking-wide bg-indigo-100/70 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-200 transition-colors border border-indigo-200 self-start sm:self-auto"
                   >
                     Acesso Completo
                   </button>
                 </div>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                   {modulosDisponiveis.map(m => (
                     <label key={m.id} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${selectedModulos.includes(m.id) ? 'border-indigo-600 bg-indigo-50 shadow-inner' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}>
                       <div className="pt-0.5">
                         <input type="checkbox" className="w-4 h-4 text-indigo-600 border-neutral-300 rounded focus:ring-indigo-600" checked={selectedModulos.includes(m.id)} onChange={() => handeToggleModulo(m.id)} />
                       </div>
                       <div>
                         <span className={`block text-sm font-bold ${selectedModulos.includes(m.id) ? 'text-indigo-900' : 'text-neutral-700'}`}>{m.label}</span>
                       </div>
                     </label>
                   ))}
                 </div>
                 
                 <div className="mt-6 flex items-start gap-3 bg-white p-3 rounded-lg border border-neutral-200 shadow-sm">
                   <div className="bg-amber-100 p-1.5 rounded-full"><Key className="w-4 h-4 text-amber-700"/></div>
                   <p className="text-xs text-neutral-600 leading-relaxed">
                     <strong className="text-neutral-900 blo">Atenção sobre Exclusões:</strong> 
                     <br/>Colaboradores com <strong>Acesso Completo</strong> recebem permissão total de exclusões no sistema sem restrições. Para os de acessos parciais, o sistema bloqueará a exclusão direta e exigirá aprovação da central indicando um motivo.
                   </p>
                 </div>
               </div>
               
               <div className="pt-2 flex gap-3">
                 <button type="button" onClick={() => setColaboradorStep(1)} className="btn-secondary flex-1">Voltar</button>
                 <button type="submit" className="btn-primary flex-[2] bg-indigo-600 hover:bg-indigo-700">Concluir Cadastro</button>
               </div>
             </div>
          )}
        </form>
      </Modal>

      {/* MODAL DETALHES DA SESSÃO */}
      <Modal 
        isOpen={isSessionModalOpen} 
        onClose={() => setIsSessionModalOpen(false)} 
        title="Detalhes da Transação de Acesso"
        size="auto"
      >
        {selectedSession && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Usuário</p>
                <p className="font-bold text-neutral-900">{selectedSession.ator_nome}</p>
              </div>
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Tipo</p>
                <p className="font-bold text-indigo-600 uppercase text-xs">{selectedSession.ator_tipo}</p>
              </div>
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Início</p>
                <p className="font-bold text-neutral-900 text-xs">{new Date(selectedSession.criado_em).toLocaleString('pt-BR')}</p>
              </div>
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Status</p>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${selectedSession.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-600'}`}>
                  {selectedSession.status}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="flex items-center gap-2 text-xs font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100 pb-2">
                <Activity className="h-4 w-4" />
                Linha do Tempo de Ações
              </h5>
              
              {(() => {
                 const acoesReais = selectedSession.sistema_logs?.filter((l: any) => l.acao !== 'LOGIN' && l.acao !== 'LOGOUT') || [];
                 
                 if (acoesReais.length === 0) {
                   return (
                     <div className="p-8 text-center text-neutral-500 italic bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                       <p className="font-medium text-neutral-700">Apenas navegação no sistema.</p>
                       <p className="text-[10px] text-neutral-400 mt-1 uppercase tracking-widest font-black">Nenhuma alteração de dados foi realizada nesta sessão.</p>
                     </div>
                   );
                 }

                 return (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {acoesReais.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((log: any) => (
                    <div 
                      key={log.id} 
                      onClick={() => { setSelectedLog(log); setIsLogModalOpen(true); }}
                      className="group bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-neutral-50 group-hover:bg-indigo-50 transition-colors">
                          <Activity className="w-4 h-4 text-neutral-500 group-hover:text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-neutral-800 uppercase tracking-tight">{log.acao}</p>
                          <p className="text-xs text-neutral-500 line-clamp-1">{log.detalhes || 'Sem detalhes adicionais'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase">{formatDateTime(log.created_at)}</p>
                        <span className="text-[8px] font-black text-indigo-400 uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Ver Detalhes &rarr;</span>
                      </div>
                    </div>
                  ))}
                </div>
                );
              })()}
            </div>
            
            <button onClick={() => setIsSessionModalOpen(false)} className="w-full py-4 rounded-2xl bg-neutral-900 text-white font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl">
              Fechar Auditoria
            </button>
          </div>
        )}
      </Modal>

      {/* MODAL DETALHES DO LOG INDIVIDUAL */}
      <Modal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title="Detalhes da Ação"
      >
        {selectedLog && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-100 space-y-4">
              <div className="flex items-center gap-4 border-b border-neutral-200 pb-4">
                <div className="p-3 rounded-2xl bg-white shadow-sm">
                  <Activity className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-black text-neutral-900 uppercase tracking-tight">{selectedLog.acao}</h4>
                  <p className="text-xs text-neutral-500 font-bold uppercase">{new Date(selectedLog.created_at).toLocaleString('pt-BR')}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Informações Técnicas</p>
                <div className="bg-white p-4 rounded-2xl border border-neutral-100 text-xs font-mono text-neutral-600 leading-relaxed overflow-x-auto">
                  {selectedLog.detalhes || 'Nenhum detalhe técnico registrado para esta ação.'}
                </div>
              </div>
            </div>

            <button onClick={() => setIsLogModalOpen(false)} className="w-full py-3 rounded-2xl bg-neutral-100 text-neutral-600 font-black uppercase tracking-widest hover:bg-neutral-200 transition-all">
              Voltar
            </button>
          </div>
        )}
      </Modal>

      {/* MODAL LIMPEZA MANUAL */}
      <Modal isOpen={isClearModalOpen} onClose={() => setIsClearModalOpen(false)} title="Limpeza de Histórico de Sessões">
        <form onSubmit={handleLimpezaManual} className="space-y-4">
          <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-red-700 text-sm mb-4">
            <strong>Atenção:</strong> Esta ação excluirá os registros de sessão e todos os seus logs internamente ligados. Não é possível reverter essa exclusão.
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Qual período deseja excluir?</label>
            <select value={clearPeriod} onChange={e => setClearPeriod(e.target.value)} className="input-field">
              <option value="hoje">Limpar apenas os acessos de Hoje</option>
              <option value="7_dias">Últimos 7 dias retrospectivos</option>
              <option value="15_dias">Últimos 15 dias</option>
              <option value="30_dias">Últimos 30 dias (1 Mês)</option>
              <option value="personalizado">Período Personalizado (Datas Específicas)</option>
            </select>
          </div>
          
          {clearPeriod === 'personalizado' && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
              <div>
                <label className="block text-sm font-medium mb-1">Data Inicial</label>
                <input type="date" value={clearCustomStart} onChange={e => setClearCustomStart(e.target.value)} required className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data Final</label>
                <input type="date" value={clearCustomEnd} onChange={e => setClearCustomEnd(e.target.value)} required className="input-field" />
              </div>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={() => setIsClearModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={clearing} className="btn-primary flex-[1.5] bg-red-600 hover:bg-red-700 shadow-md flex items-center justify-center gap-2">
               {clearing ? <Activity className="w-5 h-5 animate-spin"/> : <Trash2 className="w-5 h-5"/>}
               {clearing ? 'Excluindo Lote...' : 'Excluir Lote Selecionado'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
