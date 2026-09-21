#!/usr/bin/env bash
DB="postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub"

echo "=== gsa_tv_graphics rows ==="
psql "$DB" -X -c "SELECT id, channel_id, layer_type, name, enabled FROM public.gsa_tv_graphics ORDER BY layer_type, created_at" 2>&1

echo ""
echo "=== gsa_tv_programs publicados/ativos ==="
psql "$DB" -X -c "SELECT id, name, status FROM public.gsa_tv_programs WHERE status IN ('published','active') ORDER BY name" 2>&1

echo ""
echo "=== gsa_tv_series existentes ==="
psql "$DB" -X -c "SELECT s.id, s.name, p.name as program_name FROM public.gsa_tv_series s JOIN public.gsa_tv_programs p ON p.id=s.program_id LIMIT 20" 2>&1 || \
psql "$DB" -X -c "\d public.gsa_tv_series" 2>&1

echo ""
echo "=== gsa_tv_episodes (10 mais recentes) ==="
psql "$DB" -X -c "SELECT e.id, e.title, e.episode_number, s.name as series_name FROM public.gsa_tv_episodes e JOIN public.gsa_tv_series s ON s.id=e.series_id ORDER BY e.created_at DESC LIMIT 10" 2>&1
