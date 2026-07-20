#!/usr/bin/env bash
set -euo pipefail

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git fetch origin main

set +e
git merge --no-ff --no-commit origin/main
merge_status=$?
set -e

if [ "$merge_status" -ne 0 ]; then
  git diff --name-only --diff-filter=U | sort > /tmp/home-conflicts.log
  while IFS= read -r path; do
    [ -n "$path" ] || continue
    case "$path" in
      index.html|public/logo.svg|scripts/check-home-public-contracts.ts|scripts/test-home-public-migrations.sql|src/components/public/GSAEnterpriseHome.tsx|src/components/public/LoginHub.tsx|src/data/publicProjectTypes.ts|src/data/publicServiceCatalog.ts|src/hooks/usePublicPageMetadata.ts|src/pages/Home.tsx|src/routing/safeReturnTo.ts|supabase/migrations/20260720215500_fix_public_home_contracts.sql|supabase/migrations/20260720215530_minimize_public_referral_lookup.sql|supabase/migrations/20260720215600_guard_legacy_budget_permissions.sql|vite.config.ts)
        git checkout --ours -- "$path"
        ;;
      *)
        git checkout --theirs -- "$path"
        ;;
    esac
    git add "$path"
  done < /tmp/home-conflicts.log
else
  : > /tmp/home-conflicts.log
fi

unresolved="$(git diff --name-only --diff-filter=U)"
if [ -n "$unresolved" ]; then
  echo 'Conflitos não resolvidos:'
  echo "$unresolved"
  exit 2
fi

# O isolamento administrativo validado na main prevalece integralmente.
git checkout origin/main -- src/routing/adminAccess.ts scripts/check-admin-panel-contracts.ts
git add src/routing/adminAccess.ts scripts/check-admin-panel-contracts.ts

if [ -f scripts/resolve-home-current-main.py ]; then
  python scripts/resolve-home-current-main.py
fi

node <<'NODE'
const fs = require('node:fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts['test:home'] = 'tsx scripts/check-home-public-contracts.ts';
fs.writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
NODE

python <<'PY'
from pathlib import Path

test_path = Path('scripts/check-home-public-contracts.ts')
test = test_path.read_text()
if "const sessionService = read('src/lib/sessionService.ts');" not in test:
    test = test.replace(
        "const home = read('src/pages/Home.tsx');",
        "const home = read('src/pages/Home.tsx');\nconst sessionService = read('src/lib/sessionService.ts');\nconst authGateway = read('supabase/functions/gsa-auth-session/index.ts');",
        1,
    )
test = test.replace(
    "assert.doesNotMatch(migration, /gsa_recuperar_senha_cliente|recover_client/, 'A correção da Home não pode alterar a recuperação em andamento');\n",
    '',
)
anchor = "assert.match(migration, /v_default_active AND upper\\(v_token\\)/, 'Código público depende da configuração ativa');"
contracts = """assert.match(sessionService, /request_client_recovery/, 'Recuperação deve iniciar desafio sem abrir sessão');
assert.match(sessionService, /complete_client_recovery/, 'Recuperação só pode criar sessão após desafio concluído');
assert.doesNotMatch(sessionService, /['\"]recover_client['\"]/, 'Fluxo antigo de recuperação direta deve permanecer removido');
assert.match(authGateway, /request_client_recovery/, 'Gateway deve oferecer solicitação protegida');
assert.match(authGateway, /complete_client_recovery/, 'Gateway deve concluir somente o desafio autenticado');
assert.match(authGateway, /gsa_client_recovery_challenges/, 'Desafio deve ser único, expirar e ser consumido');
assert.match(clientModal, /verifyOtp/, 'Código recebido por e-mail deve ser verificado pelo Supabase Auth');
assert.match(clientModal, /autoComplete=\"one-time-code\"/, 'Home deve solicitar o código de uso único');
"""
if contracts.splitlines()[0] not in test:
    if anchor not in test:
        raise SystemExit('Âncora dos contratos públicos da Home não encontrada.')
    test = test.replace(anchor, contracts + anchor, 1)
test_path.write_text(test)

admin_path = Path('scripts/check-admin-panel-contracts.ts')
admin = admin_path.read_text()
legacy = "    \"localStorage.setItem('colaboradorModulos'\",\n"
if legacy in admin:
    admin = admin.replace(legacy, "    'colaboradorModulos: adminDetails.modulos',\n    'readSafeReturnTo',\n", 1)
secure_anchor = "  await assertFileContains('src/pages/SecureAdminPanel.tsx', [\n"
secure_block = """  await assertFileExcludes('src/App.tsx', [
    "localStorage.setItem('adminType'",
    "localStorage.setItem('colaboradorModulos'",
  ]);

"""
if secure_block not in admin:
    if secure_anchor not in admin:
        raise SystemExit('Âncora do contrato administrativo não encontrada.')
    admin = admin.replace(secure_anchor, secure_block + secure_anchor, 1)
admin_path.write_text(admin)

quality_path = Path('.github/workflows/quality.yml')
quality = quality_path.read_text()
home_step = """      - name: Public Home contracts
        if: steps.typescript.outputs.exit_code == '0'
        run: npm run test:home

"""
marker = "      - name: Client portal security contracts\n"
if 'name: Public Home contracts' not in quality:
    if marker not in quality:
        raise SystemExit('Ponto de inserção do Quality não encontrado.')
    quality = quality.replace(marker, home_step + marker, 1)
quality_path.write_text(quality)
PY

git add -A
if git rev-parse -q --verify MERGE_HEAD >/dev/null; then
  git commit -m 'Sincronizar Home completa com a main atual'
fi

rm -f .github/workflows/sync-home-current-main.yml
rm -f .github/workflows/sync-home-final-v13.yml
rm -f .sync-home-current-main-trigger
rm -f scripts/resolve-home-current-main.py
rm -f scripts/finalize-home-sync-v13.sh
git add -A
git commit -m 'Remover controles temporários da sincronização da Home'
