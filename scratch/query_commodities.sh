psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
SELECT title, summary, published_at 
FROM public.gsa_tv_editorial_items 
WHERE title ILIKE '%soja%' OR title ILIKE '%milho%' OR summary ILIKE '%soja%' OR summary ILIKE '%milho%'
ORDER BY published_at DESC NULLS LAST 
LIMIT 10;
"
