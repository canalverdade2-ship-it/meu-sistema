import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { OrdemFiscal } from '../../../types';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { FileText, Download, Receipt, Search, Eye, Printer, FileDown } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { downloadFiscalReceiptPdf } from '../../../lib/fiscalReceiptPdf';

export function NotasFiscaisList({ clientId, initialItemId }: { clientId: string, initialItemId?: string }) {
  const [ordens, setOrdens] = useState<OrdemFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrdem, setSelectedOrdem] = useState<OrdemFiscal | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    fetchOrdens();
  }, [clientId]);

  useEffect(() => {
    const handleOpenItem = (e: any) => {
      const itemId = e.detail?.itemId;
      if (itemId && ordens.length > 0) {
        const item = ordens.find(o => o.id === itemId);
        if (item) {
          setSelectedOrdem(item);
          setIsDetailOpen(true);
        }
      }
    };
    window.addEventListener('open-nf-detail', handleOpenItem);
    return () => window.removeEventListener('open-nf-detail', handleOpenItem);
  }, [ordens]);

  useEffect(() => {
    const channel = supabase
      .channel('client-nf-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ordens_fiscais',
        filter: `cliente_id=eq.${clientId}`
      }, () => {
        fetchOrdens();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clientId]);

  const fetchOrdens = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ordens_fiscais')
        .select('*')
        .eq('cliente_id', clientId)
        .eq('status_emissao', 'emitida')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrdens(data || []);
    } catch (err) {
      console.error('Erro ao buscar ordens fiscais:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrdens = ordens.filter(o => 
    o.codigo_fiscal?.toLowerCase().includes(search.toLowerCase()) ||
    o.descricao_item?.toLowerCase().includes(search.toLowerCase()) ||
    o.numero_nota?.toLowerCase().includes(search.toLowerCase())
  );

  const handlePrintReceipt = (ordem: OrdemFiscal) => {
    void downloadFiscalReceiptPdf(ordem as OrdemFiscal & Record<string, unknown>);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-neutral-900">Minhas Notas Fiscais</h2>
          <p className="text-sm text-neutral-500">Documentos fiscais referentes aos seus produtos e serviços.</p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar por código ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-neutral-200 bg-white py-2 pl-9 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : filteredOrdens.length === 0 ? (
          <div className="col-span-full py-12 text-center rounded-3xl bg-neutral-50 border border-neutral-100 flex flex-col items-center justify-center">
            <Receipt className="h-12 w-12 text-neutral-300 mb-3" />
            <p className="text-sm font-bold text-neutral-600">Nenhuma nota fiscal encontrada.</p>
            <p className="text-xs text-neutral-500 mt-1">Sujas notas fiscais emitidas aparecerão aqui.</p>
          </div>
        ) : (
          filteredOrdens.map((ordem) => (
            <div key={ordem.id} id={`nf-${ordem.id}`} className={`relative flex flex-col rounded-3xl bg-white p-5 sm:p-6 shadow-sm border transition-all hover:shadow-md ${initialItemId === ordem.id ? 'border-indigo-400 ring-2 ring-indigo-100 shadow-md scale-[1.01]' : 'border-neutral-200'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-indigo-600">{ordem.codigo_fiscal}</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">NF Nº {ordem.numero_nota || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-black text-neutral-900">{formatCurrency(ordem.valor_total)}</span>
                  <span className="text-[9px] font-bold text-neutral-400 mt-0.5">{formatDate(ordem.data_emissao || ordem.created_at)}</span>
                </div>
              </div>

              <div className="mb-5 flex-1 space-y-3">
                <div>
                  <p className="text-[9px] font-black uppercase text-neutral-400 tracking-widest mb-0.5">Descrição / Serviço</p>
                  <p className="text-xs font-bold text-neutral-700 line-clamp-2">{ordem.descricao_item || 'Serviços/Produtos Diversos'}</p>
                </div>
                
                <div className="flex flex-wrap gap-1.5">
                  {ordem.codigo_orcamento && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/10">
                      ORÇ: {ordem.codigo_orcamento}
                    </span>
                  )}
                  {ordem.codigo_ordem && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/10">
                      OS/OC: {ordem.codigo_ordem}
                    </span>
                  )}
                  {ordem.forma_pagamento && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                      PGTO: {ordem.forma_pagamento.replace(/_/g, ' ')}
                    </span>
                  )}
                  {ordem.tipo_compra && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-500/10">
                      {ordem.tipo_compra}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 border-t border-neutral-100 pt-4 mt-auto">
                <button 
                  onClick={() => { setSelectedOrdem(ordem); setIsDetailOpen(true); }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#1a1a1a] py-2.5 text-xs font-bold text-white hover:bg-black transition-all shadow-sm"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver Detalhes
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="Detalhes da Ordem Fiscal">
        {selectedOrdem && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-neutral-50 ring-1 ring-neutral-200">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-mono text-lg font-black text-indigo-600">{selectedOrdem.codigo_fiscal}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">NF Nº {selectedOrdem.numero_nota || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-neutral-900">{formatCurrency(selectedOrdem.valor_total)}</p>
                  <p className="text-xs text-neutral-500">{formatDate(selectedOrdem.data_emissao || selectedOrdem.created_at)}</p>
                </div>
              </div>
              <div className="border-t border-neutral-200 mt-3 pt-3">
                <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest mb-1">Descrição Detalhada</p>
                <p className="text-sm font-bold text-neutral-800">{selectedOrdem.descricao_item}</p>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {selectedOrdem.codigo_orcamento && (
                    <div>
                      <p className="text-[9px] font-black uppercase text-neutral-400 tracking-widest mb-0.5">Orçamento Origem</p>
                      <p className="text-xs font-bold text-neutral-900">{selectedOrdem.codigo_orcamento}</p>
                    </div>
                  )}
                  {selectedOrdem.codigo_ordem && (
                    <div>
                      <p className="text-[9px] font-black uppercase text-neutral-400 tracking-widest mb-0.5">Ordem de Serviço/Compra</p>
                      <p className="text-xs font-bold text-neutral-900">{selectedOrdem.codigo_ordem}</p>
                    </div>
                  )}
                  {selectedOrdem.forma_pagamento && (
                    <div>
                      <p className="text-[9px] font-black uppercase text-neutral-400 tracking-widest mb-0.5">Forma de Pagamento</p>
                      <p className="text-xs font-bold text-neutral-900 uppercase">{selectedOrdem.forma_pagamento.replace(/_/g, ' ')}</p>
                    </div>
                  )}
                  {selectedOrdem.tipo_compra && (
                    <div>
                      <p className="text-[9px] font-black uppercase text-neutral-400 tracking-widest mb-0.5">Categoria / Tipo</p>
                      <p className="text-xs font-bold text-neutral-900 uppercase">{selectedOrdem.tipo_compra}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-neutral-200 mt-3 pt-3">
                 <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest mb-2">Composição do Valor</p>
                 <div className="flex justify-between items-center text-xs mb-1">
                   <span className="text-neutral-500 font-bold">Valor Bruto / Unitário Base</span>
                   <span className="font-black text-neutral-700">{formatCurrency(selectedOrdem.valor_bruto || selectedOrdem.valor_total)}</span>
                 </div>
                 {Number(selectedOrdem.valor_desconto) > 0 && (
                   <div className="flex justify-between items-center text-xs mb-1 text-emerald-600">
                     <span className="font-bold">Descontos Aplicados</span>
                     <span className="font-black">- {formatCurrency(selectedOrdem.valor_desconto)}</span>
                   </div>
                 )}
                 {Number(selectedOrdem.valor_acrescimo) > 0 && (
                   <div className="flex justify-between items-center text-xs mb-1 text-rose-600">
                     <span className="font-bold">Acréscimos / Taxas</span>
                     <span className="font-black">+ {formatCurrency(selectedOrdem.valor_acrescimo)}</span>
                   </div>
                 )}
                 <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t border-neutral-200 border-dashed">
                   <span className="font-black text-neutral-900 uppercase tracking-widest">Valor Total Pago</span>
                   <span className="font-black text-indigo-600 text-base">{formatCurrency(selectedOrdem.valor_total)}</span>
                 </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-neutral-400">Documentos Disponíveis</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handlePrintReceipt(selectedOrdem)}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border-2 border-neutral-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                >
                  <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 group-hover:bg-indigo-100 group-hover:text-indigo-600 mb-2 transition-all">
                    <Printer className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-bold text-neutral-900 group-hover:text-indigo-700">Baixar Recibo</span>
                  <span className="text-[10px] text-neutral-500 mt-1">Sempre disponível</span>
                </button>

                {selectedOrdem.arquivo_nf_url ? (
                  <a href={selectedOrdem.arquivo_nf_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border-2 border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-200 mb-2 transition-all">
                      <FileDown className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-bold text-neutral-900 group-hover:text-emerald-700">Baixar Nota Fiscal</span>
                    <span className="text-[10px] text-emerald-600 mt-1 font-medium">Download do PDF</span>
                  </a>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-100 cursor-not-allowed opacity-60">
                    <div className="h-10 w-10 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-400 mb-2">
                      <FileDown className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-bold text-neutral-500">Nota Fiscal</span>
                    <span className="text-[10px] text-neutral-400 mt-1">Aguardando upload</span>
                  </div>
                )}
              </div>
              {selectedOrdem.arquivo_nf_xml_url && (
                <div className="pt-2">
                  <a href={selectedOrdem.arquivo_nf_xml_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-neutral-100 py-3 text-xs font-bold text-neutral-600 hover:bg-neutral-200 transition-all">
                    <Download className="h-4 w-4" /> Baixar XML da Nota Fiscal
                  </a>
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t border-neutral-100">
              <button onClick={() => setIsDetailOpen(false)} className="w-full rounded-xl bg-neutral-100 py-3 font-bold text-neutral-600 hover:bg-neutral-200">
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
