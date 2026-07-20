import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Upload, CheckCircle, CreditCard, Lock, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { formatCurrency } from '../../../../lib/utils';
import { toast } from 'react-hot-toast';
import CheckoutModal from '../../store/CheckoutModal';

export function TravelReservationPage({ transacaoId, clientId, onBack }: { transacaoId: string, clientId: string, onBack: () => void }) {
  const [trip, setTrip] = useState<any>(null);
  const [passageiros, setPassageiros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPassengerForm, setShowPassengerForm] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [savingPassenger, setSavingPassenger] = useState(false);
  const [passengerForm, setPassengerForm] = useState({
    nome_completo: '',
    data_nascimento: '',
    numero_documento: '',
    tipo_documento: 'RG',
    tipo_passageiro: 'adulto',
  });

  useEffect(() => {
    fetchTripDetails();
  }, [transacaoId, clientId]);

  const fetchTripDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('viagens_transacoes')
        .select(`
          *,
          viagens_propostas (
            id,
            snapshot_completo,
            viagens_passageiros (
              id, nome_completo, tipo_documento, numero_documento, tipo_passageiro,
              viagens_passageiro_documentos (id, tipo_documento, verificado)
            )
          )
        `)
        .eq('id', transacaoId)
        .eq('cliente_id', clientId)
        .single();

      if (error) throw error;
      setTrip(data);
      setPassageiros(data?.viagens_propostas?.viagens_passageiros || []);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível carregar os detalhes da viagem.');
      onBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSavePassenger = async () => {
    if (!trip?.viagens_propostas?.id) return;
    if (!passengerForm.nome_completo.trim() || !passengerForm.data_nascimento || !passengerForm.numero_documento.trim()) {
      toast.error('Preencha nome, nascimento e documento do passageiro.');
      return;
    }

    try {
      setSavingPassenger(true);
      const { error } = await supabase.from('viagens_passageiros').insert({
        proposta_id: trip.viagens_propostas.id,
        cliente_id: clientId,
        nome_completo: passengerForm.nome_completo.trim(),
        data_nascimento: passengerForm.data_nascimento,
        tipo_documento: passengerForm.tipo_documento,
        numero_documento: passengerForm.numero_documento.trim(),
        tipo_passageiro: passengerForm.tipo_passageiro,
      });

      if (error) throw error;

      toast.success('Passageiro cadastrado com sucesso!');
      setPassengerForm({
        nome_completo: '',
        data_nascimento: '',
        numero_documento: '',
        tipo_documento: 'RG',
        tipo_passageiro: 'adulto',
      });
      setShowPassengerForm(false);
      await fetchTripDetails();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Não foi possível salvar o passageiro.');
    } finally {
      setSavingPassenger(false);
    }
  };

  const handleCheckout = () => {
    if (passageiros.length === 0) {
      toast.error('É obrigatório preencher pelo menos um passageiro.');
      return;
    }
    setShowCheckout(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f1ea]">
        <Loader2 className="h-10 w-10 animate-spin text-[#0c2340] mb-4" />
        <p className="font-bold text-[#0c2340]">Carregando viagem...</p>
      </div>
    );
  }

  if (!trip) return null;

  const snapshot = trip.viagens_propostas?.snapshot_completo || {};
  const isPendingPayment = trip.status === 'pendente';

  return (
    <div className="bg-[#f4f1ea] min-h-screen font-sans pb-32">
      <nav className="sticky top-0 z-50 border-b border-black/[0.06] bg-[#f4f1ea]/80 backdrop-blur-xl shrink-0">
        <div className="max-w-7xl mx-auto px-5 flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-[#1a1a1a] transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="h-5 w-px bg-black/10" />
            <span className="text-sm font-black tracking-tight text-[#0c2340]">Gestão da Viagem</span>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-5 py-12">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#0c2340] mb-2" style={{ fontFamily: '"Cinzel", serif', fontWeight: 700 }}>
              {snapshot.titulo || 'Viagem Personalizada'}
            </h1>
            <p className="text-neutral-600 font-medium">{snapshot.destino}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5 flex flex-col items-end">
            <span className="text-xs font-bold uppercase text-neutral-400 mb-1">Status Atual</span>
            <span className={`px-3 py-1 rounded-lg text-sm font-black uppercase tracking-wider ${
              isPendingPayment ? 'bg-yellow-100 text-yellow-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {trip.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-black/5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-[#0c2340] flex items-center gap-2">
                  <Users className="h-5 w-5" /> Passageiros
                </h3>
                <button
                  onClick={() => setShowPassengerForm(true)}
                  className="text-sm font-bold text-[#168ac1] hover:text-[#0c2340] transition-colors"
                >
                  + Adicionar Passageiro
                </button>
              </div>

              {passageiros.length === 0 ? (
                <div className="bg-neutral-50 rounded-2xl p-8 text-center border border-neutral-100">
                  <AlertCircle className="h-10 w-10 text-neutral-400 mx-auto mb-3" />
                  <p className="text-neutral-500 font-medium">Nenhum passageiro adicionado.</p>
                  <p className="text-xs text-neutral-400 mt-1">Preencha os dados dos viajantes para realizar o pagamento e emitir as passagens.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {passageiros.map((p) => (
                    <div key={p.id} className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                      <div>
                        <h4 className="font-bold text-[#1a1a1a]">{p.nome_completo}</h4>
                        <p className="text-sm text-neutral-500">{p.tipo_documento}: {p.numero_documento}</p>
                      </div>
                      <div className="flex gap-2">
                        {p.viagens_passageiro_documentos?.length > 0 ? (
                          <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                            <CheckCircle className="h-4 w-4" /> Docs Enviados
                          </div>
                        ) : (
                          <button
                            onClick={() => toast('Upload de documentos será a próxima etapa.', { icon: '📎' })}
                            className="flex items-center gap-1 text-xs font-bold text-yellow-700 bg-yellow-50 hover:bg-yellow-100 px-3 py-1.5 rounded-lg border border-yellow-200 transition-colors"
                          >
                            <Upload className="h-4 w-4" /> Anexar Docs
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showPassengerForm && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-[#38bdf8]/30">
                <h4 className="font-black text-[#0c2340] mb-4">Novo Passageiro</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <input
                    type="text"
                    placeholder="Nome Completo"
                    value={passengerForm.nome_completo}
                    onChange={(e) => setPassengerForm((p) => ({ ...p, nome_completo: e.target.value }))}
                    className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none"
                  />
                  <input
                    type="date"
                    value={passengerForm.data_nascimento}
                    onChange={(e) => setPassengerForm((p) => ({ ...p, data_nascimento: e.target.value }))}
                    className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none"
                  />
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <select
                      value={passengerForm.tipo_documento}
                      onChange={(e) => setPassengerForm((p) => ({ ...p, tipo_documento: e.target.value }))}
                      className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3 outline-none"
                    >
                      <option value="RG">RG</option>
                      <option value="CPF">CPF</option>
                      <option value="Passaporte">Passaporte</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Número do documento"
                      value={passengerForm.numero_documento}
                      onChange={(e) => setPassengerForm((p) => ({ ...p, numero_documento: e.target.value }))}
                      className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none"
                    />
                  </div>
                  <select
                    value={passengerForm.tipo_passageiro}
                    onChange={(e) => setPassengerForm((p) => ({ ...p, tipo_passageiro: e.target.value }))}
                    className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none"
                  >
                    <option value="adulto">Adulto</option>
                    <option value="crianca">Criança</option>
                    <option value="bebe">Bebê</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowPassengerForm(false)} disabled={savingPassenger} className="px-4 py-2 text-sm font-bold text-neutral-500 hover:text-neutral-700">Cancelar</button>
                  <button onClick={handleSavePassenger} disabled={savingPassenger} className="px-4 py-2 text-sm font-bold bg-[#0c2340] text-white rounded-xl disabled:opacity-60 flex items-center gap-2">
                    {savingPassenger && <Loader2 className="h-4 w-4 animate-spin" />}
                    {savingPassenger ? 'Salvando...' : 'Salvar Passageiro'}
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-black/5 sticky top-24">
              <h3 className="text-xl font-black text-[#0c2340] mb-6">Resumo Financeiro</h3>
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Valor do Pacote</span>
                  <span className="font-bold text-[#1a1a1a]">{formatCurrency(trip.valor_pago)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Taxas de Emissão</span>
                  <span className="font-bold text-emerald-600">Inclusas</span>
                </div>
                <div className="h-px bg-neutral-100 my-2" />
                <div className="flex justify-between text-lg">
                  <span className="font-black text-[#0c2340]">Total</span>
                  <span className="font-black text-[#0c2340]">{formatCurrency(trip.valor_pago)}</span>
                </div>
              </div>

              {isPendingPayment ? (
                <>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <Lock className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800 font-medium">Pagamento seguro através do Checkout GSA. Cadastre os passageiros antes de continuar.</p>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={passageiros.length === 0}
                    className="w-full py-4 rounded-xl bg-[#0c2340] text-white font-black hover:bg-[#134e78] transition-all shadow-lg hover:-translate-y-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    <CreditCard className="h-5 w-5" /> Ir para Pagamento
                  </button>
                </>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                  <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <h4 className="font-bold text-emerald-800 mb-1">Pagamento Confirmado</h4>
                  <p className="text-xs text-emerald-600">Sua viagem está garantida. Aguarde o envio dos vouchers finais.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showCheckout && (
        <CheckoutModal
          isOpen={showCheckout}
          onClose={() => setShowCheckout(false)}
          clientId={clientId}
          cartItems={[{
            item_id: trip.viagens_propostas?.id,
            tipo: 'pacote_viagem',
            quantidade: 1,
            item_detalhes: { titulo: snapshot.titulo, valor: trip.valor_pago, preco_venda: trip.valor_pago, is_digital: true }
          }]}
          onSuccess={() => {
            setShowCheckout(false);
            fetchTripDetails();
          }}
        />
      )}
    </div>
  );
}
