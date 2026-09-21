#!/usr/bin/env bash
DB="postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub"

echo "=== gsa_tv_series com programa ==="
psql "$DB" -X -c "SELECT s.id, s.title, p.id as program_id, p.name as program_name FROM public.gsa_tv_series s JOIN public.gsa_tv_programs p ON p.id=s.program_id WHERE s.status='active' ORDER BY p.name LIMIT 20" 2>&1

echo ""
echo "=== gsa_tv_episodes (10 recentes com series) ==="
psql "$DB" -X -c "SELECT e.id, e.title, e.episode_number, e.season_number, s.title as series_title, p.name as program_name FROM public.gsa_tv_episodes e JOIN public.gsa_tv_series s ON s.id=e.series_id JOIN public.gsa_tv_programs p ON p.id=s.program_id ORDER BY e.created_at DESC LIMIT 10" 2>&1

echo ""
echo "=== lower_thirds ja existentes ==="
psql "$DB" -X -c "SELECT id, name, enabled, text_content, config FROM public.gsa_tv_graphics WHERE layer_type='lower_third' ORDER BY created_at" 2>&1
