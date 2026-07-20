import { supabase } from './supabase';
import { toast } from 'react-hot-toast';

export interface DemandHistoryParams {
  demandaId: string;
  tipoEvento: 'criacao' | 'transferencia' | 'aceite' | 'entrega' | 'ajuste' | 'recusa' | 'negociacao' | 'finalizacao' | 'cancelamento';
  motivo: string;
  colaboradorOrigemId?: string | null;
  colaboradorDestinoId?: string | null;
  prestadorOrigemId?: string | null;
  prestadorDestinoId?: string | null;
  valorProposto?: number | null;
}

export const demandService = {
  async addDemandHistory({
    demandaId,
    tipoEvento,
    motivo,
    colaboradorOrigemId = null,
    colaboradorDestinoId = null,
    prestadorOrigemId = null,
    prestadorDestinoId = null,
    valorProposto = null
  }: DemandHistoryParams) {
    try {
      const { error } = await supabase
        .from('prestador_demandas_historico')
        .insert({
          demanda_id: demandaId,
          tipo_evento: tipoEvento,
          motivo,
          colaborador_origem_id: colaboradorOrigemId,
          colaborador_destino_id: colaboradorDestinoId,
          prestador_origem_id: prestadorOrigemId,
          prestador_destino_id: prestadorDestinoId,
          valor_proposto: valorProposto
        });

      if (error) {
        console.error('Error adding demand history:', error);
        toast.error(`Falha ao gravar histórico: ${error.message}`);
        return { success: false, error };
      }

      return { success: true };
    } catch (error) {
      console.error('Unexpected error adding demand history:', error);
      return { success: false, error };
    }
  }
};
