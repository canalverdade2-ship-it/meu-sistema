select 'tables=' || count(*)
from pg_tables
where schemaname = 'public'
  and tablename in (
    'parceiros_resgates_recursos',
    'parceiros_resgates_eventos',
    'parceiros_resgates_public_status',
    'parceiros_resgates_recurso_desafios',
    'parceiros_resgates_notificacoes'
  );

select 'functions=' || count(*)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'gsa_%partner%appeal%';

select 'publication=' || count(*)
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'parceiros_resgates_public_status';

select 'status_rows=' || count(*) from public.parceiros_resgates_public_status;
select 'timeline_rows=' || count(*) from public.parceiros_resgates_eventos;
