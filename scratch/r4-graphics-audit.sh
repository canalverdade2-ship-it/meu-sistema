#!/usr/bin/env bash
DB="postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub"

echo "=== Schema gsa_tv_graphics completo ==="
psql "$DB" -X -c "\d public.gsa_tv_graphics" 2>&1

echo ""
echo "=== Rows existentes ==="
psql "$DB" -X -c "SELECT id, channel_id, graphic_type, label, is_active FROM public.gsa_tv_graphics ORDER BY created_at" 2>&1

echo ""
echo "=== Programas no gsa_tv_programs ==="
psql "$DB" -X -c "SELECT id, name, is_active FROM public.gsa_tv_programs WHERE is_active=true ORDER BY name LIMIT 20" 2>&1

echo ""
echo "=== Programas no gsa_tv_program_blocks ==="
psql "$DB" -X -c "SELECT DISTINCT program_id FROM public.gsa_tv_program_blocks LIMIT 10" 2>&1 || true

echo ""
echo "=== gsa_tv_episodes amostra ==="
psql "$DB" -X -c "SELECT id, program_id, title FROM public.gsa_tv_episodes ORDER BY created_at DESC LIMIT 10" 2>&1
