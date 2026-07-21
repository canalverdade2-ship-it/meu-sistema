from pathlib import Path

path = Path('src/components/public/GSAEnterpriseHome.tsx')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        '<div className="mt-10 grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">',
        '<div className="mt-8 grid gap-5 sm:mt-10 sm:gap-8 lg:grid-cols-[0.7fr_1.3fr]">',
        'espaçamento mobile do catálogo',
    ),
    (
        '<div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">',
        '<div className="hidden md:mt-8 md:grid md:grid-cols-2 md:gap-3 lg:grid-cols-1">',
        'ocultação mobile dos cards introdutórios',
    ),
]

changed = False
for old, new, description in replacements:
    if new in text:
        continue
    if old not in text:
        raise RuntimeError(f'Âncora não localizada para {description}.')
    text = text.replace(old, new, 1)
    changed = True

if changed:
    path.write_text(text, encoding='utf-8')

print('Correção mobile aplicada.' if changed else 'Correção mobile já aplicada.')
