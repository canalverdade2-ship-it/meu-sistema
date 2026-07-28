import type * as Legacy from './types.original';

export type {
  Module,
  ProdutoFornecedorConfig,
  LojaCategoria,
  Servico,
  Produto,
  PromotionQuantityInfo,
  ProductQuantityPriceBreakdown,
  Assinatura,
  Empresa,
  Orcamento,
  OS,
  OrdemCompra,
  OrdemAssinatura,
  TicketMensagem,
  Transferencia,
  Indicacao,
  PontoMovimentacao,
  ClientePromocao,
  Notificacao,
  OrdemFiscal,
  CobrancaStatus,
  CobrancaHistoricoTipo,
  Cobranca,
  CobrancaHistorico,
  CobrancaAcordoParcela,
  CobrancaPromessaPagamento,
  EmprestimoDocumento,
  EmprestimoParcela,
  EmprestimoHistorico,
  EmprestimoComentario,
  EmprestimoTemplateContrato,
  CupomLoja,
  LojaAvaliacao,
  LojaCarrinho,
  LojaAvisoEstoque,
  LojaCreditoDocumento,
  LojaCreditoMovimentacao,
  PromocaoQuantidadeNivel,
  PromocaoComboItem,
  PromocaoNivelVip,
  PromocaoQuantidade,
  PromocaoQuantidadeUso,
} from './types.original';

export type Cliente = Legacy.Cliente & {
  pin_bloqueado?: boolean;
  pin_tentativas?: number;
  saldo?: number;
  pontos?: number;
};

export type Voucher = Legacy.Voucher & {
  data_cancelamento?: string;
};

export type Fatura = Omit<Legacy.Fatura, 'status'> & {
  status: Legacy.Fatura['status'] | 'fatura_negociada' | 'protestado';
  orcamento_id?: string;
  tem_cobranca?: boolean;
  is_amortizacao_credito?: boolean;
  clientes?: Cliente;
  ordens_compra?: Legacy.OrdemCompra;
};

export type Ticket = Legacy.Ticket & {
  prestador_id?: string;
};

export type Saque = Legacy.Saque & {
  clientes?: Cliente;
};

export type Promocao = Omit<Legacy.Promocao, 'status'> & {
  status: Legacy.Promocao['status'] | 'cancelado' | 'disponivel';
};

export type Emprestimo = Omit<Legacy.Emprestimo, 'status'> & {
  status:
    | Legacy.Emprestimo['status']
    | 'analise_quitacao'
    | 'aguardando_pagamento_quitacao';
  valor_quitacao_acordo?: number;
};

export type LojaSolicitacao = Omit<Legacy.LojaSolicitacao, 'status'> & {
  status:
    | Legacy.LojaSolicitacao['status']
    | 'pendente'
    | 'aguardando_instrucoes'
    | 'aguardando_devolucao'
    | 'devolucao_postada'
    | 'agendado'
    | 'devolucao_recebida'
    | 'novo_produto_enviado';
  descricao_detalhada?: string;
  imagens_anexo?: string[];
  metodo_entrega?: string;
  endereco_devolucao?: string;
  data_agendamento?: string;
  rastreio_cliente?: string;
  rastreio_admin?: string;
  historico_status?: Record<string, string>;
};

export type LojaCreditoSolicitacao = Legacy.LojaCreditoSolicitacao & {
  tipo?: Legacy.LojaCreditoSolicitacao['tipo_solicitacao'];
};
