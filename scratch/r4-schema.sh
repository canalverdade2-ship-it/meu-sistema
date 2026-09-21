#!/usr/bin/env bash
DB="postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub"

echo "=== gsa_tv_graphics rows existentes ==="
psql "$DB" -X -c "SELECT id, channel_id, layer_type, name, enabled FROM public.gsa_tv_graphics ORDER BY created_at" 2>&1

echo ""
echo "=== gsa_tv_programs schema ==="
psql "$DB" -X -c "\d public.gsa_tv_programs" 2>&1

echo ""
echo "=== gsa_tv_programs todos ==="
psql "$DB" -X -c "SELECT * FROM public.gsa_tv_programs LIMIT 20" 2>&1

echo ""
echo "=== gsa_tv_program_blocks schema ==="
psql "$DB" -X -c "\d public.gsa_tv_program_blocks" 2>&1

echo ""
echo "=== gsa_tv_episodes schema ==="
psql "$DB" -X -c "\d public.gsa_tv_episodes" 2>&1

echo ""
echo "=== gsa_tv_channels ==="
psql "$DB" -X -c "SELECT id, name FROM public.gsa_tv_channels LIMIT 5" 2>&1
