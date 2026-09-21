begin;

-- Keep the channel continuous: vacated slots become independent GSA Music editions.
update public.gsa_tv_weekly_grid_slots s
set program_id=music.id,
    segment_variant='Faixa musical independente',
    metadata=coalesce(s.metadata,'{}'::jsonb)||jsonb_build_object(
      'replaced_program',old_program.name,
      'content_must_differ_from_prior_same_day',true,
      'changed_at','2026-09-04'
    ),
    updated_at=now()
from public.gsa_tv_programs old_program
join public.gsa_tv_programs music on music.name='GSA Music'
where old_program.name in ('GSA Motivação','GSA Doc')
  and s.program_id=old_program.id;

-- Correct already-materialized future blocks without changing their times.
update public.gsa_tv_program_blocks b
set program_id=music.id,
    notes='GSA Music — Faixa musical independente',
    metadata=coalesce(b.metadata,'{}'::jsonb)||jsonb_build_object(
      'replaced_program',old_program.name,
      'content_must_differ_from_prior_same_day',true,
      'changed_at','2026-09-04'
    )
from public.gsa_tv_programs old_program
join public.gsa_tv_programs music on music.name='GSA Music'
where old_program.name in ('GSA Motivação','GSA Doc')
  and b.program_id=old_program.id;

update public.gsa_tv_programs
set status='archived',
    notes='Removido da grade oficial e da tabela de logos por determinação do responsável em 2026-09-04.',
    updated_at=now()
where name in ('GSA Motivação','GSA Doc');

update public.gsa_tv_programs
set name='GSA Desenhos',
    notes='Nome oficial simplificado de GSA Desenhos Clássicos para GSA Desenhos em 2026-09-04.',
    updated_at=now()
where name='GSA Desenhos Clássicos';

commit;
