import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate, formatDateTime } from './utils';
import { Orcamento, OS, Fatura, Empresa } from '../types';
import { supabase } from './supabase';

// ─── Interfaces para os PDFs ──────────────────────────────────────────────────
export interface PdfEmpresa {
  razao_social?: string;
  nome?: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
}

export interface PdfCliente {
  nome?: string;
  cpf?: string;
  cnpj?: string;
  codigo_cliente?: string;
  telefone?: string;
}

export interface PdfItem {
  nome?: string;
}

export interface PdfOrcamento {
  servicos?: { nome?: string };
  valor_servico?: number;
  valor_adicional?: number;
  descricao_adicional?: string;
  acrescimo?: number;
  desconto?: number;
  total?: number;
}

export interface PdfOS {
  codigo_os?: string;
  orcamentos?: PdfOrcamento;
}

export interface PdfFaturaItem {
  descricao?: string;
  valor?: number;
}

// ─── Design Tokens ────────────────────────────────────────────────────────────
const COLOR = {
  primary:     [15,  23,  42]  as [number, number, number],  // slate-900
  accent:      [79,  70,  229] as [number, number, number],  // indigo-600
  accentLight: [238,242,255]   as [number, number, number],  // indigo-50
  success:     [22,  163,  74] as [number, number, number],  // emerald-600
  successBg:   [240,253,244]   as [number, number, number],  // emerald-50
  warning:     [217,119,  6]   as [number, number, number],  // amber-600
  warningBg:   [255,251,235]   as [number, number, number],  // amber-50
  danger:      [220, 38,  38]  as [number, number, number],  // red-600
  dangerBg:    [254,242,242]   as [number, number, number],  // red-50
  dark:        [30,  30,  30]  as [number, number, number],
  gray:        [100,116,139]   as [number, number, number],  // slate-500
  grayLight:   [226,232,240]   as [number, number, number],  // slate-200
  rowAlt:      [248,250,252]   as [number, number, number],  // slate-50
  white:       [255,255,255]   as [number, number, number],
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function checkPageBreak(doc: jsPDF, y: number, neededH: number): number {
  if (y + neededH > PAGE_H - 25) {
    doc.addPage();
    return 20;
  }
  return y;
}

function rgbString(c: [number, number, number]) {
  return c.join(',');
}

/** Trunca texto para caber em maxW (em mm) com a fonte/size ativa */
function truncate(doc: jsPDF, text: string, maxW: number): string {
  while (doc.getTextWidth(text) > maxW && text.length > 3) {
    text = text.slice(0, -4) + '…';
  }
  return text;
}

/**
 * Desenha o cabeçalho premium (duas faixas: dark + accent strip).
 * Retorna o Y logo após o cabeçalho.
 */
function drawHeader(doc: jsPDF, empresa: PdfEmpresa | null | undefined, docTitle: string, docSubtitle: string | string[]): number {
  // Faixa principal dark
  doc.setFillColor(...COLOR.primary);
  doc.rect(0, 0, PAGE_W, 44, 'F');

  // Strip accent na base do header
  doc.setFillColor(...COLOR.accent);
  doc.rect(0, 41, PAGE_W, 3, 'F');

  // Título do documento (direita)
  doc.setTextColor(...COLOR.white);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const titleLabel = docTitle.toUpperCase();
  doc.text(titleLabel, PAGE_W - MARGIN, 13, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 190, 210);
  const subtitles = Array.isArray(docSubtitle) ? docSubtitle : docSubtitle.split('  •  ');
  let subY = 20;
  for (const sub of subtitles) {
    doc.text(sub.trim(), PAGE_W - MARGIN, subY, { align: 'right' });
    subY += 4.5;
  }

  // Nome da empresa (esquerda)
  doc.setTextColor(...COLOR.white);
  doc.setFont('helvetica', 'bold');
  let rawCompanyName = empresa?.razao_social || empresa?.nome || 'EMPRESA';
  
  // Calcula o espaço máximo para o nome da empresa sem sobrepor o título direito
  doc.setFontSize(14);
  const titleW = doc.getTextWidth(titleLabel);
  const maxCompanyW = PAGE_W - (MARGIN * 2) - titleW - 10;
  
  let fontSize = 16;
  doc.setFontSize(fontSize);
  while (doc.getTextWidth(rawCompanyName) > maxCompanyW && fontSize > 10) {
    fontSize -= 0.5;
    doc.setFontSize(fontSize);
  }
  const companyName = truncate(doc, rawCompanyName, maxCompanyW);
  doc.text(companyName, MARGIN, 16);

  // Dados empresa
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 190, 210);
  let currentY = 22;
  
  if (empresa?.cnpj) {
    doc.text(`CNPJ: ${empresa.cnpj}`, MARGIN, currentY);
    currentY += 4.5;
  }
  if (empresa?.telefone) {
    doc.text(`Tel: ${empresa.telefone}`, MARGIN, currentY);
    currentY += 4.5;
  }
  if (empresa?.email) {
    doc.text(empresa.email, MARGIN, currentY);
    currentY += 4.5;
  }
  if (empresa?.endereco) {
    doc.text(empresa.endereco, MARGIN, currentY);
  }

  return 52; // Y de início do conteúdo
}

/** Rodapé em todas as páginas */
function drawFooter(doc: jsPDF, empresa: PdfEmpresa | null | undefined) {
  const pages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    // Linha separadora
    doc.setDrawColor(...COLOR.grayLight);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR.gray);
    doc.text(empresa?.razao_social || '', MARGIN, PAGE_H - 9);
    doc.text(`Emitido em: ${formatDateTime(new Date().toISOString())}`, 105, PAGE_H - 9, { align: 'center' });
    doc.text(`Pág. ${i} / ${pages}`, PAGE_W - MARGIN, PAGE_H - 9, { align: 'right' });
  }
}

/** Título de seção com linha colorida */
function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(...COLOR.accent);
  doc.rect(MARGIN, y, 2.5, 6, 'F');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR.primary);
  doc.text(title.toUpperCase(), MARGIN + 5, y + 4.5);

  doc.setDrawColor(...COLOR.grayLight);
  doc.setLineWidth(0.2);
  doc.line(MARGIN + 5 + doc.getTextWidth(title.toUpperCase()) + 3, y + 2.5, PAGE_W - MARGIN, y + 2.5);

  return y + 12;
}

/** Info em 2 colunas dentro de um card cinza */
function drawInfoCard(doc: jsPDF, fields: [string, string][], y: number, columns = 2): number {
  const cardPad = 5;
  const colW = CONTENT_W / columns;
  const rowH = 8;
  const rows = Math.ceil(fields.length / columns);
  const cardH = rows * rowH + cardPad * 2;

  doc.setFillColor(...COLOR.rowAlt);
  doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 2, 2, 'F');
  doc.setDrawColor(...COLOR.grayLight);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 2, 2, 'S');

  fields.forEach(([label, value], idx) => {
    const col = idx % columns;
    const row = Math.floor(idx / columns);
    const xBase = MARGIN + cardPad + col * colW;
    const yBase = y + cardPad + row * rowH;

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR.gray);
    doc.text(label.toUpperCase(), xBase, yBase + 2.5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR.dark);
    doc.text(truncate(doc, value || '—', colW - cardPad - 2), xBase, yBase + 7);
  });

  return y + cardH + 6;
}

/** Badge de status colorido */
function drawStatusBadge(doc: jsPDF, status: string, x: number, y: number) {
  const statusMap: Record<string, { label: string; bg: [number,number,number]; fg: [number,number,number] }> = {
    pago:             { label: 'PAGO',             bg: COLOR.successBg, fg: COLOR.success },
    aprovado:         { label: 'APROVADO',         bg: COLOR.successBg, fg: COLOR.success },
    pendente:         { label: 'PENDENTE',         bg: COLOR.warningBg, fg: COLOR.warning },
    pendente_pagamento:{ label: 'AG. PAGAMENTO',   bg: COLOR.warningBg, fg: COLOR.warning },
    em_aberto:        { label: 'EM ABERTO',        bg: COLOR.accentLight, fg: COLOR.accent },
    vencida:          { label: 'VENCIDA',          bg: COLOR.dangerBg,  fg: COLOR.danger  },
    cancelado:        { label: 'CANCELADO',        bg: COLOR.dangerBg,  fg: COLOR.danger  },
  };
  const cfg = statusMap[status?.toLowerCase()] || { label: status?.toUpperCase() || 'N/A', bg: COLOR.rowAlt, fg: COLOR.gray };
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  const tw = doc.getTextWidth(cfg.label) + 6;
  doc.setFillColor(...cfg.bg);
  doc.roundedRect(x, y - 4.5, tw, 6.5, 1.5, 1.5, 'F');
  doc.setTextColor(...cfg.fg);
  doc.text(cfg.label, x + 3, y);
}

/** Bloco de total destacado */
function drawTotalBlock(doc: jsPDF, rows: [string, string, boolean?][], y: number): number {
  const blockH = rows.length * 8 + 6;
  doc.setFillColor(...COLOR.accentLight);
  doc.roundedRect(MARGIN, y, CONTENT_W, blockH, 3, 3, 'F');
  doc.setDrawColor(...COLOR.accent);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, CONTENT_W, blockH, 3, 3, 'S');

  rows.forEach(([label, value, isTotal], idx) => {
    const rowY = y + 7 + idx * 8;
    if (isTotal) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR.accent);
    } else {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLOR.dark);
    }
    doc.text(label, MARGIN + 5, rowY);
    doc.text(value, PAGE_W - MARGIN - 5, rowY, { align: 'right' });

    // Linha separadora fina entre linhas (exceto a última)
    if (idx < rows.length - 1) {
      doc.setDrawColor(...COLOR.grayLight);
      doc.setLineWidth(0.15);
      doc.line(MARGIN + 3, rowY + 3.5, PAGE_W - MARGIN - 3, rowY + 3.5);
    }
  });

  return y + blockH + 6;
}

// ─── Geradores ────────────────────────────────────────────────────────────────

export async function generateOrcamentoPDF(orcamento: Orcamento, cliente: PdfCliente | null | undefined, item: PdfItem | null | undefined, options: { returnDoc?: boolean } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { data: empresa } = await supabase.from('empresa').select('*').limit(1).single();

  let y = drawHeader(doc, empresa, 'Orçamento', `N.º ${orcamento.codigo_orcamento}  •  ${formatDate(orcamento.data_criacao)}`);

  // Informações Gerais
  y = drawSectionTitle(doc, 'Informações do Orçamento', y);
  y = drawInfoCard(doc, [
    ['Código', orcamento.codigo_orcamento],
    ['Data de Emissão', formatDate(orcamento.data_criacao)],
    ['Categoria', (orcamento.categoria || 'Serviço').toUpperCase()],
    ['Status', (orcamento.status || 'aberto').toUpperCase()],
  ], y, 2);

  // Cliente
  y = drawSectionTitle(doc, 'Dados do Cliente', y);
  y = drawInfoCard(doc, [
    ['Nome Completo', cliente?.nome || '–'],
    ['CPF / CNPJ', cliente?.cpf || cliente?.cnpj || '–'],
    ['Código', cliente?.codigo_cliente || '–'],
    ['Telefone', cliente?.telefone || '–'],
  ], y, 2);

  // Serviços / itens
  y = drawSectionTitle(doc, 'Itens do Orçamento', y);

  const itemNome = item?.nome || orcamento.descricao_adicional || 'Item';
  const itemValor = orcamento.categoria === 'produto' ? orcamento.valor_produto :
                    orcamento.categoria === 'assinatura' ? orcamento.valor_assinatura :
                    orcamento.valor_servico;
  const quantidade = orcamento.quantidade || 1;

  const tableBody: string[][] = [
    [itemNome, quantidade.toString(), formatCurrency(itemValor), formatCurrency(itemValor * quantidade)],
  ];
  if ((orcamento.valor_adicional || 0) > 0) {
    tableBody.push([orcamento.descricao_adicional || 'Taxa Adicional', '1', formatCurrency(orcamento.valor_adicional), formatCurrency(orcamento.valor_adicional)]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Descrição', 'Qtd', 'Valor Unit.', 'Total']],
    body: tableBody,
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 }, textColor: COLOR.dark, lineColor: COLOR.grayLight, lineWidth: 0.15 },
    headStyles: { fillColor: COLOR.primary, textColor: COLOR.white, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: COLOR.rowAlt },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 15, halign: 'center' }, 2: { cellWidth: 30, halign: 'right' }, 3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Totais
  y = checkPageBreak(doc, y, 60);
  y = drawSectionTitle(doc, 'Resumo Financeiro', y);
  const totalRows: [string, string, boolean?][] = [
    ['Subtotal', formatCurrency(itemValor * quantidade + (orcamento.valor_adicional || 0))],
  ];
  if ((orcamento.acrescimo || 0) > 0) totalRows.push([`Acréscimo`, `+ ${formatCurrency(orcamento.acrescimo)}`]);
  if ((orcamento.desconto || 0) > 0)  totalRows.push([`Desconto`, `- ${formatCurrency(orcamento.desconto)}`]);
  totalRows.push([`Valor Total do Orçamento`, formatCurrency(orcamento.total), true]);
  y = drawTotalBlock(doc, totalRows, y);

  // Observações
  if (orcamento.descricao_adicional) {
    y = checkPageBreak(doc, y, 30);
    y = drawSectionTitle(doc, 'Observações', y);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR.dark);
    const lines = doc.splitTextToSize(orcamento.descricao_adicional, CONTENT_W);
    doc.text(lines, MARGIN, y);
    y += lines.length * 4;
  }

  drawFooter(doc, empresa);

  if (options.returnDoc) return doc;
  doc.save(`orcamento_${orcamento.codigo_orcamento}.pdf`);
}

export async function generateOSPDF(os: OS, cliente: PdfCliente | null | undefined, orcamento: PdfOrcamento | null | undefined, options: { returnDoc?: boolean } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { data: empresa } = await supabase.from('empresa').select('*').limit(1).single();

  let y = drawHeader(doc, empresa, 'Ordem de Serviço', `OS: ${os.codigo_os}  •  Início: ${formatDate(os.data_inicio)}`);

  // OS Info
  y = drawSectionTitle(doc, 'Dados da Ordem de Serviço', y);
  y = drawInfoCard(doc, [
    ['Código OS', os.codigo_os],
    ['Status', (os.status || '–').toUpperCase()],
    ['Data de Início', formatDate(os.data_inicio)],
    ['Conclusão', os.data_fim ? formatDate(os.data_fim) : '–'],
  ], y, 2);

  // Cliente
  y = drawSectionTitle(doc, 'Dados do Cliente', y);
  y = drawInfoCard(doc, [
    ['Nome Completo', cliente?.nome || '–'],
    ['CPF / CNPJ', cliente?.cpf || cliente?.cnpj || '–'],
    ['Código', cliente?.codigo_cliente || '–'],
    ['Telefone', cliente?.telefone || '–'],
  ], y, 2);

  // Serviço
  y = drawSectionTitle(doc, 'Detalhamento do Serviço', y);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Descrição', 'Valor']],
    body: [
      ['Serviço: ' + (orcamento?.servicos?.nome || '–'), formatCurrency(orcamento?.valor_servico || 0)],
      ...(orcamento?.valor_adicional > 0 ? [[orcamento.descricao_adicional || 'Taxa Adicional', formatCurrency(orcamento.valor_adicional)]] : []),
      ...(orcamento?.acrescimo > 0 ? [['Acréscimo', `+ ${formatCurrency(orcamento.acrescimo)}`]] : []),
      ...(orcamento?.desconto > 0  ? [['Desconto', `- ${formatCurrency(orcamento.desconto)}`]] : []),
    ],
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 }, textColor: COLOR.dark, lineColor: COLOR.grayLight, lineWidth: 0.15 },
    headStyles: { fillColor: COLOR.primary, textColor: COLOR.white, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: COLOR.rowAlt },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 40, halign: 'right', fontStyle: 'bold' } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Total
  y = checkPageBreak(doc, y, 40);
  y = drawSectionTitle(doc, 'Total do Serviço', y);
  y = drawTotalBlock(doc, [
    ['Valor Total da OS', formatCurrency(orcamento?.total || 0), true],
  ], y);

  // Assinaturas
  y = checkPageBreak(doc, y, 40);
  y = drawSectionTitle(doc, 'Assinaturas', y + 6);
  doc.setDrawColor(...COLOR.grayLight);
  doc.setLineWidth(0.3);
  const sigY = y + 16;
  doc.line(MARGIN, sigY, MARGIN + 70, sigY);
  doc.line(PAGE_W - MARGIN - 70, sigY, PAGE_W - MARGIN, sigY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR.gray);
  doc.text('Responsável pela Empresa', MARGIN + 35, sigY + 5, { align: 'center' });
  doc.text('Cliente', PAGE_W - MARGIN - 35, sigY + 5, { align: 'center' });

  drawFooter(doc, empresa);

  if (options.returnDoc) return doc;
  doc.save(`os_${os.codigo_os}.pdf`);
}

export async function generateFaturaPDF(fatura: Fatura, cliente: PdfCliente | null | undefined, os: PdfOS | null | undefined, options: { returnDoc?: boolean } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { data: empresa } = await supabase.from('empresa').select('*').limit(1).single();
  const orcamento = os?.orcamentos;

  const statusLabel = fatura.status === 'pago' ? 'RECIBO DE PAGAMENTO' : 'FATURA';
  let y = drawHeader(doc, empresa, statusLabel, `N.º ${fatura.codigo_fatura}  •  Vencimento: ${formatDate(fatura.data_vencimento)}`);

  // Status badge
  drawStatusBadge(doc, fatura.status, MARGIN, y - 6);

  // Fatura Info
  const faturaInfoCards: [string, string][] = [
    ['Código da Fatura', fatura.codigo_fatura],
    ['Data de Emissão', formatDate(fatura.data_emissao || fatura.created_at || fatura.data_vencimento)],
    ['Data de Vencimento', formatDate(fatura.data_vencimento)],
  ];

  if (fatura.status === 'pago') {
    faturaInfoCards.push(['Data de Pagamento', fatura.data_pagamento ? formatDate(fatura.data_pagamento) : '–']);
  }

  faturaInfoCards.push(['Status', (fatura.status || '–').toUpperCase()]);

  y = drawSectionTitle(doc, 'Dados da Fatura', y);
  y = drawInfoCard(doc, faturaInfoCards, y, 2);

  // Cliente
  y = drawSectionTitle(doc, 'Dados do Cliente', y);
  y = drawInfoCard(doc, [
    ['Nome Completo', cliente?.nome || '–'],
    ['CPF / CNPJ', cliente?.cpf || cliente?.cnpj || '–'],
    ['Código do Cliente', cliente?.codigo_cliente || '–'],
    ['Telefone', cliente?.telefone || '–'],
  ], y, 2);

  // Itens
  y = drawSectionTitle(doc, 'Itens Faturados', y);

  let tableBody: string[][] = [];

  if (fatura.tipo === 'pacote_nivel' && fatura.itens_faturados && fatura.itens_faturados.length > 0) {
    tableBody = (fatura.itens_faturados as unknown as PdfFaturaItem[]).map((it) => [it.descricao || '', '1', formatCurrency(it.valor || 0), formatCurrency(it.valor || 0)]);
  } else if (os) {
    const servico = orcamento?.servicos?.nome || 'Serviço';
    tableBody.push([`Serviço: ${servico}\nOS: ${os.codigo_os}`, '1', formatCurrency(orcamento?.valor_servico || 0), formatCurrency(orcamento?.valor_servico || 0)]);
    if ((orcamento?.valor_adicional || 0) > 0) {
      tableBody.push([orcamento?.descricao_adicional || 'Taxa Adicional', '1', formatCurrency(orcamento?.valor_adicional || 0), formatCurrency(orcamento?.valor_adicional || 0)]);
    }
  } else {
    tableBody.push(['Cobrança de Serviço', '1', formatCurrency(fatura.valor_total), formatCurrency(fatura.valor_total)]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Descrição', 'Qtd', 'Valor Unit.', 'Total']],
    body: tableBody,
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: { top: 5, bottom: 5, left: 5, right: 5 }, textColor: COLOR.dark, lineColor: COLOR.grayLight, lineWidth: 0.15 },
    headStyles: { fillColor: COLOR.primary, textColor: COLOR.white, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: COLOR.rowAlt },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Resumo Financeiro
  y = checkPageBreak(doc, y, 60);
  y = drawSectionTitle(doc, 'Resumo Financeiro', y);

  const baseTotal = Number(fatura.valor_base_original) > 0 ? Number(fatura.valor_base_original) : Number(fatura.valor_total);

  const totalRows: [string, string, boolean?][] = [
    ['Subtotal', formatCurrency(baseTotal)],
  ];
  if ((fatura.desconto_voucher_aplicado || 0) > 0)    totalRows.push(['Desconto Voucher', `- ${formatCurrency(fatura.desconto_voucher_aplicado)}`]);
  if ((fatura.abatimento_carteira_aplicado || 0) > 0) totalRows.push(['Abatimento Carteira', `- ${formatCurrency(fatura.abatimento_carteira_aplicado)}`]);
  if ((fatura.desconto_pontos_aplicado || 0) > 0)     totalRows.push(['Desconto Pontos', `- ${formatCurrency(fatura.desconto_pontos_aplicado)}`]);
  if ((orcamento?.acrescimo || 0) > 0)                totalRows.push(['Acréscimo (Orçamento)', `+ ${formatCurrency(orcamento.acrescimo)}`]);
  if ((orcamento?.desconto || 0) > 0)                 totalRows.push(['Desconto (Orçamento)', `- ${formatCurrency(orcamento.desconto)}`]);
  if (Number(fatura.acrescimo_manual) > 0)            totalRows.push(['Acréscimo Ajuste', `+ ${formatCurrency(fatura.acrescimo_manual)}`]);
  if (Number(fatura.desconto_manual) > 0)             totalRows.push(['Desconto Ajuste', `- ${formatCurrency(fatura.desconto_manual)}`]);

  const labelTotal = fatura.status === 'pago' ? 'Total Pago' : 'Total a Pagar';
  totalRows.push([labelTotal, formatCurrency(fatura.valor_pago || fatura.valor_total), true]);

  if ((fatura.valor_final_pendente || 0) > 0 && fatura.status !== 'pago') {
    totalRows.push(['Restante a Pagar', formatCurrency(fatura.valor_final_pendente)]);
  }

  y = drawTotalBlock(doc, totalRows, y);

  // Informações de pagamento (se pago)
  if (fatura.status === 'pago' && fatura.data_pagamento) {
    y = checkPageBreak(doc, y, 35);
    y = drawSectionTitle(doc, 'Confirmação de Pagamento', y);
    y = drawInfoCard(doc, [
      ['Pago em', formatDateTime(fatura.data_pagamento)],
      ['Forma de Pagamento', (fatura.forma_pagamento_escolhida || 'Não informado').toUpperCase()],
    ], y, 2);
  }

  // Mensagem de obrigado
  y = checkPageBreak(doc, y, 20);
  const finalMsgY = y + 8;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...COLOR.gray);
  doc.text('Agradecemos a preferência e confiança depositada em nossos serviços.', 105, finalMsgY, { align: 'center' });

  drawFooter(doc, empresa);

  if (options.returnDoc) return doc;
  doc.save(`fatura_${fatura.codigo_fatura}.pdf`);
}
