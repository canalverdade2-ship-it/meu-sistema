select 'total=' || count(*) from public.parceiros_resgates;
select 'statuses=' || coalesce(string_agg(status || ':' || total, ',' order by status), '')
from (select coalesce(status, '<null>') status, count(*)::text total from public.parceiros_resgates group by status) s;
select 'missing_protocol=' || count(*) from public.parceiros_resgates where nullif(trim(codigo_gerado), '') is null;
select 'duplicate_protocol_groups=' || count(*) from (select codigo_gerado from public.parceiros_resgates where codigo_gerado is not null group by codigo_gerado having count(*) > 1) d;
select 'invalid_status=' || count(*) from public.parceiros_resgates where status not in ('pendente','analise','recusado','concluido');
select 'completed_without_link_or_date=' || count(*) from public.parceiros_resgates where status='concluido' and (nullif(trim(link_ativacao),'') is null or data_ativacao is null);
select 'rejected_without_reason=' || count(*) from public.parceiros_resgates where status='recusado' and nullif(trim(motivo_recusa),'') is null;
select 'rejected_without_timestamp=' || count(*) from public.parceiros_resgates where status='recusado' and recusado_em is null;
select 'appeals=' || count(*) from public.parceiros_resgates_recursos;
select 'appeals_invalid_parent=' || count(*) from public.parceiros_resgates_recursos a join public.parceiros_resgates r on r.id=a.resgate_id where (a.status='em_analise' and r.status <> 'recusado') or (a.status='deferido' and r.status not in ('pendente','analise','concluido'));
select 'appeals_decided_without_date=' || count(*) from public.parceiros_resgates_recursos where status in ('deferido','indeferido') and analisado_em is null;
select 'appeals_denied_without_reason=' || count(*) from public.parceiros_resgates_recursos where status='indeferido' and nullif(trim(motivo_decisao),'') is null;
select 'public_status_missing=' || count(*) from public.parceiros_resgates r left join public.parceiros_resgates_public_status s on s.resgate_id=r.id where s.resgate_id is null;
select 'timeline_missing=' || count(*) from public.parceiros_resgates r where not exists (select 1 from public.parceiros_resgates_eventos e where e.resgate_id=r.id);
select 'outbox=' || coalesce(string_agg(status || ':' || total, ',' order by status), '')
from (select status, count(*)::text total from public.parceiros_resgates_notificacoes group by status) s;
select 'anon_private_grants=' || count(*) from information_schema.role_table_grants where grantee='anon' and table_schema='public' and table_name='parceiros_resgates';
select 'anon_private_policies=' || count(*) from pg_policies where schemaname='public' and tablename='parceiros_resgates' and ('anon'=any(roles) or 'public'=any(roles));
select 'authenticated_private_policies=' || count(*) from pg_policies where schemaname='public' and tablename='parceiros_resgates' and 'authenticated'=any(roles);
select 'realtime_publication=' || count(*) from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='parceiros_resgates_public_status';
