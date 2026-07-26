-- Portal Empresarial GSA HUB
-- Fundação de dados, isolamento por CNPJ, histórico e painel consolidado.

begin;

create extension if not exists pgcrypto;

create or replace function public.gsa_current_enterprise_client_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor_type text;
  v_actor_id uuid;
begin
  v_actor_type := coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '');
  if v_actor_type <> 'cliente' then
    return null;
  end if;

  begin
    v_actor_id := nullif(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '')::uuid;
  exception when others then
    return null;
  end;

  if exists (
    select 1
      from public.clientes c
     where c.id = v_actor_id
       and c.tipo_pessoa = 'pj'
  ) then
    return v_actor_id;
  end if;

  return null;
end;
$$;

revoke all on function public.gsa_current_enterprise_client_id() from public;
grant execute on function public.gsa_current_enterprise_client_id() to authenticated;

create table if not exists public.enterprise_portal_profiles (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  razao_social text not null,
  nome_fantasia text,
  cnpj text not null,
  responsavel_principal text,
  email_corporativo text,
  telefone_corporativo text,
  segmento text,
  porte text,
  website text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enterprise_members (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nome text not null,
  email text not null,
  cargo text,
  perfil text not null default 'consulta' check (perfil in ('representante_legal', 'administrador', 'financeiro', 'fiscal', 'rh', 'operacional', 'consulta', 'contador_externo')),
  status text not null default 'ativo' check (status in ('ativo', 'inativo', 'convite_pendente', 'revogado')),
  permissoes jsonb not null default '{}'::jsonb,
  is_primary boolean not null default false,
  last_access_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, email)
);

create table if not exists public.enterprise_audit_events (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  member_id uuid references public.enterprise_members(id) on delete set null,
  actor_client_id uuid references public.clientes(id) on delete set null,
  event_type text not null,
  module text,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_enterprise_members_cliente_status
  on public.enterprise_members (cliente_id, status);
create index if not exists idx_enterprise_audit_cliente_created
  on public.enterprise_audit_events (cliente_id, created_at desc);

create or replace function public.gsa_enterprise_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enterprise_profiles_updated_at on public.enterprise_portal_profiles;
create trigger trg_enterprise_profiles_updated_at
before update on public.enterprise_portal_profiles
for each row execute function public.gsa_enterprise_touch_updated_at();

drop trigger if exists trg_enterprise_members_updated_at on public.enterprise_members;
create trigger trg_enterprise_members_updated_at
before update on public.enterprise_members
for each row execute function public.gsa_enterprise_touch_updated_at();

insert into public.enterprise_portal_profiles (
  cliente_id,
  razao_social,
  nome_fantasia,
  cnpj,
  responsavel_principal,
  email_corporativo,
  telefone_corporativo
)
select
  c.id,
  coalesce(nullif(c.nome_razao, ''), c.nome),
  c.nome,
  coalesce(c.cnpj, ''),
  c.nome,
  c.email,
  c.telefone
from public.clientes c
where c.tipo_pessoa = 'pj'
on conflict (cliente_id) do nothing;

insert into public.enterprise_members (
  cliente_id,
  nome,
  email,
  cargo,
  perfil,
  status,
  is_primary
)
select
  c.id,
  c.nome,
  coalesce(nullif(c.email, ''), concat('responsavel+', c.id::text, '@gsa.local')),
  'Responsável principal',
  'representante_legal',
  'ativo',
  true
from public.clientes c
where c.tipo_pessoa = 'pj'
on conflict (cliente_id, email) do nothing;

alter table public.enterprise_portal_profiles enable row level security;
alter table public.enterprise_members enable row level security;
alter table public.enterprise_audit_events enable row level security;

revoke all on public.enterprise_portal_profiles from anon;
revoke all on public.enterprise_members from anon;
revoke all on public.enterprise_audit_events from anon;

grant select, insert, update on public.enterprise_portal_profiles to authenticated;
grant select, insert, update on public.enterprise_members to authenticated;
grant select on public.enterprise_audit_events to authenticated;

drop policy if exists enterprise_profiles_select_own on public.enterprise_portal_profiles;
create policy enterprise_profiles_select_own
on public.enterprise_portal_profiles for select
to authenticated
using (cliente_id = public.gsa_current_enterprise_client_id());

drop policy if exists enterprise_profiles_insert_own on public.enterprise_portal_profiles;
create policy enterprise_profiles_insert_own
on public.enterprise_portal_profiles for insert
to authenticated
with check (cliente_id = public.gsa_current_enterprise_client_id());

drop policy if exists enterprise_profiles_update_own on public.enterprise_portal_profiles;
create policy enterprise_profiles_update_own
on public.enterprise_portal_profiles for update
to authenticated
using (cliente_id = public.gsa_current_enterprise_client_id())
with check (cliente_id = public.gsa_current_enterprise_client_id());

drop policy if exists enterprise_members_select_own on public.enterprise_members;
create policy enterprise_members_select_own
on public.enterprise_members for select
to authenticated
using (cliente_id = public.gsa_current_enterprise_client_id());

drop policy if exists enterprise_members_insert_own on public.enterprise_members;
create policy enterprise_members_insert_own
on public.enterprise_members for insert
to authenticated
with check (cliente_id = public.gsa_current_enterprise_client_id());

drop policy if exists enterprise_members_update_own on public.enterprise_members;
create policy enterprise_members_update_own
on public.enterprise_members for update
to authenticated
using (cliente_id = public.gsa_current_enterprise_client_id())
with check (cliente_id = public.gsa_current_enterprise_client_id());

drop policy if exists enterprise_audit_select_own on public.enterprise_audit_events;
create policy enterprise_audit_select_own
on public.enterprise_audit_events for select
to authenticated
using (cliente_id = public.gsa_current_enterprise_client_id());

create or replace function public.gsa_enterprise_record_event(
  p_event_type text,
  p_module text,
  p_description text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid := public.gsa_current_enterprise_client_id();
  v_event_id uuid;
begin
  if v_client_id is null then
    raise exception 'Acesso empresarial inválido';
  end if;

  if nullif(trim(p_event_type), '') is null or nullif(trim(p_description), '') is null then
    raise exception 'Evento empresarial inválido';
  end if;

  insert into public.enterprise_audit_events (
    cliente_id,
    actor_client_id,
    event_type,
    module,
    description,
    metadata
  ) values (
    v_client_id,
    v_client_id,
    left(trim(p_event_type), 120),
    nullif(left(trim(coalesce(p_module, '')), 80), ''),
    left(trim(p_description), 500),
    coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.gsa_enterprise_record_event(text, text, text, jsonb) from public;
grant execute on function public.gsa_enterprise_record_event(text, text, text, jsonb) to authenticated;

create or replace function public.gsa_enterprise_audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_description text;
begin
  v_client_id := case when tg_op = 'DELETE' then old.cliente_id else new.cliente_id end;
  if v_client_id is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  v_description := case
    when tg_table_name = 'enterprise_portal_profiles' then 'Dados institucionais da empresa foram atualizados.'
    when tg_op = 'INSERT' then 'Novo responsável empresarial foi cadastrado.'
    when tg_op = 'UPDATE' then 'Cadastro de responsável empresarial foi atualizado.'
    else 'Cadastro de responsável empresarial foi removido.'
  end;

  insert into public.enterprise_audit_events (
    cliente_id,
    member_id,
    actor_client_id,
    event_type,
    module,
    description,
    metadata
  ) values (
    v_client_id,
    case
      when tg_table_name <> 'enterprise_members' then null
      when tg_op = 'DELETE' then old.id
      else new.id
    end,
    public.gsa_current_enterprise_client_id(),
    upper(tg_table_name || '_' || tg_op),
    case when tg_table_name = 'enterprise_members' then 'equipe' else 'empresa' end,
    v_description,
    jsonb_build_object('operation', tg_op)
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_enterprise_profiles_audit on public.enterprise_portal_profiles;
create trigger trg_enterprise_profiles_audit
after insert or update on public.enterprise_portal_profiles
for each row execute function public.gsa_enterprise_audit_row_change();

drop trigger if exists trg_enterprise_members_audit on public.enterprise_members;
create trigger trg_enterprise_members_audit
after insert or update or delete on public.enterprise_members
for each row execute function public.gsa_enterprise_audit_row_change();

create or replace function public.gsa_enterprise_portal_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_client_id uuid := public.gsa_current_enterprise_client_id();
  v_result jsonb;
begin
  if v_client_id is null then
    return jsonb_build_object('success', false, 'error', 'enterprise_access_denied');
  end if;

  select jsonb_build_object(
    'success', true,
    'counts', jsonb_build_object(
      'pending_invoices', (
        select count(*) from public.faturas f
         where f.cliente_id = v_client_id
           and f.status in ('pendente', 'vencida', 'aguardando_link', 'pendente_pagamento', 'revisada')
      ),
      'overdue_invoices', (
        select count(*) from public.faturas f
         where f.cliente_id = v_client_id
           and f.status not in ('pago', 'cancelado')
           and f.data_vencimento < current_date
      ),
      'open_requests', (
        select count(*) from public.tickets t
         where t.cliente_id = v_client_id
           and t.status <> 'concluido'
      ),
      'open_quotes', (
        select count(*) from public.orcamentos o
         where o.cliente_id = v_client_id
           and o.status in ('aberto', 'em revisão', 'negociação', 'pendência documentos')
      ),
      'active_services', (
        coalesce((select count(*) from public.ordens_servico os where os.cliente_id = v_client_id and os.status = 'andamento'), 0)
        + coalesce((select count(*) from public.ordens_assinatura oa where oa.cliente_id = v_client_id and oa.status in ('em_analise', 'concluido')), 0)
      ),
      'issued_documents', (
        select count(*) from public.ordens_fiscais ofi
         where ofi.cliente_id = v_client_id
           and ofi.status_emissao = 'emitida'
      )
    ),
    'next_invoices', coalesce((
      select jsonb_agg(row_data order by row_data->>'due_date')
      from (
        select jsonb_build_object(
          'id', f.id,
          'code', f.codigo_fatura,
          'due_date', f.data_vencimento,
          'amount', f.valor_total,
          'status', f.status
        ) row_data
        from public.faturas f
        where f.cliente_id = v_client_id
          and f.status in ('pendente', 'vencida', 'aguardando_link', 'pendente_pagamento', 'revisada')
        order by f.data_vencimento asc
        limit 5
      ) invoice_rows
    ), '[]'::jsonb),
    'recent_requests', coalesce((
      select jsonb_agg(row_data order by row_data->>'opened_at' desc)
      from (
        select jsonb_build_object(
          'id', t.id,
          'subject', t.assunto,
          'status', t.status,
          'opened_at', t.data_abertura
        ) row_data
        from public.tickets t
        where t.cliente_id = v_client_id
        order by t.data_abertura desc
        limit 5
      ) request_rows
    ), '[]'::jsonb),
    'recent_activity', coalesce((
      select jsonb_agg(row_data order by row_data->>'created_at' desc)
      from (
        select jsonb_build_object(
          'id', e.id,
          'event_type', e.event_type,
          'module', e.module,
          'description', e.description,
          'created_at', e.created_at
        ) row_data
        from public.enterprise_audit_events e
        where e.cliente_id = v_client_id
        order by e.created_at desc
        limit 20
      ) audit_rows
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.gsa_enterprise_portal_snapshot() from public;
grant execute on function public.gsa_enterprise_portal_snapshot() to authenticated;

commit;
