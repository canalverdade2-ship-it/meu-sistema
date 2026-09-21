#!/usr/bin/env bash
set -euo pipefail

NEWS_ID="9f1d56ce-68f6-4f9c-8b91-c17c5f49d302"
MARKETS_ID="cbb0f824-87ba-45f7-a8b5-8f3d65268f3c"
LOTTERY_ID="7bc9f31c-e50b-421c-896d-545a9cf3aa42"
WEATHER_ID="3b1cc764-fbaa-428a-b398-7cdf61c34120"
DASHBOARD_ID="d8d61b70-c5a6-45e2-9cd9-f7bf81db217e"
DB_URL="$(docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')"

TICKER_TEXT="$(docker run --rm --network host postgres:15-alpine psql "$DB_URL" -X -qAt -c "
with candidates as (
  select i.title, s.attribution, coalesce(i.published_at,i.fetched_at) as event_at,
         row_number() over(partition by lower(i.title) order by coalesce(i.published_at,i.fetched_at) desc) as duplicate_rank
  from public.gsa_tv_editorial_items i
  join public.gsa_tv_editorial_sources s on s.id=i.source_id
  where i.validation_state='verified'
    and coalesce(i.published_at,i.fetched_at) >= now()-interval '36 hours'
    and s.category in ('noticias','politica','eleicoes','economia','tecnologia','ciencia_tecnologia','meteorologia','saude','saude_publica','ciencia_espaco')
    and i.title !~* '^Previsão do tempo'
), latest as (
  select title,attribution,event_at from candidates where duplicate_rank=1 order by event_at desc limit 14
)
select coalesce(string_agg('• '||left(regexp_replace(title,E'[\\n\\r|]+',' ','g'),60),E'\\n\\n' order by event_at desc),
                'Noticias verificadas em atualizacao.') from (select * from latest limit 7) x;
" | tr -s ' ' | cut -c1-1900)"

MARKETS_TEXT="$(docker run --rm --network host postgres:15-alpine psql "$DB_URL" -X -qAt -c "
with latest as (
  select distinct on (i.source_id) i.title,coalesce(i.published_at,i.fetched_at) event_at
  from public.gsa_tv_editorial_items i join public.gsa_tv_editorial_sources s on s.id=i.source_id
  where i.validation_state='verified' and s.category in ('economia','mercado_capitais','combustiveis','estatisticas')
  order by i.source_id,coalesce(i.published_at,i.fetched_at) desc
)
select coalesce(string_agg('• '||left(regexp_replace(title,E'[\\n\\r|]+',' ','g'),42),E'\\n' order by event_at desc),'Indicadores em atualizacao.') from (select * from latest limit 4) x;
" | tr -s ' ' | cut -c1-1900)"

LOTTERY_TEXT="$(docker run --rm --network host postgres:15-alpine psql "$DB_URL" -X -qAt -c "
with latest as (
  select distinct on (i.source_id) i.title,coalesce(i.published_at,i.fetched_at) event_at
  from public.gsa_tv_editorial_items i join public.gsa_tv_editorial_sources s on s.id=i.source_id
  where i.validation_state='verified' and s.category='loterias'
  order by i.source_id,coalesce(i.published_at,i.fetched_at) desc
)
select coalesce(string_agg('• '||left(regexp_replace(title,E'[\\n\\r|]+',' ','g'),46),E'\\n' order by event_at desc),'Resultados oficiais em atualizacao.') from (select * from latest limit 4) x;
" | tr -s ' ' | cut -c1-1900)"

WEATHER_TEXT="$(docker run --rm --network host postgres:15-alpine psql "$DB_URL" -X -qAt -c "
with ranked as (
  select i.title,coalesce(i.published_at,i.fetched_at) event_at,
         row_number() over(partition by lower(i.title) order by i.fetched_at desc) duplicate_rank
  from public.gsa_tv_editorial_items i
  where i.source_id='inmet-prevmet' and i.validation_state='verified'
), latest as (
  select title,event_at from ranked where duplicate_rank=1 order by event_at desc limit 12
)
select coalesce(string_agg('• '||left(regexp_replace(title,E'[\\n\\r|]+',' ','g'),42),E'\\n' order by event_at desc),'Previsoes do INMET em atualizacao.') from (select * from latest limit 4) x;
" | tr -s ' ' | cut -c1-1900)"

TICKER_B64="$(printf '%s' "$TICKER_TEXT" | base64 -w0)"
MARKETS_B64="$(printf '%s' "$MARKETS_TEXT" | base64 -w0)"
LOTTERY_B64="$(printf '%s' "$LOTTERY_TEXT" | base64 -w0)"
WEATHER_B64="$(printf '%s' "$WEATHER_TEXT" | base64 -w0)"

docker run --rm --network host postgres:15-alpine psql "$DB_URL" -X -v ON_ERROR_STOP=1 -c "
insert into public.gsa_tv_graphics(id,channel_id,layer_type,name,enabled,text_content,config,updated_at)
values('$DASHBOARD_ID','ch-main','lower_third','Central GSA Agora',true,'GSA AGORA','{\"preset\":\"dashboard_backdrop\",\"no_embedded_logo\":true}'::jsonb,now())
on conflict(id) do update set enabled=true,config=excluded.config,updated_at=now();
insert into public.gsa_tv_graphics(id,channel_id,layer_type,name,enabled,text_content,config,updated_at)
values('$NEWS_ID','ch-main','ticker','Feed automático — Notícias',true,convert_from(decode('$TICKER_B64','base64'),'UTF8'),
       '{\"preset\":\"dashboard_card\",\"heading\":\"PRINCIPAIS NOTICIAS\",\"x\":60,\"y\":150,\"width\":1120,\"height\":850,\"font_size\":26,\"accent\":\"#d2a744\",\"source\":\"verified_editorial_apis\",\"refresh_seconds\":60,\"no_embedded_logo\":true}'::jsonb,now())
on conflict(id) do update set enabled=true,text_content=excluded.text_content,config=excluded.config,updated_at=now();"

docker run --rm --network host postgres:15-alpine psql "$DB_URL" -X -v ON_ERROR_STOP=1 -c "
insert into public.gsa_tv_graphics(id,channel_id,layer_type,name,enabled,text_content,config,updated_at) values
('$MARKETS_ID','ch-main','ticker','Feed automático — Mercados',true,convert_from(decode('$MARKETS_B64','base64'),'UTF8'),'{\"preset\":\"dashboard_card\",\"heading\":\"MERCADOS\",\"x\":1210,\"y\":150,\"width\":650,\"height\":260,\"font_size\":20,\"accent\":\"#54c4ff\",\"source\":\"verified_market_apis\",\"refresh_seconds\":60,\"no_embedded_logo\":true}'::jsonb,now()),
('$LOTTERY_ID','ch-main','ticker','Feed automático — Loterias',true,convert_from(decode('$LOTTERY_B64','base64'),'UTF8'),'{\"preset\":\"dashboard_card\",\"heading\":\"LOTERIAS CAIXA\",\"x\":1210,\"y\":440,\"width\":650,\"height\":260,\"font_size\":18,\"accent\":\"#d2a744\",\"source\":\"caixa_official_apis\",\"refresh_seconds\":60,\"no_embedded_logo\":true}'::jsonb,now()),
('$WEATHER_ID','ch-main','ticker','Feed automático — Clima e Tempo',true,convert_from(decode('$WEATHER_B64','base64'),'UTF8'),'{\"preset\":\"dashboard_card\",\"heading\":\"CLIMA E TEMPO\",\"x\":1210,\"y\":730,\"width\":650,\"height\":270,\"font_size\":20,\"accent\":\"#65d6c0\",\"source\":\"inmet_prevmet\",\"refresh_seconds\":60,\"no_embedded_logo\":true}'::jsonb,now())
on conflict(id) do update set enabled=true,text_content=excluded.text_content,config=excluded.config,updated_at=now();"

# O filtro drawtext usa reload=1; atualizar este arquivo troca o texto sem corte.
docker exec gsa-tv-control-plane sh -lc "printf '%s' \"\$1\" > /tmp/gsa-tv-$NEWS_ID.txt" sh "$TICKER_TEXT"
docker exec gsa-tv-control-plane sh -lc "printf '%s' \"\$1\" > /tmp/gsa-tv-$MARKETS_ID.txt" sh "$MARKETS_TEXT"
docker exec gsa-tv-control-plane sh -lc "printf '%s' \"\$1\" > /tmp/gsa-tv-$LOTTERY_ID.txt" sh "$LOTTERY_TEXT"
docker exec gsa-tv-control-plane sh -lc "printf '%s' \"\$1\" > /tmp/gsa-tv-$WEATHER_ID.txt" sh "$WEATHER_TEXT"
