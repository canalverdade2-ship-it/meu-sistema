import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle,
  CheckCircle2,
  IdCard,
  Loader2,
  Search,
  Send,
  Sparkles,
  User,
  UserCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDateTime, maskCNPJ, maskCPF, generateUUID } from '../../lib/utils';
import { Modal } from '../ui/Modal';
import { Cliente } from '../../types';
import { callClientRpc } from '../../lib/clientRpc';

type TransferType = 'saldo' | 'pontos';
type DocType = 'cpf' | 'cnpj' | 'id';

export function ClientTransferencias({
  clientId,
  cliente: clienteProp,
  initialItemId
}: {
  clientId: string;
  cliente?: Cliente | null;
  initialTab?: string;
  initialItemId?: string;
}) {
  const [transferencias, setTransferencias] = useState<any[]>([]);
  const [clienteData, setClienteData] = useState<Cliente | null>(clienteProp || null);
  const [selectedTransferencia, setSelectedTransferencia] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isEstornoModalOpen, setIsEstornoModalOpen] = useState(false);
  const [tipo, setTipo] = useState<TransferType>('saldo');
  const [docType, setDocType] = useState<DocType>('cpf');
  const [destinoDoc, setDestinoDoc] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [destinoNome, setDestinoNome] = useState('');
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [isEstornando, setIsEstornando] = useState(false);
  const hasAutoOpened = useRef<string | null>(null);
  const transferRequestId = useRef<string>(generateUUID());

  const fetchClienteData = async () => {
    const { data } = await supabase.from('clientes').select('*').eq('id', clientId).single();
    if (data) setClienteData(data as Cliente);
  };

  const fetchTransferencias = async () => {
    const { data, error } = await supabase
      .from('transferencias')
      .select('*, cliente_origem:clientes!cliente_origem_id(nome, cpf, cnpj), cliente_destino:clientes!cliente_destino_id(nome, cpf, cnpj)')
      .or(`cliente_origem_id.eq.${clientId},cliente_destino_id.eq.${clientId}`)
      .order('data_solicitacao', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar transferencias.');
      return;
    }
    setTransferencias(data || []);
  };

  useEffect(() => {
    fetchClienteData();
    fetchTransferencias();
  }, [clientId]);

  useEffect(() => {
    if (!initialItemId || transferencias.length === 0) return;
    if (hasAutoOpened.current === initialItemId) return;
    const target = transferencias.find(item => item.id === initialItemId);
    if (target) {
      setSelectedTransferencia(target);
      setIsDetailModalOpen(true);
      hasAutoOpened.current = initialItemId;
    }
  }, [initialItemId, transferencias]);

  const resetForm = () => {
    setTipo('saldo');
    setDocType('cpf');
    setDestinoDoc('');
    setDestinoId('');
    setDestinoNome('');
    setValor('');
    setMotivo('');
    transferRequestId.current = generateUUID();
  };

  const handleDocChange = (val: string) => {
    if (docType === 'id') {
      setDestinoDoc(val.toUpperCase().trim());
      setDestinoId('');
      setDestinoNome('');
      return;
    }
    const clean = val.replace(/\D/g, '');
    const masked = docType === 'cpf' ? maskCPF(clean) : maskCNPJ(clean);
    setDestinoDoc(masked);
    setDestinoId('');
    setDestinoNome('');
  };

  const handleVerifyDoc = async () => {
    const trimmed = destinoDoc.trim().toUpperCase();
    if (!trimmed) {
      toast.error('Informe o CPF, CNPJ ou Código/ID do destinatário.');
      return;
    }

    const cleanDoc = trimmed.replace(/\D/g, '');

    if (docType === 'cpf' && cleanDoc.length !== 11 && !trimmed.startsWith('CL')) {
      toast.error('Informe um CPF válido (11 dígitos).');
      return;
    }

    if (docType === 'cnpj' && cleanDoc.length !== 14 && !trimmed.startsWith('CL')) {
      toast.error('Informe um CNPJ válido (14 dígitos).');
      return;
    }

    setLoading(true);
    try {
      let query = supabase.from('clientes').select('id, nome, codigo_cliente');
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed);

      if (docType === 'id' || trimmed.startsWith('CL')) {
        if (isUuid) {
          query = query.or(`codigo_cliente.ilike.${trimmed},id.eq.${trimmed}`);
        } else {
          query = query.ilike('codigo_cliente', trimmed);
        }
      } else {
        const conditions: string[] = [];
        if (cleanDoc.length === 11) conditions.push(`cpf.eq.${cleanDoc}`);
        if (cleanDoc.length === 14) conditions.push(`cnpj.eq.${cleanDoc}`);
        conditions.push(`codigo_cliente.ilike.${trimmed}`);
        if (isUuid) conditions.push(`id.eq.${trimmed}`);
        query = query.or(conditions.join(','));
      }

      const { data, error } = await query.maybeSingle();

      if (error || !data) {
        toast.error('Destinatário não encontrado.');
        setDestinoId('');
        setDestinoNome('');
        return;
      }

      if (data.id === clientId) {
        toast.error('Você não pode transferir para si mesmo.');
        setDestinoId('');
        setDestinoNome('');
        return;
      }

      setDestinoId(data.id);
      setDestinoNome(data.codigo_cliente ? `${data.nome} (${data.codigo_cliente})` : data.nome);
      toast.success('Destinatário localizado!');
    } catch {
      toast.error('Erro ao verificar destinatário.');
    } finally {
      setLoading(false);
    }
  };

  const handleValorChange = (val: string) => {
    if (tipo === 'pontos') {
      setValor(val.replace(/\D/g, ''));
      return;
    }
    const clean = val.replace(/\D/g, '');
    if (!clean) {
      setValor('');
      return;
    }
    const num = (parseInt(clean, 10) / 100).toFixed(2);
    setValor(num);
  };

  const getAvailableAmount = () => {
    if (!clienteData) return 0;
    if (tipo === 'saldo') {
      return Number(clienteData.saldo ?? (clienteData as any).saldo_carteira ?? 0);
    }
    return Number(clienteData.pontos ?? (clienteData as any).saldo_pontos ?? 0);
  };

  const availableAmount = getAvailableAmount();
  const numericValor = parseFloat(valor || '0');
  const isValorExcedido = valor !== '' && numericValor > availableAmount;
  const isSaldoIndisponivel = availableAmount <= 0;

  const handleSubmit = async () => {
    if (!destinoId || !valor || !motivo.trim()) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    if (numericValor <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }

    if (numericValor > availableAmount || availableAmount <= 0) {
      toast.error(`Você não possui ${tipo === 'saldo' ? 'saldo' : 'pontos'} suficientes para esta transferência.`);
      return;
    }

    setLoading(true);
    try {
      const data = await callClientRpc<any>('gsa_client_request_transfer', {
        p_request_id: transferRequestId.current,
        p_destino_id: destinoId,
        p_tipo: tipo,
        p_valor: numericValor,
        p_motivo: motivo.trim(),
      });

      if (data && data.success === false) {
        toast.error(data.error || 'Erro ao processar transferência.');
        return;
      }

      toast.success('Transferência solicitada com sucesso!');
      setIsConfirmModalOpen(false);
      setIsModalOpen(false);
      resetForm();
      fetchTransferencias();
      fetchClienteData();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao solicitar transferência.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTransferencia = async (t: any) => {
    setCanceling(true);
    try {
      const data = await callClientRpc<any>('gsa_client_cancel_transfer', {
        p_transferencia_id: t.id,
      });

      if (data && data.success === false) {
        toast.error(data.error || 'Erro ao cancelar transferência.');
        return;
      }

      toast.success('Transferência cancelada com sucesso.');
      setIsDetailModalOpen(false);
      fetchTransferencias();
      fetchClienteData();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao cancelar.');
    } finally {
      setCanceling(false);
    }
  };

  const handleEstornar = async () => {
    if (!selectedTransferencia) return;
    setIsEstornando(true);
    try {
      const data = await callClientRpc<any>('gsa_client_reverse_transfer', {
        p_transferencia_id: selectedTransferencia.id,
      });

      if (data && data.success === false) {
        toast.error(data.error || 'Erro ao estornar transferência.');
        return;
      }

      toast.success('Estorno realizado com sucesso.');
      setIsEstornoModalOpen(false);
      setIsDetailModalOpen(false);
      fetchTransferencias();
      fetchClienteData();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao estornar.');
    } finally {
      setIsEstornando(false);
    }
  };

  const statusLabel = (status: string) => ({
    em_analise: 'Em Análise',
    aprovado: 'Aprovada',
    recusado: 'Recusada',
    reprovado: 'Reprovada',
    concluido: 'Concluída',
    estornado: 'Estornada',
    cancelado: 'Cancelada'
  }[status] || status);

  const renderValue = (transferencia: any) => {
    const isOut = transferencia.cliente_origem_id === clientId;
    const raw = isOut ? transferencia.valor : transferencia.valor_liquido || transferencia.valor;
    return transferencia.tipo === 'pontos' ? `${isOut ? '-' : '+'} ${raw} pts` : `${isOut ? '-' : '+'} ${formatCurrency(raw)}`;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-neutral-900">Transferências</h2>
          <p className="text-xs font-bold text-neutral-400 mt-0.5">Envie saldo ou pontos para outros clientes de forma instantânea</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-3.5 text-sm font-black text-white shadow-md shadow-indigo-600/20 transition-all hover:from-indigo-500 hover:to-indigo-600 active:scale-95"
        >
          <Send className="h-4 w-4" /> Solicitar Transferência
        </button>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-md ring-1 ring-neutral-200">
        {transferencias.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
              <ArrowLeftRight className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-neutral-500">Nenhuma transferência encontrada.</p>
            <p className="text-xs text-neutral-400 mt-1">Suas transferências enviadas e recebidas aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transferencias.map(t => {
              const isOut = t.cliente_origem_id === clientId;
              return (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTransferencia(t); setIsDetailModalOpen(true); }}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-neutral-100 bg-white p-4 text-left shadow-sm transition hover:border-neutral-200 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isOut ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {isOut ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-neutral-900">{isOut ? t.cliente_destino?.nome : t.cliente_origem?.nome}</p>
                      <p className="text-xs font-bold text-neutral-400">{formatDateTime(t.data_solicitacao)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${isOut ? 'text-rose-600' : 'text-emerald-600'}`}>{renderValue(t)}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-neutral-400">{statusLabel(t.status)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Solicitar Transferência">
        <div className="space-y-5 pt-1">
          {clienteData && (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-4 text-white shadow-sm border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-indigo-300 backdrop-blur-md">
                    {tipo === 'saldo' ? <Wallet className="h-5 w-5 text-indigo-400" /> : <Sparkles className="h-5 w-5 text-amber-400" />}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {tipo === 'saldo' ? 'Saldo Disponível' : 'Pontos Disponíveis'}
                    </p>
                    <p className="text-base font-black text-white">
                      {tipo === 'saldo' ? formatCurrency(availableAmount) : `${availableAmount} pts`}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border ${
                  availableAmount > 0
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                }`}>
                  {availableAmount > 0 ? 'Disponível' : 'Sem Saldo'}
                </span>
              </div>

              {isSaldoIndisponivel && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200/80 p-3 text-rose-700 text-xs font-bold">
                  <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>Você não possui {tipo === 'saldo' ? 'saldo financeiro' : 'pontos'} disponíveis para realizar transferências.</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">
              Modalidade
            </label>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 ring-1 ring-slate-200/60">
              <button
                type="button"
                onClick={() => setTipo('saldo')}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition-all ${
                  tipo === 'saldo'
                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Wallet className="h-4 w-4" />
                Saldo (R$)
              </button>
              <button
                type="button"
                onClick={() => setTipo('pontos')}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition-all ${
                  tipo === 'pontos'
                    ? 'bg-white text-amber-600 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sparkles className="h-4 w-4 text-amber-500" />
                Pontos
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">
              Identificação do Destinatário
            </label>

            <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100/70 p-1">
              <button
                type="button"
                onClick={() => { setDocType('cpf'); setDestinoDoc(''); setDestinoId(''); setDestinoNome(''); }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs transition-all ${
                  docType === 'cpf' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-500 font-bold hover:text-slate-800'
                }`}
              >
                <User className="h-3.5 w-3.5" />
                CPF
              </button>
              <button
                type="button"
                onClick={() => { setDocType('cnpj'); setDestinoDoc(''); setDestinoId(''); setDestinoNome(''); }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs transition-all ${
                  docType === 'cnpj' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-500 font-bold hover:text-slate-800'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                CNPJ
              </button>
              <button
                type="button"
                onClick={() => { setDocType('id'); setDestinoDoc(''); setDestinoId(''); setDestinoNome(''); }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs transition-all ${
                  docType === 'id' ? 'bg-white text-indigo-600 shadow-sm font-black' : 'text-slate-500 font-bold hover:text-slate-800'
                }`}
              >
                <IdCard className="h-3.5 w-3.5" />
                ID Cliente
              </button>
            </div>

            <div className="flex gap-2">
              <input
                value={destinoDoc}
                onChange={e => handleDocChange(e.target.value)}
                inputMode={docType === 'id' ? 'text' : 'numeric'}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder:font-normal placeholder:text-slate-400"
                placeholder={
                  docType === 'id'
                    ? 'Digite o ID do cliente (ex: CL101)'
                    : docType === 'cpf'
                    ? 'Digite o CPF (000.000.000-00)'
                    : 'Digite o CNPJ (00.000.000/0000-00)'
                }
              />
              <button
                type="button"
                onClick={handleVerifyDoc}
                disabled={loading || !destinoDoc.trim()}
                className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-xs font-black text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </button>
            </div>

            {destinoNome && (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-emerald-900 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white font-black text-xs">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Destinatário Encontrado</p>
                    <p className="text-sm font-black text-slate-900">{destinoNome}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  <CheckCircle2 className="h-3 w-3" /> Verificado
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">
              {tipo === 'saldo' ? 'Valor a Transferir' : 'Quantidade de Pontos'}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                {tipo === 'saldo' ? 'R$' : 'PTS'}
              </span>
              <input
                value={valor}
                onChange={e => handleValorChange(e.target.value)}
                disabled={isSaldoIndisponivel}
                inputMode="decimal"
                className={`w-full rounded-xl border bg-white py-3 pl-12 pr-4 text-base font-black outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400 ${
                  isValorExcedido
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 text-rose-900'
                    : 'border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                } placeholder:font-normal placeholder:text-slate-400`}
                placeholder={tipo === 'saldo' ? '0,00' : '0'}
              />
            </div>
            {isValorExcedido && (
              <p className="text-[11px] font-bold text-rose-600">
                Valor excede o limite disponível ({tipo === 'saldo' ? formatCurrency(availableAmount) : `${availableAmount} pts`}).
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">
              Motivo da Transferência
            </label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              disabled={isSaldoIndisponivel}
              className="min-h-[88px] w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm font-medium text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder:font-normal placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
              placeholder="Descreva resumidamente a razão da transferência..."
            />
          </div>

          <button
            type="button"
            onClick={() => setIsConfirmModalOpen(true)}
            disabled={!destinoId || !valor || numericValor <= 0 || isValorExcedido || isSaldoIndisponivel || !motivo.trim() || loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 py-3.5 text-sm font-black text-white shadow-md shadow-indigo-600/20 transition-all hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.99] disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            Avançar para Confirmação
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </Modal>

      <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="Confirmar Transferência">
        <div className="space-y-5 pt-1">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold border-b border-slate-200/80 pb-2.5">
              <span>Modalidade</span>
              <span className="font-black text-slate-900 uppercase">{tipo === 'saldo' ? 'Transferência de Saldo' : 'Transferência de Pontos'}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold border-b border-slate-200/80 pb-2.5">
              <span>Destinatário</span>
              <span className="font-black text-slate-900">{destinoNome}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold border-b border-slate-200/80 pb-2.5">
              <span>Documento / ID</span>
              <span className="font-mono font-bold text-slate-700">
                {docType === 'id' || destinoDoc.toUpperCase().startsWith('CL')
                  ? destinoDoc.toUpperCase()
                  : docType === 'cpf'
                  ? maskCPF(destinoDoc)
                  : maskCNPJ(destinoDoc)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold border-b border-slate-200/80 pb-2.5">
              <span>Motivo</span>
              <span className="font-bold text-slate-700 max-w-[200px] truncate">{motivo}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold pt-1">
              <span>Taxa de Transferência</span>
              <span className="font-black text-emerald-600 uppercase">R$ 0,00 (Isento)</span>
            </div>
          </div>

          <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-1">Valor Total a Ser Transferido</p>
            <p className="text-3xl font-black text-indigo-950">
              {tipo === 'saldo' ? formatCurrency(Number(valor || 0)) : `${valor || 0} pts`}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(false)}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 active:scale-95"
            >
              Voltar e Editar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 rounded-xl bg-indigo-600 py-3 text-xs font-black text-white shadow-md transition hover:bg-indigo-700 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400"
            >
              {loading ? 'Processando...' : 'Confirmar e Enviar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Detalhes da Transferência">
        {selectedTransferencia && (
          <div className="space-y-5 pt-1">
            <div className="flex items-center gap-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 font-black">
                <ArrowLeftRight className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xl font-black text-slate-900">{renderValue(selectedTransferencia)}</p>
                <p className="text-xs font-bold text-slate-500 mt-0.5">{statusLabel(selectedTransferencia.status)}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs font-bold text-slate-700 space-y-2.5">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400">Origem:</span>
                <span className="font-black text-slate-900">{selectedTransferencia.cliente_origem?.nome}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400">Destino:</span>
                <span className="font-black text-slate-900">{selectedTransferencia.cliente_destino?.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Motivo:</span>
                <span className="font-bold text-slate-800">{selectedTransferencia.motivo || '-'}</span>
              </div>
            </div>

            {selectedTransferencia.cliente_origem_id === clientId && selectedTransferencia.status === 'em_analise' && (
              <button
                type="button"
                onClick={() => handleCancelTransferencia(selectedTransferencia)}
                disabled={canceling}
                className="w-full rounded-xl bg-rose-600 py-3 text-xs font-black text-white shadow-md transition hover:bg-rose-700 disabled:bg-slate-200"
              >
                {canceling ? 'Processando...' : 'Cancelar Solicitação'}
              </button>
            )}
            {selectedTransferencia.status === 'aprovado' && (
              <button
                type="button"
                onClick={() => setIsEstornoModalOpen(true)}
                className="w-full rounded-xl bg-slate-900 py-3 text-xs font-black text-white shadow-md transition hover:bg-slate-800"
              >
                Solicitar Estorno
              </button>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={isEstornoModalOpen} onClose={() => setIsEstornoModalOpen(false)} title="Confirmar Estorno">
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-3 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-rose-700">
            <XCircle className="h-5 w-5 shrink-0" />
            <p className="text-xs font-bold">O estorno reverte os saldos da origem e do destino em uma transação segura no banco.</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsEstornoModalOpen(false)}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleEstornar}
              disabled={isEstornando}
              className="flex-1 rounded-xl bg-rose-600 py-3 text-xs font-black text-white shadow-md transition hover:bg-rose-700 disabled:bg-slate-200"
            >
              {isEstornando ? 'Processando...' : 'Estornar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={false} onClose={() => undefined} title="">
        <CheckCircle className="hidden" />
      </Modal>
    </div>
  );
}
