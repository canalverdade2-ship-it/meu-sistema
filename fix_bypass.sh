PGPASSWORD='GSA_SENHA_FORTE_2026' psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -c "
-- 1. Remover o bypass trigger que causa o 100% instantâneo
DROP TRIGGER IF EXISTS trg_auto_complete_scraping ON automacao_scraping_logs;
DROP FUNCTION IF EXISTS auto_complete_scraping();

-- 2. Verificar se pg_net está disponível como extensão
SELECT * FROM pg_available_extensions WHERE name = 'pg_net';
"