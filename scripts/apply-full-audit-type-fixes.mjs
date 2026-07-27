import { readFileSync, writeFileSync } from 'node:fs';

const file = 'src/types.ts';
let source = readFileSync(file, 'utf8');
let replacements = 0;

function replaceRequired(pattern, replacement, label) {
  if (!pattern.test(source)) {
    throw new Error(`Padrao nao encontrado para: ${label}`);
  }
  source = source.replace(pattern, replacement);
  replacements += 1;
}

replaceRequired(
  /  max_parcelas\?: number;\n};/,
  `  max_parcelas?: number;\n  pin_bloqueado?: boolean;\n  saldo?: number;\n  pontos?: number;\n};`,
  'campos operacionais do cliente',
);

replaceRequired(
  /  motivo_cancelamento\?: string;\n  categoria: 'desconto' \| 'saque';/,
  `  motivo_cancelamento?: string;\n  data_cancelamento?: string;\n  categoria: 'desconto' | 'saque';`,
  'data de cancelamento do voucher',
);

replaceRequired(
  /  status: 'pendente' \| 'pago' \| 'cancelado' \| 'revisada' \| 'vencida' \| 'aguardando_link' \| 'pendente_pagamento';/,
  `  status: 'pendente' | 'pago' | 'cancelado' | 'revisada' | 'vencida' | 'aguardando_link' | 'pendente_pagamento' | 'fatura_negociada' | 'protestado';`,
  'status adicionais de fatura',
);

replaceRequired(
  /  emprestimo_id\?: string;\n};/,
  `  emprestimo_id?: string;\n  orcamento_id?: string;\n  tem_cobranca?: boolean;\n  is_amortizacao_credito?: boolean;\n  clientes?: Cliente;\n  ordens_compra?: OrdemCompra;\n};`,
  'joins e metadados de fatura',
);

replaceRequired(
  /  data_fechamento\?: string;\n};/,
  `  data_fechamento?: string;\n  prestador_id?: string;\n};`,
  'prestador associado ao ticket',
);

replaceRequired(
  /  motivo_prorrogacao\?: string;\n};/,
  `  motivo_prorrogacao?: string;\n  clientes?: Cliente;\n};`,
  'join de cliente no saque',
);

replaceRequired(
  /  status: 'ativa' \| 'suspensa' \| 'encerrada' \| 'usada' \| 'cancelada';/,
  `  status: 'ativa' | 'suspensa' | 'encerrada' | 'usada' | 'cancelada' | 'cancelado' | 'disponivel';`,
  'status derivados de promocao',
);

replaceRequired(
  /  status: 'analise_inicial' \| 'proposta_enviada' \| 'proposta_expirada' \| 'aguardando_dados_bancarios' \| 'analise_final' \| 'pendencia_assinatura' \| 'analise_contrato' \| 'pendencia_documentos' \| 'aprovado' \| 'ativo' \| 'quitado' \| 'cancelado';/,
  `  status: 'analise_inicial' | 'proposta_enviada' | 'proposta_expirada' | 'aguardando_dados_bancarios' | 'analise_final' | 'pendencia_assinatura' | 'analise_contrato' | 'pendencia_documentos' | 'analise_quitacao' | 'aguardando_pagamento_quitacao' | 'aprovado' | 'ativo' | 'quitado' | 'cancelado';`,
  'fluxo de quitacao do emprestimo',
);

replaceRequired(
  /  motivo_pendencia\?: string;\n  created_at: string;/,
  `  motivo_pendencia?: string;\n  valor_quitacao_acordo?: number;\n  created_at: string;`,
  'valor de quitacao do emprestimo',
);

replaceRequired(
  /  status: 'em_analise' \| 'aprovado' \| 'rejeitado' \| 'concluido';\n  resposta_admin\?: string;/,
  `  status: 'pendente' | 'em_analise' | 'aprovado' | 'rejeitado' | 'aguardando_instrucoes' | 'aguardando_devolucao' | 'devolucao_postada' | 'agendado' | 'devolucao_recebida' | 'novo_produto_enviado' | 'concluido';\n  resposta_admin?: string;`,
  'status completos de troca e devolucao',
);

replaceRequired(
  /  novo_orcamento_id\?: string;\n  created_at: string;/,
  `  novo_orcamento_id?: string;\n  descricao_detalhada?: string;\n  imagens_anexo?: string[];\n  metodo_entrega?: string;\n  endereco_devolucao?: string;\n  data_agendamento?: string;\n  rastreio_cliente?: string;\n  rastreio_admin?: string;\n  historico_status?: Record<string, unknown>[];\n  created_at: string;`,
  'dados operacionais de troca e devolucao',
);

replaceRequired(
  /  tipo_solicitacao: 'adesao' \| 'alteracao';\n  status:/,
  `  tipo_solicitacao: 'adesao' | 'alteracao';\n  tipo?: 'adesao' | 'alteracao';\n  status:`,
  'alias de tipo da solicitacao de credito',
);

writeFileSync(file, source, 'utf8');
console.log(`Aplicadas ${replacements} correcoes estruturais em ${file}.`);
