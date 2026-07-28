import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const BRANCH = 'audit/full-system-remediation-20260727';
const SCRIPT_PATH = 'scripts/apply-accessible-admin-dialogs.mjs';
const PACKAGE_PATH = 'package.json';
const AFFILIATE_PATH = 'src/components/admin/AffiliateAdminModule.tsx';
const DEMAND_PATH = 'src/components/admin/demandas/DemandasDetalhesModal.tsx';
const OLD_REPORT_PATH = 'audit-control/modern-exceljs-validation.json';
const CALL_SITES_PATH = 'audit-control/delete-request-call-sites.txt';

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_HEAD_REF !== BRANCH) {
  console.log('[accessible-dialogs] Fora do PR de auditoria; nenhuma escrita realizada.');
  process.exit(0);
}

const git = (...args) => execFileSync('git', args, { stdio: 'inherit' });
const replaceRequired = (source, before, after, label) => {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`[accessible-dialogs] Padrão não encontrado: ${label}`);
  return source.replace(before, after);
};

git('fetch', 'origin', BRANCH);
git('checkout', '-B', BRANCH, `origin/${BRANCH}`);

let affiliate = readFileSync(AFFILIATE_PATH, 'utf8');
affiliate = replaceRequired(
  affiliate,
  "import { formatCurrency, formatDateTime } from '../../lib/utils';\n",
  "import { formatCurrency, formatDateTime } from '../../lib/utils';\nimport { ConfirmDialog } from '../ui/ConfirmDialog';\nimport { useConfirm } from '../../hooks/useConfirm';\n",
  'imports do diálogo no módulo de afiliados',
);
affiliate = replaceRequired(
  affiliate,
  "export function AffiliateAdminModule() {\n  const [tab, setTab]",
  "export function AffiliateAdminModule() {\n  const confirmHook = useConfirm();\n  const [tab, setTab]",
  'hook de confirmação no módulo de afiliados',
);
affiliate = replaceRequired(
  affiliate,
  "    if (!window.confirm(`Deseja ${label} o afiliado ${affiliate.nome_divulgacao}?`)) return;",
  "    const confirmed = await confirmHook.confirm({\n      title: `${label.charAt(0).toUpperCase()}${label.slice(1)} afiliado`,\n      message: `Deseja ${label} o afiliado ${affiliate.nome_divulgacao}?`,\n      confirmLabel: `${label.charAt(0).toUpperCase()}${label.slice(1)}`,\n      variant: status === 'ativo' ? 'info' : 'warning',\n    });\n    if (!confirmed) return;",
  'confirmação de status do afiliado',
);
affiliate = replaceRequired(
  affiliate,
  "    const label = action === 'approve' ? 'aprovar' : action === 'reject' ? 'rejeitar' : 'confirmar o pagamento de';\n    if (!window.confirm(`Deseja ${label} ${formatCurrency(number(payout.valor))}?`)) return;\n    const notes = action === 'reject' ? window.prompt('Informe o motivo da rejeição:')?.trim() : `Ação ${action} realizada no painel administrativo.`;\n    if (action === 'reject' && !notes) return;",
  "    const label = action === 'approve' ? 'aprovar' : action === 'reject' ? 'rejeitar' : 'confirmar o pagamento de';\n    let notes = `Ação ${action} realizada no painel administrativo.`;\n\n    if (action === 'reject') {\n      const reason = await confirmHook.confirm({\n        title: 'Rejeitar solicitação de saque',\n        message: `Informe o motivo para rejeitar o saque de ${formatCurrency(number(payout.valor))}.`,\n        confirmLabel: 'Rejeitar saque',\n        variant: 'danger',\n        promptLabel: 'Motivo da rejeição',\n        promptPlaceholder: 'Descreva de forma objetiva o motivo da rejeição...',\n        promptRequired: true,\n      });\n      if (!reason || typeof reason !== 'string') return;\n      notes = reason.trim();\n    } else {\n      const confirmed = await confirmHook.confirm({\n        title: action === 'approve' ? 'Aprovar solicitação de saque' : 'Confirmar pagamento do saque',\n        message: `Deseja ${label} ${formatCurrency(number(payout.valor))}?`,\n        confirmLabel: action === 'approve' ? 'Aprovar saque' : 'Confirmar pagamento',\n        variant: 'info',\n      });\n      if (!confirmed) return;\n    }",
  'decisão de pagamento do afiliado',
);
affiliate = replaceRequired(
  affiliate,
  '    <section className="space-y-5" aria-labelledby="affiliate-admin-title">\n',
  '    <section className="space-y-5" aria-labelledby="affiliate-admin-title">\n      <ConfirmDialog {...confirmHook} />\n',
  'renderização do diálogo no módulo de afiliados',
);
writeFileSync(AFFILIATE_PATH, affiliate, 'utf8');

let demand = readFileSync(DEMAND_PATH, 'utf8');
demand = replaceRequired(
  demand,
  "import { useFileViewer } from '../../../contexts/FileViewerContext';\n",
  "import { useFileViewer } from '../../../contexts/FileViewerContext';\nimport { ConfirmDialog } from '../../ui/ConfirmDialog';\nimport { useConfirm } from '../../../hooks/useConfirm';\n",
  'imports do diálogo em demandas',
);
demand = replaceRequired(
  demand,
  "}: Props) {\n  const { openFile } = useFileViewer();",
  "}: Props) {\n  const { openFile } = useFileViewer();\n  const confirmHook = useConfirm();",
  'hook de confirmação em demandas',
);
demand = replaceRequired(
  demand,
  "  const handleRecusarDemanda = async () => {\n    const motivo = prompt('Informe o motivo da recusa:');\n    if (!motivo) return;",
  "  const handleRecusarDemanda = async () => {\n    const reason = await confirmHook.confirm({\n      title: 'Recusar demanda interna',\n      message: 'A demanda voltará ao pool central. Informe o motivo da recusa para manter a rastreabilidade.',\n      confirmLabel: 'Recusar demanda',\n      variant: 'danger',\n      promptLabel: 'Motivo da recusa',\n      promptPlaceholder: 'Descreva o motivo da recusa...',\n      promptRequired: true,\n    });\n    if (!reason || typeof reason !== 'string') return;\n    const motivo = reason.trim();",
  'recusa de demanda interna',
);
demand = replaceRequired(
  demand,
  "  const handleRecusarContrapropostaAdmin = async () => {\n    const motivo = prompt('Motivo para recusar a contraproposta do prestador:');\n    if (!motivo) return;",
  "  const handleRecusarContrapropostaAdmin = async () => {\n    const reason = await confirmHook.confirm({\n      title: 'Recusar contraproposta do prestador',\n      message: 'A demanda será devolvida ao pool central. Informe o motivo que será registrado no histórico.',\n      confirmLabel: 'Recusar contraproposta',\n      variant: 'danger',\n      promptLabel: 'Motivo da recusa',\n      promptPlaceholder: 'Explique por que a contraproposta foi recusada...',\n      promptRequired: true,\n    });\n    if (!reason || typeof reason !== 'string') return;\n    const motivo = reason.trim();",
  'recusa de contraproposta',
);
demand = replaceRequired(
  demand,
  "  const handleCancelDemanda = async () => {\n    const motivo = prompt('Por que deseja cancelar esta demanda?');\n    if (!motivo) return;\n\n    if (!confirm('TEM CERTEZA? O cancelamento é irreversível e cancelará a OS e Orçamento vinculados.')) return;",
  "  const handleCancelDemanda = async () => {\n    const reason = await confirmHook.confirm({\n      title: 'Cancelar demanda definitivamente',\n      message: 'Esta ação é irreversível e também cancelará a ordem de serviço e o orçamento vinculados. Informe o motivo para confirmar.',\n      confirmLabel: 'Cancelar definitivamente',\n      variant: 'danger',\n      promptLabel: 'Motivo do cancelamento',\n      promptPlaceholder: 'Descreva o motivo do cancelamento...',\n      promptRequired: true,\n    });\n    if (!reason || typeof reason !== 'string') return;\n    const motivo = reason.trim();",
  'cancelamento irreversível da demanda',
);
demand = replaceRequired(
  demand,
  '    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center">\n',
  '    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center">\n      <ConfirmDialog {...confirmHook} />\n',
  'renderização do diálogo em demandas',
);
writeFileSync(DEMAND_PATH, demand, 'utf8');

function collectCallSites(root) {
  const matches = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) matches.push(...collectCallSites(path));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      const lines = readFileSync(path, 'utf8').split(/\r?\n/);
      lines.forEach((line, index) => {
        if (line.includes('canDeleteRecord')) matches.push(`${path.replaceAll('\\', '/')}:${index + 1}:${line.trim()}`);
      });
    }
  }
  return matches;
}
mkdirSync('audit-control', { recursive: true });
writeFileSync(CALL_SITES_PATH, `${collectCallSites('src').join('\n')}\n`, 'utf8');

const packageJson = JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'));
packageJson.scripts.lint = 'tsc --noEmit && node scripts/audit-production-real.mjs --enforce';
writeFileSync(PACKAGE_PATH, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
if (existsSync(OLD_REPORT_PATH)) rmSync(OLD_REPORT_PATH);
if (existsSync(SCRIPT_PATH)) rmSync(SCRIPT_PATH);

git('diff', '--check');
git('config', 'user.name', 'github-actions[bot]');
git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
git('add', AFFILIATE_PATH, DEMAND_PATH, CALL_SITES_PATH, OLD_REPORT_PATH, PACKAGE_PATH, SCRIPT_PATH);
try {
  execFileSync('git', ['diff', '--cached', '--quiet']);
  console.log('[accessible-dialogs] Correções já incorporadas.');
  process.exit(0);
} catch {
  // Há alterações staged.
}

git('commit', '-m', 'fix(ux): substituir confirmações nativas por diálogos acessíveis');
git('reset', '--hard', 'HEAD');
for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    git('fetch', 'origin', BRANCH);
    git('rebase', `origin/${BRANCH}`);
    git('push', 'origin', `HEAD:${BRANCH}`);
    console.log('[accessible-dialogs] Correções e mapa de chamadas persistidos.');
    process.exit(0);
  } catch (error) {
    console.error(`[accessible-dialogs] Tentativa ${attempt} de 5 não concluiu o push.`);
    try { git('rebase', '--abort'); } catch { /* sem rebase ativo */ }
    if (attempt === 5) throw error;
  }
}
