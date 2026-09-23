-- Consulta mínima e protegida para o webhook detectar resgates anteriores.
-- Evita conceder SELECT amplo em parceiros_resgates ao service_role local.

CREATE OR REPLACE FUNCTION public.gsa_bot_find_partner_redemption(
  p_parceiro_id uuid,
  p_email text DEFAULT NULL,
  p_telefone text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  status text,
  codigo_gerado text,
  nome_completo text,
  email text,
  telefone text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH input AS (
    SELECT
      lower(trim(coalesce(p_email, ''))) AS email_norm,
      regexp_replace(coalesce(p_telefone, ''), '[^0-9]', '', 'g') AS phone_norm
  )
  SELECT
    r.id,
    r.status,
    r.codigo_gerado,
    r.nome_completo,
    r.email,
    r.telefone
  FROM public.parceiros_resgates r
  CROSS JOIN input i
  WHERE r.parceiro_id = p_parceiro_id
    AND r.status <> 'recusado'
    AND (
      (i.email_norm <> '' AND lower(trim(coalesce(r.email, ''))) = i.email_norm)
      OR
      (
        i.phone_norm <> ''
        AND (
          regexp_replace(coalesce(r.telefone, ''), '[^0-9]', '', 'g') = i.phone_norm
          OR regexp_replace(coalesce(r.telefone, ''), '[^0-9]', '', 'g') = regexp_replace(i.phone_norm, '^55', '')
          OR regexp_replace(regexp_replace(coalesce(r.telefone, ''), '[^0-9]', '', 'g'), '^55', '') = regexp_replace(i.phone_norm, '^55', '')
        )
      )
    )
  ORDER BY r.created_at DESC
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.gsa_bot_find_partner_redemption(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_bot_find_partner_redemption(uuid, text, text) TO service_role;

