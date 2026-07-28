from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')


def write(rel, content):
    (ROOT / rel).write_text(content, encoding='utf-8')


def replace_required(text, old, new, label, count=None):
    actual = text.count(old)
    if actual == 0:
        raise RuntimeError(f'{label}: trecho não encontrado')
    if count is not None and actual != count:
        raise RuntimeError(f'{label}: esperado {count}, encontrado {actual}')
    return text.replace(old, new)

# 1. Relatórios administrativos: API e rótulos Excel.
report_dir = ROOT / 'src/components/admin/relatorios'
label_replacements = {
    'Excel/CSV': 'Excel',
    'CSV Estoque': 'Excel Estoque',
    'CSV Carteira': 'Excel Carteira',
    'OS CSV': 'OS Excel',
    'Orç. CSV': 'Orç. Excel',
    'Colab. CSV': 'Colab. Excel',
    'Excl. CSV': 'Excl. Excel',
    'Vouchers CSV': 'Vouchers Excel',
    'Indicações CSV': 'Indicações Excel',
    'Imprimir PDF': 'Gerar PDF',
    'Exporte CSV para ver todos.': 'Exporte Excel para ver todos.',
}
for path in sorted(report_dir.glob('Relatorio*.tsx')):
    text = path.read_text(encoding='utf-8')
    if 'exportarCSV' in text:
        text = text.replace('exportarCSV', 'exportarExcel')
    for old, new in label_replacements.items():
        text = text.replace(old, new)
    text = re.sub(r'(<Download className="h-3 w-3"\s*/>\s*)CSV(?=</button>)', r'\1Excel', text)
    path.write_text(text, encoding='utf-8')

# Evita que o evento de clique seja tratado como conjunto de dados do PDF.
fiscal_report = report_dir / 'RelatorioFiscal.tsx'
fiscal_text = fiscal_report.read_text(encoding='utf-8')
fiscal_text = replace_required(
    fiscal_text,
    'onClick={exportarPDF}',
    'onClick={() => void exportarPDF()}',
    'handler PDF fiscal',
    1,
)
fiscal_report.write_text(fiscal_text, encoding='utf-8')

# 2. Demandas: CSV direto -> Excel institucional com filtros ativos.
rel = 'src/components/admin/demandas/DemandasTabela.tsx'
text = read(rel)
import_anchor = "import { isPast, differenceInDays } from 'date-fns';\n"
text = replace_required(
    text,
    import_anchor,
    import_anchor + "import { exportInstitutionalExcel } from '../../../lib/institutionalFileExport';\n",
    'import Demandas',
    1,
)
block_start = text.index('  const exportCSV = () => {')
block_end = text.index('\n\n  return (', block_start)
new_block = """  const exportExcel = async () => {
    const rows = filtradas.map(d => ({
      id: d.id.slice(0, 8).toUpperCase(),
      titulo: d.titulo || d.descricao?.slice(0, 50) || '—',
      status: STATUS_LABELS[d.status]?.label || d.status || '—',
      prioridade: PRIO_CONFIG[d.prioridade || 'normal']?.label || d.prioridade || 'Normal',
      cliente: d.ordem_servico?.cliente?.nome || '—',
      responsavel: d.colaborador?.nome || d.prestador?.nome_razao || 'Pool central',
      prazo: d.prazo_limite ? format(new Date(d.prazo_limite), 'dd/MM/yyyy HH:mm') : '—',
      criado_em: format(new Date(d.created_at), 'dd/MM/yyyy'),
    }));

    try {
      await exportInstitutionalExcel({
        title: 'Relatório de Demandas',
        subtitle: 'Demandas exportadas com os filtros e a ordenação atualmente aplicados no painel administrativo.',
        fileName: 'demandas',
        sheetName: 'Demandas',
        rows,
        columns: [
          { key: 'id', label: 'Código', type: 'text', width: 14 },
          { key: 'titulo', label: 'Título', type: 'text', width: 36 },
          { key: 'status', label: 'Status', type: 'text', width: 24 },
          { key: 'prioridade', label: 'Prioridade', type: 'text', width: 16 },
          { key: 'cliente', label: 'Cliente', type: 'text', width: 28 },
          { key: 'responsavel', label: 'Responsável', type: 'text', width: 28 },
          { key: 'prazo', label: 'Prazo', type: 'text', width: 20 },
          { key: 'criado_em', label: 'Criada em', type: 'text', width: 16 },
        ],
        filters: {
          busca: busca || 'Sem filtro',
          status: statusFiltro,
          prioridade: prioFiltro,
          responsavel: responsavelFiltro,
          prazo: prazoFiltro,
          ordenacao: `${sortKey} (${sortDir})`,
        },
        summary: [
          { label: 'Demandas exportadas', value: rows.length, type: 'number' },
        ],
        source: 'Gestão de Demandas GSA HUB',
      });
    } catch (error) {
      console.error('Falha ao exportar demandas:', error);
      alert(error instanceof Error ? error.message : 'Não foi possível gerar a planilha de demandas.');
    }
  };"""
text = text[:block_start] + new_block + text[block_end:]
text = replace_required(text, 'onClick={exportCSV}', 'onClick={() => void exportExcel()}', 'handler Demandas', 1)
text = replace_required(text, '<Download className="h-3 w-3" /> CSV', '<Download className="h-3 w-3" /> Excel', 'rótulo Demandas', 1)
write(rel, text)

# 3. Fiscal admin: janela de impressão -> PDF institucional comum.
rel = 'src/components/admin/FiscalModule.tsx'
text = read(rel)
anchor = "import { removePrivateDocument, uploadPrivateDocument } from '../../lib/privateStorage';\n"
text = replace_required(text, anchor, anchor + "import { downloadFiscalReceiptPdf } from '../../lib/fiscalReceiptPdf';\n", 'import FiscalModule', 1)
text = replace_required(
    text,
    'onClick={() => window.print()} className="rounded-xl border border-neutral-200 p-2"',
    'onClick={() => void downloadFiscalReceiptPdf(selected)} title="Gerar recibo fiscal em PDF" aria-label="Gerar recibo fiscal em PDF" className="rounded-xl border border-neutral-200 p-2"',
    'ação PDF FiscalModule',
    1,
)
write(rel, text)

# 4. Portal do cliente: remover montagem HTML/print e reutilizar PDF institucional.
rel = 'src/components/client/financeiro/NotasFiscaisList.tsx'
text = read(rel)
anchor = "import { Modal } from '../../ui/Modal';\n"
text = replace_required(text, anchor, anchor + "import { downloadFiscalReceiptPdf } from '../../../lib/fiscalReceiptPdf';\n", 'import NotasFiscaisList', 1)
pattern = re.compile(r"\nconst RECEIPT_PRINT_STYLES = `[\s\S]*?\n}\n\nexport function NotasFiscaisList", re.MULTILINE)
match = pattern.search(text)
if not match:
    raise RuntimeError('bloco de impressão de NotasFiscaisList não encontrado')
text = text[:match.start()] + "\nexport function NotasFiscaisList" + text[match.end():]
old_handler = """  const handlePrintReceipt = (ordem: OrdemFiscal) => {
    const printWindow = window.open('about:blank', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;
    printWindow.opener = null;

    renderFiscalReceipt(printWindow.document, ordem);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };
"""
new_handler = """  const handlePrintReceipt = (ordem: OrdemFiscal) => {
    void downloadFiscalReceiptPdf(ordem as OrdemFiscal & Record<string, unknown>);
  };
"""
text = replace_required(text, old_handler, new_handler, 'handler NotasFiscaisList', 1)
text = text.replace('Imprimir Recibo', 'Gerar Recibo PDF').replace('Imprimir recibo', 'Gerar recibo PDF')
write(rel, text)

# 5. PDFs de orçamento, OS e fatura: identidade GSA, compressão e metadados.
rel = 'src/lib/pdf.ts'
text = read(rel)
text = replace_required(text, "  primary:     [15,  23,  42]  as [number, number, number],  // slate-900\n  accent:      [79,  70,  229] as [number, number, number],  // indigo-600\n  accentLight: [238,242,255]   as [number, number, number],  // indigo-50\n", "  primary:     [11,  31,  58]  as [number, number, number],  // azul-marinho GSA\n  accent:      [198, 161, 91]  as [number, number, number],  // dourado institucional\n  accentLight: [247, 243, 234] as [number, number, number],  // marfim institucional\n", 'tokens PDF', 1)
text = text.replace("  rowAlt:      [248,250,252]   as [number, number, number],  // slate-50\n", "  rowAlt:      [247,249,252]   as [number, number, number],\n")
metadata_helper = """
function configureDocumentMetadata(doc: jsPDF, title: string, subject: string) {
  doc.setProperties({
    title,
    subject,
    author: 'GSA HUB',
    creator: 'GSA HUB',
    keywords: 'GSA HUB, documento institucional, gestão de serviços',
  });
}

"""
anchor = "// ─── Helpers ──────────────────────────────────────────────────────────────────\n\n"
text = replace_required(text, anchor, anchor + metadata_helper, 'helper metadados pdf.ts', 1)
text = text.replace("new jsPDF({ unit: 'mm', format: 'a4' })", "new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true, putOnlyUsedFonts: true })")
text = replace_required(text, "  const { data: empresa } = await supabase.from('empresa').select('*').limit(1).single();\n\n  let y = drawHeader(doc, empresa, 'Orçamento'", "  configureDocumentMetadata(doc, `Orçamento ${orcamento.codigo_orcamento}`, 'Orçamento institucional emitido pelo GSA HUB.');\n  const { data: empresa } = await supabase.from('empresa').select('*').limit(1).single();\n\n  let y = drawHeader(doc, empresa, 'Orçamento'", 'metadata orçamento', 1)
text = replace_required(text, "  const { data: empresa } = await supabase.from('empresa').select('*').limit(1).single();\n\n  let y = drawHeader(doc, empresa, 'Ordem de Serviço'", "  configureDocumentMetadata(doc, `Ordem de Serviço ${os.codigo_os}`, 'Ordem de serviço institucional emitida pelo GSA HUB.');\n  const { data: empresa } = await supabase.from('empresa').select('*').limit(1).single();\n\n  let y = drawHeader(doc, empresa, 'Ordem de Serviço'", 'metadata OS', 1)
text = replace_required(text, "  const { data: empresa } = await supabase.from('empresa').select('*').limit(1).single();\n  const orcamento = os?.orcamentos;", "  configureDocumentMetadata(doc, `Fatura ${fatura.codigo_fatura}`, 'Fatura ou recibo de pagamento institucional emitido pelo GSA HUB.');\n  const { data: empresa } = await supabase.from('empresa').select('*').limit(1).single();\n  const orcamento = os?.orcamentos;", 'metadata fatura', 1)
text = text.replace("    doc.text(empresa?.razao_social || '', MARGIN, PAGE_H - 9);", "    doc.text(empresa?.razao_social || empresa?.nome || 'GSA HUB', MARGIN, PAGE_H - 9);")
text = text.replace("doc.save(`orcamento_${orcamento.codigo_orcamento}.pdf`);", "doc.save(`gsa-orcamento-${orcamento.codigo_orcamento}.pdf`);")
text = text.replace("doc.save(`os_${os.codigo_os}.pdf`);", "doc.save(`gsa-os-${os.codigo_os}.pdf`);")
text = text.replace("doc.save(`fatura_${fatura.codigo_fatura}.pdf`);", "doc.save(`gsa-fatura-${fatura.codigo_fatura}.pdf`);")
write(rel, text)

# 6. PDFs das calculadoras: compressão, metadados e revisão textual.
rel = 'src/lib/freeToolsPdfReport.ts'
text = read(rel)
text = replace_required(text, "new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })", "new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true, putOnlyUsedFonts: true })", 'construtor calculadoras', 1)
text = text.replace("RELATORIO COMPLETO - MODO PRO", "RELATÓRIO COMPLETO — MODO PRO").replace("RELATORIO SIMPLES - MODO FREE", "RELATÓRIO SIMPLES — MODO FREE")
text = text.replace("Este PDF foi criado localmente no navegador apenas para download. O arquivo e os dados do relatorio nao foram enviados nem armazenados no sistema ou no banco de dados da GSA.", "Este PDF foi criado localmente no navegador apenas para download. O arquivo e os dados do relatório não foram enviados nem armazenados no sistema ou no banco de dados da GSA.")
text = text.replace("GSA HUB - Ferramentas publicas", "GSA HUB — Ferramentas públicas")
text = text.replace("Pagina ${page} de ${pageCount}", "Página ${page} de ${pageCount}")
text = text.replace("Relatorio educativo gerado pelas calculadoras publicas da GSA HUB", "Relatório educativo gerado pelas calculadoras públicas da GSA HUB")
text = replace_required(text, "    creator: 'GSA HUB',\n  });", "    creator: 'GSA HUB',\n    keywords: 'GSA HUB, calculadora, relatório educativo, ferramentas públicas',\n  });", 'keywords calculadoras', 1)
write(rel, text)

print('Upgrade institucional aplicado com sucesso.')
