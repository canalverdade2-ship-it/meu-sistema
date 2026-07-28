import type { OrdemFiscal } from '../types';
import { exportInstitutionalPdf, type InstitutionalReportColumn } from './institutionalFileExport';
import { formatCurrency, formatDate } from './utils';

const PURCHASE_TYPE_LABELS: Record<string, string> = {
  servico: 'Serviço',
  produto: 'Produto',
  assinatura: 'Assinatura',
};

const ISSUE_STATUS_LABELS: Record<string, string> = {
  pendente_emissao: 'Pendente de emissão',
  emitida: 'Emitida',
  cancelada: 'Cancelada',
  inutilizada: 'Inutilizada',
  arquivada: 'Arquivada',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  cancelado: 'Cancelado',
  estornado: 'Estornado',
};

const COLUMNS: InstitutionalReportColumn[] = [
  { key: 'section', label: 'Seção', type: 'text', width: 20 },
  { key: 'field', label: 'Campo', type: 'text', width: 28 },
  { key: 'value', label: 'Informação', type: 'text', width: 55 },
];

function text(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function fiscalCode(order: Partial<OrdemFiscal> & Record<string, unknown>): string {
  return text(order.codigo_fiscal || order.id).replace(/^—$/, 'sem-codigo');
}

export async function downloadFiscalReceiptPdf(order: Partial<OrdemFiscal> & Record<string, unknown>): Promise<void> {
  const code = fiscalCode(order);
  const total = Number(order.valor_total || 0);
  const rows: Record<string, unknown>[] = [
    { section: 'Identificação', field: 'Código fiscal', value: text(order.codigo_fiscal || order.id) },
    { section: 'Cliente', field: 'Nome', value: text(order.cliente_nome) },
    { section: 'Cliente', field: 'CPF / CNPJ', value: text(order.cliente_documento) },
    { section: 'Cliente', field: 'Telefone', value: text(order.cliente_telefone) },
    { section: 'Cliente', field: 'E-mail', value: text(order.cliente_email) },
    { section: 'Compra', field: 'Tipo', value: PURCHASE_TYPE_LABELS[text(order.tipo_compra)] || text(order.tipo_compra) },
    { section: 'Compra', field: 'Descrição', value: text(order.descricao_item) },
    { section: 'Compra', field: 'Código da ordem', value: text(order.codigo_ordem) },
    { section: 'Compra', field: 'Código do orçamento', value: text(order.codigo_orcamento) },
    { section: 'Valores', field: 'Valor bruto', value: formatCurrency(Number(order.valor_bruto || 0)) },
    { section: 'Valores', field: 'Desconto', value: formatCurrency(Number(order.valor_desconto || 0)) },
    { section: 'Valores', field: 'Acréscimo', value: formatCurrency(Number(order.valor_acrescimo || 0)) },
    { section: 'Valores', field: 'Valor total', value: formatCurrency(total) },
    { section: 'Pagamento', field: 'Status', value: PAYMENT_STATUS_LABELS[text(order.status_pagamento)] || text(order.status_pagamento) },
    { section: 'Pagamento', field: 'Forma de pagamento', value: text(order.forma_pagamento).toUpperCase() },
    { section: 'Pagamento', field: 'Data do pagamento', value: order.data_pagamento ? formatDate(order.data_pagamento) : '—' },
    { section: 'Nota fiscal', field: 'Status de emissão', value: ISSUE_STATUS_LABELS[text(order.status_emissao)] || text(order.status_emissao) },
    { section: 'Nota fiscal', field: 'Número da nota', value: text(order.numero_nota) },
    { section: 'Nota fiscal', field: 'Data de emissão', value: order.data_emissao ? formatDate(order.data_emissao) : '—' },
  ];

  await exportInstitutionalPdf({
    title: 'Recibo Fiscal',
    subtitle: `Documento fiscal referente ao registro ${code}, emitido a partir dos dados autorizados no GSA HUB.`,
    fileName: `recibo-fiscal-${code}`,
    rows,
    columns: COLUMNS,
    summary: [
      { label: 'Valor total', value: total, type: 'currency' },
      { label: 'Pagamento', value: PAYMENT_STATUS_LABELS[text(order.status_pagamento)] || text(order.status_pagamento), type: 'text' },
      { label: 'Emissão', value: ISSUE_STATUS_LABELS[text(order.status_emissao)] || text(order.status_emissao), type: 'text' },
    ],
    filters: {
      'Código fiscal': text(order.codigo_fiscal || order.id),
      'Número da nota': text(order.numero_nota),
    },
    source: 'Módulo Fiscal GSA HUB',
    confidentiality: 'Documento fiscal gerado para consulta do titular e da equipe autorizada do GSA HUB.',
  });
}
