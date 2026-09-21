PGPASSWORD=GSA_SENHA_FORTE_2026 psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -c "SELECT taxa_entrega FROM orcamentos WHERE codigo_orcamento LIKE '%F9EBC9EE43%';"
