PGPASSWORD='GSA_SENHA_FORTE_2026' psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -c "
CREATE POLICY \"Allow anon to insert logs\" ON automacao_scraping_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
"