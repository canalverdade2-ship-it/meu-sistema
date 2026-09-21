#!/usr/bin/env bash
DB="postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub"

echo "=== 1. ExecStart do servico ==="
systemctl show gsa-tv-backup.service -p ExecStart

echo ""
echo "=== 2. Schema gsa_tv_graphics ==="
psql "$DB" -X -c "\d public.gsa_tv_graphics" 2>&1 || true

echo ""
echo "=== 3. Rows atuais em gsa_tv_graphics ==="
psql "$DB" -X -c "SELECT * FROM public.gsa_tv_graphics LIMIT 10" 2>&1 || true

echo ""
echo "=== 4. Tabelas gsa_tv relevantes ==="
psql "$DB" -X -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'gsa_tv_%' ORDER BY table_name" 2>&1

echo ""
echo "=== 5. B-roll dir ==="
ls -la /opt/gsa-tv/cache/media/1/broll/biblico/raw/ 2>/dev/null || echo "dir not found"
