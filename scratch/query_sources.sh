psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
SELECT source_id, s.category, count(*) 
FROM public.gsa_tv_editorial_items i 
JOIN public.gsa_tv_editorial_sources s ON s.id=i.source_id 
GROUP BY source_id, s.category 
ORDER BY count(*) DESC;
"
