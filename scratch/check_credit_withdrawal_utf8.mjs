import fs from 'node:fs';
const root = 'C:/Users/Adriano Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)';
const files = [
  'supabase/migrations/20260829133000_credit_available_withdrawals.sql',
  'supabase/migrations/20260829134500_restore_admin_settings_allowlist.sql',
  'src/features/creditWithdrawal/types.ts',
  'src/features/creditWithdrawal/service.ts',
  'src/components/client/CreditWithdrawalModal.tsx',
  'src/components/client/ClientMeuCredito.tsx',
  'src/components/admin/super-domains/financeiro/CreditWithdrawalsAdminPanel.tsx',
  'src/components/admin/super-domains/financeiro/EmprestimosCreditoView.tsx',
  'src/components/admin/super-domains/financeiro/FinanceiroSuperDomain.tsx',
  'src/components/admin/ConfiguracoesModule.tsx',
  'src/components/admin/super-domains/governanca/GovernancaConfiguracoesView.tsx',
  'src/tests/credit-withdrawal.test.ts',
];
let problems = 0;
for (const rel of files) {
  const text = fs.readFileSync(`${root}/${rel}`, 'utf8');
  const bad = [];
  if (text.includes('\uFFFD')) bad.push('replacement-char');
  for (const pattern of ['Ã', 'Â', 'â€', 'ðŸ']) if (text.includes(pattern)) bad.push(pattern);
  if (bad.length) { problems++; console.log(`${rel}: ${bad.join(',')}`); }
}
console.log(`files=${files.length}`);
console.log(`utf8_problems=${problems}`);
process.exitCode = problems ? 1 : 0;
