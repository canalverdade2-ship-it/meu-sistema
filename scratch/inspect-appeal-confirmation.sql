select 'CHALLENGES' as section;
select id, resgate_id, expires_at, consumed_at, attempts, created_at
from public.parceiros_resgates_recurso_desafios
order by created_at desc
limit 8;

select 'APPEALS' as section;
select resgate_id, protocolo_recurso, status, aberto_em
from public.parceiros_resgates_recursos
order by aberto_em desc
limit 5;
