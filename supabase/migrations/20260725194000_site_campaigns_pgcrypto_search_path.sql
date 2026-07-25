BEGIN;

-- Em projetos Supabase, a extensão pgcrypto normalmente pertence ao schema
-- `extensions`. As RPCs permanecem com search_path fechado e passam a incluir
-- explicitamente esse schema controlado para resolver digest(text,text).
ALTER FUNCTION public.gsa_public_site_campaigns(text,text,text,text,text,text)
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.gsa_public_site_campaign_event(uuid,text,text,text,text,text,text,text,jsonb)
  SET search_path = public, extensions, pg_temp;

COMMIT;
