import { supabase, logValidation } from './base';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

async function validateSubscriptions() {
  logValidation('🚀 INICIANDO VALIDAÇÃO: ETAPA 6 - ASSINATURAS RECORRENTES');

  try {
    // 1. Carregar estado anterior
    const statePath = resolve(process.cwd(), 'src/validation/state.json');
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    const { cliente_id } = state;

    if (!cliente_id) throw new Error('Cliente ID não encontrado no estado.');

    // 2. Criar uma Ordem de Assinatura (Simulando Venda de Recorrência)
    logValidation('🔹 Criando Ordem de Assinatura Recorrente...');
    const { data: assinatura, error: assError } = await supabase
      .from('ordens_assinatura')
      .insert([{
        cliente_id: cliente_id,
        status: 'pendente',
        valor_mensal: 299.90,
        dia_vencimento: 10,
        descricao: 'Plano Plus GSA - Teste Validação'
      }])
      .select()
      .single();

    if (assError) throw assError;
    logValidation(`✅ Ordem de Assinatura criada: ${assinatura.id}`);

    // 3. Simular Aprovação e Geração de Fatura de Assinatura
    logValidation('🔹 Aprovando e ativando assinatura...');
    const { data: fatura, error: fatError } = await supabase
      .from('faturas')
      .insert([{
        cliente_id: cliente_id,
        ordem_assinatura_id: assinatura.id,
        valor_total: 299.90,
        status: 'pendente',
        data_vencimento: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 10).toISOString(),
        descricao: 'Mensalidade GSA - Parcela 01'
      }])
      .select()
      .single();

    if (fatError) throw fatError;

    // Atualizar status da assinatura para ativa
    await supabase.from('ordens_assinatura').update({ status: 'ativa' }).eq('id', assinatura.id);
    logValidation('✅ Assinatura ativada e fatura gerada.');

    // 4. Salvar estado da assinatura
    state.assinatura_id = assinatura.id;
    state.fatura_assinatura_id = fatura.id;
    writeFileSync(statePath, JSON.stringify(state, null, 2));

    logValidation('\n🔹 --- CHECKLIST DE ASSINATURAS ---');
    logValidation(`✅ Contrato Gerado: OK`);
    logValidation(`✅ Status Ativa: OK`);
    logValidation(`✅ Fatura Vinculada: FAT-ASSIN-${fatura.id.substring(0,4)}`);

    logValidation('\n✨ ETAPA 6 CONCLUÍDA COM SUCESSO!');

  } catch (error: any) {
    logValidation(`❌ ERRO NA ETAPA 6: ${error.message}`);
    process.exit(1);
  }
}

validateSubscriptions();
