begin;

create temporary table _gsa_program_aliases (
  alias_name text primary key,
  canonical_name text not null,
  edition_label text not null
) on commit drop;

insert into _gsa_program_aliases(alias_name, canonical_name, edition_label) values
  ('GSA Manhã News', 'GSA News', 'Manhã'),
  ('GSA Meio Dia News', 'GSA News', 'Meio-Dia'),
  ('GSA News Noite', 'GSA News', 'Noite'),
  ('GSA News Especial', 'GSA News', 'Especial'),
  ('GSA News Noturno', 'GSA News', 'Noturno'),
  ('GSA Tá na Rede Web', 'GSA Tá na Rede', 'Web'),
  ('GSA Em Fé Reflexão', 'GSA Em Fé', 'Reflexão'),
  ('GSA Destinos do Mundo', 'GSA Destinos', 'Do Mundo'),
  ('GSA Documentário Especial', 'GSA Doc', 'Especial'),
  ('GSA Mistérios da Noite', 'GSA Mistérios', 'Da Noite'),
  ('GSA Mistérios Noturno', 'GSA Mistérios', 'Noturno');

-- Preserve the schedule while moving edition names into segment_variant.
update public.gsa_tv_weekly_grid_slots s
set program_id = canonical.id,
    segment_variant = case
      when coalesce(btrim(s.segment_variant), '') = '' then a.edition_label
      else a.edition_label || ' — ' || s.segment_variant
    end,
    updated_at = now()
from public.gsa_tv_programs alias_program
join _gsa_program_aliases a on a.alias_name = alias_program.name
join public.gsa_tv_programs canonical on canonical.name = a.canonical_name
where s.program_id = alias_program.id;

-- Preserve all editorial and production relationships.
-- If the same sourced item already exists under the canonical program, keep one copy.
delete from public.gsa_tv_editorial_items alias_item
using public.gsa_tv_programs alias_program, _gsa_program_aliases a, public.gsa_tv_programs canonical
where alias_item.program_id = alias_program.id
  and alias_program.name = a.alias_name
  and canonical.name = a.canonical_name
  and exists (
    select 1
    from public.gsa_tv_editorial_items canonical_item
    where canonical_item.program_id = canonical.id
      and canonical_item.source_id = alias_item.source_id
      and canonical_item.dedupe_hash = alias_item.dedupe_hash
  );

-- Also collapse duplicates that exist across two different aliases mapping to the same program.
with ranked_alias_items as (
  select x.ctid,
         row_number() over (
           partition by a.canonical_name, x.source_id, x.dedupe_hash
           order by x.created_at, x.id
         ) as duplicate_rank
  from public.gsa_tv_editorial_items x
  join public.gsa_tv_programs alias_program on alias_program.id = x.program_id
  join _gsa_program_aliases a on a.alias_name = alias_program.name
)
delete from public.gsa_tv_editorial_items x
using ranked_alias_items r
where x.ctid = r.ctid
  and r.duplicate_rank > 1;

update public.gsa_tv_editorial_items x
set program_id = canonical.id
from public.gsa_tv_programs alias_program
join _gsa_program_aliases a on a.alias_name = alias_program.name
join public.gsa_tv_programs canonical on canonical.name = a.canonical_name
where x.program_id = alias_program.id;

update public.gsa_tv_program_blocks x
set program_id = canonical.id
from public.gsa_tv_programs alias_program
join _gsa_program_aliases a on a.alias_name = alias_program.name
join public.gsa_tv_programs canonical on canonical.name = a.canonical_name
where x.program_id = alias_program.id;

update public.gsa_tv_series x
set program_id = canonical.id
from public.gsa_tv_programs alias_program
join _gsa_program_aliases a on a.alias_name = alias_program.name
join public.gsa_tv_programs canonical on canonical.name = a.canonical_name
where x.program_id = alias_program.id;

-- Merge source rules without violating the composite primary key.
insert into public.gsa_tv_program_source_links(program_id, source_id, priority, purpose, required_for_generation, metadata, created_at)
select canonical.id,
       x.source_id,
       max(x.priority),
       max(x.purpose),
       bool_or(x.required_for_generation),
       (array_agg(x.metadata order by x.created_at))[1],
       min(x.created_at)
from public.gsa_tv_program_source_links x
join public.gsa_tv_programs alias_program on alias_program.id = x.program_id
join _gsa_program_aliases a on a.alias_name = alias_program.name
join public.gsa_tv_programs canonical on canonical.name = a.canonical_name
group by canonical.id, x.source_id
on conflict (program_id, source_id) do update
set priority = greatest(public.gsa_tv_program_source_links.priority, excluded.priority),
    purpose = coalesce(public.gsa_tv_program_source_links.purpose, excluded.purpose),
    required_for_generation = public.gsa_tv_program_source_links.required_for_generation or excluded.required_for_generation,
    metadata = coalesce(public.gsa_tv_program_source_links.metadata, '{}'::jsonb) || coalesce(excluded.metadata, '{}'::jsonb);

delete from public.gsa_tv_program_source_links x
using public.gsa_tv_programs alias_program, _gsa_program_aliases a
where x.program_id = alias_program.id
  and alias_program.name = a.alias_name;

-- Retain aliases only as archived audit history; they no longer participate in the grade.
update public.gsa_tv_programs p
set status = 'archived',
    notes = 'Nome complementar consolidado no programa principal em 2026-09-04; não usar como programa ou logo independente.',
    updated_at = now()
from _gsa_program_aliases a
where p.name = a.alias_name;

commit;
