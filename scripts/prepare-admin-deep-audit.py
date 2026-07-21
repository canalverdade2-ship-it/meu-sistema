from pathlib import Path

path = Path('scripts/apply-admin-deep-audit.py')
text = path.read_text(encoding='utf-8')
old_priority = '"    \'fidelidade\',\\n    \'promocoes\',\\n    \'area_vip\',\\n    \'relatorios\',"'
new_priority = '"    \'fidelidade\',\\n    \'emprestimos\',\\n    \'credito_loja\',\\n    \'promocoes\',\\n    \'area_vip\',\\n    \'relatorios\',"'
if old_priority not in text:
    raise SystemExit('Priority patch anchor not found')
text = text.replace(old_priority, new_priority, 1)
old_cleanup = "    '.github/workflows/run-admin-deep-audit-pr.yml',\n    'scripts/apply-admin-deep-audit.py',"
new_cleanup = "    '.github/workflows/run-admin-deep-audit-pr.yml',\n    '.github/workflows/diagnose-admin-deep-audit.yml',\n    'scripts/prepare-admin-deep-audit.py',\n    'scripts/apply-admin-deep-audit.py',"
if old_cleanup not in text:
    raise SystemExit('Cleanup patch anchor not found')
path.write_text(text.replace(old_cleanup, new_cleanup, 1), encoding='utf-8')
