PGPASSWORD=GSA_SENHA_FORTE_2026 psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -tAc "SELECT pg_get_functiondef('gsa_notify_orcamento_lifecycle'::regproc);"
