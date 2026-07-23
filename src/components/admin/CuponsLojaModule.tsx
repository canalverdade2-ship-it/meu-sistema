import { useState, useEffect } from 'react';
import { Plus, Search, MoreHorizontal, Ticket, Trash2, Calendar, User, ShoppingBag, Package, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CupomLoja, Cliente, Produto } from '../../types';
import { Modal } from '../ui/Modal';
import { formatCurrency, formatDate, generateCode } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { logService } from '../../lib/logService';

export function CuponsLojaModule({ colaboradorId, colaboradorNome }: { colaboradorId?: string, colaboradorNome?: string }) {
  const [activeTab, setActiveTab] = useState<'ativos' | 'inativos'>('ativos');
  const [cupons, setCupons] = useState<CupomLoja[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCupom, setSelectedCupom] = useState<CupomLoja | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Data for selects
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  useEffect(() => {
    fetchCupons();
    
    // Fetch dependencies for form
    supabase.from('clientes').select('id, nome, email').order('nome').then(({ data, error }) => {
      if (error) console.error("Erro clientes cupons:", error);
      if (data) setClientes(data);
    });
    supabase.from('produtos').select('id, nome, valor').order('nome').then(({ data, error }) => {
      if (error) console.error("Erro produtos cupons:", error);
      if (data) setProdutos(data);
    });

    const channel = supabase
      .channel('admin-cupons-loja-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cupons_loja' }, () => {
        fetchCupons();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, search]);

  const fetchCupons = async () => {
    let query = supabase.from('cupons_loja').select('*, clientes(nome), produtos(nome)');
    
    if (activeTab === 'ativos') {
      query = query.in('status', ['ativo']);
    } else {
      query = query.in('status', ['usado', 'expirado', 'cancelado']);
    }

    if (search) {
      query = query.ilike('nome_cupom', `%${search}%`);
    }

    const { data } = await query.order('created_at', { ascending: false });
    if (data) setCupons(data);
  };

  const handleCreate = async (formData: any) => {
    const { data, error } = await supabase.from('cupons_loja').insert([{
      ...formData,
      status: 'ativo'
    }]).select().single();

    if (error) {
      if (error.code === '23505') {
        toast.error('Ja existe um cupom com este codigo.');
      } else {
        toast.error(error.message || 'Erro ao cadastrar cupom.');
      }
      return false;
    } else {
      toast.success('Cupom cadastrado com sucesso.');
      await logService.logAction({
        acao: 'CRIAR_CUPOM_LOJA',
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador',
        ator_id: colaboradorId,
        detalhes: `Criou o cupom da loja: ${formData.nome_cupom} (${formData.codigo_cupom})`
      });
      setIsModalOpen(false);
      fetchCupons();
      return true;
    }
  };

  const handleCancel = async () => {
    if (!selectedCupom) return;
    const { error } = await supabase.from('cupons_loja').update({ 
      status: 'cancelado',
      motivo_cancelamento: `Cancelado administrativamente por ${colaboradorNome || 'Admin'}`
    }).eq('id', selectedCupom.id);

    if (error) {
      toast.error('Erro ao cancelar cupom.');
    } else {
      toast.success('Cupom cancelado com sucesso.');
      await logService.logAction({
        acao: 'CANCELAR_CUPOM_LOJA',
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador',
        ator_id: colaboradorId,
        detalhes: `Cancelou o cupom da loja: ${selectedCupom.nome_cupom}`
      });
      setIsDetailOpen(false);
      fetchCupons();
    }
  };

  const handleDelete = async () => {
    if (!selectedCupom) return;
    const { error } = await supabase.from('cupons_loja').delete().eq('id', selectedCupom.id);
    if (error) {
      toast.error('Erro ao excluir cupom.');
    } else {
      toast.success('Cupom excluído com sucesso.');
      await logService.logAction({
        acao: 'EXCLUIR_CUPOM_LOJA',
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador',
        ator_id: colaboradorId,
        detalhes: `Excluiu o cupom da loja: ${selectedCupom.nome_cupom}`
      });
      setIsDetailOpen(false);
      setIsDeleting(false);
      fetchCupons();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Buscar por nome do cupom..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white shadow-sm border border-neutral-200 rounded-xl py-3 pl-10 pr-4 text-xs font-medium text-neutral-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
          />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-3 rounded-xl bg-[#1a1a1a] px-8 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-black active:scale-95 group whitespace-nowrap"
        >
          <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
          Novo Cupom
        </button>
      </div>

      <div className="flex border-b border-neutral-200 mb-6">
        <button
          onClick={() => setActiveTab('ativos')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'ativos'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
          }`}
        >
          Cupons Ativos
        </button>
        <button
          onClick={() => setActiveTab('inativos')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'inativos'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
          }`}
        >
          Inativos / Cancelados
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cupons.map((cupom) => (
          <div key={cupom.id} className="group relative rounded-3xl bg-white p-6 shadow-sm ring-1 ring-neutral-200 transition-all hover:shadow-md">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Ticket className="h-6 w-6" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                  cupom.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 
                  cupom.status === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-neutral-100 text-neutral-700'
                }`}>
                  {cupom.status}
                </span>
                <span className="font-mono text-xs font-bold text-neutral-400">{cupom.codigo_cupom}</span>
              </div>
            </div>
            
            <h3 className="text-lg font-bold text-neutral-900">{cupom.nome_cupom}</h3>
            
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 uppercase">
                {cupom.categoria_cupom}
              </span>
              {cupom.produto_id && (
                <span className="inline-block rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-600 uppercase flex items-center gap-1">
                  <Package className="w-3 h-3" /> Específico
                </span>
              )}
            </div>

            <div className="mt-4 space-y-1">
              <p className="text-sm font-bold text-indigo-600">
                {cupom.categoria_cupom === 'desconto' || cupom.categoria_cupom === 'reembolso' ? (
                  cupom.tipo_desconto === 'valor' ? formatCurrency(cupom.valor_desconto || 0) : `${cupom.valor_desconto}% OFF`
                ) : (
                  cupom.tipo_entrega === 'frete_gratis' ? 'Frete Grátis' : 
                  cupom.tipo_entrega === 'frete_gratis_minimo' ? `Frete Grátis > ${formatCurrency(cupom.valor_minimo_compra || 0)}` :
                  `Fixo: ${formatCurrency(cupom.taxa_fixa_entrega || 0)}`
                )}
              </p>
              <p className="text-xs text-neutral-500 font-medium">Usos: {cupom.total_usos} / {cupom.limite_usos}</p>
              {cupom.data_validade && (
                <p className="text-xs text-neutral-500 font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {formatDate(cupom.data_validade)}
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end">
              <button 
                onClick={() => { setSelectedCupom(cupom); setIsDetailOpen(true); }}
                className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-indigo-600"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {cupons.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 mb-4">
            <Ticket className="h-8 w-8 text-neutral-400" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900">Nenhum cupom encontrado</h3>
          <p className="text-neutral-500 mt-2 max-w-sm">
            Nenhum cupom com os filtros atuais.
          </p>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Cupom GSA Store Hub" size="wide">
        <CupomForm onSubmit={handleCreate} onCancel={() => setIsModalOpen(false)} clientes={clientes} produtos={produtos} />
      </Modal>

      <Modal isOpen={isDetailOpen} onClose={() => { setIsDetailOpen(false); setIsDeleting(false); }} title="Detalhes do Cupom" size="wide">
        {selectedCupom && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-neutral-50 p-6 ring-1 ring-neutral-200">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                    <Ticket className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-neutral-900">{selectedCupom.nome_cupom}</h3>
                    <span className="font-mono text-sm font-bold text-neutral-500">{selectedCupom.codigo_cupom}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-black uppercase ${
                    selectedCupom.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {selectedCupom.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mt-6">
                <div>
                  <p className="text-xs font-bold text-neutral-400 uppercase">Categoria</p>
                  <p className="text-sm font-bold text-neutral-900 uppercase">{selectedCupom.categoria_cupom}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-400 uppercase">Benefício</p>
                  <p className="text-sm font-bold text-indigo-600">
                    {selectedCupom.categoria_cupom === 'desconto' || selectedCupom.categoria_cupom === 'reembolso' ? (
                      selectedCupom.tipo_desconto === 'valor' ? formatCurrency(selectedCupom.valor_desconto || 0) : `${selectedCupom.valor_desconto}% OFF`
                    ) : (
                      selectedCupom.tipo_entrega === 'frete_gratis' ? 'Frete Grátis' : 
                      selectedCupom.tipo_entrega === 'frete_gratis_minimo' ? `Frete Grátis Acima de ${formatCurrency(selectedCupom.valor_minimo_compra || 0)}` :
                      `Taxa Fixa de Entrega: ${formatCurrency(selectedCupom.taxa_fixa_entrega || 0)}`
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-400 uppercase">Utilização</p>
                  <p className="text-sm font-bold text-neutral-900">{selectedCupom.total_usos} de {selectedCupom.limite_usos} usos</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-400 uppercase">Validade</p>
                  <p className="text-sm font-bold text-neutral-900">
                    {selectedCupom.data_validade ? formatDate(selectedCupom.data_validade) : 'Sem validade'}
                  </p>
                </div>
                {selectedCupom.cliente_id && (
                  <div className="col-span-2">
                    <p className="text-xs font-bold text-neutral-400 uppercase">Cliente Específico</p>
                    <p className="text-sm font-bold text-neutral-900 flex items-center gap-2 mt-1">
                      <User className="w-4 h-4 text-indigo-500" />
                      {(selectedCupom as any).clientes?.nome || selectedCupom.cliente_id}
                    </p>
                  </div>
                )}
                {selectedCupom.produto_id && (
                  <div className="col-span-2">
                    <p className="text-xs font-bold text-neutral-400 uppercase">Produto Específico</p>
                    <p className="text-sm font-bold text-neutral-900 flex items-center gap-2 mt-1">
                      <Package className="w-4 h-4 text-purple-500" />
                      {(selectedCupom as any).produtos?.nome || selectedCupom.produto_id}
                    </p>
                  </div>
                )}
              </div>

              {selectedCupom.motivo_cancelamento && (
                <div className="mt-6 rounded-xl bg-red-50 p-4 border border-red-100">
                  <p className="text-xs font-bold text-red-800 uppercase mb-1">Motivo do Cancelamento</p>
                  <p className="text-sm text-red-900">{selectedCupom.motivo_cancelamento}</p>
                </div>
              )}
            </div>
            
            {isDeleting ? (
              <div className="rounded-2xl bg-red-50 p-6 ring-1 ring-red-200 flex flex-col items-center text-center">
                <Trash2 className="h-8 w-8 text-red-500 mb-2" />
                <h4 className="text-lg font-bold text-red-900 mb-1">Confirmar Exclusão</h4>
                <p className="text-sm text-red-700 mb-6">
                  Tem certeza que deseja excluir este cupom permanentemente?
                </p>
                <div className="flex w-full gap-4">
                  <button onClick={() => setIsDeleting(false)} className="flex-1 rounded-xl bg-white py-3 font-bold text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50">
                    Cancelar
                  </button>
                  <button onClick={handleDelete} className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-700">
                    Sim, Excluir
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {selectedCupom.status === 'ativo' && (
                  <button onClick={handleCancel} className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-50 py-3 font-bold text-amber-600 hover:bg-amber-100">
                    Inativar / Cancelar Cupom
                  </button>
                )}
                <div className="flex gap-4">
                  <button onClick={() => setIsDetailOpen(false)} className="flex-1 rounded-xl bg-neutral-900 py-4 font-bold text-white hover:bg-black transition-all">
                    Fechar
                  </button>
                </div>
                <button onClick={() => setIsDeleting(true)} className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-50 py-3 font-bold text-red-600 hover:bg-red-100">
                  <Trash2 className="h-5 w-5" />
                  Excluir Permanentemente
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function CupomForm({ onSubmit, onCancel, clientes, produtos }: { onSubmit: (data: any) => Promise<boolean>, onCancel: () => void, clientes: Cliente[], produtos: Produto[] }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<any>({
    nome_cupom: '',
    codigo_cupom: '',
    categoria_cupom: 'desconto',
    tipo_desconto: 'porcentagem',
    valor_desconto: '',
    tipo_entrega: 'frete_gratis',
    valor_minimo_compra: '',
    taxa_fixa_entrega: '',
    cliente_id: '',
    produto_id: '',
    limite_usos: 1,
    data_validade: ''
  });

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      if (isSubmitting) return;
      setIsSubmitting(true);
      
      const payload: any = {
        nome_cupom: formData.nome_cupom,
        codigo_cupom: formData.codigo_cupom.trim().toUpperCase(),
        categoria_cupom: formData.categoria_cupom,
        limite_usos: parseInt(formData.limite_usos) || 1,
        total_usos: 0,
      };

      if (!payload.codigo_cupom) {
        toast.error('Informe o codigo do cupom.');
        setIsSubmitting(false);
        return;
      }

      if (formData.data_validade) payload.data_validade = formData.data_validade;
      if (formData.cliente_id) payload.cliente_id = formData.cliente_id;
      if (formData.produto_id && formData.categoria_cupom !== 'entrega') payload.produto_id = formData.produto_id;

      if (formData.categoria_cupom === 'desconto' || formData.categoria_cupom === 'reembolso') {
        payload.tipo_desconto = formData.tipo_desconto;
        payload.valor_desconto = parseFloat(formData.valor_desconto) || 0;
        if (payload.valor_desconto <= 0) {
          toast.error('Informe um desconto maior que zero.');
          setIsSubmitting(false);
          return;
        }
        if (payload.tipo_desconto === 'porcentagem' && payload.valor_desconto > 100) {
          toast.error('O desconto em porcentagem nao pode passar de 100%.');
          setIsSubmitting(false);
          return;
        }
      } else {
        payload.tipo_entrega = formData.tipo_entrega;
        if (formData.tipo_entrega === 'frete_gratis_minimo') payload.valor_minimo_compra = parseFloat(formData.valor_minimo_compra) || 0;
        if (formData.tipo_entrega === 'taxa_fixa') payload.taxa_fixa_entrega = parseFloat(formData.taxa_fixa_entrega) || 0;
      }

      await onSubmit(payload);
      setIsSubmitting(false);
    }} className="space-y-6">
      
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-bold text-neutral-700">Nome do Cupom *</label>
          <input type="text" required value={formData.nome_cupom} onChange={e => setFormData({...formData, nome_cupom: e.target.value})} className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-indigo-500 focus:outline-none" placeholder="Ex: Black Friday 2026" />
        </div>
        
        <div>
          <label className="mb-1 block text-sm font-bold text-neutral-700">Código *</label>
          <div className="flex">
            <input type="text" required value={formData.codigo_cupom} onChange={e => setFormData({...formData, codigo_cupom: e.target.value.toUpperCase()})} className="w-full rounded-l-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono focus:border-indigo-500 focus:outline-none uppercase" placeholder="BLACK20" />
            <button type="button" onClick={() => setFormData({...formData, codigo_cupom: generateCode('')})} className="bg-neutral-900 text-white px-4 rounded-r-xl font-bold text-xs hover:bg-black transition-colors">GERAR</button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold text-neutral-700">Categoria *</label>
          <select required value={formData.categoria_cupom} onChange={e => setFormData({...formData, categoria_cupom: e.target.value})} className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-indigo-500 focus:outline-none">
            <option value="desconto">Desconto Comum</option>
            <option value="entrega">Benefício de Entrega</option>
            <option value="reembolso">Voucher de Reembolso / Troca</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl bg-indigo-50/50 p-4 border border-indigo-100">
        {(formData.categoria_cupom === 'desconto' || formData.categoria_cupom === 'reembolso') ? (
          <div className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="tipo_desconto" value="porcentagem" checked={formData.tipo_desconto === 'porcentagem'} onChange={e => setFormData({...formData, tipo_desconto: e.target.value})} className="text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm font-bold text-neutral-700">Porcentagem (%)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="tipo_desconto" value="valor" checked={formData.tipo_desconto === 'valor'} onChange={e => setFormData({...formData, tipo_desconto: e.target.value})} className="text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm font-bold text-neutral-700">Valor Fixo (R$)</span>
              </label>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-neutral-700">
                {formData.tipo_desconto === 'porcentagem' ? 'Porcentagem de Desconto *' : 'Valor do Desconto (R$) *'}
              </label>
              <input type="number" step="0.01" required min="0.01" value={formData.valor_desconto} onChange={e => setFormData({...formData, valor_desconto: e.target.value})} className="w-full rounded-xl border border-indigo-200 bg-white px-4 py-3 focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-neutral-700">Tipo de Benefício de Entrega *</label>
              <select required value={formData.tipo_entrega} onChange={e => setFormData({...formData, tipo_entrega: e.target.value})} className="w-full rounded-xl border border-indigo-200 bg-white px-4 py-3 focus:border-indigo-500 focus:outline-none">
                <option value="frete_gratis">Frete Totalmente Grátis</option>
                <option value="frete_gratis_minimo">Frete Grátis com Valor Mínimo de Compra</option>
                <option value="taxa_fixa">Taxa de Entrega Fixa Reduzida</option>
              </select>
            </div>
            {formData.tipo_entrega === 'frete_gratis_minimo' && (
              <div>
                <label className="mb-1 block text-sm font-bold text-neutral-700">Valor Mínimo da Compra (R$) *</label>
                <input type="number" step="0.01" required min="0" value={formData.valor_minimo_compra} onChange={e => setFormData({...formData, valor_minimo_compra: e.target.value})} className="w-full rounded-xl border border-indigo-200 bg-white px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>
            )}
            {formData.tipo_entrega === 'taxa_fixa' && (
              <div>
                <label className="mb-1 block text-sm font-bold text-neutral-700">Taxa de Entrega Fixa (R$) *</label>
                <input type="number" step="0.01" required min="0" value={formData.taxa_fixa_entrega} onChange={e => setFormData({...formData, taxa_fixa_entrega: e.target.value})} className="w-full rounded-xl border border-indigo-200 bg-white px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-neutral-100 pt-4">
        <div>
          <label className="mb-1 block text-sm font-bold text-neutral-700 flex justify-between">
            Limite de Usos Globais *
          </label>
          <input type="number" required min="1" value={formData.limite_usos} onChange={e => setFormData({...formData, limite_usos: e.target.value})} className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold text-neutral-700">Data de Validade (Opcional)</label>
          <input type="date" value={formData.data_validade} onChange={e => setFormData({...formData, data_validade: e.target.value})} className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-indigo-500 focus:outline-none" />
        </div>
      </div>

      <div className="space-y-4 border-t border-neutral-100 pt-4">
        <h4 className="text-sm font-bold text-neutral-900">Restrições (Opcional)</h4>
        
        <div>
          <label className="mb-1 block text-xs font-bold text-neutral-500 uppercase">Restringir a Cliente Específico</label>
          <select value={formData.cliente_id} onChange={e => setFormData({...formData, cliente_id: e.target.value})} className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none">
            <option value="">Nenhuma Restrição (Todos os Clientes)</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.nome} ({c.email})</option>
            ))}
          </select>
        </div>

        {formData.categoria_cupom !== 'entrega' && (
          <div>
            <label className="mb-1 block text-xs font-bold text-neutral-500 uppercase flex items-center gap-1">
              <Package className="w-3 h-3" /> Restringir a Produto Específico
            </label>
            <select value={formData.produto_id} onChange={e => setFormData({...formData, produto_id: e.target.value})} className="w-full rounded-xl border border-purple-200 bg-purple-50/50 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none">
              <option value="">Aplicável a todos os produtos do carrinho</option>
              {produtos.map(p => (
                <option key={p.id} value={p.id}>{p.nome} - {formatCurrency(p.valor)}</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-neutral-500">Se selecionado, o desconto será aplicado SOMENTE a este produto dentro do carrinho.</p>
          </div>
        )}
      </div>

      <div className="flex gap-4 pt-4 border-t border-neutral-100">
        <button type="button" onClick={onCancel} disabled={isSubmitting} className="flex-1 rounded-xl border border-neutral-200 py-3 font-bold text-neutral-600 hover:bg-neutral-50">Cancelar</button>
        <button type="submit" disabled={isSubmitting} className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-lg hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center gap-2">
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
          Cadastrar Cupom
        </button>
      </div>
    </form>
  );
}
