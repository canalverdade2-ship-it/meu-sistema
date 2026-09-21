begin;

update public.gsa_tv_programs
set status='published',
    notes='Edição própria do GSA News; gera arquivo de vídeo independente e possui logo próprio.',
    updated_at=now()
where name in ('GSA Manhã News','GSA Meio Dia News','GSA News Noite');

-- Restore the three independently produced editions in the weekly grid.
update public.gsa_tv_weekly_grid_slots s
set program_id=p.id, segment_variant=null, updated_at=now()
from public.gsa_tv_programs p
where p.name='GSA Manhã News'
  and s.program_id=(select id from public.gsa_tv_programs where name='GSA News')
  and s.segment_variant='Manhã';

update public.gsa_tv_weekly_grid_slots s
set program_id=p.id, segment_variant=null, updated_at=now()
from public.gsa_tv_programs p
where p.name='GSA Meio Dia News'
  and s.program_id=(select id from public.gsa_tv_programs where name='GSA News')
  and s.segment_variant='Meio-Dia';

update public.gsa_tv_weekly_grid_slots s
set program_id=p.id,
    segment_variant=case
      when s.segment_variant='Noite' then null
      when s.segment_variant='Noturno' then 'Noturno'
      when s.segment_variant like 'Especial — %' then replace(s.segment_variant,'Especial — ','Especial — ')
      else s.segment_variant
    end,
    updated_at=now()
from public.gsa_tv_programs p
where p.name='GSA News Noite'
  and s.program_id=(select id from public.gsa_tv_programs where name='GSA News')
  and (s.segment_variant='Noite' or s.segment_variant='Noturno' or s.segment_variant like 'Especial — %');

-- Restore already-materialized schedule blocks without changing their times.
update public.gsa_tv_program_blocks b
set program_id=p.id
from public.gsa_tv_programs p
where p.name='GSA Manhã News'
  and b.program_id=(select id from public.gsa_tv_programs where name='GSA News')
  and b.notes like 'GSA Manhã News%';

update public.gsa_tv_program_blocks b
set program_id=p.id
from public.gsa_tv_programs p
where p.name='GSA Meio Dia News'
  and b.program_id=(select id from public.gsa_tv_programs where name='GSA News')
  and b.notes like 'GSA Meio Dia News%';

update public.gsa_tv_program_blocks b
set program_id=p.id
from public.gsa_tv_programs p
where p.name='GSA News Noite'
  and b.program_id=(select id from public.gsa_tv_programs where name='GSA News')
  and (b.notes like 'GSA News Noite%' or b.notes like 'GSA News Especial%' or b.notes like 'GSA News Noturno%');

-- Restore the explicit source profiles that existed for each edition.
insert into public.gsa_tv_program_source_links(program_id,source_id,priority,purpose,required_for_generation,metadata)
select p.id,v.source_id,v.priority,v.purpose,true,'{"restored_three_news_editions":true}'::jsonb
from (values
 ('GSA Manhã News','agencia-brasil',100,'headlines'),
 ('GSA Manhã News','camara-api',70,'politica'),
 ('GSA Manhã News','tse-ckan',80,'eleicoes'),
 ('GSA Meio Dia News','agencia-brasil',100,'headlines'),
 ('GSA Meio Dia News','camara-api',70,'politica'),
 ('GSA Meio Dia News','senado-api',70,'politica'),
 ('GSA News Noite','agencia-brasil',100,'headlines'),
 ('GSA News Noite','tse-ckan',85,'eleicoes'),
 ('GSA News Noite','bcb-ptax',60,'economia')
) as v(program_name,source_id,priority,purpose)
join public.gsa_tv_programs p on p.name=v.program_name
join public.gsa_tv_editorial_sources src on src.id=v.source_id
on conflict(program_id,source_id) do update
set priority=excluded.priority,
    purpose=excluded.purpose,
    required_for_generation=true,
    metadata=coalesce(public.gsa_tv_program_source_links.metadata,'{}'::jsonb)||excluded.metadata;

commit;
