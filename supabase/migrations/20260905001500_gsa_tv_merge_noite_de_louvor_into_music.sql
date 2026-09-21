begin;

-- GSA Noite de Louvor is a content edition of GSA Music, not an independent brand.
update public.gsa_tv_weekly_grid_slots s
set program_id=music.id,
    segment_variant=case
      when coalesce(btrim(s.segment_variant),'')='' then 'Louvor'
      else 'Louvor — '||s.segment_variant
    end,
    updated_at=now()
from public.gsa_tv_programs old_program
join public.gsa_tv_programs music on music.name='GSA Music'
where old_program.name='GSA Noite de Louvor'
  and s.program_id=old_program.id;

-- Remove only editorial duplicates already present under GSA Music.
delete from public.gsa_tv_editorial_items old_item
using public.gsa_tv_programs old_program, public.gsa_tv_programs music
where old_program.name='GSA Noite de Louvor'
  and music.name='GSA Music'
  and old_item.program_id=old_program.id
  and exists (
    select 1 from public.gsa_tv_editorial_items current_item
    where current_item.program_id=music.id
      and current_item.source_id=old_item.source_id
      and current_item.dedupe_hash=old_item.dedupe_hash
  );

update public.gsa_tv_editorial_items x
set program_id=music.id
from public.gsa_tv_programs old_program
join public.gsa_tv_programs music on music.name='GSA Music'
where old_program.name='GSA Noite de Louvor'
  and x.program_id=old_program.id;

update public.gsa_tv_program_blocks x
set program_id=music.id,
    notes=replace(coalesce(x.notes,''),'GSA Noite de Louvor','GSA Music — Louvor')
from public.gsa_tv_programs old_program
join public.gsa_tv_programs music on music.name='GSA Music'
where old_program.name='GSA Noite de Louvor'
  and x.program_id=old_program.id;

update public.gsa_tv_series x
set program_id=music.id
from public.gsa_tv_programs old_program
join public.gsa_tv_programs music on music.name='GSA Music'
where old_program.name='GSA Noite de Louvor'
  and x.program_id=old_program.id;

insert into public.gsa_tv_program_source_links(program_id,source_id,priority,purpose,required_for_generation,metadata,created_at)
select music.id,x.source_id,x.priority,x.purpose,x.required_for_generation,x.metadata,x.created_at
from public.gsa_tv_program_source_links x
join public.gsa_tv_programs old_program on old_program.id=x.program_id and old_program.name='GSA Noite de Louvor'
join public.gsa_tv_programs music on music.name='GSA Music'
on conflict(program_id,source_id) do update
set priority=greatest(public.gsa_tv_program_source_links.priority,excluded.priority),
    required_for_generation=public.gsa_tv_program_source_links.required_for_generation or excluded.required_for_generation;

delete from public.gsa_tv_program_source_links x
using public.gsa_tv_programs old_program
where old_program.name='GSA Noite de Louvor'
  and x.program_id=old_program.id;

update public.gsa_tv_programs
set status='archived',
    notes='Consolidado em GSA Music em 2026-09-04. Louvor é edição/conteúdo, não programa ou logo independente.',
    updated_at=now()
where name='GSA Noite de Louvor';

commit;
