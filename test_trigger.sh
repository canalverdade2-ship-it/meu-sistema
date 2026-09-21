PGPASSWORD='GSA_SENHA_FORTE_2026' psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -c "
SELECT gsa_admin_trigger_scraping_now_internal(NULL, NULL, 'dfb0bfe3-6d14-468e-9126-52e947925f04');
"