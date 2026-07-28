import { readFileSync, writeFileSync } from 'node:fs';

if (process.env.GITHUB_ACTIONS !== 'true') {
  console.log('[audit-remediation-wave2] Execucao permitida somente no GitHub Actions.');
  process.exit(0);
}

const changed = new Set();

function updateFile(path, transform) {
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) return;
  writeFileSync(path, after, 'utf8');
  changed.add(path);
}

function replaceExact(source, before, after, label) {
  if (after && source.includes(after)) return source;
  if (!source.includes(before)) {
    if (!after) return source;
    throw new Error(`[audit-remediation-wave2] Padrao nao encontrado: ${label}`);
  }
  return source.replace(before, after);
}

updateFile('src/types.ts', (source) => {
  source = replaceExact(source, '  Orcamento,\n', '', 'retirar Orcamento do reexport legado');
  source = replaceExact(
    source,
    `export type Cliente = Legacy.Cliente & {\n  pin_bloqueado?: boolean;\n  pin_tentativas?: number;\n  saldo?: number;\n  pontos?: number;\n};\n`,
    `export type Cliente = Legacy.Cliente & {\n  pin_bloqueado?: boolean;\n  pin_tentativas?: number;\n  saldo?: number;\n  pontos?: number;\n};\n\nexport type Orcamento = Omit<Legacy.Orcamento, 'status' | 'categoria'> & {\n  status: Legacy.Orcamento['status'] | 'pendente' | 'produção' | 'em separação';\n  categoria: Legacy.Orcamento['categoria'] | 'loja';\n};\n`,
    'contrato operacional de Orcamento',
  );
  return source;
});

updateFile('src/components/admin/CuponsLojaModule.tsx', (source) => replaceExact(
  source,
  "function CupomForm({ onSubmit, onCancel, clientes, produtos }: { onSubmit: (data: any) => Promise<boolean>, onCancel: () => void, clientes: Cliente[], produtos: Produto[] }) {",
  "function CupomForm({ onSubmit, onCancel, clientes, produtos }: { onSubmit: (data: any) => Promise<boolean>, onCancel: () => void, clientes: ClienteCupom[], produtos: ProdutoCupom[] }) {",
  'projecoes do formulario de cupom',
));

updateFile('src/components/admin/OrcamentosModule.tsx', (source) => replaceExact(
  source,
  "    categoria: 'servico' as 'servico' | 'emprestimo',",
  "    categoria: 'servico' as 'servico' | 'produto' | 'assinatura' | 'emprestimo',",
  'categorias completas do wizard de orcamento',
));

updateFile('src/components/admin/PremiosModule.tsx', (source) => replaceExact(
  source,
  '  clientes?: { nome: string; codigo_cliente: string };',
  '  clientes?: { nome: string; codigo_cliente: string; telefone?: string };',
  'telefone no join de premio',
));

updateFile('src/components/admin/PrestadoresModule.tsx', (source) => replaceExact(
  source,
  'pendencies.prestadoresPendentes',
  'pendencies.cadastro_prestadores_pendentes',
  'contador real de prestadores pendentes',
));

updateFile('src/components/admin/ProdutosModule.tsx', (source) => replaceExact(
  source,
  'formData.valor_custo > 0 && importSelection.preco',
  'Number(formData.valor_custo) > 0 && importSelection.preco',
  'comparacao numerica do valor de custo',
));

updateFile('src/components/admin/TravelAdminModule.tsx', (source) => replaceExact(
  source,
  "  const getRefundStatus = (item: any): string => String(item?.cancelamento_status || item?.status || '');",
  `  const refundRequestIdsRef = useRef<Map<string, string>>(new Map());\n\n  const getRefundRequestId = (transactionId: string, action: 'approve' | 'complete' | 'deny'): string => {\n    const key = \`${'${transactionId}:${action}'}\`;\n    const existing = refundRequestIdsRef.current.get(key);\n    if (existing) return existing;\n\n    const requestId = generateUUID();\n    refundRequestIdsRef.current.set(key, requestId);\n    return requestId;\n  };\n\n  const getRefundStatus = (item: any): string => String(item?.cancelamento_status || item?.status || '');`,
  'idempotencia do processamento de reembolso',
));

updateFile('src/components/admin/demandas/DemandasDetalhesModal.tsx', (source) => {
  source = replaceExact(
    source,
    `      toast.success(\n        transferTarget === 'admin' ? 'Enviado para análise!' :\n        transferTarget === 'prestador' ? '📤 Proposta enviada ao prestador! Aguardando resposta.' :\n        'Transferido com sucesso!'\n      );`,
    `      toast.success(\n        transferTarget === 'prestador'\n          ? '📤 Proposta enviada ao prestador! Aguardando resposta.'\n          : 'Transferido com sucesso!'\n      );`,
    'remover destino admin inexistente do retorno',
  );
  source = replaceExact(
    source,
    `                {isSubmitting ? 'Processando...' :\n                  transferTarget === 'prestador' ? '📤 Enviar Proposta ao Prestador' :\n                  transferTarget === 'admin' ? 'Enviar para Análise' :\n                  'Confirmar Transferência'}`,
    `                {isSubmitting\n                  ? 'Processando...'\n                  : transferTarget === 'prestador'\n                    ? '📤 Enviar Proposta ao Prestador'\n                    : 'Confirmar Transferência'}`,
    'remover rotulo admin inexistente',
  );
  return source;
});

updateFile('src/components/admin/ui/AdminWhatsAppButton.tsx', (source) => replaceExact(
  source,
  "{React.cloneElement(whatsappIcon as React.ReactElement, { width: '14', height: '14' })}",
  "{React.cloneElement(whatsappIcon as React.ReactElement<React.SVGProps<SVGSVGElement>>, { width: '14', height: '14' })}",
  'props SVG do icone do WhatsApp',
));

updateFile('src/components/client/ClientOrcamentos.tsx', (source) => {
  source = replaceExact(
    source,
    `interface DadosPessoais {\n  nome: string;\n  cpf: string;\n  telefone: string;\n  email: string;\n}\n\ninterface DadosEmprestimo {\n  valor: number;\n  prazo: string;\n  motivo: string;\n}\n\ninterface DocFiles {\n  identidade: File | null;\n  comprovanteRenda: File | null;\n  comprovanteResidencia: File | null;\n}`,
    `interface DadosPessoais {\n  nome_completo: string;\n  data_nascimento: string;\n  rg: string;\n  cpf: string;\n  telefone: string;\n  cep: string;\n  numero_casa: string;\n  endereco_rua: string;\n  endereco_bairro: string;\n  endereco_cidade: string;\n  endereco_uf: string;\n  email: string;\n}\n\ninterface DadosEmprestimo {\n  valor_desejado: string;\n  parcelas_desejadas: number;\n  data_desejada: string;\n}\n\ninterface DocFiles {\n  cnh: File | null;\n  comprovante_endereco: File | null;\n  holerite: File | null;\n  foto_perfil: File | null;\n}`,
    'tipos reais da solicitacao de emprestimo',
  );
  source = replaceExact(
    source,
    `        if (initialTab && initialTab !== activeTab) {\n          setActiveTab(initialTab);\n        }`,
    `        if ((initialTab === 'abertos' || initialTab === 'aprovados') && initialTab !== activeTab) {\n          setActiveTab(initialTab);\n        }`,
    'guarda da aba de orcamentos',
  );
  return source;
});

updateFile('src/components/client/financeiro/FaturasList.tsx', (source) => replaceExact(
  source,
  "selectedFatura.itens_faturados?.[0]?.descricao?.match(/Parcela \\d+\\/\\d+/)?.[0]",
  "String(selectedFatura.itens_faturados?.[0]?.descricao || '').match(/Parcela \\d+\\/\\d+/)?.[0]",
  'normalizacao da descricao da parcela',
));

updateFile('src/components/client/ClientDashboard.tsx', (source) => replaceExact(
  source,
  '  label: string;',
  '  label: React.ReactNode;',
  'rotulo de menu como ReactNode',
));

console.log(`[audit-remediation-wave2] ${changed.size} arquivos atualizados.`);
