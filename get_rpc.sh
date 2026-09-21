PGPASSWORD=GSA_SENHA_FORTE_2026 psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -t -c "SELECT prosrc FROM pg_proc WHERE proname = 'gsa_admin_get_pendency_counts_secure';"
