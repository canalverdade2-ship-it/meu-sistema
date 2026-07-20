import React, { useState, useEffect } from 'react';
import { Plane, Users, Plus, Edit, Trash2, Loader2, Eye, Receipt, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../../lib/utils';
import { Modal } from '../ui/Modal';

export function TravelAdminModule() {
  const [activeTab, setActiveTab] = useState<'pacotes' | 'solicitacoes' | 'propostas' | 'transacoes'>('solicitacoes');
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
            <Plane className="h-6 w-6 text-indigo-600" />
            Módulo de Viagens
          </h2>
          <p className="text-neutral-500">Gerenciamento de pacotes, orçamentos e reservas de viagens.</p>
        </div>
      </div>

      <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-neutral-200">
        <button
          onClick={() => setActiveTab('solicitacoes')}
          className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'solicitacoes' ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
          }`}
        >
          Orçamentos
        </button>
        <button
          onClick={() => setActiveTab('pacotes')}
          className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'pacotes' ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
          }`}
        >
          Pacotes
        </button>
        <button
          onClick={() => setActiveTab('propostas')}
          className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'propostas' ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
          }`}
        >
          Propostas
        </button>
        <button
          onClick={() => setActiveTab('transacoes')}
          className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'transacoes' ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
          }`}
        >
          Reservas & Transações
        </button>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
        {activeTab === 'solicitacoes' && <SolicitacoesTab />}
        {activeTab === 'pacotes' && <PacotesTab />}
        {activeTab === 'propostas' && <PropostasTab />}
        {activeTab === 'transacoes' && <TransacoesTab />}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Componentes Aba
// ----------------------------------------------------------------------

function SolicitacoesTab() {
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSolicitacoes();
  }, []);

  const fetchSolicitacoes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('viagens_orcamentos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSolicitacoes(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao buscar orçamentos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Solicitações de Orçamento</h3>
        <button onClick={fetchSolicitacoes} className="text-indigo-600 hover:text-indigo-800 text-sm font-bold">Atualizar</button>
      </div>
      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>
      ) : solicitacoes.length === 0 ? (
        <p className="text-neutral-500 text-center py-8">Nenhuma solicitação encontrada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="py-3 px-4 text-xs font-black text-neutral-500 uppercase">Data</th>
                <th className="py-3 px-4 text-xs font-black text-neutral-500 uppercase">Cliente</th>
                <th className="py-3 px-4 text-xs font-black text-neutral-500 uppercase">Destino</th>
                <th className="py-3 px-4 text-xs font-black text-neutral-500 uppercase">Status</th>
                <th className="py-3 px-4 text-xs font-black text-neutral-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {solicitacoes.map((s) => (
                <tr key={s.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="py-3 px-4 text-sm">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-sm font-medium">{s.nome}</td>
                  <td className="py-3 px-4 text-sm">{s.destino}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 uppercase">
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button className="text-indigo-600 hover:text-indigo-800 text-xs font-bold px-2 py-1 bg-indigo-50 rounded-lg">Ver / Gerar Proposta</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PacotesTab() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Pacotes (Catálogo)</h3>
        <button className="bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-bold px-4 py-2 rounded-xl flex items-center gap-2">
          <Plus className="h-4 w-4" /> Novo Pacote
        </button>
      </div>
      <div className="text-center py-12 text-neutral-500">
        <Plane className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
        <p>O módulo de cadastro de pacotes será expandido em breve.</p>
        <p className="text-sm">Por enquanto os pacotes são populados via backend ou importação.</p>
      </div>
    </div>
  );
}

function PropostasTab() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold mb-4">Propostas Enviadas</h3>
      <div className="text-center py-12 text-neutral-500">
        <FileText className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
        <p>Listagem de propostas ativas e pendentes de aceitação.</p>
      </div>
    </div>
  );
}

function TransacoesTab() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold mb-4">Reservas e Transações</h3>
      <div className="text-center py-12 text-neutral-500">
        <Receipt className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
        <p>Acompanhamento de pagamentos e emissão de vouchers para viagens confirmadas.</p>
      </div>
    </div>
  );
}
