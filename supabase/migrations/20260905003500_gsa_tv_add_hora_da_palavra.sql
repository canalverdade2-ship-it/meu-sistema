begin;

insert into public.gsa_tv_programs(
  id,channel_id,name,category,description,default_duration_s,status,clock_template,notes,created_at,updated_at
)
select gen_random_uuid(),'ch-main','GSA Hora da Palavra','religioso',
       'Programa espiritual com pequenos ensinamentos da Bíblia, explicados de forma simples, natural e aplicável ao cotidiano.',
       1800,'published','[]'::jsonb,
       'Programa oficial criado em 2026-09-04. Identidade pastoral e didática própria; cada exibição deve possuir ensinamento diferente no mesmo dia.',
       now(),now()
where not exists(select 1 from public.gsa_tv_programs where name='GSA Hora da Palavra');

-- Reuse the two slots vacated by GSA Motivação, which were temporarily covered by GSA Music.
update public.gsa_tv_weekly_grid_slots s
set program_id=word_program.id,
    segment_variant=null,
    content_mode='ai_original',
    metadata=(coalesce(s.metadata,'{}'::jsonb)-'replaced_program')||jsonb_build_object(
      'program_created_at','2026-09-04',
      'format','small_bible_teaching',
      'content_must_differ_from_prior_same_day',true
    ),
    updated_at=now()
from public.gsa_tv_programs music
join public.gsa_tv_programs word_program on word_program.name='GSA Hora da Palavra'
where music.name='GSA Music'
  and s.program_id=music.id
  and s.metadata->>'replaced_program'='GSA Motivação';

-- Correct already-materialized future blocks for the same two positions.
update public.gsa_tv_program_blocks b
set program_id=word_program.id,
    notes='GSA Hora da Palavra',
    metadata=(coalesce(b.metadata,'{}'::jsonb)-'replaced_program')||jsonb_build_object(
      'program_created_at','2026-09-04',
      'format','small_bible_teaching',
      'content_must_differ_from_prior_same_day',true
    )
from public.gsa_tv_programs music
join public.gsa_tv_programs word_program on word_program.name='GSA Hora da Palavra'
where music.name='GSA Music'
  and b.program_id=music.id
  and b.metadata->>'replaced_program'='GSA Motivação';

commit;
