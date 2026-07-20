from pathlib import Path


def replace_once(path: str, old: str, new: str, description: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    if old not in text:
        raise RuntimeError(f'Âncora ausente para {description}: {path}')
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    'vite.config.ts',
    "      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),\n",
    '',
    'remoção da chave Gemini do bundle',
)

edge_path = Path('supabase/functions/gsa-auth-session/index.ts')
edge = edge_path.read_text()
edge = edge.replace('type AuthAction =', 'export type AuthAction =', 1)
subject_anchor = "function subjectFor(action: AuthAction, payload: Record<string, string>) {\n  if (action === 'login_admin' || action === 'login_colaborador') return payload.code;\n  return payload.documento || payload.recovery_id;\n}\n\n"
subject_block = subject_anchor + "export function subjectRateLimitMode(action: AuthAction): 'before' | 'invalid-only' {\n  return action === 'request_client_recovery' || action === 'complete_client_recovery'\n    ? 'before'\n    : 'invalid-only';\n}\n\n"
if subject_anchor not in edge:
    raise RuntimeError('Âncora da política de rate limiting não encontrada')
edge = edge.replace(subject_anchor, subject_block, 1)

bucket_anchor = "    const subjectBucket = await hashBucket(\n      serviceRoleKey,\n      `${body.action}:subject`,\n      subjectFor(body.action, normalizedPayload),\n    );\n\n"
bucket_block = bucket_anchor + "    if (subjectRateLimitMode(body.action) === 'before') {\n      const subjectLimit = await checkRateLimit(admin, subjectBucket, rules.subject);\n      if (!subjectLimit.allowed) {\n        const retryAfter = Math.max(1, Number(subjectLimit.retry_after || rules.subject.blockSeconds));\n        return tooManyAttempts(retryAfter, allowedOrigin);\n      }\n    }\n\n"
if bucket_anchor not in edge:
    raise RuntimeError('Âncora do bucket por identidade não encontrada')
edge_path.write_text(edge.replace(bucket_anchor, bucket_block, 1))

replace_once(
    'supabase/functions/gsa-auth-session/index_test.ts',
    "import { handleRequest, normalizePayload } from './index.ts';",
    "import { handleRequest, normalizePayload, subjectRateLimitMode } from './index.ts';",
    'importação do teste de rate limiting',
)

test_path = Path('supabase/functions/gsa-auth-session/index_test.ts')
test_text = test_path.read_text()
if 'aplica limite por identidade antes dos fluxos de recuperação' in test_text:
    raise RuntimeError('Teste de rate limiting já existe inesperadamente')
test_path.write_text(test_text.rstrip() + """

Deno.test('aplica limite por identidade antes dos fluxos de recuperação', () => {
  assertEquals(subjectRateLimitMode('request_client_recovery'), 'before');
  assertEquals(subjectRateLimitMode('complete_client_recovery'), 'before');
  assertEquals(subjectRateLimitMode('login_pin'), 'invalid-only');
  assertEquals(subjectRateLimitMode('login_admin'), 'invalid-only');
});
""")

stress_path = Path('tests/e2e/0-stress-real-data.spec.ts')
stress = stress_path.read_text()
import_anchor = "import { generateTestCPF } from '../utils/cpf-generator';\n"
if import_anchor not in stress:
    raise RuntimeError('Âncora do teste massivo não encontrada')
stress = stress.replace(
    import_anchor,
    import_anchor + "\nconst REAL_DATA_STRESS_ENABLED = process.env.ALLOW_REAL_DATA_STRESS_TEST === 'true';\n",
    1,
)
describe_anchor = "test.describe('Testes Massivos Reais de Sistema', () => {\n"
if describe_anchor not in stress:
    raise RuntimeError('Bloco do teste massivo não encontrado')
stress_path.write_text(stress.replace(
    describe_anchor,
    describe_anchor + "  test.skip(!REAL_DATA_STRESS_ENABLED, 'Teste com gravação real exige ALLOW_REAL_DATA_STRESS_TEST=true.');\n",
    1,
))

Path('.github/dependabot.yml').write_text("""version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
""")

Path('.github/workflows/dependency-security.yml').write_text("""name: Dependency Security

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
    paths:
      - package.json
      - package-lock.json
      - .github/workflows/dependency-security.yml
  schedule:
    - cron: '17 8 * * 1'

permissions:
  contents: read

jobs:
  audit:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm audit --audit-level=high
""")
