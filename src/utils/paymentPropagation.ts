import { supabase } from '../lib/supabase';
import { notificationService } from '../lib/notificationService';

export interface FaturaData {
  id: string;
  codigo_fatura: string | null;
  ordem_compra_id: string | null;
  ordem_assinatura_id: string | null;
  os_id: string | null;
  cliente_id: string | null;
  is_amortizacao_credito: boolean | null;
  valor_total: number | null;
  valor_base_original?: number | null;
}

export interface SolicitacaoData {
  id: string;
  tipo: string;
  cliente_id: string;
  historico_status: Record<string, string> | null;
}

export interface ClienteCreditoData {
  limite_credito_disponivel: number | null;
  limite_credito_total: number | null;
  nome: string | null;
}

export interface OrdemCompraData {
  id: string;
  orcamento_id: string | null;
}

export interface OrdemAssinaturaData {
  id: string;
  orcamento_id: string | null;
}

export interface OrdemServicoData {
  id: string;
  orcamento_id: string | null;
}

export async function propagateFaturaPayment(faturaId: string) {
  try {
    // 1. Buscar a fatura para ver os vínculos de ordem e código da fatura
    const { data: fatura, error: fatError } = (await supabase
      .from('faturas')
      .select('id, codigo_fatura, ordem_compra_id, ordem_assinatura_id, os_id, cliente_id, is_amortizacao_credito, valor_total, valor_base_original')
      .eq('id', faturaId)
      .single()) as { data: FaturaData | null; error: unknown };

    if (fatError || !fatura) {
      console.error('Erro ao buscar fatura para propagar pagamento:', fatError);
      return;
    }

    // 1.1 Se for fatura de diferença de troca de produto (FAT-TROCA-XXXX)
    if (fatura.codigo_fatura && fatura.codigo_fatura.startsWith('FAT-TROCA-')) {
      const codigoSolicitacao = fatura.codigo_fatura.replace('FAT-TROCA-', '');
      
      // Buscar a solicitação de troca correspondente para pegar o id e tipo
      const { data: solicitacao } = (await supabase
        .from('loja_solicitacoes')
        .select('id, tipo, cliente_id, historico_status')
        .eq('codigo_solicitacao', codigoSolicitacao)
        .single()) as { data: SolicitacaoData | null };

      if (solicitacao) {
        // Atualizar status da solicitação de troca para 'aguardando_instrucoes'
        const novoHistorico = { 
          ...(solicitacao.historico_status || {}),
          ['aguardando_instrucoes']: new Date().toISOString()
        };

        const { error: updateError } = await supabase
          .from('loja_solicitacoes')
          .update({ 
            status: 'aguardando_instrucoes',
            historico_status: novoHistorico,
            updated_at: new Date().toISOString()
          })
          .eq('id', solicitacao.id);

        if (!updateError) {
          // Notificar o cliente de que o pagamento foi confirmado e a logística se iniciou
          await notificationService.notifyClient(
            solicitacao.cliente_id,
            '💳 Pagamento Diferença Troca Confirmado',
            `O pagamento da fatura da sua solicitação de ${solicitacao.tipo} foi confirmado! O processo de logística foi iniciado e em breve o admin informará as instruções.`,
            'gsa_store',
            'pagamento_confirmado',
            { tab: 'acompanhar', itemId: solicitacao.id, prioridade: 'alta' }
          );
        }
      }
    }
    // 1.2 Se for fatura de amortização de crédito da loja (is_amortizacao_credito)
    if (fatura.is_amortizacao_credito && fatura.cliente_id) {
      const valorPago = Number(fatura.valor_total) || 0;

      if (valorPago > 0) {
        // Buscar limite atual do cliente
        const { data: clienteData } = (await supabase
          .from('clientes')
          .select('limite_credito_disponivel, limite_credito_total, nome')
          .eq('id', fatura.cliente_id)
          .single()) as { data: ClienteCreditoData | null };

        if (clienteData) {
          const limiteDisponivelAnterior = Number(clienteData.limite_credito_disponivel) || 0;
          const limiteTotalAtual = Number(clienteData.limite_credito_total) || 0;
          
          // Se a fatura tiver um valor original maior (ex: quitação com desconto), restaura o limite completo
          const valorRestaurado = (Number(fatura.valor_base_original) > valorPago)
            ? Number(fatura.valor_base_original)
            : valorPago;
            
          const novoLimiteDisponivel = Math.round((limiteDisponivelAnterior + valorRestaurado) * 100) / 100;

          // Atualizar limite disponível do cliente
          await supabase
            .from('clientes')
            .update({ limite_credito_disponivel: novoLimiteDisponivel })
            .eq('id', fatura.cliente_id);

          // Registrar movimentação de amortização no extrato
          await supabase
            .from('loja_credito_movimentacoes')
            .insert({
              cliente_id: fatura.cliente_id,
              tipo: 'amortizacao',
              valor: valorRestaurado,
              descricao: `Amortização de parcela de crédito (Fatura ${fatura.codigo_fatura || fatura.id.substring(0, 8)})`,
              limite_total_anterior: limiteTotalAtual,
              limite_total_novo: limiteTotalAtual,
              limite_disponivel_anterior: limiteDisponivelAnterior,
              limite_disponivel_novo: novoLimiteDisponivel,
              created_at: new Date().toISOString()
            });

          // Notificar o cliente
          await notificationService.notifyClient(
            fatura.cliente_id,
            '✅ Parcela de Crédito Paga',
            `Sua parcela de R$ ${valorPago.toFixed(2).replace('.', ',')} (${fatura.codigo_fatura}) foi confirmada. Seu limite disponível foi atualizado para R$ ${novoLimiteDisponivel.toFixed(2).replace('.', ',')}.`,
            'credito_loja',
            'amortizacao_confirmada',
            { tab: 'meu_credito' }
          );
        }
      }
    }

    // 2. Propagar para Ordem de Compra
    if (fatura.ordem_compra_id) {
      const { data: oc } = (await supabase
        .from('ordens_compra')
        .select('id, orcamento_id')
        .eq('id', fatura.ordem_compra_id)
        .single()) as { data: OrdemCompraData | null };

      if (oc) {
        // Atualizar status da ordem de compra
        await supabase
          .from('ordens_compra')
          .update({ status: 'pago' })
          .eq('id', oc.id);

        if (oc.orcamento_id) {
          // Atualizar status do orçamento e entrega
          await supabase
            .from('orcamentos')
            .update({ 
              status: 'pago', 
              status_entrega: 'pagamento_aprovado',
              data_pagamento_aprovado: new Date().toISOString()
            })
            .eq('id', oc.orcamento_id);
            
          // Adicionalmente, se houver outras ordens vinculadas ao mesmo orçamento, podemos atualizar o status delas também
          await supabase
            .from('ordens_compra')
            .update({ status: 'pago' })
            .eq('orcamento_id', oc.orcamento_id);

          await supabase
            .from('ordens_assinatura')
            .update({ status: 'concluido' })
            .eq('orcamento_id', oc.orcamento_id);
        }
      }
    }

    // 3. Propagar para Ordem de Assinatura
    if (fatura.ordem_assinatura_id) {
      const { data: oa } = (await supabase
        .from('ordens_assinatura')
        .select('id, orcamento_id')
        .eq('id', fatura.ordem_assinatura_id)
        .single()) as { data: OrdemAssinaturaData | null };

      if (oa) {
        // Atualizar status da ordem de assinatura para concluído (Ativa)
        await supabase
          .from('ordens_assinatura')
          .update({ status: 'concluido' })
          .eq('id', oa.id);

        if (oa.orcamento_id) {
          // Atualizar status do orçamento e entrega
          await supabase
            .from('orcamentos')
            .update({ 
              status: 'pago', 
              status_entrega: 'pagamento_aprovado',
              data_pagamento_aprovado: new Date().toISOString()
            })
            .eq('id', oa.orcamento_id);
            
          // Atualizar outras ordens vinculadas ao mesmo orçamento
          await supabase
            .from('ordens_compra')
            .update({ status: 'pago' })
            .eq('orcamento_id', oa.orcamento_id);

          await supabase
            .from('ordens_assinatura')
            .update({ status: 'concluido' })
            .eq('orcamento_id', oa.orcamento_id);
        }
      }
    }

    // 4. Propagar para Ordem de Serviço
    if (fatura.os_id) {
      const { data: os } = (await supabase
        .from('ordens_servico')
        .select('id, orcamento_id')
        .eq('id', fatura.os_id)
        .single()) as { data: OrdemServicoData | null };

      if (os) {
        await supabase
          .from('ordens_servico')
          .update({ status: 'pago' })
          .eq('id', os.id);

        if (os.orcamento_id) {
          await supabase
            .from('orcamentos')
            .update({ status: 'pago' })
            .eq('id', os.orcamento_id);
        }
      }
    }
  } catch (err: unknown) {
    console.error('Erro na propagação de pagamento da fatura:', err);
  }
}
