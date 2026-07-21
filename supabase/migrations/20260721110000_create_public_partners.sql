create table if not exists public.parceiros (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  legal_name text,
  category text not null,
  short_description text not null,
  description text,
  logo_url text,
  cover_url text,
  phone text,
  whatsapp text,
  email text,
  website text,
  instagram text,
  facebook text,
  linkedin text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  zip_code text,
  maps_url text,
  business_hours text,
  service_mode text not null default 'hibrido' check (service_mode in ('presencial', 'online', 'hibrido')),
  service_regions text[] not null default '{}',
  services text[] not null default '{}',
  products text[] not null default '{}',
  benefits text,
  contact_person text,
  internal_notes text,
  featured boolean not null default false,
  display_order integer not null default 0,
  status text not null default 'em_analise' check (status in ('em_analise', 'ativo', 'inativo', 'encerrado', 'excluido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parceiros_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint parceiros_state_length check (state is null or char_length(state) <= 2)
);

create index if not exists parceiros_public_listing_idx
  on public.parceiros (status, featured desc, display_order asc, name asc);
create index if not exists parceiros_category_idx on public.parceiros (category);
create index if not exists parceiros_city_state_idx on public.parceiros (city, state);

create or replace function public.gsa_touch_parceiros_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_parceiros_updated_at on public.parceiros;
create trigger trg_parceiros_updated_at
before update on public.parceiros
for each row execute function public.gsa_touch_parceiros_updated_at();

alter table public.parceiros enable row level security;

drop policy if exists parceiros_public_read_active on public.parceiros;
create policy parceiros_public_read_active
on public.parceiros
for select
to anon, authenticated
using (status = 'ativo');

drop policy if exists parceiros_admin_read_all on public.parceiros;
create policy parceiros_admin_read_all
on public.parceiros
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') in ('admin', 'colaborador'));

drop policy if exists parceiros_admin_insert on public.parceiros;
create policy parceiros_admin_insert
on public.parceiros
for insert
to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') in ('admin', 'colaborador'));

drop policy if exists parceiros_admin_update on public.parceiros;
create policy parceiros_admin_update
on public.parceiros
for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') in ('admin', 'colaborador'))
with check ((auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') in ('admin', 'colaborador'));

drop policy if exists parceiros_admin_delete on public.parceiros;
create policy parceiros_admin_delete
on public.parceiros
for delete
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') in ('admin', 'colaborador'));

grant select on public.parceiros to anon, authenticated;
grant insert, update, delete on public.parceiros to authenticated;

comment on table public.parceiros is 'Rede pública de parceiros da GSA HUB, com gestão administrativa e publicação controlada por status.';
comment on column public.parceiros.internal_notes is 'Campo exclusivamente administrativo; não deve ser selecionado nas consultas públicas.';
comment on column public.parceiros.contact_person is 'Responsável interno pelo relacionamento com o parceiro; não deve ser selecionado nas consultas públicas.';
