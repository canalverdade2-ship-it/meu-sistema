PGPASSWORD='GSA_SENHA_FORTE_2026' psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -c "
SELECT id, passo, status, mensagem, progresso, created_at FROM automacao_scraping_logs ORDER BY id DESC LIMIT 10;
"