import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BRANCH = 'audit/full-system-remediation-20260727';
const SCRIPT_PATH = 'scripts/apply-global-delete-request-dialog.mjs';
const PACKAGE_PATH = 'package.json';
const DELETE_REQUEST_PATH = 'src/lib/deleteRequest.ts';
const ADMIN_PANEL_PATH = 'src/pages/AdminPanel.tsx';
const HOST_PATH = 'src/components/admin/DeleteRequestDialogHost.tsx';
const CALL_SITES_PATH = 'audit-control/delete-request-call-sites.txt';

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_HEAD_REF !== BRANCH) {
  console.log('[delete-request-dialog] Fora do PR de auditoria; nenhuma escrita realizada.');
  process.exit(0);
}

const git = (...args) => execFileSync('git', args, { stdio: 'inherit' });
const replaceRequired = (source, before, after, label) => {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`[delete-request-dialog] Padrão não encontrado: ${label}`);
  return source.replace(before, after);
};

git('fetch', 'origin', BRANCH);
git('checkout', '-B', BRANCH, `origin/${BRANCH}`);

let deleteRequest = readFileSync(DELETE_REQUEST_PATH, 'utf8');
deleteRequest = replaceRequired(
  deleteRequest,
  "import { toast } from 'react-hot-toast';\n",
  "import { toast } from 'react-hot-toast';\n\nexport const DELETE_REASON_REQUEST_EVENT = 'gsa:request-delete-reason';\n\nexport interface DeleteReasonRequestDetail {\n  tabela: string;\n  registroId: string;\n  handled: boolean;\n  resolve: (reason: string | null) => void;\n}\n\nfunction requestDeletionReason(tabela: string, registroId: string): Promise<string | null> {\n  if (typeof window === 'undefined') return Promise.resolve(null);\n\n  return new Promise((resolve) => {\n    let settled = false;\n    const safeResolve = (reason: string | null) => {\n      if (settled) return;\n      settled = true;\n      resolve(reason);\n    };\n    const detail: DeleteReasonRequestDetail = {\n      tabela,\n      registroId,\n      handled: false,\n      resolve: safeResolve,\n    };\n\n    window.dispatchEvent(new CustomEvent<DeleteReasonRequestDetail>(DELETE_REASON_REQUEST_EVENT, { detail }));\n    if (!detail.handled) safeResolve(null);\n  });\n}\n",
  'contrato global para motivo de exclusão',
);
deleteRequest = replaceRequired(
  deleteRequest,
  "    const motivo = window.prompt('Exclusão restrita: qual o motivo para solicitar a exclusão deste registro? Sua solicitação será enviada para aprovação administrativa.');\n\n    if (!motivo || motivo.trim() === '') {",
  "    const motivo = await requestDeletionReason(tabela, registro_id);\n\n    if (!motivo || motivo.trim() === '') {",
  'substituição do prompt nativo de exclusão',
);
writeFileSync(DELETE_REQUEST_PATH, deleteRequest, 'utf8');

const hostSource = `import { useEffect } from 'react';\nimport { useConfirm } from '../../hooks/useConfirm';\nimport {\n  DELETE_REASON_REQUEST_EVENT,\n  type DeleteReasonRequestDetail,\n} from '../../lib/deleteRequest';\nimport { ConfirmDialog } from '../ui/ConfirmDialog';\n\nexport function DeleteRequestDialogHost() {\n  const confirmHook = useConfirm();\n  const { confirm } = confirmHook;\n\n  useEffect(() => {\n    const handleRequest = (event: Event) => {\n      const detail = (event as CustomEvent<DeleteReasonRequestDetail>).detail;\n      if (!detail || detail.handled) return;\n      detail.handled = true;\n\n      void confirm({\n        title: 'Solicitar exclusão para aprovação',\n        message: 'Como colaborador, você não pode excluir diretamente. Informe o motivo; a solicitação será registrada e enviada à administração.',\n        confirmLabel: 'Enviar solicitação',\n        cancelLabel: 'Cancelar',\n        variant: 'warning',\n        promptLabel: 'Motivo da exclusão',\n        promptPlaceholder: 'Descreva por que este registro precisa ser excluído...',\n        promptRequired: true,\n      }).then((result) => {\n        detail.resolve(typeof result === 'string' ? result.trim() || null : null);\n      }).catch(() => detail.resolve(null));\n    };\n\n    window.addEventListener(DELETE_REASON_REQUEST_EVENT, handleRequest as EventListener);\n    return () => window.removeEventListener(DELETE_REASON_REQUEST_EVENT, handleRequest as EventListener);\n  }, [confirm]);\n\n  return <ConfirmDialog {...confirmHook} />;\n}\n`;
writeFileSync(HOST_PATH, hostSource, 'utf8');

let adminPanel = readFileSync(ADMIN_PANEL_PATH, 'utf8');
adminPanel = replaceRequired(
  adminPanel,
  "import { SystemStatusIndicator } from '../components/admin/SystemStatusIndicator';\n",
  "import { SystemStatusIndicator } from '../components/admin/SystemStatusIndicator';\nimport { DeleteRequestDialogHost } from '../components/admin/DeleteRequestDialogHost';\n",
  'import do host global de exclusão',
);
adminPanel = replaceRequired(
  adminPanel,
  "    >\n      <div className=\"p-3 lg:p-5\"><div className=\"min-h-[calc(100vh-140px)] rounded-[2rem] bg-white p-3 lg:p-4 shadow-sm ring-1 ring-neutral-100\">",
  "    >\n      <DeleteRequestDialogHost />\n      <div className=\"p-3 lg:p-5\"><div className=\"min-h-[calc(100vh-140px)] rounded-[2rem] bg-white p-3 lg:p-4 shadow-sm ring-1 ring-neutral-100\">",
  'montagem do host global no painel',
);
writeFileSync(ADMIN_PANEL_PATH, adminPanel, 'utf8');

const packageJson = JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'));
packageJson.scripts.lint = 'tsc --noEmit && node scripts/audit-production-real.mjs --enforce';
writeFileSync(PACKAGE_PATH, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
if (existsSync(CALL_SITES_PATH)) rmSync(CALL_SITES_PATH);
if (existsSync(SCRIPT_PATH)) rmSync(SCRIPT_PATH);

git('diff', '--check');
git('config', 'user.name', 'github-actions[bot]');
git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
git('add', DELETE_REQUEST_PATH, HOST_PATH, ADMIN_PANEL_PATH, PACKAGE_PATH, CALL_SITES_PATH, SCRIPT_PATH);
try {
  execFileSync('git', ['diff', '--cached', '--quiet']);
  console.log('[delete-request-dialog] Correção já incorporada.');
  process.exit(0);
} catch {
  // Há alterações staged.
}

git('commit', '-m', 'fix(ux): centralizar solicitações de exclusão em diálogo acessível');
git('reset', '--hard', 'HEAD');
for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    git('fetch', 'origin', BRANCH);
    git('rebase', `origin/${BRANCH}`);
    git('push', 'origin', `HEAD:${BRANCH}`);
    console.log('[delete-request-dialog] Correção persistida.');
    process.exit(0);
  } catch (error) {
    console.error(`[delete-request-dialog] Tentativa ${attempt} de 5 não concluiu o push.`);
    try { git('rebase', '--abort'); } catch { /* sem rebase ativo */ }
    if (attempt === 5) throw error;
  }
}
