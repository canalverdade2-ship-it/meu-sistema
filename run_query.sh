sudo -u postgres psql -p 5433 -d gsahub -c "
SELECT proname, pg_get_functiondef(pg_proc.oid) 
FROM pg_proc 
JOIN pg_namespace n ON n.oid=pronamespace 
WHERE nspname='public' 
AND (proname ILIKE '%saque%' OR proname ILIKE '%withdraw%' OR proname ILIKE '%carteira%');
"
