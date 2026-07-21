from pathlib import Path

path = Path('.github/workflows/advertising-foundation.yml')
text = path.read_text(encoding='utf-8')
text = text.replace("      - 'scripts/apply-advertising-completion.py'\n", '')
text = text.replace('permissions:\n  contents: write', 'permissions:\n  contents: read')
start = text.find('jobs:\n  integrate:')
end = text.find('\n  validate:', start)
if start < 0 or end < 0:
    raise SystemExit('Job temporário de integração não encontrado')
text = text[:start] + 'jobs:' + text[end:]
text = text.replace("  validate:\n    needs: integrate\n    if: always() && (needs.integrate.result == 'success' || needs.integrate.result == 'skipped')\n", '  validate:\n')
path.write_text(text, encoding='utf-8')
print('Workflow definitivo restaurado para validação somente leitura.')
