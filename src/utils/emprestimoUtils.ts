import { supabase } from '../lib/supabase';

/**
 * Registra uma ação no histórico do empréstimo (auditoria)
 */
export async function registrarHistoricoEmprestimo(
  emprestimoId: string | null,
  orcamentoId: string | null,
  tipoAcao: string,
  descricao: string,
  usuarioTipo: 'admin' | 'cliente' | 'sistema',
  usuarioId?: string,
  metadata?: Record<string, any>
) {
  try {
    await supabase.from('emprestimo_historico').insert([{
      emprestimo_id: emprestimoId,
      orcamento_id: orcamentoId,
      tipo_acao: tipoAcao,
      descricao,
      usuario_tipo: usuarioTipo,
      usuario_id: usuarioId,
      metadata
    }]);
  } catch (error) {
    console.error('Erro ao registrar histórico:', error);
  }
}

/**
 * Calcula o valor da parcela de um empréstimo
 * Juros total = percentual aplicado sobre o valor aprovado
 * Fórmula: valorTotal = valorAprovado × (1 + jurosTotalPercentual/100)
 *          valorParcela = valorTotal / parcelas
 */
export function calcularParcela(
  valorAprovado: number,
  jurosTotalPercentual: number,
  numeroParcelas: number
): { valorParcela: number; valorTotalFinanciado: number } {
  const valorTotalFinanciado = Math.round(valorAprovado * (1 + jurosTotalPercentual / 100) * 100) / 100;
  const valorParcela = Math.round((valorTotalFinanciado / numeroParcelas) * 100) / 100;
  return {
    valorParcela,
    valorTotalFinanciado
  };
}

/**
 * Retorna informações visuais do status do empréstimo
 */
export function getEmprestimoStatusInfo(status: string) {
  const map: Record<string, { label: string; color: string; bg: string; step: number }> = {
    'analise_inicial': { label: 'Em Análise', color: 'text-blue-700', bg: 'bg-blue-50', step: 1 },
    'proposta_enviada': { label: 'Proposta Recebida', color: 'text-indigo-700', bg: 'bg-indigo-50', step: 2 },
    'proposta_expirada': { label: 'Proposta Expirada', color: 'text-neutral-700', bg: 'bg-neutral-100', step: 2 },
    'aguardando_dados_bancarios': { label: 'Dados Bancários', color: 'text-purple-700', bg: 'bg-purple-50', step: 3 },
    'analise_final': { label: 'Análise Final', color: 'text-blue-700', bg: 'bg-blue-50', step: 3 },
    'pendencia_assinatura': { label: 'Assinar Contrato', color: 'text-amber-700', bg: 'bg-amber-50', step: 4 },
    'analise_contrato': { label: 'Analisando Contrato', color: 'text-blue-700', bg: 'bg-blue-50', step: 4 },
    'pendencia_documentos': { label: 'Pendência Documentos', color: 'text-rose-700', bg: 'bg-rose-50', step: 4 },
    'aprovado': { label: 'Aprovado', color: 'text-emerald-700', bg: 'bg-emerald-50', step: 5 },
    'ativo': { label: 'Ativo', color: 'text-emerald-700', bg: 'bg-emerald-50', step: 6 },
    'analise_quitacao': { label: 'Análise de Quitação', color: 'text-amber-700', bg: 'bg-amber-50', step: 6 },
    'aguardando_pagamento_quitacao': { label: 'Oferta de Quitação', color: 'text-indigo-700', bg: 'bg-indigo-50', step: 6 },
    'quitado': { label: 'Quitado', color: 'text-teal-700', bg: 'bg-teal-50', step: 6 },
    'cancelado': { label: 'Cancelado', color: 'text-red-700', bg: 'bg-red-50', step: 0 },
  };
  return map[status] || { label: status, color: 'text-neutral-500', bg: 'bg-neutral-50', step: 0 };
}

/**
 * Etapas do stepper visual
 */
export const EMPRESTIMO_STEPS = [
  { step: 1, label: 'Solicitação' },
  { step: 2, label: 'Proposta' },
  { step: 3, label: 'Dados Bancários' },
  { step: 4, label: 'Contrato' },
  { step: 5, label: 'Aprovação' },
  { step: 6, label: 'Ativo' },
];

/**
 * Verifica se o cliente pode solicitar um novo empréstimo
 */
export async function verificarElegibilidadeEmprestimo(clienteId: string): Promise<{ elegivel: boolean; motivo?: string }> {
  // 1. Buscar configuração de limite
  const { data: settings } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'emprestimo_limite_simultaneos')
    .single();
  
  const limite = parseInt(settings?.value || '1');

  // 2. Contar empréstimos ativos/em análise
  const { count } = await supabase
    .from('emprestimos')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .not('status', 'in', '("quitado","cancelado","proposta_expirada")');

  if (count && count >= limite) {
    return { elegivel: false, motivo: `Você já possui ${count} empréstimo(s) ativo(s). O limite é de ${limite} empréstimo(s) simultâneo(s).` };
  }

  // 3. Verificar inadimplência
  const { count: parcelasVencidas } = await supabase
    .from('emprestimo_parcelas')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .eq('status', 'vencida');

  if (parcelasVencidas && parcelasVencidas > 0) {
    return { elegivel: false, motivo: `Você possui ${parcelasVencidas} parcela(s) vencida(s). Regularize antes de solicitar um novo empréstimo.` };
  }

  return { elegivel: true };
}
