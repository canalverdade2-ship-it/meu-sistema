psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'gsa_tv_editorial_items';
"
