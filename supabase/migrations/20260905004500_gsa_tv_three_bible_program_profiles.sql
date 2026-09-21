begin;

update public.gsa_tv_programs
set description='Programa devocional que inspira por meio de louvor, oração, mensagens de esperança e reflexão espiritual.',
    notes='PROMESSA EDITORIAL: GSA Em Fé inspira. Formato devocional, acolhedor, emotivo e reverente. Não transformar em aula bíblica extensa nem narrativa dramatizada. Apresentador e voz próprios; trilha espiritual e imagens em movimento obrigatórias.',
    updated_at=now()
where name='GSA Em Fé';

update public.gsa_tv_programs
set description='Programa didático com pequenos ensinamentos da Bíblia, contexto da passagem, explicação simples e aplicação prática no cotidiano.',
    notes='PROMESSA EDITORIAL: GSA Hora da Palavra ensina. Formato curto, didático, natural e objetivo, conduzido por apresentador pastoral/professor fixo. Não transformar em culto, louvor contínuo ou história dramatizada.',
    updated_at=now()
where name='GSA Hora da Palavra';

update public.gsa_tv_programs
set description='Programa narrativo e cinematográfico que conta histórias da Bíblia com começo, desenvolvimento, conclusão, ambientação, movimento e trilha coerente.',
    notes='PROMESSA EDITORIAL: GSA Histórias da Bíblia conta. Não usar formato de sermão ou aula expositiva. Proibida voz seca sobre imagem estática; exigir narrativa visual em movimento, ambientação sonora e identidade própria.',
    updated_at=now()
where name='GSA Histórias da Bíblia';

commit;
