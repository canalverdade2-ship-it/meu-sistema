#!/usr/bin/env bash
set -euo pipefail
DB="postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub"

echo "=== [R4] Inserindo lower_thirds universais para programas ==="

# Insere lower_thirds para os 5 principais programas publicados
# que ainda nao tenham um lower_third especifico com seu nome
# A tabela gsa_tv_graphics nao tem FK para programs, por isso usamos o name no campo "name"
# e o program name + episode info em text_content e config

psql "$DB" -X -v ON_ERROR_STOP=1 << 'SQL'
DO $$
DECLARE
  rec RECORD;
  lt_count INT;
BEGIN
  -- Seleciona os programas publicados para inserir lower_thirds
  FOR rec IN
    SELECT id, name, category
    FROM public.gsa_tv_programs
    WHERE status = 'published'
    ORDER BY
      -- Prioriza os mais relevantes da grade
      CASE name
        WHEN 'GSA Manhã News' THEN 1
        WHEN 'GSA News' THEN 2
        WHEN 'GSA Em Fé' THEN 3
        WHEN 'GSA Agro' THEN 4
        WHEN 'GSA Destinos' THEN 5
        WHEN 'GSA Hora da Palavra' THEN 6
        WHEN 'GSA Histórias da Bíblia' THEN 7
        WHEN 'GSA Sessão Pipoca' THEN 8
        WHEN 'GSA Tá na Rede' THEN 9
        WHEN 'GSA Esportes' THEN 10
        ELSE 99
      END,
      name
    LIMIT 10
  LOOP
    -- Verifica se ja existe um lower_third com esse nome de programa
    SELECT COUNT(*) INTO lt_count
    FROM public.gsa_tv_graphics
    WHERE layer_type = 'lower_third'
      AND name ILIKE '%' || rec.name || '%';

    IF lt_count = 0 THEN
      INSERT INTO public.gsa_tv_graphics
        (channel_id, layer_type, name, enabled, text_content, config)
      VALUES (
        'ch-main',
        'lower_third',
        'Lower Third — ' || rec.name,
        true,
        rec.name || chr(10) || 'Episódio em exibição',
        jsonb_build_object(
          'preset', 'program_lower_third',
          'program_name', rec.name,
          'episode_label', 'Episódio em exibição',
          'category', COALESCE(rec.category, 'geral'),
          'position', 'bottom_left',
          'font_size', 28,
          'background', 'rgba(0,0,0,0.72)',
          'accent', CASE rec.category
            WHEN 'jornalismo' THEN '#1d4ed8'
            WHEN 'religioso' THEN '#7c3aed'
            WHEN 'entretenimento' THEN '#be185d'
            WHEN 'agronegocio' THEN '#15803d'
            WHEN 'esportes' THEN '#b45309'
            ELSE '#b91c1c'
          END
        )
      );
      RAISE NOTICE 'Inserido lower_third para: %', rec.name;
    ELSE
      RAISE NOTICE 'Lower_third ja existe para: %', rec.name;
    END IF;
  END LOOP;
END $$;
SQL

echo ""
echo "=== Verificando lower_thirds inseridos ==="
psql "$DB" -X -c "SELECT id, name, enabled, (config->>'program_name') as prog FROM public.gsa_tv_graphics WHERE layer_type='lower_third' ORDER BY created_at" 2>&1

echo ""
echo "=== Contagem total ==="
psql "$DB" -X -c "SELECT layer_type, COUNT(*) FROM public.gsa_tv_graphics GROUP BY layer_type ORDER BY layer_type" 2>&1

echo ""
echo "=== Verificando distintos programas com lower_thirds ativos ==="
psql "$DB" -X -c "SELECT COUNT(DISTINCT config->>'program_name') as programas_com_lower_third FROM public.gsa_tv_graphics WHERE layer_type='lower_third' AND enabled=true" 2>&1
