import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const TARGET_BRANCH = 'audit/full-system-remediation-20260727';

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_HEAD_REF !== TARGET_BRANCH) {
  console.log('[audit-remediation] Fora do PR de auditoria; nenhuma alteracao aplicada.');
  process.exit(0);
}

const runGit = (...args) => execFileSync('git', args, { stdio: 'inherit' });
runGit('fetch', 'origin', TARGET_BRANCH);
runGit('checkout', '-B', TARGET_BRANCH, `origin/${TARGET_BRANCH}`);

const changed = new Set();

function updateFile(path, transform) {
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) return;
  writeFileSync(path, after, 'utf8');
  changed.add(path);
}

function replaceExact(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) {
    throw new Error(`[audit-remediation] Padrao nao encontrado: ${label}`);
  }
  return source.replace(before, after);
}

updateFile('src/types.ts', (source) => {
  source = replaceExact(
    source,
    '  pin_bloqueado?: boolean;\n  saldo?: number;',
    '  pin_bloqueado?: boolean;\n  pin_tentativas?: number;\n  saldo?: number;',
    'Cliente.pin_tentativas',
  );
  source = replaceExact(
    source,
    '  historico_status?: Record<string, unknown>[];',
    '  historico_status?: Record<string, string>;',
    'LojaSolicitacao.historico_status',
  );
  return source;
});

updateFile('src/lib/notificationService.ts', (source) => {
  if (source.includes('const normalizedOptions = typeof options === \'string\'')) return source;
  const start = source.indexOf('  async notifyClient(');
  const endMarker = '\n  },\n\n  // ─────────────────────────────────────────────────────\n  // NOTIFICAÇÕES PARA PRESTADORES ESPECÍFICOS';
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('[audit-remediation] Bloco notifyClient nao encontrado.');

  let block = source.slice(start, end + 5);
  block = replaceExact(
    block,
    '    options?: {\n      tab?: string;\n      itemId?: string;\n      prioridade?: Prioridade;\n      contexto?: Record<string, any>;\n    }\n  ): Promise<void> {\n    if (!clienteId) {',
    '    options?: {\n      tab?: string;\n      itemId?: string;\n      prioridade?: Prioridade;\n      contexto?: Record<string, any>;\n    } | string\n  ): Promise<void> {\n    const normalizedOptions = typeof options === \'string\'\n      ? { tab: acaoOrigem, itemId: options }\n      : options;\n\n    if (!clienteId) {',
    'compatibilidade notifyClient',
  );
  block = block.replaceAll('options?.', 'normalizedOptions?.');
  return source.slice(0, start) + block + source.slice(end + 5);
});

updateFile('src/components/admin/CobrancaModule.tsx', (source) => replaceExact(
  source,
  "setAcordoData({ parcelas: 1, dtPrimeiroVenc: '', desconto: 0, observacoes: '' });",
  "setAcordoData({ parcelas: 1, dtPrimeiroVenc: '', desconto: 0, tipo_desconto: 'fixo', observacoes: '' });",
  'reset completo de acordo',
));

updateFile('src/components/admin/CuponsLojaModule.tsx', (source) => {
  source = replaceExact(
    source,
    "import { CupomLoja, Cliente, Produto } from '../../types';\n",
    "import { CupomLoja, Cliente, Produto } from '../../types';\n\ntype ClienteCupom = Pick<Cliente, 'id' | 'nome' | 'email'>;\ntype ProdutoCupom = Pick<Produto, 'id' | 'nome' | 'valor'>;\n",
    'tipos de opcao dos cupons',
  );
  source = replaceExact(source, 'useState<Cliente[]>([])', 'useState<ClienteCupom[]>([])', 'estado cliente cupom');
  source = replaceExact(source, 'useState<Produto[]>([])', 'useState<ProdutoCupom[]>([])', 'estado produto cupom');
  return source;
});

updateFile('src/components/admin/FinanceiroModule.tsx', (source) => {
  source = replaceExact(
    source,
    "setConfirmModalSaque({ isOpen: true, saque, type: 'reject', reason: '' });",
    "setConfirmModalSaque({ isOpen: true, saque, type: 'reject', reason: '', dataPagamento: confirmModalSaque.dataPagamento });",
    'modal de rejeicao de saque',
  );
  source = replaceExact(
    source,
    'if (data) setAvailableClients(data);',
    'if (data) setAvailableClients(data as unknown as Cliente[]);',
    'projecao de clientes no financeiro',
  );
  return source;
});

updateFile('src/components/admin/OrcamentosModule.tsx', (source) => {
  source = replaceExact(source, 'if (c) setClientes(c);', 'if (c) setClientes(c as unknown as Cliente[]);', 'projecao de clientes em orcamentos');
  source = replaceExact(
    source,
    "      desconto: orcamento.desconto || 0,\n      observacoes_servico:",
    "      desconto: orcamento.desconto || 0,\n      promocao_desconto_manual: orcamento.promocao_desconto_manual || 0,\n      observacoes_servico:",
    'reset de desconto promocional',
  );
  return source;
});

updateFile('src/components/admin/VouchersModule.tsx', (source) => replaceExact(
  source,
  'if (data) setClientes(data);',
  'if (data) setClientes(data as unknown as Cliente[]);',
  'projecao de clientes em vouchers',
));

updateFile('src/components/admin/prestadores/PrestadoresFinanceiro.tsx', (source) => replaceExact(
  source,
  "setConfirmModal({ isOpen: true, saque, type: 'reject', reason: '' });",
  "setConfirmModal({ isOpen: true, saque, type: 'reject', reason: '', paymentDate: confirmModal.paymentDate });",
  'modal de rejeicao de saque do prestador',
));

updateFile('src/pages/BusinessRegistrationPage.tsx', (source) => replaceExact(
  source,
  'onClick={onLogin}',
  'onClick={() => onLogin()}',
  'evento do botao de login empresarial',
));

updateFile('src/components/client/marketplace/classifieds/EditClassifiedListingPage.tsx', (source) => replaceExact(
  source,
  ".map((media: any, index: number) => ({ url: media.url, path: getStoragePath(media.url), tipo: media.tipo || 'image', ordem: index }));",
  ".map((media: any, index: number) => ({\n          url: media.url,\n          path: getStoragePath(media.url),\n          tipo: 'image' as const,\n          ordem: index,\n          nome: String(media.url || '').split('/').pop() || `imagem-${index + 1}`,\n          tamanho: 0,\n        }));",
  'metadados de midia existente',
));

if (changed.size === 0) {
  console.log('[audit-remediation] Onda 1 ja aplicada.');
  process.exit(0);
}

runGit('diff', '--check');
runGit('config', 'user.name', 'github-actions[bot]');
runGit('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
runGit('add', ...changed);
runGit('commit', '-m', 'fix(audit): corrigir primeira onda de incompatibilidades locais');
runGit('push', 'origin', `HEAD:${TARGET_BRANCH}`);
console.log(`[audit-remediation] Onda 1 aplicada em ${changed.size} arquivos.`);
