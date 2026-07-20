import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Receipt, FileText, CheckCircle, XCircle, Clock, Upload,
  Search, Eye, Printer, X, Download, FileUp, Calendar,
  TrendingUp, AlertCircle, ChevronDown, Filter, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { OrdemFiscal } from '../../types';
import { Modal } from '../ui/Modal';
import { formatCurrency, formatDate, formatDateTime, generateCode } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { logService } from '../../lib/logService';
import { notificationService } from '../../lib/notificationService';
import { whatsappNotificationService } from '../../lib/whatsappNotificationService';
import { AdminWhatsAppButton } from './ui/AdminWhatsAppButton';

const EMISSAO_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente_emissao: { label: 'Pendente Emissão', color: 'bg-amber-100 text-amber-700 ring-amber-200', icon: <Clock className="h-3 w-3" /> },
  emitida:          { label: 'Emitida',           color: 'bg-emerald-100 text-emerald-700 ring-emerald-200', icon: <CheckCircle className="h-3 w-3" /> },
  cancelada:        { label: 'Cancelada',         color: 'bg-red-100 text-red-700 ring-red-200',     icon: <XCircle className="h-3 w-3" /> },
  inutilizada:      { label: 'Inutilizada',       color: 'bg-neutral-100 text-neutral-500 ring-neutral-200', icon: <XCircle className="h-3 w-3" /> },
};

const PAGAMENTO_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendente:  { label: 'Pendente', color: 'bg-amber-50 text-amber-700' },
  pago:      { label: 'Pago',     color: 'bg-emerald-50 text-emerald-700' },
  cancelado: { label: 'Cancelado',color: 'bg-red-50 text-red-700' },
};

const TIPO_COMPRA_LABEL: Record<string, string> = {
  servico:    'Serviço',
  produto:    'Produto',
  assinatura: 'Assinatura',
};

export function FiscalModule({ initialItemId, colaboradorId, colaboradorNome }: { initialItemId?: string, colaboradorId?: string, colaboradorNome?: string }) {
  const [ordens, setOrdens] = useState<OrdemFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({ mes: '', ano: '', status_emissao: '', status_pagamento: '' });
  const [activeTab, setActiveTab] = useState<'pendentes' | 'emitidas' | 'canceladas' | 'todas'>('pendentes');
  const [selectedOrdem, setSelectedOrdem] = useState<OrdemFiscal | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEmissaoModalOpen, setIsEmissaoModalOpen] = useState(false);
  const [uploadFilePDF, setUploadFilePDF] = useState<File | null>(null);
  const [uploadFileXML, setUploadFileXML] = useState<File | null>(null);
  const [numeroNota, setNumeroNota] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [emissaoStatus, setEmissaoStatus] = useState<string>('emitida');
  const [cancelNote, setCancelNote] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const hasAutoOpened = useRef<string | null>(null);

  useEffect(() => {
    if (initialItemId && ordens.length > 0 && hasAutoOpened.current !== initialItemId) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`fiscal-${initialItemId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedId(initialItemId);
          
          // Abrir modal automaticamente
          const ordem = ordens.find(o => o.id === initialItemId);
          if (ordem) {
            setSelectedOrdem(ordem);
            setIsDetailOpen(true);
            hasAutoOpened.current = initialItemId;
          }

          setTimeout(() => setHighlightedId(null), 3000);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initialItemId, ordens]);

  // Stats
  const [stats, setStats] = useState({ total: 0, pendentes: 0, emitidas: 0, valorTotal: 0 });

  useEffect(() => {
    fetchOrdens();

    const channel = supabase
      .channel('admin-fiscal-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_fiscais' }, () => {
        fetchOrdens();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [search, filters, activeTab]);

  const fetchOrdens = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('ordens_fiscais')
        .select('*')
        .order('created_at', { ascending: false });

      // Tab filter
      if (activeTab === 'pendentes')  query = query.eq('status_emissao', 'pendente_emissao');
      if (activeTab === 'emitidas')   query = query.eq('status_emissao', 'emitida');
      if (activeTab === 'canceladas') query = query.in('status_emissao', ['cancelada', 'inutilizada']);

      // Search
      if (search) {
        query = query.or(`codigo_fiscal.ilike.%${search}%,cliente_nome.ilike.%${search}%,descricao_item.ilike.%${search}%`);
      }

      // Date filter
      if (filters.mes && filters.ano) {
        const startDate = `${filters.ano}-${filters.mes}-01`;
        const endDate = new Date(Number(filters.ano), Number(filters.mes), 0).toISOString().split('T')[0];
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      }

      if (filters.status_emissao)   query = query.eq('status_emissao', filters.status_emissao);
      if (filters.status_pagamento) query = query.eq('status_pagamento', filters.status_pagamento);

      const { data, error } = await query;
      if (error) throw error;

      setOrdens(data || []);

      // Update stats
      const all = data || [];
      setStats({
        total: all.length,
        pendentes: all.filter(o => o.status_emissao === 'pendente_emissao').length,
        emitidas: all.filter(o => o.status_emissao === 'emitida').length,
        valorTotal: all.reduce((acc, o) => acc + (Number(o.valor_total) || 0), 0),
      });
    } catch (err) {
      console.error('Erro ao buscar ordens fiscais:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = (ordem: OrdemFiscal) => {
    setSelectedOrdem(ordem);
    setIsDetailOpen(true);
  };

  const handleOpenUpload = (ordem: OrdemFiscal) => {
    setSelectedOrdem(ordem);
    setNumeroNota(ordem.numero_nota || '');
    setUploadFilePDF(null);
    setUploadFileXML(null);
    setIsUploadOpen(true);
  };

  const handleUploadNF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrdem) return;
    setIsUploading(true);

    try {
      let pdfUrl = selectedOrdem.arquivo_nf_url || '';
      let xmlUrl = selectedOrdem.arquivo_nf_xml_url || '';

      if (uploadFilePDF) {
        const path = `fiscal/${selectedOrdem.id}/nota_fiscal.pdf`;
        const { error: upErr } = await supabase.storage.from('fiscal_docs').upload(path, uploadFilePDF, { upsert: true });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('fiscal_docs').getPublicUrl(path);
        pdfUrl = publicUrl;
      }

      if (uploadFileXML) {
        const path = `fiscal/${selectedOrdem.id}/nota_fiscal.xml`;
        const { error: upErr } = await supabase.storage.from('fiscal_docs').upload(path, uploadFileXML, { upsert: true });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('fiscal_docs').getPublicUrl(path);
        xmlUrl = publicUrl;
      }

      const { error } = await supabase
        .from('ordens_fiscais')
        .update({
          arquivo_nf_url: pdfUrl || null,
          arquivo_nf_xml_url: xmlUrl || null,
          numero_nota: numeroNota || null,
          status_emissao: 'emitida',
          data_emissao: new Date().toISOString(),
          observacoes: `${selectedOrdem.observacoes ? selectedOrdem.observacoes + ' | ' : ''}Nota fiscal anexada em ${formatDate(new Date())} ${colaboradorNome ? `[POR: ${colaboradorNome}]` : ''}`,
        })
        .eq('id', selectedOrdem.id);

      if (error) throw error;

      if (selectedOrdem.cliente_id) {
        await notificationService.notifyClient(
          selectedOrdem.cliente_id,
          '📄 Nota Fiscal Disponível',
          `A nota fiscal da sua ordem ${selectedOrdem.codigo_fiscal} já está disponível para visualização e download.`,
          'financeiro',
          'nf_emitida',
          { tab: 'nf', itemId: selectedOrdem.id }
        );
      }

      toast.success('Nota fiscal anexada e marcada como emitida!');
      setIsUploadOpen(false);
      setIsDetailOpen(false);

      // Log Action
      await logService.logAction({
        acao: 'ANEXAR_NOTA_FISCAL',
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_id: colaboradorId || undefined,
        ator_nome: colaboradorNome || 'Administrador',
        detalhes: `Anexou nota fiscal ${numeroNota} à ordem fiscal ${selectedOrdem.codigo_fiscal}`
      });

      fetchOrdens();
    } catch (err: any) {
      console.error('Erro ao fazer upload da NF:', err);
      toast.error(err.message || 'Erro ao anexar nota fiscal.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleChangeEmissaoStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrdem) return;

    try {
      const updateData: any = { status_emissao: emissaoStatus };
      if (emissaoStatus === 'cancelada' || emissaoStatus === 'inutilizada') {
        const auditTag = colaboradorNome ? ` [POR: ${colaboradorNome}]` : '';
        updateData.observacoes = cancelNote ? `${selectedOrdem.observacoes ? selectedOrdem.observacoes + ' | ' : ''}${cancelNote}${auditTag}` : `${selectedOrdem.observacoes ? selectedOrdem.observacoes + ' | ' : ''}Status alterado para ${emissaoStatus}${auditTag}`;
      } else {
        const auditTag = colaboradorNome ? ` [POR: ${colaboradorNome}]` : '';
        updateData.observacoes = `${selectedOrdem.observacoes ? selectedOrdem.observacoes + ' | ' : ''}Status alterado para ${emissaoStatus}${auditTag}`;
      }

      const { error } = await supabase
        .from('ordens_fiscais')
        .update(updateData)
        .eq('id', selectedOrdem.id);

      if (error) throw error;

      if (selectedOrdem.cliente_id) {
        await notificationService.notifyClient(
          selectedOrdem.cliente_id,
          '📄 Status da Nota Fiscal Atualizado',
          `A nota fiscal da sua ordem ${selectedOrdem.codigo_fiscal} agora está com status: ${EMISSAO_STATUS_CONFIG[emissaoStatus]?.label || emissaoStatus}.`,
          'financeiro',
          'nf_atualizada',
          { tab: 'nf', itemId: selectedOrdem.id }
        );
      }

      toast.success('Status de emissão atualizado!');
      setIsEmissaoModalOpen(false);
      setIsDetailOpen(false);
      setCancelNote('');

      // Log Action
      await logService.logAction({
        acao: 'ALTERAR_STATUS_EMISSAO_FISCAL',
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_id: colaboradorId || undefined,
        ator_nome: colaboradorNome || 'Administrador',
        detalhes: `Alterou status de emissão da ordem ${selectedOrdem.codigo_fiscal} para ${emissaoStatus}`
      });

      fetchOrdens();
    } catch (err: any) {
      toast.error('Erro ao atualizar status.');
    }
  };

  const handleDeleteOrdem = async () => {
    if (!selectedOrdem) return;
    if (!window.confirm('ATENÇÃO: Tem certeza que deseja excluir DEIFINITIVAMENTE esta ordem fiscal?')) return;

    try {
      const { error } = await supabase
        .from('ordens_fiscais')
        .delete()
        .eq('id', selectedOrdem.id);

      if (error) throw error;

      toast.success('Ordem fiscal excluída com sucesso!');
      setIsDetailOpen(false);

      // Log Action
      await logService.logAction({
        acao: 'EXCLUIR_ORDEM_FISCAL',
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_id: colaboradorId || undefined,
        ator_nome: colaboradorNome || 'Administrador',
        detalhes: `Excluiu permanentemente a ordem fiscal ${selectedOrdem.codigo_fiscal}`
      });

      fetchOrdens();
    } catch (err: any) {
      console.error('Erro ao excluir:', err);
      toast.error('Ocorreu um erro ao excluir a ordem.');
    }
  };

  const handlePrintReceipt = () => {
    if (!selectedOrdem) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Recibo Fiscal — ${selectedOrdem.codigo_fiscal}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 40px; color: #111; background: #fff; }
          .header { border-bottom: 3px solid #111; padding-bottom: 20px; margin-bottom: 24px; }
          .title { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase; }
          .subtitle { font-size: 11px; color: #666; letter-spacing: 2px; text-transform: uppercase; font-weight: 700; margin-top: 4px; }
          .code { font-size: 13px; font-weight: 700; color: #4f46e5; margin-top: 8px; }
          .section { margin-bottom: 24px; }
          .section-title { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #666; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
          .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f5f5f5; }
          .row label { font-size: 12px; color: #555; font-weight: 600; }
          .row span { font-size: 12px; font-weight: 700; color: #111; }
          .total-row { display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid #111; margin-top: 8px; }
          .total-row label { font-size: 14px; font-weight: 900; }
          .total-row span { font-size: 18px; font-weight: 900; color: #4f46e5; }
          .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
          .badge-pago { background: #d1fae5; color: #065f46; }
          .badge-pendente { background: #fef3c7; color: #92400e; }
          .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #999; letter-spacing: 1px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Recibo Fiscal</div>
          <div class="subtitle">Grupo GSA — Gestão de Serviços</div>
          <div class="code">${selectedOrdem.codigo_fiscal}</div>
        </div>

        <div class="section">
          <div class="section-title">Dados do Cliente</div>
          <div class="row"><label>Nome</label><span>${selectedOrdem.cliente_nome || '—'}</span></div>
          <div class="row"><label>CPF / CNPJ</label><span>${selectedOrdem.cliente_documento || '—'}</span></div>
          <div class="row"><label>Telefone</label><span>${selectedOrdem.cliente_telefone || '—'}</span></div>
          ${selectedOrdem.cliente_email ? `<div class="row"><label>Email</label><span>${selectedOrdem.cliente_email}</span></div>` : ''}
        </div>

        <div class="section">
          <div class="section-title">Detalhes da Compra</div>
          <div class="row"><label>Tipo</label><span>${TIPO_COMPRA_LABEL[selectedOrdem.tipo_compra || ''] || '—'}</span></div>
          <div class="row"><label>Descrição</label><span>${selectedOrdem.descricao_item || '—'}</span></div>
          ${selectedOrdem.codigo_ordem ? `<div class="row"><label>Código da Ordem</label><span>${selectedOrdem.codigo_ordem}</span></div>` : ''}
          ${selectedOrdem.codigo_orcamento ? `<div class="row"><label>Código do Orçamento</label><span>${selectedOrdem.codigo_orcamento}</span></div>` : ''}
        </div>

        <div class="section">
          <div class="section-title">Valores</div>
          <div class="row"><label>Valor Bruto</label><span>R$ ${Number(selectedOrdem.valor_bruto).toFixed(2).replace('.', ',')}</span></div>
          ${Number(selectedOrdem.valor_desconto) > 0 ? `<div class="row"><label>Desconto</label><span>- R$ ${Number(selectedOrdem.valor_desconto).toFixed(2).replace('.', ',')}</span></div>` : ''}
          ${Number(selectedOrdem.valor_acrescimo) > 0 ? `<div class="row"><label>Acréscimo</label><span>+ R$ ${Number(selectedOrdem.valor_acrescimo).toFixed(2).replace('.', ',')}</span></div>` : ''}
          <div class="total-row"><label>Total</label><span>R$ ${Number(selectedOrdem.valor_total).toFixed(2).replace('.', ',')}</span></div>
        </div>

        <div class="section">
          <div class="section-title">Pagamento</div>
          <div class="row"><label>Status</label><span class="badge ${selectedOrdem.status_pagamento === 'pago' ? 'badge-pago' : 'badge-pendente'}">${selectedOrdem.status_pagamento === 'pago' ? 'Pago' : 'Pendente'}</span></div>
          ${selectedOrdem.forma_pagamento ? `<div class="row"><label>Forma de Pagamento</label><span>${selectedOrdem.forma_pagamento.toUpperCase()}</span></div>` : ''}
          ${selectedOrdem.data_pagamento ? `<div class="row"><label>Data do Pagamento</label><span>${formatDate(selectedOrdem.data_pagamento)}</span></div>` : ''}
        </div>

        <div class="section">
          <div class="section-title">Nota Fiscal</div>
          <div class="row"><label>Status de Emissão</label><span>${EMISSAO_STATUS_CONFIG[selectedOrdem.status_emissao]?.label || '—'}</span></div>
          ${selectedOrdem.numero_nota ? `<div class="row"><label>Número da NF</label><span>${selectedOrdem.numero_nota}</span></div>` : ''}
          ${selectedOrdem.data_emissao ? `<div class="row"><label>Data de Emissão</label><span>${formatDate(selectedOrdem.data_emissao)}</span></div>` : ''}
        </div>

        <div class="footer">
          Gerado em ${formatDate(new Date())} • Sistema GSA Gestão de Serviços
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  // ── TABS ──────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'pendentes',  label: 'Pendentes Emissão' },
    { id: 'emitidas',   label: 'Emitidas' },
    { id: 'canceladas', label: 'Canceladas' },
    { id: 'todas',      label: 'Todas' },
  ] as const;

  const FILTER_OPTIONS = [
    {
      id: 'status_pagamento',
      label: 'Status Pagamento',
      type: 'select' as const,
      options: [
        { value: 'pendente',  label: 'Pendente' },
        { value: 'pago',      label: 'Pago' },
        { value: 'cancelado', label: 'Cancelado' },
      ],
    },
    {
      id: 'mes',
      label: 'Mês',
      type: 'select' as const,
      options: Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1).padStart(2, '0'),
        label: new Date(2000, i).toLocaleString('pt-BR', { month: 'long' }),
      })),
    },
    {
      id: 'ano',
      label: 'Ano',
      type: 'select' as const,
      options: [2024, 2025, 2026, 2027].map(y => ({ value: String(y), label: String(y) })),
    },
  ];

  const handlePrimaryEmitNF = () => {
    const ordemParaEmitir = ordens.find(o => o.status_emissao === 'pendente_emissao') || ordens[0];

    if (!ordemParaEmitir) {
      toast.error('Nenhuma ordem fiscal disponivel para emissao. Gere a ordem fiscal a partir de uma fatura primeiro.');
      return;
    }

    handleOpenUpload(ordemParaEmitir);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* ── MODULE HEADER ── */}
      <div className="bg-[#1a1a1a] p-3 md:p-4 rounded-[2rem] md:rounded-[2.5rem] text-white relative shadow-2xl mb-3">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex flex-row items-center justify-between gap-6 border-b border-white/5 pb-3">
            <div className="flex items-center gap-4">
              <div className="h-6 w-1 bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.6)]" />
              <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-black tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-neutral-100 to-neutral-400">
                Módulo Fiscal
              </h1>
            </div>
            <Receipt className="hidden md:block h-8 w-8 text-white/5" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total de Ordens', value: stats.total, color: 'text-white' },
              { label: 'Pendentes Emissão', value: stats.pendentes, color: 'text-amber-400' },
              { label: 'Emitidas', value: stats.emitidas, color: 'text-emerald-400' },
              { label: 'Valor Total', value: formatCurrency(stats.valorTotal), color: 'text-indigo-400', isCurrency: true },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/5 rounded-2xl px-4 py-3 ring-1 ring-white/5">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/40">{stat.label}</p>
                <p className={`text-xl font-black mt-1 ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-xl px-5 py-2.5 text-[11px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? 'bg-[#1a1a1a] text-white shadow-lg'
                : 'bg-white text-neutral-500 ring-1 ring-neutral-200 hover:ring-neutral-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── FILTERS ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar por código, cliente ou serviço…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-2xl bg-white ring-1 ring-neutral-200 py-3 pl-11 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mês */}
          <select
            value={filters.mes}
            onChange={e => setFilters(f => ({ ...f, mes: e.target.value }))}
            className="rounded-2xl bg-white ring-1 ring-neutral-200 py-2.5 px-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          >
            <option value="">Todos os Meses</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={String(i + 1).padStart(2, '0')}>
                {new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}
              </option>
            ))}
          </select>
          {/* Ano */}
          <select
            value={filters.ano}
            onChange={e => setFilters(f => ({ ...f, ano: e.target.value }))}
            className="rounded-2xl bg-white ring-1 ring-neutral-200 py-2.5 px-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          >
            <option value="">Todos os Anos</option>
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
          {/* Status Pagamento */}
          <select
            value={filters.status_pagamento}
            onChange={e => setFilters(f => ({ ...f, status_pagamento: e.target.value }))}
            className="rounded-2xl bg-white ring-1 ring-neutral-200 py-2.5 px-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          >
            <option value="">Todos Pgtos.</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="cancelado">Cancelado</option>
          </select>
          {/* Clear filters */}
          {(search || filters.mes || filters.ano || filters.status_pagamento) && (
            <button
              onClick={() => { setSearch(''); setFilters({ mes: '', ano: '', status_emissao: '', status_pagamento: '' }); }}
              className="rounded-2xl bg-neutral-100 py-2.5 px-4 text-xs font-bold text-neutral-500 hover:bg-neutral-200 transition-all"
            >
              Limpar
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handlePrimaryEmitNF}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 sm:w-auto"
        >
          <FileUp className="h-4 w-4" />
          Emitir NF
        </button>
      </div>


      {/* ── TABLE ── */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-neutral-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80">
                {['Código Fiscal', 'Cliente', 'Tipo / Serviço', 'Valor Total', 'Pagamento', 'Emissão NF', 'Ações'].map(h => (
                  <th key={h} className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto" />
                  </td>
                </tr>
              ) : ordens.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-neutral-50 flex items-center justify-center">
                        <Receipt className="h-8 w-8 text-neutral-200" />
                      </div>
                      <p className="text-sm font-medium text-neutral-400">Nenhuma ordem fiscal encontrada.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                ordens.map((ordem) => {
                  const emissao = EMISSAO_STATUS_CONFIG[ordem.status_emissao];
                  const pagamento = PAGAMENTO_STATUS_CONFIG[ordem.status_pagamento];
                  return (
                    <tr 
                      key={ordem.id} 
                      id={`fiscal-${ordem.id}`}
                      className={`group transition-all duration-300 ${
                        highlightedId === ordem.id 
                          ? 'bg-indigo-50/80 ring-2 ring-indigo-500 z-10' 
                          : 'hover:bg-neutral-50/60'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-indigo-600">{ordem.codigo_fiscal}</span>
                        <p className="text-[10px] text-neutral-400 mt-0.5">{formatDate(ordem.created_at)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-neutral-900">{ordem.cliente_nome || '—'}</p>
                        <p className="text-[10px] text-neutral-400">{ordem.cliente_documento || ''}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-neutral-700">{TIPO_COMPRA_LABEL[ordem.tipo_compra || ''] || '—'}</p>
                        <p className="text-[10px] text-neutral-400 truncate max-w-[160px]">{ordem.descricao_item || '—'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-black text-neutral-900">{formatCurrency(ordem.valor_total)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${pagamento.color}`}>
                          {pagamento.label}
                        </span>
                        {ordem.forma_pagamento && (
                          <p className="text-[10px] text-neutral-400 mt-1 uppercase">{ordem.forma_pagamento}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ${emissao.color}`}>
                          {emissao.icon}
                          {emissao.label}
                        </span>
                        {ordem.numero_nota && (
                          <p className="text-[10px] text-neutral-400 mt-1">NF {ordem.numero_nota}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenDetail(ordem)}
                            title="Ver detalhes"
                            className="h-8 w-8 flex items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 hover:bg-[#1a1a1a] hover:text-white transition-all"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenUpload(ordem)}
                            title="Anexar nota fiscal"
                            className="h-8 w-8 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-500 hover:bg-indigo-600 hover:text-white transition-all"
                          >
                            <FileUp className="h-3.5 w-3.5" />
                          </button>
                          {ordem.cliente_telefone && (
                            <div className="scale-[0.8] origin-left opacity-70 hover:opacity-100 transition-all ml-1">
                              <AdminWhatsAppButton
                                telefone={ordem.cliente_telefone}
                                mensagem={whatsappNotificationService.gerarMensagemWhatsApp({
                                  tipo: 'fiscal',
                                  clienteNome: ordem.cliente_nome,
                                  codigo: `NF-e ${ordem.numero_nota || 'Pendente'}`,
                                  valorTotal: formatCurrency(ordem.valor)
                                })}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DETAIL MODAL ── */}
      <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="Ordem Fiscal — Detalhes" size="xl">
        {selectedOrdem && (
          <div className="space-y-6">
            {/* Header info strip */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-50 ring-1 ring-neutral-200">
              <div>
                <p className="font-mono text-lg font-black text-indigo-600">{selectedOrdem.codigo_fiscal}</p>
                <p className="text-xs text-neutral-400 mt-0.5">Criado em {formatDateTime(selectedOrdem.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ring-1 ${EMISSAO_STATUS_CONFIG[selectedOrdem.status_emissao]?.color}`}>
                  {EMISSAO_STATUS_CONFIG[selectedOrdem.status_emissao]?.icon}
                  {EMISSAO_STATUS_CONFIG[selectedOrdem.status_emissao]?.label}
                </span>
                <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${PAGAMENTO_STATUS_CONFIG[selectedOrdem.status_pagamento]?.color}`}>
                  {PAGAMENTO_STATUS_CONFIG[selectedOrdem.status_pagamento]?.label}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cliente */}
              <div className="space-y-1">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">Dados do Cliente</p>
                <div className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200 space-y-2">
                  {[
                    { l: 'Nome', v: selectedOrdem.cliente_nome },
                    { l: 'CPF / CNPJ', v: selectedOrdem.cliente_documento },
                    { l: 'Telefone', v: selectedOrdem.cliente_telefone },
                    { l: 'Email', v: selectedOrdem.cliente_email },
                  ].filter(r => r.v).map(row => (
                    <div key={row.l} className="flex justify-between items-center py-1 border-b border-neutral-100 last:border-0">
                      <span className="text-xs text-neutral-500 font-medium">{row.l}</span>
                      <span className="text-xs font-bold text-neutral-900">{row.v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compra */}
              <div className="space-y-1">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">Detalhes da Compra</p>
                <div className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200 space-y-2">
                  {[
                    { l: 'Tipo', v: TIPO_COMPRA_LABEL[selectedOrdem.tipo_compra || ''] },
                    { l: 'Serviço/Produto', v: selectedOrdem.descricao_item },
                    { l: 'Código da Ordem', v: selectedOrdem.codigo_ordem },
                    { l: 'Código do Orçamento', v: selectedOrdem.codigo_orcamento },
                  ].filter(r => r.v).map(row => (
                    <div key={row.l} className="flex justify-between items-center py-1 border-b border-neutral-100 last:border-0">
                      <span className="text-xs text-neutral-500 font-medium">{row.l}</span>
                      <span className="text-xs font-bold text-neutral-900">{row.v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Valores */}
              <div className="space-y-1">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">Valores</p>
                <div className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200 space-y-2">
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="text-xs text-neutral-500 font-medium">Valor Bruto</span>
                    <span className="text-xs font-bold">{formatCurrency(selectedOrdem.valor_bruto)}</span>
                  </div>
                  {Number(selectedOrdem.valor_desconto) > 0 && (
                    <div className="flex justify-between py-1 border-b border-neutral-100">
                      <span className="text-xs text-neutral-500">Desconto</span>
                      <span className="text-xs font-bold text-emerald-600">- {formatCurrency(selectedOrdem.valor_desconto)}</span>
                    </div>
                  )}
                  {Number(selectedOrdem.valor_acrescimo) > 0 && (
                    <div className="flex justify-between py-1 border-b border-neutral-100">
                      <span className="text-xs text-neutral-500">Acréscimo</span>
                      <span className="text-xs font-bold text-amber-600">+ {formatCurrency(selectedOrdem.valor_acrescimo)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 mt-1 border-t-2 border-neutral-200">
                    <span className="text-sm font-black text-neutral-900">Total</span>
                    <span className="text-sm font-black text-indigo-600">{formatCurrency(selectedOrdem.valor_total)}</span>
                  </div>
                </div>
              </div>

              {/* Pagamento e NF */}
              <div className="space-y-1">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">Pagamento & Nota Fiscal</p>
                <div className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200 space-y-2">
                  {[
                    { l: 'Status Pgto.', v: PAGAMENTO_STATUS_CONFIG[selectedOrdem.status_pagamento]?.label },
                    { l: 'Forma de Pgto.', v: selectedOrdem.forma_pagamento?.toUpperCase() },
                    { l: 'Data do Pgto.', v: selectedOrdem.data_pagamento ? formatDate(selectedOrdem.data_pagamento) : null },
                    { l: 'Status Emissão', v: EMISSAO_STATUS_CONFIG[selectedOrdem.status_emissao]?.label },
                    { l: 'Número da NF', v: selectedOrdem.numero_nota },
                    { l: 'Data de Emissão', v: selectedOrdem.data_emissao ? formatDate(selectedOrdem.data_emissao) : null },
                  ].filter(r => r.v).map(row => (
                    <div key={row.l} className="flex justify-between items-center py-1 border-b border-neutral-100 last:border-0">
                      <span className="text-xs text-neutral-500 font-medium">{row.l}</span>
                      <span className="text-xs font-bold text-neutral-900">{row.v}</span>
                    </div>
                  ))}
                </div>

                {/* NF Files */}
                {(selectedOrdem.arquivo_nf_url || selectedOrdem.arquivo_nf_xml_url) && (
                  <div className="flex gap-2 mt-2">
                    {selectedOrdem.arquivo_nf_url && (
                      <a href={selectedOrdem.arquivo_nf_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-100 transition-all">
                        <Download className="h-3 w-3" /> PDF da NF
                      </a>
                    )}
                    {selectedOrdem.arquivo_nf_xml_url && (
                      <a href={selectedOrdem.arquivo_nf_xml_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-100 transition-all">
                        <Download className="h-3 w-3" /> XML da NF
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Observations */}
            {selectedOrdem.observacoes && (
              <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Observações</p>
                <p className="text-xs text-neutral-700">{selectedOrdem.observacoes}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap justify-between gap-3 pt-4 border-t border-neutral-100 w-full">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handlePrintReceipt}
                  className="flex items-center gap-2 rounded-2xl bg-neutral-900 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-black transition-all"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir Recibo
                </button>
                <button
                  onClick={() => { handleOpenUpload(selectedOrdem); setIsDetailOpen(false); }}
                  className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all"
                >
                  <FileUp className="h-4 w-4" />
                  Anexar Nota Fiscal
                </button>
                <button
                  onClick={() => { setEmissaoStatus(selectedOrdem.status_emissao); setIsEmissaoModalOpen(true); }}
                  className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-neutral-600 ring-1 ring-neutral-200 hover:ring-neutral-300 transition-all"
                >
                  <ChevronDown className="h-4 w-4" />
                  Alterar Status Emissão
                </button>
                {selectedOrdem.cliente_telefone && (
                  <div className="flex items-center justify-center scale-90 origin-left">
                    <AdminWhatsAppButton
                      telefone={selectedOrdem.cliente_telefone}
                      mensagem={whatsappNotificationService.gerarMensagemWhatsApp({
                        tipo: 'fiscal',
                        clienteNome: selectedOrdem.cliente_nome,
                        codigo: `NF-e ${selectedOrdem.numero_nota || 'Pendente'}`,
                        valorTotal: formatCurrency(selectedOrdem.valor)
                      })}
                    />
                  </div>
                )}
              </div>

              {/* Botão Excluir */}
              <button
                onClick={handleDeleteOrdem}
                className="flex items-center gap-2 rounded-2xl bg-red-50 px-5 py-3 text-xs font-black uppercase tracking-widest text-red-600 ring-1 ring-red-200 hover:bg-red-100 transition-all ml-auto"
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </button>
            </div>

          </div>
        )}
      </Modal>

      {/* ── UPLOAD MODAL ── */}
      <Modal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} title="Anexar Nota Fiscal" size="md">
        <form onSubmit={handleUploadNF} className="space-y-5">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-500">Número da Nota Fiscal</label>
            <input
              type="text"
              value={numeroNota}
              onChange={e => setNumeroNota(e.target.value)}
              placeholder="Ex: 000012345"
              className="w-full rounded-2xl bg-neutral-100 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-500">PDF da Nota Fiscal</label>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 px-6 py-8 hover:border-indigo-400 hover:bg-white transition-all">
              {uploadFilePDF ? (
                <div className="flex flex-col items-center text-center">
                  <FileText className="mb-2 h-8 w-8 text-indigo-600" />
                  <span className="text-sm font-bold">{uploadFilePDF.name}</span>
                  <span className="text-[10px] text-neutral-400">Clique para trocar</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <Upload className="mb-2 h-8 w-8 text-neutral-300" />
                  <span className="text-sm font-bold text-neutral-700">Arquivo PDF</span>
                  <span className="text-[10px] text-neutral-400">Clique para selecionar</span>
                </div>
              )}
              <input type="file" accept=".pdf" className="hidden" onChange={e => setUploadFilePDF(e.target.files?.[0] || null)} />
            </label>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-500">XML da Nota Fiscal</label>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 px-6 py-8 hover:border-indigo-400 hover:bg-white transition-all">
              {uploadFileXML ? (
                <div className="flex flex-col items-center text-center">
                  <FileText className="mb-2 h-8 w-8 text-blue-600" />
                  <span className="text-sm font-bold">{uploadFileXML.name}</span>
                  <span className="text-[10px] text-neutral-400">Clique para trocar</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <Upload className="mb-2 h-8 w-8 text-neutral-300" />
                  <span className="text-sm font-bold text-neutral-700">Arquivo XML</span>
                  <span className="text-[10px] text-neutral-400">Clique para selecionar</span>
                </div>
              )}
              <input type="file" accept=".xml" className="hidden" onChange={e => setUploadFileXML(e.target.files?.[0] || null)} />
            </label>
          </div>

          <p className="text-[10px] text-neutral-400">Ao confirmar, a ordem fiscal será marcada automaticamente como <strong>Emitida</strong>.</p>

          <button
            type="submit"
            disabled={isUploading || (!uploadFilePDF && !uploadFileXML && !numeroNota)}
            className="w-full rounded-2xl bg-indigo-600 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50 transition-all"
          >
            {isUploading ? 'Enviando…' : 'Confirmar e Marcar como Emitida'}
          </button>
        </form>
      </Modal>

      {/* ── CHANGE EMISSAO STATUS MODAL ── */}
      <Modal isOpen={isEmissaoModalOpen} onClose={() => setIsEmissaoModalOpen(false)} title="Alterar Status de Emissão" size="sm">
        <form onSubmit={handleChangeEmissaoStatus} className="space-y-5">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-500">Novo Status</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(EMISSAO_STATUS_CONFIG) as [string, typeof EMISSAO_STATUS_CONFIG[string]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setEmissaoStatus(key)}
                  className={`flex items-center gap-2 rounded-2xl p-3 text-left transition-all ring-1 text-xs font-bold ${
                    emissaoStatus === key ? 'bg-indigo-600 text-white ring-indigo-600 shadow-lg' : 'bg-white text-neutral-600 ring-neutral-200 hover:ring-neutral-300'
                  }`}
                >
                  {cfg.icon}
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {(emissaoStatus === 'cancelada' || emissaoStatus === 'inutilizada') && (
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-500">Motivo</label>
              <textarea
                value={cancelNote}
                onChange={e => setCancelNote(e.target.value)}
                placeholder="Descreva o motivo…"
                rows={3}
                className="w-full rounded-2xl bg-neutral-100 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-2xl bg-[#1a1a1a] py-4 text-sm font-black uppercase tracking-widest text-white hover:bg-black transition-all"
          >
            Confirmar Alteração
          </button>
        </form>
      </Modal>
    </div>
  );
}
