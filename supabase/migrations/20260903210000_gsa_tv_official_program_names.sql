-- Padroniza os nomes oficiais aprovados para a grade fixa da GSA TV.
-- Os identificadores e caminhos de arquivos permanecem inalterados para
-- preservar compatibilidade com vinhetas e mídias já renderizadas.

UPDATE public.gsa_tv_programs
SET name = CASE name
  WHEN 'GSA Motores' THEN 'GSA Motor'
  WHEN 'GSA Motores Diário' THEN 'GSA Motor'
  WHEN 'GSA Clima' THEN 'GSA Tempo'
  WHEN 'GSA Clima & Tempo' THEN 'GSA Tempo'
  WHEN 'GSA Clima & Tempo Brasil' THEN 'GSA Tempo'
  WHEN 'GSA Cidadania & Direitos' THEN 'GSA Cidadania'
  WHEN 'GSA Cidadania & Seus Direitos' THEN 'GSA Cidadania'
  WHEN 'GSA Boletim Financeiro' THEN 'GSA Mercado'
  WHEN 'GSA Boletim Financeiro B3' THEN 'GSA Mercado'
  ELSE name
END,
updated_at = now()
WHERE name IN (
  'GSA Motores', 'GSA Motores Diário',
  'GSA Clima', 'GSA Clima & Tempo', 'GSA Clima & Tempo Brasil',
  'GSA Cidadania & Direitos', 'GSA Cidadania & Seus Direitos',
  'GSA Boletim Financeiro', 'GSA Boletim Financeiro B3'
);

UPDATE public.gsa_tv_media_items
SET title = replace(title, 'GSA Boletim Financeiro', 'GSA Mercado'),
    updated_at = now()
WHERE title LIKE '%GSA Boletim Financeiro%';

UPDATE public.gsa_tv_media_items
SET title = replace(replace(title, 'GSA Motores Diário', 'GSA Motor'), 'GSA Motores', 'GSA Motor'),
    updated_at = now()
WHERE title LIKE '%GSA Motores%';

UPDATE public.gsa_tv_media_items
SET title = replace(replace(replace(title, 'GSA Clima & Tempo Brasil', 'GSA Tempo'), 'GSA Clima & Tempo', 'GSA Tempo'), 'GSA Clima', 'GSA Tempo'),
    updated_at = now()
WHERE title LIKE '%GSA Clima%';

UPDATE public.gsa_tv_media_items
SET title = replace(replace(title, 'GSA Cidadania & Seus Direitos', 'GSA Cidadania'), 'GSA Cidadania & Direitos', 'GSA Cidadania'),
    updated_at = now()
WHERE title LIKE '%GSA Cidadania &%';
