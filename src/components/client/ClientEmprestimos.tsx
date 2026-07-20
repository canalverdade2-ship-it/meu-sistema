import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { Emprestimo, EmprestimoParcela, EmprestimoComentario, EmprestimoHistorico } from '../../types';
import { formatCurrency, formatDate, formatDateTime, handleError, generateCode } from '../../lib/utils';
import { Landmark, CreditCard, Clock, CheckCircle, XCircle, MessageSquare, Send, ChevronRight, Download, AlertTriangle, HelpCircle, Plus, ChevronLeft, Info } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { toast } from 'react-hot-toast';
import { notificationService } from '../../lib/notificationService';
import { calcularParcela, getEmprestimoStatusInfo, EMPRESTIMO_STEPS, verificarElegibilidadeEmprestimo } from '../../utils/emprestimoUtils';
import SignaturePad from 'signature_pad';
import { useClientNotifications } from '../../hooks/useClientNotifications';
import { useFileViewer } from '../../contexts/FileViewerContext';
import { StepDadosPessoais, StepValorCondicoes, StepDocumentos, StepConfirmacao } from './emprestimo/EmprestimoFormSteps';
import { clientOperationalWrite } from '../../lib/clientOperationalWrite';
import type { DadosPessoais, DadosEmprestimo, DocFiles } from './emprestimo/EmprestimoFormSteps';
import { callClientRpc } from '../../lib/clientRpc';

export function ClientEmprestimos({ clientId, initialTab, initialItemId, onNavigate }: { clientId: string, initialTab?: string, initialItemId?: string, onNavigate?: (mod: any, tab?: string, itemId?: string) => void }) {
  const { openFile } = useFileViewer();
  const { pendencies } = useClientNotifications();
  const initialEmprestimosTab = initialTab === 'parcelas' ? 'parcelas' : 'propostas';
  const [tab, setTab] = useState<'propostas'|'ativos'|'parcelas'>(initialEmprestimosTab);
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([]);
  const [parcelas, setParcelas] = useState<EmprestimoParcela[]>([]);
  const [selected, setSelected] = useState<Emprestimo|null>(null);
  const [historico, setHistorico] = useState<EmprestimoHistorico[]>([]);
  const [comentarios, setComentarios] = useState<EmprestimoComentario[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showSign, setShowSign] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [parcelasEscolhidas, setParcelasEscolhidas] = useState(1);
  const [dadosBancarios, setDadosBancarios] = useState<any>({ tipo: 'pix', pix_tipo_chave: 'cpf', pix_chave: '' });
  const [filterEmprestimo, setFilterEmprestimo] = useState('todos');
  const [showAcceptInfo, setShowAcceptInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [selectedParcela, setSelectedParcela] = useState<EmprestimoParcela | null>(null);

  // ── Solicitação de Alteração Cadastral (Tickets) ──
  const [hasPendingEditTicket, setHasPendingEditTicket] = useState(false);
  const [editFieldInfo, setEditFieldInfo] = useState<{label: string, currentValue: string} | null>(null);
  const [newFieldValue, setNewFieldValue] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // ── Nova solicitação (formulário 4 etapas) ──
  const [showSolicitarModal, setShowSolicitarModal] = useState(false);
  const [solicitarStep, setSolicitarStep] = useState(1);
  const [isSolicitando, setIsSolicitando] = useState(false);
  const [dadosPessoais, setDadosPessoais] = useState<DadosPessoais>({
    nome_completo: '', data_nascimento: '', rg: '', cpf: '', telefone: '',
    cep: '', numero_casa: '', endereco_rua: '', endereco_bairro: '',
    endereco_cidade: '', endereco_uf: '', email: ''
  });
  const [dadosEmprestimo, setDadosEmprestimo] = useState<DadosEmprestimo>({
    valor_desejado: '', parcelas_desejadas: 0
  });
  const [docFiles, setDocFiles] = useState<DocFiles>({
    cnh: null, comprovante_endereco: null, holerite: null, foto_perfil: null
  });
  const [loadingPay, setLoadingPay] = useState(false);
  const signCanvasRef = useRef<HTMLCanvasElement>(null);
  const signPadRef = useRef<SignaturePad|null>(null);

  useEffect(() => { fetchData(); }, [clientId]);
  useEffect(() => {
    if (initialItemId && emprestimos.length > 0) {
      const emp = emprestimos.find(e => e.id === initialItemId);
      if (emp) {
        setHighlightedItemId(emp.id);
        setTab('propostas');
        
        setTimeout(() => {
          const el = document.getElementById(`emp-${emp.id}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 500);

        // Remove o destaque após 5 segundos
        setTimeout(() => setHighlightedItemId(null), 5000);
      }
    }
  }, [initialItemId, emprestimos]);

  // Real-time listener para atualizar a tela automaticamente
  useEffect(() => {
    if (!clientId) return;
    const channel = supabase.channel(`client-emprestimos-${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emprestimos', filter: `cliente_id=eq.${clientId}` }, () => {
        fetchData();
        if (selected) reFetchDetail(selected.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emprestimo_parcelas', filter: `cliente_id=eq.${clientId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emprestimo_comentarios' }, () => {
        if (selected) reFetchDetail(selected.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emprestimo_historico' }, () => {
        if (selected) reFetchDetail(selected.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emprestimo_documentos' }, () => {
        if (selected) reFetchDetail(selected.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clientId, selected]);

  const reFetchDetail = async (empId: string) => {
    const [h, c] = await Promise.all([
      supabase.from('emprestimo_historico').select('*').eq('emprestimo_id', empId).order('created_at', { ascending: false }),
      supabase.from('emprestimo_comentarios').select('*').eq('emprestimo_id', empId).order('created_at')
    ]);
    setHistorico((h.data || []) as any);
    setComentarios((c.data || []) as any);
  };

  const fetchData = async () => {
    setLoading(true);
    const [e, p, t] = await Promise.all([
      supabase.from('emprestimos')
        .select('*, clientes(*), orcamentos(*)')
        .eq('cliente_id', clientId)
        .order('created_at', { ascending: false }),
      supabase.from('emprestimo_parcelas').select('*, faturas!emprestimo_parcelas_fatura_id_fkey(cobrancas(id))').eq('cliente_id', clientId).order('data_vencimento'),
      supabase.from('tickets')
        .select('id')
        .eq('cliente_id', clientId)
        .eq('assunto', 'Solicitação de Alteração Cadastral')
        .neq('status', 'concluido')
        .limit(1)
    ]);
    setEmprestimos((e.data || []) as any);
    setParcelas((p.data || []) as any);
    setHasPendingEditTicket(t.data && t.data.length > 0 ? true : false);
    setLoading(false);
  };

  const handleFinishEmprestimo = async () => {
    if (isSolicitando) return;
    setIsSolicitando(true);
    try {
      // Upload de documentos
      const uploadedDocs: { tipo: string; nome: string; url: string }[] = [];
      for (const [tipo, file] of Object.entries(docFiles)) {
        if (!file) continue;
        const ext = (file as File).name.split('.').pop();
        const path = `solicitacoes/${clientId}/${tipo}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('emprestimos').upload(path, file as File);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('emprestimos').getPublicUrl(path);
        uploadedDocs.push({ tipo, nome: (file as File).name, url: publicUrl });
      }

      const valorNum = parseFloat(dadosEmprestimo.valor_desejado.replace(/\./g, '').replace(',', '.')) || 0;

      // Inserir diretamente na tabela emprestimos (sem criar orcamento)
      const newEmp = await clientOperationalWrite<{ id: string }>(clientId, 'emprestimos', 'insert', {
        codigo_emprestimo: generateCode('EMP'),
        valor_solicitado: valorNum,
        parcelas_escolhidas: dadosEmprestimo.parcelas_desejadas,
        status: 'analise_inicial'
      });

      // Salva a data de nascimento e RG no cadastro do cliente
      if (dadosPessoais.data_nascimento || dadosPessoais.rg) {
        const updateData: any = {};
        if (dadosPessoais.data_nascimento) updateData.data_nascimento = dadosPessoais.data_nascimento;
        
        if (dadosPessoais.rg) {
          const { data: clienteData } = await supabase.from('clientes').select('observacoes').eq('id', clientId).single();
          const obsAtual = clienteData?.observacoes || '';
          if (!obsAtual.includes('RG:')) {
            updateData.observacoes = obsAtual ? `${obsAtual}\nRG: ${dadosPessoais.rg}` : `RG: ${dadosPessoais.rg}`;
          }
        }
        
        if (Object.keys(updateData).length > 0) {
          await clientOperationalWrite(clientId, 'clientes', 'update', updateData, { id: clientId });
        }
      }

      // Salvar docs na tabela emprestimo_documentos
      for (const doc of uploadedDocs) {
        await clientOperationalWrite(clientId, 'emprestimo_documentos', 'insert', {
          emprestimo_id: newEmp.id,
          tipo: doc.tipo,
          nome: doc.nome,
          url: doc.url,
          status: 'enviado'
        });
      }

      // Registrar histórico
      await clientOperationalWrite(clientId, 'emprestimo_historico', 'insert', {
        emprestimo_id: newEmp.id,
        tipo_acao: 'solicitacao_criada',
        descricao: `Cliente solicitou empréstimo de R$ ${dadosEmprestimo.valor_desejado} em ${dadosEmprestimo.parcelas_desejadas}x`,
        usuario_tipo: 'cliente',
        usuario_id: clientId
      });

      // Notificar admin
      await notificationService.notifyAdmin(
        '💰 Nova Solicitação de Empréstimo',
        `Um cliente solicitou um empréstimo de R$ ${dadosEmprestimo.valor_desejado}`,
        'emprestimos',
        'emprestimo_criado',
        { itemId: newEmp.id, tab: 'solicitacoes', prioridade: 'alta' }
      );

      toast.success('Solicitação enviada com sucesso! Prazo de retorno: 5 dias úteis.');
      setShowSolicitarModal(false);
      setSolicitarStep(1);
      setDadosPessoais({ nome_completo: '', data_nascimento: '', rg: '', cpf: '', telefone: '', cep: '', numero_casa: '', endereco_rua: '', endereco_bairro: '', endereco_cidade: '', endereco_uf: '', email: '' });
      setDadosEmprestimo({ valor_desejado: '', parcelas_desejadas: 0 });
      setDocFiles({ cnh: null, comprovante_endereco: null, holerite: null, foto_perfil: null });
      setTab('propostas');
      fetchData();
    } catch (err: any) {
      toast.error(handleError(err, 'Erro ao enviar solicitação'));
    } finally {
      setIsSolicitando(false);
    }
  };

  const handleSubmitEditTicket = async () => {
    if (!editFieldInfo || !newFieldValue.trim()) { toast.error('Informe o novo valor desejado.'); return; }
    setIsSubmittingTicket(true);
    try {
      const descricao = `O cliente solicitou a alteração do campo "${editFieldInfo.label}".\n\nValor Atual: ${editFieldInfo.currentValue}\n\nNovo Valor Solicitado: ${newFieldValue}`;
      const ticket = await clientOperationalWrite<{ id: string }>(clientId, 'tickets', 'insert', {
        assunto: 'Solicitação de Alteração Cadastral',
        descricao,
        status: 'aberto'
      });

      await notificationService.notifyAdmin(
        '✏️ Solicitação de Alteração Cadastral',
        `Cliente solicitou alteração no campo ${editFieldInfo.label}`,
        'suporte',
        'ticket_aberto_cliente',
        { itemId: ticket.id, tab: 'abertos', prioridade: 'normal' }
      );

      toast.success('Solicitação de alteração enviada ao suporte!');
      setEditFieldInfo(null);
      setNewFieldValue('');
      setHasPendingEditTicket(true);
    } catch (err: any) {
      toast.error(handleError(err, 'Erro ao abrir ticket de alteração'));
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const openDetail = async (emp: Emprestimo) => {
    setSelected(emp);
    setShowDetail(true);
    setShowChat(false);
    if (emp.parcelas_escolhidas) setParcelasEscolhidas(emp.parcelas_escolhidas);
    const [h, c, d] = await Promise.all([
      supabase.from('emprestimo_historico').select('*').eq('emprestimo_id', emp.id).order('created_at', { ascending: false }),
      supabase.from('emprestimo_comentarios').select('*').eq('emprestimo_id', emp.id).order('created_at'),
      supabase.from('emprestimo_documentos').select('*').eq('emprestimo_id', emp.id)
    ]);
    setHistorico((h.data || []) as any);
    setComentarios((c.data || []) as any);
    setDocumentos((d.data || []) as any);
  };

  const sendMsg = async () => {
    if (!newMsg.trim() || !selected) return;
    await clientOperationalWrite(clientId, 'emprestimo_comentarios', 'insert', { emprestimo_id: selected.id, autor_tipo: 'cliente', autor_id: clientId, mensagem: newMsg });
    await notificationService.notifyAdmin('💬 Nova mensagem em empréstimo', `Cliente enviou mensagem no empréstimo ${selected.codigo_emprestimo}`, 'emprestimos', 'emprestimo_comentario', { itemId: selected.id, tab: 'propostas' });
    setNewMsg('');
    const { data } = await supabase.from('emprestimo_comentarios').select('*').eq('emprestimo_id', selected.id).order('created_at');
    setComentarios((data || []) as any);
  };

  const handleReplaceDocument = async (docId: string, tipo: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;

    try {
      setUploadingDocId(docId);
      const ext = file.name.split('.').pop();
      const path = `${clientId}/${Date.now()}_${tipo}.${ext}`;
      const { error: upErr } = await supabase.storage.from('emprestimos').upload(path, file);
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from('emprestimos').getPublicUrl(path);

      await clientOperationalWrite(clientId, 'emprestimo_documentos', 'update', {
        url: publicUrl,
        nome: file.name,
        status: 'reenviado',
        motivo_rejeicao: null
      }, { id: docId });

      // Verify if there are any other documents still rejected
      const { data: remainingDocs } = await supabase.from('emprestimo_documentos').select('status').eq('emprestimo_id', selected.id);
      const hasRejected = remainingDocs?.some(d => d.status === 'rejeitado');
      if (!hasRejected) {
        // Change loan status back to analise_inicial
        await clientOperationalWrite(clientId, 'emprestimos', 'update', { status: 'analise_inicial' }, { id: selected.id });
      }

      await clientOperationalWrite(clientId, 'emprestimo_historico', 'insert', {
        emprestimo_id: selected.id,
        usuario_id: clientId,
        tipo_acao: 'documento_reenviado',
        descricao: `Cliente reenviou o documento: ${tipo.replace('_', ' ')}`,
        usuario_tipo: 'cliente'
      });

      await notificationService.notifyAdmin('📄 Documento Reenviado', `Cliente reenviou o documento ${tipo.replace('_', ' ')}`, 'emprestimos', 'documento_enviado_cliente', { itemId: selected.id, tab: 'pendentes' });

      toast.success('Documento reenviado com sucesso!');
      
      // reload docs and history
      const [d, h] = await Promise.all([
        supabase.from('emprestimo_documentos').select('*').eq('emprestimo_id', selected.id),
        supabase.from('emprestimo_historico').select('*').eq('emprestimo_id', selected.id).order('created_at', { ascending: false })
      ]);
      setDocumentos((d.data || []) as any);
      setHistorico((h.data || []) as any);

    } catch (err: any) {
      toast.error('Erro ao reenviar documento');
    } finally {
      setUploadingDocId(null);
    }
  };

  const aceitarProposta = async () => {
    if (!selected) return;
    const calc = calcularParcela(selected.valor_aprovado || selected.valor_solicitado || 0, selected.juros_total_percentual || 0, parcelasEscolhidas);
    await clientOperationalWrite(clientId, 'emprestimos', 'update', {
      parcelas_escolhidas: parcelasEscolhidas, valor_parcela: calc.valorParcela, valor_total_financiado: calc.valorTotalFinanciado,
      dados_bancarios: dadosBancarios, status: 'analise_final'
    }, { id: selected.id });
    await clientOperationalWrite(clientId, 'emprestimo_historico', 'insert', { emprestimo_id: selected.id, tipo_acao: 'proposta_aceita', descricao: 'Cliente aceitou: ' + parcelasEscolhidas + 'x de ' + formatCurrency(calc.valorParcela), usuario_tipo: 'cliente', usuario_id: clientId });
    await notificationService.notifyAdmin('✅ Proposta aceita', `Cliente aceitou proposta do empréstimo ${selected.codigo_emprestimo}`, 'emprestimos', 'emprestimo_aceito', { itemId: selected.id, tab: 'propostas' });
    toast.success('Proposta aceita!');
    setShowDetail(false);
    setShowAcceptInfo(true);
    fetchData();
  };

  const openSignature = () => {
    setShowSign(true);
    setTimeout(() => {
      if (signCanvasRef.current) {
        signPadRef.current = new SignaturePad(signCanvasRef.current, { backgroundColor: 'rgb(255,255,255)', penColor: 'rgb(0,0,0)' });
        const canvas = signCanvasRef.current;
        canvas.width = canvas.offsetWidth * 2;
        canvas.height = canvas.offsetHeight * 2;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.scale(2, 2);
      }
    }, 300);
  };

  const finishSignature = async () => {
    if (!signPadRef.current || signPadRef.current.isEmpty() || !selected) { toast.error('Assine o contrato antes de concluir.'); return; }
    const dataUrl = signPadRef.current.toDataURL('image/png');
    const blob = await (await fetch(dataUrl)).blob();
    const path = `assinaturas/${clientId}/${selected.id}-${Date.now()}.png`;
    const { error } = await supabase.storage.from('emprestimos').upload(path, blob);
    if (error) { toast.error('Erro ao salvar assinatura.'); return; }
    const { data: { publicUrl } } = supabase.storage.from('emprestimos').getPublicUrl(path);
    await clientOperationalWrite(clientId, 'emprestimos', 'update', { assinatura_url: publicUrl, data_assinatura: new Date().toISOString(), status: 'analise_contrato' }, { id: selected.id });
    await clientOperationalWrite(clientId, 'emprestimo_historico', 'insert', { emprestimo_id: selected.id, tipo_acao: 'contrato_assinado', descricao: 'Cliente assinou contrato digitalmente', usuario_tipo: 'cliente', usuario_id: clientId });
    await notificationService.notifyAdmin('📝 Contrato assinado', `Cliente assinou contrato do empréstimo ${selected.codigo_emprestimo}`, 'emprestimos', 'emprestimo_assinado', { itemId: selected.id, tab: 'ativos' });
    toast.success('Contrato assinado com sucesso!');
    setShowSign(false);
    setShowDetail(false);
    fetchData();
  };

  const solicitarQuitacao = async () => {
    if (!selected || loadingPay) return;
    if (!window.confirm('Deseja solicitar a quitação antecipada deste empréstimo? Ele entrará em análise pelo administrador.')) return;
    
    setLoadingPay(true);
    try {
      await callClientRpc('gsa_client_request_loan_settlement', {
        p_emprestimo_id: selected.id,
      });
      setSelected({ ...selected, status: 'analise_quitacao' });
      toast.success('Solicitação enviada!');
      fetchData();
    } catch (e) {
      toast.error('Erro ao enviar solicitação');
    } finally {
      setLoadingPay(false);
    }
  };

  const gerarFaturaQuitacao = async () => {
    if (!selected || !selected.valor_quitacao_acordo) return;
    setLoadingPay(true);
    try {
      const data = await callClientRpc<any>('gsa_client_accept_loan_settlement', {
        p_emprestimo_id: selected.id,
      });
      const faturaId = data?.fatura_id;
      toast.success(data?.already_exists ? 'A fatura de quitação já estava gerada.' : 'Fatura de quitação gerada com sucesso!');
      onNavigate('financeiro', 'faturas', faturaId);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar fatura');
    } finally {
      setLoadingPay(false);
    }
  };

  const recusarOfertaQuitacao = async () => {
    if (!selected) return;
    if (!window.confirm('Deseja recusar esta oferta de quitação? O empréstimo voltará ao status ativo normal.')) return;
    
    await callClientRpc('gsa_client_reject_loan_settlement', {
      p_emprestimo_id: selected.id,
    });
    toast.success('Oferta recusada.');
    setShowDetail(false); fetchData();
  };

  const getParcelasFiltradas = () => filterEmprestimo === 'todos' ? parcelas : parcelas.filter(p => p.emprestimo_id === filterEmprestimo);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"/></div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Cabeçalho com CTA */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-neutral-900">Meus Empréstimos</h2>
          <p className="text-xs text-neutral-400 mt-0.5">Gerencie suas solicitações e parcelas</p>
        </div>
        <button
          onClick={async () => {
            const result = await verificarElegibilidadeEmprestimo(clientId);
            if (!result.elegivel) { toast.error(result.motivo || 'Você não está elegível para solicitar um empréstimo no momento.'); return; }
            
            // Buscar dados atuais do cliente para pré-preencher
            const { data: clienteData } = await supabase.from('clientes').select('*').eq('id', clientId).single();
            if (clienteData) {
              setDadosPessoais({
                nome_completo: clienteData.nome || clienteData.nome_razao || '',
                data_nascimento: clienteData.data_nascimento || '',
                rg: '', // RG preenchido pelo cliente
                cpf: clienteData.cpf || clienteData.cpf_cnpj || '',
                telefone: clienteData.telefone || '',
                cep: clienteData.cep || '',
                numero_casa: clienteData.numero || '',
                endereco_rua: clienteData.endereco || '',
                endereco_bairro: clienteData.bairro || '',
                endereco_cidade: clienteData.cidade || '',
                endereco_uf: clienteData.estado || '',
                email: clienteData.email || ''
              });
            }

            setSolicitarStep(1);
            setShowSolicitarModal(true);
          }}
          className="flex items-center gap-2 rounded-2xl bg-[#1a1a1a] px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg hover:bg-black active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" />
          Nova Solicitação
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-neutral-100 p-1 rounded-xl">
        {[
          {id:'propostas' as const, label:'Propostas', icon: Clock, badge: pendencies.emprestimos_acoes_necessarias > 0},
          {id:'parcelas' as const, label:'Parcelas', icon: CreditCard, badge: pendencies.emprestimos_parcelas_vencidas > 0}
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${tab === t.id ? 'bg-white shadow-sm text-indigo-600' : 'text-neutral-500 hover:text-neutral-700'}`}>
            <t.icon className="h-4 w-4" />{t.label}
            {t.badge && (
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Aba Propostas */}
      {tab === 'propostas' && (
        <div className="space-y-4">
          {emprestimos.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl ring-1 ring-neutral-200 flex flex-col items-center">
              <Clock className="h-12 w-12 text-neutral-300 mb-3" />
              <p className="text-sm font-bold text-neutral-400">Nenhuma proposta encontrada</p>
              <p className="text-xs text-neutral-400 mt-1">Clique em &ldquo;Nova Solicitação&rdquo; para solicitar um empréstimo</p>
            </div>
          ) : emprestimos.map(emp => {
            const info = getEmprestimoStatusInfo(emp.status);

            // Remove incorrect visual override and use the real status info
            const customLabel = info.label;
            const customBg = info.bg;
            const customColor = info.color;

            return (
             <button type="button" key={emp.id} id={`emp-${emp.id}`} onClick={() => openDetail(emp)} className={`rounded-2xl p-5 transition-all cursor-pointer group relative text-left w-full block ${highlightedItemId === emp.id ? 'bg-indigo-50 ring-4 ring-indigo-500 shadow-2xl scale-[1.02] z-10' : 'bg-white ring-1 ring-neutral-200 hover:shadow-lg hover:ring-indigo-300'}`}>
                {highlightedItemId === emp.id && (
                  <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 ring-4 ring-white animate-pulse z-20 flex items-center justify-center">
                    <span className="h-2 w-2 rounded-full bg-white" />
                  </span>
                )}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{emp.codigo_emprestimo}</p>
                    <p className="text-xl font-black text-neutral-900 mt-1">{formatCurrency(emp.valor_aprovado || emp.valor_solicitado)}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${customBg} ${customColor}`}>{customLabel}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-neutral-500 font-bold uppercase tracking-tighter">Fase Atual: {EMPRESTIMO_STEPS.find(s => s.step === info.step)?.label || ''}</span>
                  <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-indigo-500 transition-all" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Aba Ativos */}
      {tab === 'ativos' && (
        <div className="space-y-4">
          {emprestimos.filter(emp => ['ativo', 'quitado', 'analise_quitacao', 'aguardando_pagamento_quitacao'].includes(emp.status)).length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl ring-1 ring-neutral-200">
              <Landmark className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-neutral-400">Nenhum empréstimo ativo ou quitado</p>
            </div>
          ) : emprestimos.filter(emp => ['ativo', 'quitado', 'analise_quitacao', 'aguardando_pagamento_quitacao'].includes(emp.status)).map(emp => {
            const info = getEmprestimoStatusInfo(emp.status);
            const pEmp = parcelas.filter(p => p.emprestimo_id === emp.id);
            const pagas = pEmp.filter(p => p.status === 'paga').length;
            const progresso = pEmp.length > 0 ? Math.round((pagas / pEmp.length) * 100) : 0;

            return (
               <button type="button" key={emp.id} id={`emp-${emp.id}`} onClick={() => openDetail(emp)} className={`rounded-2xl p-5 transition-all cursor-pointer group relative text-left w-full block ${highlightedItemId === emp.id ? 'bg-indigo-50 ring-4 ring-indigo-500 shadow-2xl scale-[1.02] z-10' : 'bg-white ring-1 ring-neutral-200 hover:shadow-lg hover:ring-indigo-300'}`}>
                {highlightedItemId === emp.id && (
                  <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 ring-4 ring-white animate-pulse z-20 flex items-center justify-center">
                    <span className="h-2 w-2 rounded-full bg-white" />
                  </span>
                )}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{emp.codigo_emprestimo}</p>
                    <p className="text-xl font-black text-neutral-900 mt-1">{formatCurrency(emp.valor_aprovado || emp.valor_solicitado)}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${info.bg} ${info.color}`}>{info.label}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-indigo-600">{progresso}% quitado ({pagas}/{pEmp.length})</span>
                  <span className="text-neutral-400 font-bold uppercase">{emp.status === 'quitado' ? 'Empréstimo Finalizado' : 'Em Pagamento'}</span>
                </div>
                <div className="mt-2 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all" style={{width:`${progresso}%`}} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Aba Parcelas */}
      {tab === 'parcelas' && (
        <div className="space-y-4">
          <select value={filterEmprestimo} onChange={e => setFilterEmprestimo(e.target.value)} className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium">
            <option value="todos">Todos os empréstimos</option>
            {emprestimos.map(e => <option key={e.id} value={e.id}>{e.codigo_emprestimo} — {formatCurrency(e.valor_aprovado || e.valor_solicitado)}</option>)}
          </select>
          {getParcelasFiltradas().length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl ring-1 ring-neutral-200">
              <CreditCard className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-neutral-400">Nenhuma parcela gerada</p>
            </div>
          ) : getParcelasFiltradas().map(p => (
            <button type="button" key={p.id} onClick={() => setSelectedParcela(p)} className={`flex items-center justify-between w-full bg-white rounded-xl p-4 ring-1 cursor-pointer hover:ring-indigo-300 transition-all ${p.status === 'paga' ? 'ring-emerald-200' : p.status === 'vencida' ? 'ring-red-200 bg-red-50' : 'ring-neutral-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-black ${p.status === 'paga' ? 'bg-emerald-100 text-emerald-600' : p.status === 'vencida' ? 'bg-red-100 text-red-600' : 'bg-neutral-100 text-neutral-500'}`}>
                  {p.numero_parcela}
                </div>
                <div>
                  <p className="text-sm font-bold text-neutral-900">{formatCurrency(p.valor)}</p>
                  <p className="text-[10px] text-neutral-400">Venc: {formatDate(p.data_vencimento)}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${p.status === 'paga' ? 'bg-emerald-100 text-emerald-700' : p.status === 'vencida' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {p.status === 'paga' ? '✅ Paga' : p.status === 'vencida' ? '⚠️ Vencida' : '🕐 Pendente'}
                </span>
                {p.data_pagamento && (
                  <p className="text-[9px] text-neutral-500 mt-1 font-bold">Pago: {formatDateTime(p.data_pagamento)}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modal Detalhes */}
      {showDetail && selected && (
        <Modal isOpen={true} title={`Empréstimo ${selected.codigo_emprestimo}`} onClose={() => setShowDetail(false)} size="lg">
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            {/* Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-indigo-50 p-4 rounded-xl"><p className="text-[10px] font-black text-indigo-400 uppercase mb-1">Valor</p><p className="text-lg font-black text-indigo-700">{formatCurrency(selected.valor_aprovado || selected.valor_solicitado)}</p></div>
              <div className="bg-neutral-50 p-4 rounded-xl"><p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Status</p><p className={`text-sm font-black ${getEmprestimoStatusInfo(selected.status).color}`}>{getEmprestimoStatusInfo(selected.status).label}</p></div>
            </div>

            {/* Documentos */}
            {documentos && documentos.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Documentos Anexados</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {documentos.map((doc: any, i: number) => (
                    <div key={i} className={`p-3 rounded-xl ring-1 ${doc.status === 'aprovado' ? 'bg-emerald-50 ring-emerald-200' : doc.status === 'rejeitado' ? 'bg-red-50 ring-red-200' : 'bg-neutral-50 ring-neutral-200'}`}>
                      <p className="text-[10px] font-black uppercase text-neutral-500 truncate mb-1" title={doc.tipo?.replace('_', ' ') || 'Documento'}>{doc.tipo?.replace('_', ' ') || 'Documento'}</p>
                      <div className="flex flex-col gap-1 items-start w-full">
                        <span className={`text-[8px] font-bold px-2 py-1 rounded-full ${doc.status === 'aprovado' ? 'bg-emerald-100 text-emerald-700' : doc.status === 'rejeitado' ? 'bg-red-100 text-red-700' : doc.status === 'reenviado' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                          {doc.status === 'rejeitado' ? 'REPROVADO' : (doc.status || 'Em Análise').toUpperCase()}
                        </span>
                        {doc.status === 'rejeitado' && (
                          <div className="mt-2 space-y-2 w-full">
                            {doc.motivo_rejeicao && (
                              <div className="bg-red-100/50 p-2 rounded-md ring-1 ring-red-200">
                                <span className="text-[8px] font-black uppercase text-red-800">Motivo:</span>
                                <div className="text-[9px] text-red-600 font-medium leading-tight break-words whitespace-normal mt-0.5">{doc.motivo_rejeicao}</div>
                              </div>
                            )}
                            <label className={`block w-full text-center py-2 text-white rounded-lg font-black text-[9px] uppercase transition-colors ${uploadingDocId === doc.id ? 'bg-neutral-400 cursor-not-allowed' : 'bg-red-600 cursor-pointer hover:bg-red-700 shadow-sm'}`}>
                              {uploadingDocId === doc.id ? 'Enviando...' : 'Reenviar Arquivo'}
                              <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => handleReplaceDocument(doc.id, doc.tipo, e)} disabled={uploadingDocId === doc.id} />
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.juros_total_percentual && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-xl ring-1 ring-neutral-200"><p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Juros Total</p><p className="text-sm font-bold">{selected.juros_total_percentual}%</p></div>
                <div className="bg-white p-3 rounded-xl ring-1 ring-neutral-200"><p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Máx Parcelas</p><p className="text-sm font-bold">{selected.max_parcelas_liberado}x</p></div>
                <div className="bg-white p-3 rounded-xl ring-1 ring-neutral-200"><p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Taxa Serviço</p><p className="text-sm font-bold">{formatCurrency(selected.taxa_servico || 0)}</p></div>
              </div>
            )}

            {/* Mensagem da proposta */}
            {selected.proposta_mensagem && (
              <div className="bg-amber-50 p-4 rounded-xl ring-1 ring-amber-200"><p className="text-[10px] font-black text-amber-500 uppercase mb-1">Mensagem do ADM</p><p className="text-xs text-amber-800">{selected.proposta_mensagem}</p></div>
            )}

            {/* Simulador de Parcelas */}
            {selected.status === 'proposta_enviada' && selected.max_parcelas_liberado && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-2xl ring-1 ring-indigo-200 space-y-4">
                <h4 className="text-sm font-black text-indigo-900 uppercase">🎛️ Simulador de Parcelas</h4>
                <div>
                  <input type="range" min={1} max={selected.max_parcelas_liberado} value={parcelasEscolhidas} onChange={e => setParcelasEscolhidas(Number(e.target.value))} className="w-full accent-indigo-600" />
                  <div className="flex justify-between text-[10px] font-bold text-neutral-400 mt-1"><span>1x</span><span>{selected.max_parcelas_liberado}x</span></div>
                </div>
                <div className="text-center bg-white p-4 rounded-xl">
                  <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">{parcelasEscolhidas}x de</p>
                  <p className="text-3xl font-black text-indigo-600">{formatCurrency(calcularParcela(selected.valor_aprovado || selected.valor_solicitado || 0, selected.juros_total_percentual || 0, parcelasEscolhidas).valorParcela)}</p>
                  <p className="text-[10px] text-neutral-400 mt-1">Total: {formatCurrency(calcularParcela(selected.valor_aprovado || selected.valor_solicitado || 0, selected.juros_total_percentual || 0, parcelasEscolhidas).valorTotalFinanciado)}</p>
                </div>
                {/* Dados Bancários */}
                <div className="space-y-3">
                  <h5 className="text-xs font-black text-neutral-700 uppercase">Dados Bancários</h5>
                  <div className="flex gap-2">
                    {['pix','ted'].map(t => <button key={t} onClick={() => setDadosBancarios({...dadosBancarios, tipo: t})} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase ${dadosBancarios.tipo === t ? 'bg-indigo-600 text-white' : 'bg-white ring-1 ring-neutral-200'}`}>{t.toUpperCase()}</button>)}
                  </div>
                  {dadosBancarios.tipo === 'pix' ? (
                    <div className="space-y-2">
                      <select value={dadosBancarios.pix_tipo_chave} onChange={e => setDadosBancarios({...dadosBancarios, pix_tipo_chave: e.target.value})} className="w-full bg-white border rounded-lg px-3 py-2 text-sm">
                        <option value="cpf">CPF</option><option value="telefone">Telefone</option><option value="email">E-mail</option><option value="aleatoria">Chave Aleatória</option>
                      </select>
                      <input inputMode={['cpf', 'telefone'].includes(dadosBancarios.pix_tipo_chave) ? 'numeric' : 'text'} pattern={['cpf', 'telefone'].includes(dadosBancarios.pix_tipo_chave) ? '[0-9]*' : undefined} value={dadosBancarios.pix_chave || ''} onChange={e => setDadosBancarios({...dadosBancarios, pix_chave: e.target.value})} placeholder="Chave PIX" className="w-full bg-white border rounded-lg px-3 py-2 text-sm" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <input inputMode="numeric" pattern="[0-9]*" placeholder="Banco" value={dadosBancarios.ted_banco||''} onChange={e=>setDadosBancarios({...dadosBancarios,ted_banco:e.target.value})} className="bg-white border rounded-lg px-3 py-2 text-sm" />
                      <input inputMode="numeric" pattern="[0-9]*" placeholder="Agência" value={dadosBancarios.ted_agencia||''} onChange={e=>setDadosBancarios({...dadosBancarios,ted_agencia:e.target.value})} className="bg-white border rounded-lg px-3 py-2 text-sm" />
                      <input inputMode="numeric" pattern="[0-9]*" placeholder="Conta" value={dadosBancarios.ted_conta||''} onChange={e=>setDadosBancarios({...dadosBancarios,ted_conta:e.target.value})} className="bg-white border rounded-lg px-3 py-2 text-sm" />
                      <select value={dadosBancarios.ted_tipo_conta||'corrente'} onChange={e=>setDadosBancarios({...dadosBancarios,ted_tipo_conta:e.target.value})} className="bg-white border rounded-lg px-3 py-2 text-sm"><option value="corrente">Corrente</option><option value="poupanca">Poupança</option></select>
                    </div>
                  )}
                </div>
                <button onClick={aceitarProposta} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 active:scale-95 transition-all">✅ Aceitar Proposta</button>
              </div>
            )}

            {/* Botão assinar contrato */}
            {selected.status === 'pendencia_assinatura' && selected.contrato_url && (
              <div className="space-y-3">
                <button type="button" onClick={() => openFile(selected.contrato_url!, 'Contrato')} className="flex items-center justify-center gap-2 w-full py-3 bg-white rounded-xl ring-1 ring-neutral-200 text-sm font-bold hover:bg-neutral-50 transition-all">
                  <Download className="h-4 w-4" /> Visualizar Contrato
                </button>
                <button onClick={openSignature} className="w-full py-3 bg-[#1a1a1a] text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-black active:scale-95 transition-all">✍️ Assinar Contrato</button>
              </div>
            )}

            {/* Empréstimo Ativo: Contrato e Parcelas */}
            {['ativo', 'quitado', 'analise_quitacao', 'aguardando_pagamento_quitacao'].includes(selected.status) && (
              <div className="space-y-4">
                {/* Contrato Assinado */}
                {selected.assinatura_url && (
                  <div className="bg-emerald-50 p-4 rounded-xl ring-1 ring-emerald-200">
                    <h4 className="text-xs font-black text-emerald-800 uppercase mb-3">📄 Documentação</h4>
                    <button type="button" onClick={() => openFile(selected.assinatura_url!, 'Contrato Assinado')} className="flex items-center justify-between w-full py-3 px-4 bg-white rounded-xl ring-1 ring-emerald-200 text-sm font-bold hover:bg-emerald-100 transition-all group">
                      <span className="flex items-center gap-2 text-emerald-700"><Download className="h-4 w-4" /> Contrato Assinado</span>
                      <ChevronRight className="h-4 w-4 text-emerald-300 group-hover:text-emerald-600 transition-all" />
                    </button>
                  </div>
                )}

                {/* Parcelas Geradas */}
                <div className="bg-white p-4 rounded-xl ring-1 ring-neutral-200">
                  <h4 className="text-xs font-black text-neutral-700 uppercase mb-3">💳 Parcelas do Empréstimo</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {parcelas.filter(p => p.emprestimo_id === selected.id).length === 0 ? (
                      <p className="text-xs text-neutral-400 text-center py-4">Nenhuma parcela gerada.</p>
                    ) : parcelas.filter(p => p.emprestimo_id === selected.id).map(p => (
                      <div key={p.id} onClick={() => setSelectedParcela(p)} className={`flex items-center justify-between p-3 rounded-xl ring-1 cursor-pointer hover:ring-indigo-300 transition-all ${p.status === 'paga' ? 'bg-emerald-50 ring-emerald-200' : p.status === 'vencida' ? 'bg-red-50 ring-red-200' : 'bg-neutral-50 ring-neutral-200'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[8px] font-black leading-none text-center ${p.status === 'paga' ? 'bg-emerald-100 text-emerald-700' : p.status === 'vencida' ? 'bg-red-100 text-red-700' : 'bg-neutral-200 text-neutral-600'}`}>
                            {p.numero_parcela === 0 ? 'QUITA' : p.numero_parcela}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-neutral-900">{p.numero_parcela === 0 ? 'QUITAÇÃO TOTAL' : `${p.numero_parcela}ª Parcela`}</p>
                            <p className="text-xs font-black text-indigo-600">{formatCurrency(p.valor)}</p>
                            <p className="text-[9px] text-neutral-400">Venc: {formatDate(p.data_vencimento)}</p>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${
                            p.status === 'paga' ? 'bg-emerald-100 text-emerald-700' : 
                            p.status === 'vencida' ? 'bg-red-100 text-red-700' : 
                            'bg-neutral-200 text-neutral-600'
                          }`}>
                            {p.status === 'paga' ? 'Paga' : 
                             p.status === 'vencida' ? 'Vencida' : 
                             'Pendente'}
                          </span>
                          
                          {(p as any).faturas?.cobrancas?.length > 0 && (
                            <span className="px-2 py-0.5 rounded border border-rose-500/30 text-[8px] font-black uppercase text-rose-600 bg-rose-50 flex items-center gap-1 animate-pulse">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              Em Cobrança
                            </span>
                          )}
                          {p.data_pagamento && (
                            <p className="text-[8px] text-neutral-500 font-bold mt-1">Pago: {formatDateTime(p.data_pagamento)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selected.status === 'ativo' && (
                  <button 
                    disabled={loadingPay}
                    onClick={solicitarQuitacao} 
                    className="w-full mt-4 py-3 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50 text-amber-600 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
                  >
                    {loadingPay ? 'Enviando solicitação...' : 'Solicitar Quitação Total Antecipada'}
                  </button>
                )}

                {selected.status === 'analise_quitacao' && (
                  <div className="bg-amber-50 p-4 rounded-xl ring-1 ring-amber-200 mt-4 text-center">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Solicitação em Análise</p>
                    <p className="text-xs font-bold text-amber-800">Sua solicitação de quitação foi enviada. O administrador retornará em até 5 dias úteis com o valor final com desconto.</p>
                  </div>
                )}

                {selected.status === 'aguardando_pagamento_quitacao' && (
                  <div className="bg-indigo-50 p-5 rounded-2xl ring-1 ring-indigo-200 mt-4 text-center">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Oferta de Quitação</p>
                    <p className="text-3xl font-black text-indigo-700">{formatCurrency(selected.valor_quitacao_acordo || 0)}</p>
                    <p className="text-xs text-indigo-500 mt-1 mb-4 font-medium">Este é o valor final acordado para quitação total do seu empréstimo.</p>
                    <div className="flex flex-col gap-2">
                      {parcelas.some(p => p.emprestimo_id === selected.id && p.numero_parcela === 0 && p.status !== 'paga') ? (
                        <button 
                          onClick={() => {
                            const p = parcelas.find(p => p.emprestimo_id === selected.id && p.numero_parcela === 0 && p.status !== 'paga');
                            if (p && p.fatura_id && onNavigate) onNavigate('financeiro', 'faturas', p.fatura_id);
                          }}
                          className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase text-[11px] tracking-widest hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                        >
                          <CreditCard className="h-4 w-4" />
                          Ir para Fatura
                        </button>
                      ) : (
                        <>
                          <button 
                            onClick={gerarFaturaQuitacao}
                            disabled={loadingPay}
                            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[11px] tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-600/20"
                          >
                            {loadingPay ? 'Gerando Fatura...' : '✅ Aceitar Oferta e Pagar'}
                          </button>
                          <button 
                            onClick={recusarOfertaQuitacao}
                            disabled={loadingPay}
                            className="w-full py-3 bg-white text-red-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-50 transition-all ring-1 ring-red-100"
                          >
                            ❌ Recusar Oferta
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fatura de Taxa */}
            {selected.fatura_taxa_id && ['analise_inicial', 'pendencia_documentos', 'analise_documentos', 'proposta_enviada', 'aguardando_pagamento_taxa', 'aprovado', 'analise_final'].includes(selected.status) && (
              <div className="bg-emerald-50 p-5 rounded-2xl ring-1 ring-emerald-200 mt-4 flex flex-col items-center justify-center space-y-3">
                <div className="text-center">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Ação Necessária</p>
                  <p className="text-xs font-bold text-emerald-800">A fatura da sua taxa de serviço já foi gerada. Efetue o pagamento para dar andamento.</p>
                </div>
                <button 
                  onClick={() => onNavigate && onNavigate('financeiro', 'faturas', selected.fatura_taxa_id)}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  Pagar Fatura de Taxa
                </button>
              </div>
            )}

            {/* Timeline */}
            {historico.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-black text-neutral-700 uppercase">📜 Histórico</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {historico.map(h => (
                    <div key={h.id} className="flex gap-3 text-xs bg-neutral-50 p-3 rounded-xl">
                      <div className="h-2 w-2 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                      <div><p className="font-bold text-neutral-700">{h.descricao}</p><p className="text-[10px] text-neutral-400 mt-0.5">{formatDate(h.created_at)} — {h.usuario_tipo}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Colapsável */}
            <div className="pt-4 border-t border-neutral-100">
              <button 
                onClick={() => setShowChat(!showChat)}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${showChat ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'}`}
              >
                <div className="flex items-center gap-2 font-black uppercase text-[10px] tracking-widest">
                  <MessageSquare className="h-4 w-4" />
                  {showChat ? 'Fechar Chat de Negociação' : 'Abrir Chat / Negociar'}
                </div>
                <ChevronRight className={`h-4 w-4 transition-transform duration-300 ${showChat ? 'rotate-90' : ''}`} />
              </button>

              {showChat && (
                <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2 max-h-60 overflow-y-auto bg-neutral-50 p-4 rounded-2xl ring-1 ring-neutral-200">
                    {comentarios.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 opacity-30">
                        <MessageSquare className="h-8 w-8 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma mensagem</p>
                      </div>
                    ) : comentarios.map(c => (
                      <div key={c.id} className={`flex ${c.autor_tipo === 'cliente' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-3 rounded-2xl text-xs max-w-[85%] ${c.autor_tipo === 'cliente' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white ring-1 ring-neutral-200 text-neutral-700 rounded-tl-none'}`}>
                          <p className="font-medium leading-relaxed">{c.mensagem}</p>
                          <p className={`text-[9px] mt-1 font-bold uppercase ${c.autor_tipo === 'cliente' ? 'text-indigo-200' : 'text-neutral-400'}`}>{formatDate(c.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 p-1 bg-neutral-50 rounded-2xl ring-1 ring-neutral-200 focus-within:ring-indigo-500 focus-within:bg-white transition-all">
                    <input 
                      value={newMsg} 
                      onChange={e => setNewMsg(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && sendMsg()} 
                      placeholder="Escreva sua mensagem aqui..." 
                      className="flex-1 bg-transparent border-none px-4 py-3 text-sm focus:ring-0 outline-none font-medium" 
                    />
                    <button 
                      onClick={sendMsg}
                      disabled={!newMsg.trim()}
                      className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all active:scale-90 disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Assinatura */}
      {showSign && selected && (
        <Modal isOpen={true} title="Assinar Contrato" onClose={() => setShowSign(false)} size="lg">
          <div className="space-y-4">
            {selected.contrato_url && (
              <iframe src={selected.contrato_url} className="w-full h-64 rounded-xl border" title="Contrato" />
            )}
            <div className="space-y-2">
              <p className="text-xs font-black text-neutral-700 uppercase">✍️ Assinatura do Cliente</p>
              <div className="bg-white rounded-xl ring-1 ring-neutral-300 overflow-hidden" style={{touchAction:'none'}}>
                <canvas ref={signCanvasRef} className="w-full" style={{height:'180px', width:'100%'}} />
              </div>
              <button onClick={() => signPadRef.current?.clear()} className="text-xs text-neutral-500 hover:text-red-500 font-bold">🗑️ Limpar</button>
            </div>
            <button onClick={finishSignature} className="w-full py-3 bg-[#1a1a1a] text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-black active:scale-95 transition-all">✅ Concluir Assinatura</button>
          </div>
        </Modal>
      )}

      {/* Modal Informativo - Pós Aceite */}
      {showAcceptInfo && (
        <Modal 
          isOpen={true} 
          title="Próximos Passos" 
          onClose={() => setShowAcceptInfo(false)} 
          size="md"
        >
          <div className="text-center space-y-6 py-4">
            <div className="h-16 w-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <Clock className="h-8 w-8" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-neutral-900">Proposta em Análise Final</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Parabéns! Sua proposta foi aceita com sucesso. Agora, nossa equipe fará uma <strong className="text-indigo-600">análise final</strong> dos dados.
              </p>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Em até <strong className="text-neutral-900">5 dias úteis</strong>, você receberá o contrato digital para assinatura diretamente aqui no seu portal.
              </p>
            </div>

            <button 
              onClick={() => setShowAcceptInfo(false)}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
            >
              Entendi, obrigado!
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Parcela Detalhes */}
      {selectedParcela && (
        <Modal 
          isOpen={true} 
          title={`Detalhes da Parcela ${selectedParcela.numero_parcela}`} 
          onClose={() => setSelectedParcela(null)} 
          size="md"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-50 p-4 rounded-xl">
                <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Valor</p>
                <p className="text-xl font-black text-neutral-900">{formatCurrency(selectedParcela.valor)}</p>
              </div>
              <div className="bg-neutral-50 p-4 rounded-xl">
                <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Vencimento</p>
                <p className="text-sm font-bold text-neutral-700">{formatDate(selectedParcela.data_vencimento)}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl ring-1 ring-neutral-200">
               <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Status</p>
               <div className="flex items-center justify-between">
                 <span className={`px-3 py-1 inline-block rounded-lg text-xs font-black uppercase ${selectedParcela.status === 'paga' ? 'bg-emerald-100 text-emerald-700' : selectedParcela.status === 'vencida' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                   {selectedParcela.status === 'paga' ? 'Paga' : selectedParcela.status === 'vencida' ? 'Vencida' : 'Pendente'}
                 </span>
                 {selectedParcela.data_pagamento && (
                   <p className="text-xs font-bold text-neutral-500">
                     Pago em: <span className="text-neutral-900">{formatDateTime(selectedParcela.data_pagamento)}</span>
                   </p>
                 )}
               </div>
            </div>

            {selectedParcela.status !== 'paga' && (
              <button 
                disabled={loadingPay}
                onClick={async () => {
                  setLoadingPay(true);
                  try {
                    let faturaId = selectedParcela.fatura_id;
                    if (!faturaId) {
                      const data = await callClientRpc<any>('gsa_client_generate_loan_installment_invoice', {
                        p_parcela_id: selectedParcela.id,
                      });
                      if (!data?.success) {
                        throw new Error('Erro ao gerar fatura da parcela.');
                      }
                      faturaId = data.fatura_id;
                    }
                    
                    setSelectedParcela(null);
                    if (onNavigate) {
                      onNavigate('financeiro', 'faturas', faturaId);
                    } else {
                      window.location.href = `/?module=financeiro&tab=faturas&item=${faturaId}`;
                    }
                    toast.success('Fatura pronta para pagamento!');
                  } catch (error) {
                    toast.error('Erro ao gerar pagamento da parcela.');
                    console.error(error);
                  } finally {
                    setLoadingPay(false);
                  }
                }}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
              >
                {loadingPay ? 'Gerando...' : '💰 Pagar Parcela'}
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Modal Nova Solicitação de Empréstimo */}
      {showSolicitarModal && (
        <Modal
          isOpen={true}
          title="Nova Solicitação de Empréstimo"
          onClose={() => { setShowSolicitarModal(false); setSolicitarStep(1); }}
          size="lg"
        >
          <div className="space-y-6">
            {/* Stepper */}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    solicitarStep >= s ? 'bg-indigo-600 text-white shadow-lg ring-4 ring-indigo-50' : 'bg-neutral-100 text-neutral-400'
                  }`}>{s}</div>
                  {s < 4 && <div className={`h-1 w-8 sm:w-12 rounded-full transition-all ${solicitarStep > s ? 'bg-indigo-600' : 'bg-neutral-100'}`} />}
                </div>
              ))}
            </div>

            {/* Steps */}
            <div className="min-h-[380px]">
              {solicitarStep === 1 && (
                <div className="space-y-4">
                  {hasPendingEditTicket && (
                    <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 flex items-start gap-3 animate-in slide-in-from-top-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-amber-900">Alteração Cadastral em Andamento</p>
                        <p className="text-xs text-amber-700 mt-1 leading-relaxed">Você possui um ticket de suporte aberto para alteração de dados. <strong className="font-black">Aguarde a conclusão do chamado pela nossa equipe para poder prosseguir</strong> com sua solicitação de empréstimo.</p>
                      </div>
                    </div>
                  )}
                  <StepDadosPessoais 
                    dados={dadosPessoais} 
                    setDados={setDadosPessoais} 
                    onRequestEditField={(label, val) => { setEditFieldInfo({label, currentValue: val}); setNewFieldValue(''); }}
                  />
                </div>
              )}
              {solicitarStep === 2 && <StepValorCondicoes dados={dadosEmprestimo} setDados={setDadosEmprestimo} />}
              {solicitarStep === 3 && <StepDocumentos docs={docFiles} setDocs={setDocFiles} />}
              {solicitarStep === 4 && <StepConfirmacao pessoais={dadosPessoais} emprestimo={dadosEmprestimo} docs={docFiles} />}
            </div>

            {/* Navegação */}
            <div className="flex gap-3 pt-2 border-t border-neutral-100">
              {solicitarStep > 1 && (
                <button
                  onClick={() => setSolicitarStep(s => s - 1)}
                  className="flex items-center gap-2 rounded-xl bg-neutral-100 px-4 py-3 text-sm font-bold text-neutral-600 hover:bg-neutral-200 transition-all"
                >
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </button>
              )}
              {solicitarStep < 4 ? (
                <button
                  disabled={solicitarStep === 1 && hasPendingEditTicket}
                  onClick={() => {
                    // Validação básica por etapa
                    if (solicitarStep === 1) {
                      if (!dadosPessoais.nome_completo || !dadosPessoais.cpf || !dadosPessoais.telefone || !dadosPessoais.cep || !dadosPessoais.data_nascimento || !dadosPessoais.rg) {
                        toast.error('Preencha todos os campos obrigatórios, incluindo RG e Data de Nascimento.'); return;
                      }
                    }
                    if (solicitarStep === 2) {
                      if (!dadosEmprestimo.valor_desejado || !dadosEmprestimo.parcelas_desejadas) {
                        toast.error('Preencha o valor e a quantidade de parcelas.'); return;
                      }
                    }
                    setSolicitarStep(s => s + 1);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Próximo <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleFinishEmprestimo}
                  disabled={isSolicitando}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#1a1a1a] py-3 text-sm font-bold text-white shadow-lg hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSolicitando ? 'Enviando...' : '✅ Enviar Solicitação'}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Ticket de Alteração Cadastral */}
      {editFieldInfo && (
        <Modal isOpen={true} title="Solicitar Alteração Cadastral" onClose={() => setEditFieldInfo(null)} size="md">
          <div className="space-y-5">
            <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200 shadow-sm">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Campo que será alterado</p>
              <p className="text-lg font-black text-indigo-600">{editFieldInfo.label}</p>
              
              <div className="mt-4 pt-4 border-t border-neutral-200">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Valor Atual Cadastrado</p>
                <p className="text-sm text-neutral-600 font-medium">{editFieldInfo.currentValue || '(Não informado)'}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-widest pl-1">Novo Valor Desejado <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={newFieldValue} 
                onChange={e => setNewFieldValue(e.target.value)} 
                placeholder={`Digite o novo ${editFieldInfo.label.toLowerCase()}`}
                className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
              />
            </div>

            <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-100 flex gap-3">
              <Info className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed font-medium">Ao enviar, um ticket será aberto para a equipe de suporte. <strong className="font-black text-amber-900">A sua solicitação de empréstimo ficará bloqueada</strong> até a conclusão da alteração pelos administradores.</p>
            </div>

            <div className="pt-2">
              <button 
                onClick={handleSubmitEditTicket}
                disabled={isSubmittingTicket}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-600/20"
              >
                {isSubmittingTicket ? 'Enviando...' : 'Enviar Solicitação de Alteração'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
