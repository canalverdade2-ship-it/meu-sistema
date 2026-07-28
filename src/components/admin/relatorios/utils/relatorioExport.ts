import { formatDate } from '../../../../lib/utils';
import {
  exportInstitutionalExcel,
  exportInstitutionalPdf,
  exportVisibleReportAsPdf,
  type InstitutionalReportColumn,
  type InstitutionalReportOptions,
  type InstitutionalReportSummaryItem,
} from '../../../../lib/institutionalFileExport';

export interface ReportExportConfig {
  titulo?: string;
  subtitulo?: string;
  planilha?: string;
  periodo?: string;
  filtros?: Record<string, string | number | boolean | null | undefined>;
  colunas?: InstitutionalReportColumn[];
  resumo?: InstitutionalReportSummaryItem[];
  confidencialidade?: string;
  origem?: string;
}

function humanizarNomeArquivo(nomeArquivo: string): string {
  return nomeArquivo
    .replace(/^relatorio[_-]?/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (caractere) => caractere.toUpperCase()) || 'Relatório';
}

function criarOpcoes(
  dados: Record<string, unknown>[],
  nomeArquivo: string,
  config: ReportExportConfig = {},
): InstitutionalReportOptions {
  const titulo = config.titulo || `Relatório de ${humanizarNomeArquivo(nomeArquivo)}`;
  return {
    title: titulo,
    subtitle: config.subtitulo || 'Relatório emitido pelo Centro de Relatórios do GSA HUB.',
    fileName: nomeArquivo,
    sheetName: config.planilha || humanizarNomeArquivo(nomeArquivo),
    rows: dados,
    columns: config.colunas,
    period: config.periodo,
    filters: config.filtros,
    summary: config.resumo,
    confidentiality: config.confidencialidade,
    source: config.origem || 'Centro de Relatórios GSA HUB',
  };
}

/**
 * Gera uma planilha Excel real, com identidade institucional, metadados,
 * cabeçalho congelado, filtros, impressão configurada e formatos numéricos.
 */
export async function exportarExcel(
  dados: Record<string, unknown>[],
  nomeArquivo: string,
  config: ReportExportConfig = {},
): Promise<void> {
  try {
    await exportInstitutionalExcel(criarOpcoes(dados, nomeArquivo, config));
  } catch (error) {
    console.error('Falha ao gerar planilha institucional:', error);
    alert(error instanceof Error ? error.message : 'Não foi possível gerar a planilha.');
  }
}

/**
 * Compatibilidade com os relatórios legados: mantém a assinatura existente,
 * mas substitui a saída CSV por uma planilha Excel institucional em .xlsx.
 */
export function exportarCSV(
  dados: Record<string, unknown>[],
  nomeArquivo: string,
  config: ReportExportConfig = {},
): Promise<void> {
  return exportarExcel(dados, nomeArquivo, config);
}

/**
 * Gera PDF institucional estruturado. Quando chamado sem dados, extrai a tabela
 * do relatório visível para substituir o antigo uso de window.print().
 */
export async function exportarPDF(
  dados?: Record<string, unknown>[],
  nomeArquivo?: string,
  config: ReportExportConfig = {},
): Promise<void> {
  try {
    if (!dados || !nomeArquivo) {
      await exportVisibleReportAsPdf();
      return;
    }
    await exportInstitutionalPdf(criarOpcoes(dados, nomeArquivo, config));
  } catch (error) {
    console.error('Falha ao gerar PDF institucional:', error);
    alert(error instanceof Error ? error.message : 'Não foi possível gerar o PDF.');
  }
}

/**
 * Retorna range de datas (ISO strings) baseado no período selecionado.
 */
export function getRangeDatas(periodo: string, dataInicio?: string, dataFim?: string): { inicio: string; fim: string } {
  const agora = new Date();
  const fimISO = agora.toISOString();

  if (periodo === 'personalizado' && dataInicio && dataFim) {
    return { inicio: new Date(dataInicio).toISOString(), fim: new Date(dataFim + 'T23:59:59').toISOString() };
  }

  let inicio: Date;
  switch (periodo) {
    case 'hoje':
      inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0);
      break;
    case 'semana':
      inicio = new Date(agora);
      inicio.setDate(agora.getDate() - 7);
      break;
    case 'trimestre':
      inicio = new Date(agora);
      inicio.setMonth(agora.getMonth() - 3);
      break;
    case 'semestre':
      inicio = new Date(agora);
      inicio.setMonth(agora.getMonth() - 6);
      break;
    case 'ano':
      inicio = new Date(agora.getFullYear(), 0, 1);
      break;
    case 'mes':
    default:
      inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
      break;
  }

  return { inicio: inicio.toISOString(), fim: fimISO };
}

export function obterRotuloPeriodo(periodo: string, dataInicio?: string, dataFim?: string): string {
  if (periodo === 'personalizado' && dataInicio && dataFim) {
    return `${formatarData(dataInicio)} a ${formatarData(dataFim)}`;
  }
  const rotulos: Record<string, string> = {
    hoje: 'Hoje',
    semana: 'Últimos 7 dias',
    mes: 'Mês atual',
    trimestre: 'Últimos 3 meses',
    semestre: 'Últimos 6 meses',
    ano: 'Ano atual',
  };
  return rotulos[periodo] || 'Período selecionado';
}

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

export function formatarData(data: string | undefined | null): string {
  if (!data) return '—';
  return formatDate(data);
}

export function formatarNumero(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n || 0);
}
