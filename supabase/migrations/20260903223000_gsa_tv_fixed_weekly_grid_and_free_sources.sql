BEGIN;

-- Grade editorial canônica da GSA TV. Os horários são locais de Brasília e
-- representam um relógio semanal permanente; edições e mídias continuam sendo
-- resolvidas na grade diária materializada.
CREATE TABLE IF NOT EXISTS public.gsa_tv_weekly_grid_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  program_id uuid NOT NULL REFERENCES public.gsa_tv_programs(id) ON DELETE RESTRICT,
  segment_variant text,
  content_mode text NOT NULL DEFAULT 'library'
    CHECK (content_mode IN ('api','mixed','library','ai_original','live')),
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id,weekday,start_time)
);

CREATE TABLE IF NOT EXISTS public.gsa_tv_editorial_sources (
  id text PRIMARY KEY,
  channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('json','rss','atom','xml','csv','odata')),
  base_url text NOT NULL,
  category text NOT NULL,
  free_only boolean NOT NULL DEFAULT true CHECK (free_only),
  official_source boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  polling_minutes integer NOT NULL DEFAULT 60 CHECK (polling_minutes BETWEEN 5 AND 10080),
  attribution text NOT NULL,
  terms_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_status text CHECK (last_status IS NULL OR last_status IN ('ok','warning','error','disabled')),
  last_collected_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gsa_tv_program_source_links (
  program_id uuid NOT NULL REFERENCES public.gsa_tv_programs(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES public.gsa_tv_editorial_sources(id) ON DELETE CASCADE,
  priority smallint NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  purpose text NOT NULL DEFAULT 'editorial_research',
  required_for_generation boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(program_id,source_id)
);

CREATE TABLE IF NOT EXISTS public.gsa_tv_editorial_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL REFERENCES public.gsa_tv_editorial_sources(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.gsa_tv_programs(id) ON DELETE SET NULL,
  external_id text,
  title text NOT NULL,
  summary text,
  canonical_url text,
  published_at timestamptz,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_state text NOT NULL DEFAULT 'pending'
    CHECK (validation_state IN ('pending','verified','rejected','expired')),
  rights_classification text NOT NULL DEFAULT 'reference_only'
    CHECK (rights_classification IN ('reference_only','open_data','public_domain','licensed','unknown')),
  dedupe_hash text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id,dedupe_hash,program_id)
);

CREATE INDEX IF NOT EXISTS gsa_tv_weekly_grid_lookup_idx
  ON public.gsa_tv_weekly_grid_slots(channel_id,weekday,start_time) WHERE enabled;
CREATE INDEX IF NOT EXISTS gsa_tv_editorial_sources_poll_idx
  ON public.gsa_tv_editorial_sources(enabled,last_collected_at,polling_minutes);
CREATE INDEX IF NOT EXISTS gsa_tv_editorial_items_program_idx
  ON public.gsa_tv_editorial_items(program_id,published_at DESC,fetched_at DESC);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gsa_tv_weekly_grid_slots','gsa_tv_editorial_sources',
    'gsa_tv_program_source_links','gsa_tv_editorial_items'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated',t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',t);
  END LOOP;
END $$;

-- Catálogo oficial de programas. A inserção é deliberadamente idempotente e
-- não depende de índice único legado: reutiliza o primeiro registro homônimo.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN SELECT * FROM (VALUES
    ('GSA Bem Viver','bem_estar',3600),('GSA Agro','agronegocio',3600),
    ('GSA Em Fé','religioso',1800),('GSA Tempo','meteorologia',300),
    ('GSA Manhã News','jornalismo',1800),('GSA Motivação','variedades',3600),
    ('GSA Business','negocios',3600),('GSA Tech','tecnologia',3600),
    ('GSA Histórias da Bíblia','religioso',1800),('GSA Cidadania','servico',3600),
    ('GSA Mundo','jornalismo',3600),('GSA Destinos','turismo',1800),
    ('GSA Tá na Rede','internet',1800),('GSA Sabor','gastronomia',1500),
    ('GSA Motor','automotivo',1800),('GSA Meio Dia News','jornalismo',1800),
    ('GSA Mercado','economia',1800),('GSA Desenhos Clássicos','infantil',5400),
    ('GSA Sessão Pipoca','filmes',6300),('GSA Cinema','cinema',3600),
    ('GSA Planeta Terra','meio_ambiente',1800),('GSA Esportes','esportes',1800),
    ('GSA Music','musica',3600),('GSA News Noite','jornalismo',1800),
    ('GSA News Especial','jornalismo',3600),('GSA Doc','documentarios',3600),
    ('GSA Mistérios','documentarios',3600),('GSA News Noturno','jornalismo',1800),
    ('GSA Documentário Especial','documentarios',3600),
    ('GSA Mistérios da Noite','documentarios',3600),
    ('GSA Noite de Louvor','religioso',3600),('GSA Destinos do Mundo','turismo',2700),
    ('GSA Tá na Rede Web','internet',1800),('GSA Mistérios Noturno','documentarios',1800),
    ('GSA Em Fé Reflexão','religioso',1800)
  ) AS x(name,category,duration_s)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.gsa_tv_programs
      WHERE channel_id='ch-main' AND lower(name)=lower(p.name)
    ) THEN
      INSERT INTO public.gsa_tv_programs(
        channel_id,name,description,category,default_duration_s,status,notes
      ) VALUES (
        'ch-main',p.name,
        'Programa integrante da grade semanal fixa oficial da GSA TV.',
        p.category,p.duration_s,'published',
        'Grade fixa definitiva; alterações exigem nova migration aprovada.'
      );
    ELSE
      UPDATE public.gsa_tv_programs
         SET category=COALESCE(NULLIF(category,''),p.category),
             status=CASE WHEN status='archived' THEN status ELSE 'published' END,
             notes='Grade fixa definitiva; alterações exigem nova migration aprovada.',
             updated_at=now()
       WHERE id=(SELECT id FROM public.gsa_tv_programs
                  WHERE channel_id='ch-main' AND lower(name)=lower(p.name)
                  ORDER BY created_at,id LIMIT 1);
    END IF;
  END LOOP;
END $$;

-- Fontes gratuitas. Fontes que exigem apenas chave gratuita ficam desativadas
-- até a chave ser cadastrada; nenhuma fonte paga é incluída.
INSERT INTO public.gsa_tv_editorial_sources(
  id,channel_id,name,provider,source_type,base_url,category,official_source,
  enabled,polling_minutes,attribution,terms_url,metadata
) VALUES
 ('agencia-brasil','ch-main','Agência Brasil — RSS','EBC','rss','https://agenciabrasil.ebc.com.br/rss','noticias',true,true,15,'Fonte: Agência Brasil/EBC','https://agenciabrasil.ebc.com.br/', '{"rights":"reference_and_link","adapter":"rss_discovery"}'),
 ('bcb-ptax','ch-main','Banco Central — PTAX','Banco Central do Brasil','odata','https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/','economia',true,true,30,'Fonte: Banco Central do Brasil','https://dadosabertos.bcb.gov.br/', '{"adapter":"odata"}'),
 ('ibge-sidra','ch-main','IBGE — SIDRA','IBGE','json','https://apisidra.ibge.gov.br/','estatisticas',true,true,360,'Fonte: IBGE/SIDRA','https://apisidra.ibge.gov.br/home/ajuda', '{"adapter":"sidra"}'),
 ('cvm-dados','ch-main','CVM — Dados Abertos','CVM','json','https://dados.cvm.gov.br/api/3/action/package_search','mercado_capitais',true,true,360,'Fonte: Comissão de Valores Mobiliários','https://dados.cvm.gov.br/', '{"adapter":"ckan"}'),
 ('camara-api','ch-main','Câmara dos Deputados — Dados Abertos','Câmara dos Deputados','json','https://dadosabertos.camara.leg.br/api/v2/','politica',true,true,30,'Fonte: Câmara dos Deputados','https://dadosabertos.camara.leg.br/swagger/api.html', '{"adapter":"camara"}'),
 ('senado-api','ch-main','Senado Federal — Dados Abertos','Senado Federal','xml','https://legis.senado.leg.br/dadosabertos/','politica',true,true,30,'Fonte: Senado Federal','https://legis.senado.leg.br/dadosabertos/docs/', '{"adapter":"senado","response_format":"xml"}'),
 ('tse-ckan','ch-main','TSE — Dados Abertos','Tribunal Superior Eleitoral','json','https://dadosabertos.tse.jus.br/api/3/action/package_search','eleicoes',true,true,180,'Fonte: Tribunal Superior Eleitoral','https://dadosabertos.tse.jus.br/', '{"adapter":"ckan"}'),
 ('sus-ckan','ch-main','Ministério da Saúde — Dados Abertos','Ministério da Saúde','json','https://dadosabertos.saude.gov.br/api/3/action/package_search','saude',true,true,360,'Fonte: Ministério da Saúde','https://dadosabertos.saude.gov.br/', '{"adapter":"ckan"}'),
 ('hacker-news','ch-main','Hacker News API','Y Combinator','json','https://hacker-news.firebaseio.com/v0/','tecnologia',false,true,15,'Fonte: Hacker News','https://github.com/HackerNews/API', '{"adapter":"hacker_news"}'),
 ('arxiv','ch-main','arXiv API','Cornell University','atom','https://export.arxiv.org/api/query','ciencia_tecnologia',false,true,60,'Fonte: arXiv','https://info.arxiv.org/help/api/', '{"adapter":"atom"}'),
 ('inmet-prevmet','ch-main','INMET — Previsão do Tempo','Instituto Nacional de Meteorologia','json','https://apiprevmet3.inmet.gov.br/previsao/','meteorologia',true,true,15,'Fonte meteorológica: INMET','https://portal.inmet.gov.br/', '{"adapter":"inmet_prevmet","location_parameter":"codigo_ibge"}'),
 ('nasa-open','ch-main','NASA Open APIs','NASA','json','https://api.nasa.gov/','ciencia_espaco',true,false,360,'Fonte: NASA','https://api.nasa.gov/', '{"adapter":"nasa","requires_free_key":true}'),
 ('tmdb','ch-main','TMDB API','The Movie Database','json','https://api.themoviedb.org/3/','cinema',false,false,360,'Dados de cinema: TMDB','https://developer.themoviedb.org/docs/faq', '{"adapter":"tmdb","requires_free_key":true,"attribution_required":true}'),
 ('thesportsdb','ch-main','TheSportsDB Free API','TheSportsDB','json','https://www.thesportsdb.com/api/v1/json/','esportes',false,false,30,'Dados esportivos: TheSportsDB','https://www.thesportsdb.com/free_sports_api', '{"adapter":"thesportsdb","requires_free_key":true}'),
 ('caixa-megasena','ch-main','CAIXA — Mega-Sena','CAIXA','json','https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena','loterias',true,true,60,'Fonte: Loterias CAIXA','https://loterias.caixa.gov.br/', '{"adapter":"caixa_loterias","game":"megasena"}'),
 ('caixa-lotofacil','ch-main','CAIXA — Lotofácil','CAIXA','json','https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil','loterias',true,true,60,'Fonte: Loterias CAIXA','https://loterias.caixa.gov.br/', '{"adapter":"caixa_loterias","game":"lotofacil"}'),
 ('caixa-quina','ch-main','CAIXA — Quina','CAIXA','json','https://servicebus2.caixa.gov.br/portaldeloterias/api/quina','loterias',true,true,60,'Fonte: Loterias CAIXA','https://loterias.caixa.gov.br/', '{"adapter":"caixa_loterias","game":"quina"}'),
 ('caixa-maismilionaria','ch-main','CAIXA — +Milionária','CAIXA','json','https://servicebus2.caixa.gov.br/portaldeloterias/api/maismilionaria','loterias',true,true,60,'Fonte: Loterias CAIXA','https://loterias.caixa.gov.br/', '{"adapter":"caixa_loterias","game":"maismilionaria"}'),
 ('caixa-lotomania','ch-main','CAIXA — Lotomania','CAIXA','json','https://servicebus2.caixa.gov.br/portaldeloterias/api/lotomania','loterias',true,true,60,'Fonte: Loterias CAIXA','https://loterias.caixa.gov.br/', '{"adapter":"caixa_loterias","game":"lotomania"}'),
 ('caixa-timemania','ch-main','CAIXA — Timemania','CAIXA','json','https://servicebus2.caixa.gov.br/portaldeloterias/api/timemania','loterias',true,true,60,'Fonte: Loterias CAIXA','https://loterias.caixa.gov.br/', '{"adapter":"caixa_loterias","game":"timemania"}'),
 ('caixa-duplasena','ch-main','CAIXA — Dupla Sena','CAIXA','json','https://servicebus2.caixa.gov.br/portaldeloterias/api/duplasena','loterias',true,true,60,'Fonte: Loterias CAIXA','https://loterias.caixa.gov.br/', '{"adapter":"caixa_loterias","game":"duplasena"}'),
 ('caixa-diadesorte','ch-main','CAIXA — Dia de Sorte','CAIXA','json','https://servicebus2.caixa.gov.br/portaldeloterias/api/diadesorte','loterias',true,true,60,'Fonte: Loterias CAIXA','https://loterias.caixa.gov.br/', '{"adapter":"caixa_loterias","game":"diadesorte"}'),
 ('caixa-supersete','ch-main','CAIXA — Super Sete','CAIXA','json','https://servicebus2.caixa.gov.br/portaldeloterias/api/supersete','loterias',true,true,60,'Fonte: Loterias CAIXA','https://loterias.caixa.gov.br/', '{"adapter":"caixa_loterias","game":"supersete"}'),
 ('caixa-federal','ch-main','CAIXA — Loteria Federal','CAIXA','json','https://servicebus2.caixa.gov.br/portaldeloterias/api/federal','loterias',true,true,60,'Fonte: Loterias CAIXA','https://loterias.caixa.gov.br/', '{"adapter":"caixa_loterias","game":"federal"}'),
 ('caixa-loteca','ch-main','CAIXA — Loteca','CAIXA','json','https://servicebus2.caixa.gov.br/portaldeloterias/api/loteca','loterias',true,true,60,'Fonte: Loterias CAIXA','https://loterias.caixa.gov.br/', '{"adapter":"caixa_loterias","game":"loteca"}')
ON CONFLICT(id) DO UPDATE SET
  name=EXCLUDED.name,provider=EXCLUDED.provider,source_type=EXCLUDED.source_type,
  base_url=EXCLUDED.base_url,category=EXCLUDED.category,free_only=true,
  official_source=EXCLUDED.official_source,enabled=EXCLUDED.enabled,
  polling_minutes=EXCLUDED.polling_minutes,
  attribution=EXCLUDED.attribution,terms_url=EXCLUDED.terms_url,
  metadata=EXCLUDED.metadata,updated_at=now();

-- Vínculos editoriais: APIs alimentam pesquisa/roteiro, nunca concedem por si
-- só direito de retransmitir fotos, vídeos ou textos integrais.
WITH links(program_name,source_id,priority,purpose) AS (VALUES
 ('GSA Manhã News','agencia-brasil',100,'headlines'),('GSA Manhã News','camara-api',70,'politica'),('GSA Manhã News','tse-ckan',80,'eleicoes'),
 ('GSA Meio Dia News','agencia-brasil',100,'headlines'),('GSA Meio Dia News','camara-api',70,'politica'),('GSA Meio Dia News','senado-api',70,'politica'),
 ('GSA News Noite','agencia-brasil',100,'headlines'),('GSA News Noite','tse-ckan',85,'eleicoes'),('GSA News Noite','bcb-ptax',60,'economia'),
 ('GSA News Especial','agencia-brasil',100,'headlines'),('GSA News Especial','camara-api',70,'politica'),('GSA News Especial','senado-api',70,'politica'),
 ('GSA News Noturno','agencia-brasil',100,'headlines'),('GSA News Noturno','tse-ckan',80,'eleicoes'),
 ('GSA Mundo','agencia-brasil',70,'brasil_mundo'),('GSA Mundo','nasa-open',40,'ciencia_espaco'),
 ('GSA Tech','hacker-news',90,'tecnologia'),('GSA Tech','arxiv',80,'ciencia'),('GSA Tech','nasa-open',50,'inovacao'),
 ('GSA Mercado','bcb-ptax',100,'cambio'),('GSA Mercado','ibge-sidra',90,'indicadores'),('GSA Mercado','cvm-dados',90,'mercado_capitais'),
 ('GSA Tempo','inmet-prevmet',100,'previsao'),('GSA Planeta Terra','inmet-prevmet',70,'clima'),('GSA Planeta Terra','nasa-open',80,'terra_espaco'),
 ('GSA Cidadania','camara-api',90,'legislacao'),('GSA Cidadania','senado-api',90,'legislacao'),('GSA Cidadania','tse-ckan',80,'eleicoes'),('GSA Cidadania','sus-ckan',80,'saude_publica'),
 ('GSA Bem Viver','sus-ckan',90,'saude_publica'),('GSA Agro','ibge-sidra',80,'estatisticas_agro'),
 ('GSA Cinema','tmdb',100,'lancamentos'),('GSA Esportes','thesportsdb',100,'resultados')
), lottery_links AS (
 SELECT 'GSA Mercado'::text AS program_name,id AS source_id,85::smallint AS priority,'resultados_loterias'::text AS purpose
 FROM public.gsa_tv_editorial_sources WHERE id LIKE 'caixa-%'
), all_links AS (
 SELECT program_name,source_id,priority::smallint,purpose FROM links
 UNION ALL SELECT program_name,source_id,priority,purpose FROM lottery_links
)
INSERT INTO public.gsa_tv_program_source_links(program_id,source_id,priority,purpose,metadata)
SELECT p.id,l.source_id,l.priority,l.purpose,
       jsonb_build_object('usage','research_and_script','broadcast_rights','separate_approval_required')
FROM all_links l
JOIN LATERAL (
  SELECT id FROM public.gsa_tv_programs
   WHERE channel_id='ch-main' AND lower(name)=lower(l.program_name)
   ORDER BY created_at,id LIMIT 1
) p ON true
ON CONFLICT(program_id,source_id) DO UPDATE SET
 priority=EXCLUDED.priority,purpose=EXCLUDED.purpose,metadata=EXCLUDED.metadata;

-- Substitui somente o relógio canônico do canal. Não altera grades diárias já
-- publicadas, que são protegidas pela função de materialização abaixo.
DELETE FROM public.gsa_tv_weekly_grid_slots WHERE channel_id='ch-main';

WITH templates(days,start_time,end_time,program_name,variant,mode) AS (VALUES
 (ARRAY[0,1,2,3,4,5,6],'00:00'::time,'01:45'::time,'GSA Sessão Pipoca','Madrugada','library'),
 (ARRAY[0,1,2,3,4,5,6],'01:45','02:45','GSA Documentário Especial',NULL,'mixed'),
 (ARRAY[0,1,2,3,4,5,6],'02:45','03:45','GSA Mistérios da Noite',NULL,'mixed'),
 (ARRAY[0,1,2,3,4,5,6],'03:45','04:15','GSA Tá na Rede','Madrugada','mixed'),
 (ARRAY[0,1,2,3,4,5,6],'04:15','05:15','GSA Noite de Louvor',NULL,'library'),
 (ARRAY[0,1,2,3,4,5,6],'05:15','06:00','GSA Destinos do Mundo',NULL,'mixed'),
 (ARRAY[1,2,3,4,5],'06:00','07:00','GSA Bem Viver',NULL,'mixed'),(ARRAY[0,6],'06:00','07:00','GSA Agro',NULL,'mixed'),
 (ARRAY[0,1,2,3,4,5,6],'07:00','07:25','GSA Em Fé',NULL,'library'),
 (ARRAY[0,1,2,3,4,5,6],'07:25','07:30','GSA Tempo',NULL,'api'),
 (ARRAY[1,2,3,4,5,6],'07:30','08:00','GSA Manhã News',NULL,'mixed'),(ARRAY[0],'07:30','08:00','GSA Motivação',NULL,'ai_original'),
 (ARRAY[1,3,5],'08:00','09:00','GSA Business',NULL,'mixed'),(ARRAY[2,4],'08:00','09:00','GSA Tech',NULL,'mixed'),
 (ARRAY[6],'08:00','09:00','GSA Motivação',NULL,'ai_original'),(ARRAY[0],'08:00','09:00','GSA Bem Viver',NULL,'mixed'),
 (ARRAY[0,1,2,3,4,5,6],'09:00','09:30','GSA Em Fé',NULL,'library'),
 (ARRAY[0,1,2,3,4,5,6],'09:30','10:00','GSA Histórias da Bíblia',NULL,'library'),
 (ARRAY[1,2,3,4,5],'10:00','11:00','GSA Cidadania',NULL,'mixed'),(ARRAY[0,6],'10:00','11:00','GSA Mundo',NULL,'mixed'),
 (ARRAY[1,2,3,4,5],'11:00','11:30','GSA Destinos',NULL,'mixed'),(ARRAY[6],'11:00','11:30','GSA Tech',NULL,'mixed'),(ARRAY[0],'11:00','11:30','GSA Tá na Rede',NULL,'mixed'),
 (ARRAY[1,2,3,4,5],'11:30','11:55','GSA Sabor',NULL,'ai_original'),(ARRAY[6],'11:30','11:55','GSA Tech','Continuação','mixed'),(ARRAY[0],'11:30','11:55','GSA Motor',NULL,'mixed'),
 (ARRAY[0,1,2,3,4,5,6],'11:55','12:00','GSA Tempo',NULL,'api'),
 (ARRAY[0,1,2,3,4,5,6],'12:00','12:30','GSA Meio Dia News',NULL,'mixed'),
 (ARRAY[1,2,3,4,5],'12:30','13:00','GSA Mercado',NULL,'api'),(ARRAY[6],'12:30','13:00','GSA Motor',NULL,'mixed'),(ARRAY[0],'12:30','13:00','GSA Sabor',NULL,'ai_original'),
 (ARRAY[0,1,2,3,4,5,6],'13:00','13:30','GSA Em Fé',NULL,'library'),
 (ARRAY[1,2,3,4,5],'13:30','15:00','GSA Desenhos Clássicos',NULL,'library'),(ARRAY[0,6],'13:30','15:00','GSA Sessão Pipoca',NULL,'library'),
 (ARRAY[0,1,2,3,4,5,6],'15:00','15:30','GSA Em Fé',NULL,'library'),
 (ARRAY[1,3,5],'15:30','16:30','GSA Tech',NULL,'mixed'),(ARRAY[2,4],'15:30','16:30','GSA Business',NULL,'mixed'),(ARRAY[0,6],'15:30','16:30','GSA Cinema',NULL,'mixed'),
 (ARRAY[1,2,3,4,5],'16:30','17:00','GSA Planeta Terra',NULL,'mixed'),(ARRAY[0,6],'16:30','17:00','GSA Cinema','Continuação','mixed'),
 (ARRAY[1,2,3,4,5],'17:00','17:30','GSA Tá na Rede',NULL,'mixed'),(ARRAY[0,6],'17:00','17:30','GSA Esportes',NULL,'mixed'),
 (ARRAY[1,2,3,4,5],'17:30','18:00','GSA Motor',NULL,'mixed'),(ARRAY[0,6],'17:30','18:00','GSA Destinos',NULL,'mixed'),
 (ARRAY[0,1,2,3,4,5,6],'18:00','18:55','GSA Music',NULL,'library'),
 (ARRAY[0,1,2,3,4,5,6],'18:55','19:00','GSA Tempo',NULL,'api'),
 (ARRAY[1,2,3,4,5],'19:00','19:30','GSA News Noite',NULL,'mixed'),(ARRAY[0,6],'19:00','19:30','GSA News Especial','Parte 1','mixed'),
 (ARRAY[1,2,3,4,5],'19:30','20:00','GSA Mercado',NULL,'api'),(ARRAY[0,6],'19:30','20:00','GSA News Especial','Parte 2','mixed'),
 (ARRAY[0,1,2,3,4,5,6],'20:00','20:30','GSA Em Fé',NULL,'library'),
 (ARRAY[1,2,3,4,5],'20:30','21:00','GSA Cidadania',NULL,'mixed'),(ARRAY[0,6],'20:30','21:00','GSA Tá na Rede Web',NULL,'mixed'),
 (ARRAY[0,1,2,3,4,5,6],'21:00','22:00','GSA Music',NULL,'library'),
 (ARRAY[1,5],'22:00','23:00','GSA Doc',NULL,'mixed'),(ARRAY[2,4],'22:00','23:00','GSA Mistérios',NULL,'mixed'),(ARRAY[3],'22:00','23:00','GSA Sessão Pipoca',NULL,'library'),
 (ARRAY[6],'22:00','23:00','GSA Doc',NULL,'mixed'),(ARRAY[0],'22:00','23:00','GSA Doc','Especial','mixed'),
 (ARRAY[0,1,2,3,4,5,6],'23:00','23:30','GSA Em Fé',NULL,'library'),
 (ARRAY[1,2,4,5],'23:30','00:00','GSA News Noturno',NULL,'mixed'),(ARRAY[3],'23:30','00:00','GSA Sessão Pipoca','Continuação','library'),
 (ARRAY[6],'23:30','00:00','GSA Mistérios Noturno',NULL,'mixed'),(ARRAY[0],'23:30','00:00','GSA Em Fé Reflexão',NULL,'library')
)
INSERT INTO public.gsa_tv_weekly_grid_slots(
 channel_id,weekday,start_time,end_time,program_id,segment_variant,content_mode,metadata
)
SELECT 'ch-main',d,t.start_time,t.end_time,p.id,t.variant,t.mode,
       jsonb_build_object('fixed',true,'timezone','America/Sao_Paulo','version','2026-09-03')
FROM templates t CROSS JOIN LATERAL unnest(t.days) d
JOIN LATERAL (
 SELECT id FROM public.gsa_tv_programs
 WHERE channel_id='ch-main' AND lower(name)=lower(t.program_name)
 ORDER BY created_at,id LIMIT 1
) p ON true;

CREATE OR REPLACE FUNCTION public.gsa_tv_materialize_fixed_schedule(
  p_broadcast_date date,
  p_channel_id text DEFAULT 'ch-main'
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
  v_schedule_id uuid;
  v_version integer;
  v_blocks integer:=0;
BEGIN
  IF p_broadcast_date IS NULL THEN RAISE EXCEPTION 'Data de exibição obrigatória.'; END IF;

  SELECT id INTO v_schedule_id
    FROM public.gsa_tv_schedule_versions
   WHERE channel_id=p_channel_id AND broadcast_date=p_broadcast_date
     AND state IN ('published','running','completed')
   ORDER BY CASE state WHEN 'running' THEN 0 WHEN 'published' THEN 1 ELSE 2 END,version DESC
   LIMIT 1;

  IF v_schedule_id IS NOT NULL THEN
    RETURN jsonb_build_object('success',true,'skipped',true,'reason','existing_protected_schedule',
                              'broadcast_date',p_broadcast_date,'schedule_version_id',v_schedule_id);
  END IF;

  SELECT COALESCE(max(version),0)+1 INTO v_version
    FROM public.gsa_tv_schedule_versions
   WHERE channel_id=p_channel_id AND broadcast_date=p_broadcast_date;

  INSERT INTO public.gsa_tv_schedule_versions(
    channel_id,broadcast_date,version,state,title,notes,published_at,updated_at
  ) VALUES (
    p_channel_id,p_broadcast_date,v_version,'published',
    'Grade fixa GSA TV — '||to_char(p_broadcast_date,'DD/MM/YYYY'),
    'Materializada automaticamente a partir do relógio semanal fixo.',now(),now()
  ) RETURNING id INTO v_schedule_id;

  INSERT INTO public.gsa_tv_program_blocks(
    schedule_version_id,program_id,block_type,position,
    planned_start_offset_s,planned_duration_s,cannot_interrupt,
    safe_cut_points,notes,metadata
  )
  SELECT v_schedule_id,s.program_id,'content',
         row_number() OVER (ORDER BY s.start_time)::integer,
         extract(epoch FROM s.start_time)::integer,
         GREATEST(1,
           CASE WHEN s.end_time>s.start_time
                THEN extract(epoch FROM (s.end_time-s.start_time))::integer
                ELSE 86400-extract(epoch FROM s.start_time)::integer+extract(epoch FROM s.end_time)::integer
           END),
         false,'[]'::jsonb,
         concat_ws(' — ',p.name,s.segment_variant),
         jsonb_build_object(
           'fixed_weekly_grid',true,'segment_variant',s.segment_variant,
           'content_mode',s.content_mode,'weekday',s.weekday,
           'editorial_source_ids',COALESCE((
             SELECT jsonb_agg(l.source_id ORDER BY l.priority DESC,l.source_id)
               FROM public.gsa_tv_program_source_links l WHERE l.program_id=s.program_id
           ),'[]'::jsonb)
         )
    FROM public.gsa_tv_weekly_grid_slots s
    JOIN public.gsa_tv_programs p ON p.id=s.program_id
   WHERE s.channel_id=p_channel_id AND s.enabled
     AND s.weekday=extract(dow FROM p_broadcast_date)::integer
   ORDER BY s.start_time;
  GET DIAGNOSTICS v_blocks=ROW_COUNT;

  RETURN jsonb_build_object('success',true,'skipped',false,'broadcast_date',p_broadcast_date,
                            'schedule_version_id',v_schedule_id,'blocks',v_blocks);
EXCEPTION WHEN unique_violation THEN
  SELECT id INTO v_schedule_id FROM public.gsa_tv_schedule_versions
   WHERE channel_id=p_channel_id AND broadcast_date=p_broadcast_date
     AND state IN ('published','running') ORDER BY version DESC LIMIT 1;
  RETURN jsonb_build_object('success',true,'skipped',true,'reason','concurrent_materialization',
                            'broadcast_date',p_broadcast_date,'schedule_version_id',v_schedule_id);
END $$;

CREATE OR REPLACE FUNCTION public.gsa_tv_refresh_fixed_schedule_horizon(
  p_start_date date DEFAULT (CURRENT_DATE+1),
  p_days integer DEFAULT 30,
  p_channel_id text DEFAULT 'ch-main'
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE d date; r jsonb; made integer:=0; skipped integer:=0;
BEGIN
  IF p_days NOT BETWEEN 1 AND 366 THEN RAISE EXCEPTION 'Horizonte deve ter entre 1 e 366 dias.'; END IF;
  FOR d IN SELECT generate_series(p_start_date,p_start_date+p_days-1,interval '1 day')::date LOOP
    r:=public.gsa_tv_materialize_fixed_schedule(d,p_channel_id);
    IF COALESCE((r->>'skipped')::boolean,false) THEN skipped:=skipped+1; ELSE made:=made+1; END IF;
  END LOOP;
  RETURN jsonb_build_object('success',true,'start_date',p_start_date,'days',p_days,
                            'materialized',made,'skipped',skipped);
END $$;

REVOKE ALL ON FUNCTION public.gsa_tv_materialize_fixed_schedule(date,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gsa_tv_refresh_fixed_schedule_horizon(date,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_tv_materialize_fixed_schedule(date,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_tv_refresh_fixed_schedule_horizon(date,integer,text) TO service_role;

-- Mantém um primeiro horizonte pronto assim que a migration for aplicada. A
-- própria função ignora, sem modificar, cada data que já tenha grade protegida.
SELECT public.gsa_tv_refresh_fixed_schedule_horizon(
  ((now() AT TIME ZONE 'America/Sao_Paulo')::date+1),30,'ch-main'
);

COMMENT ON TABLE public.gsa_tv_weekly_grid_slots IS 'Relógio semanal fixo e definitivo da GSA TV (0=domingo, 6=sábado).';
COMMENT ON TABLE public.gsa_tv_editorial_sources IS 'Catálogo exclusivamente gratuito de APIs e feeds editoriais; direitos de mídia são avaliados separadamente.';
COMMENT ON FUNCTION public.gsa_tv_refresh_fixed_schedule_horizon(date,integer,text) IS 'Materializa o horizonte futuro sem alterar grades publicadas ou em execução.';

NOTIFY pgrst,'reload schema';
COMMIT;
