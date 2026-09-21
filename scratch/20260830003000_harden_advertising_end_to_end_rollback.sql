BEGIN;

-- Refecha a superfície SQL do módulo após grants genéricos posteriores.
DO $security$
DECLARE
  v_table text;
  v_policy record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'gsa_advertisers','gsa_ad_requests','gsa_ad_request_placements',
    'gsa_ad_proposals','gsa_ad_proposal_versions','gsa_ad_negotiations',
    'gsa_ad_campaigns','gsa_ad_campaign_placements','gsa_ad_creatives',
    'gsa_ad_placements','gsa_ad_payments','gsa_ad_payment_events',
    'gsa_ad_delivery_events','gsa_ad_daily_metrics','gsa_ad_audit_logs',
    'gsa_ad_rate_limit_buckets','gsa_ad_maintenance_state'
  ] LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_table);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', v_table);
      FOR v_policy IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=v_table LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_table);
      END LOOP;
    END IF;
  END LOOP;
END;
$security$;

-- Leitura direta existe apenas para Realtime do admin/anunciante autenticado.
GRANT SELECT ON TABLE public.gsa_advertisers, public.gsa_ad_requests,
  public.gsa_ad_proposals, public.gsa_ad_campaigns, public.gsa_ad_creatives,
  public.gsa_ad_payments, public.gsa_ad_negotiations, public.gsa_ad_placements
TO authenticated;

CREATE POLICY gsa_ads_read_advertisers ON public.gsa_advertisers FOR SELECT TO authenticated
USING (auth_user_id = auth.uid() OR public.gsa_admin_has_module('anuncios'));

CREATE POLICY gsa_ads_read_requests ON public.gsa_ad_requests FOR SELECT TO authenticated
USING (advertiser_id = public.gsa_current_advertiser_id() OR public.gsa_admin_has_module('anuncios'));

CREATE POLICY gsa_ads_read_proposals ON public.gsa_ad_proposals FOR SELECT TO authenticated
USING (public.gsa_admin_has_module('anuncios') OR EXISTS (
  SELECT 1 FROM public.gsa_ad_requests r
  WHERE r.id = gsa_ad_proposals.request_id AND r.advertiser_id = public.gsa_current_advertiser_id()
));

CREATE POLICY gsa_ads_read_campaigns ON public.gsa_ad_campaigns FOR SELECT TO authenticated
USING (advertiser_id = public.gsa_current_advertiser_id() OR public.gsa_admin_has_module('anuncios'));

CREATE POLICY gsa_ads_read_creatives ON public.gsa_ad_creatives FOR SELECT TO authenticated
USING (public.gsa_admin_has_module('anuncios') OR EXISTS (
  SELECT 1 FROM public.gsa_ad_campaigns c
  WHERE c.id = gsa_ad_creatives.campaign_id AND c.advertiser_id = public.gsa_current_advertiser_id()
));

CREATE POLICY gsa_ads_read_payments ON public.gsa_ad_payments FOR SELECT TO authenticated
USING (public.gsa_admin_has_module('anuncios') OR EXISTS (
  SELECT 1 FROM public.gsa_ad_campaigns c
  WHERE c.id = gsa_ad_payments.campaign_id AND c.advertiser_id = public.gsa_current_advertiser_id()
));

CREATE POLICY gsa_ads_read_negotiations ON public.gsa_ad_negotiations FOR SELECT TO authenticated
USING (public.gsa_admin_has_module('anuncios') OR EXISTS (
  SELECT 1 FROM public.gsa_ad_proposals p
  JOIN public.gsa_ad_requests r ON r.id = p.request_id
  WHERE p.id = gsa_ad_negotiations.proposal_id AND r.advertiser_id = public.gsa_current_advertiser_id()
));

CREATE POLICY gsa_ads_read_placements ON public.gsa_ad_placements FOR SELECT TO authenticated
USING (public.gsa_admin_has_module('anuncios'));

-- Bucket privado dos criativos. Somente o dono da campanha grava no próprio prefixo.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('gsa-ad-creatives','gsa-ad-creatives',false,52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
ON CONFLICT(id) DO UPDATE SET public=false,
  file_size_limit=EXCLUDED.file_size_limit,
  allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS gsa_advertiser_creative_objects ON storage.objects;
DROP POLICY IF EXISTS gsa_ad_creative_select ON storage.objects;
DROP POLICY IF EXISTS gsa_ad_creative_insert ON storage.objects;
DROP POLICY IF EXISTS gsa_ad_creative_delete ON storage.objects;

CREATE POLICY gsa_ad_creative_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id='gsa-ad-creatives' AND (
    split_part(name,'/',1)=public.gsa_current_advertiser_id()::text
    OR public.gsa_admin_has_module('anuncios')
  )
);

CREATE POLICY gsa_ad_creative_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='gsa-ad-creatives'
  AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,180}$'
  AND split_part(name,'/',1)=public.gsa_current_advertiser_id()::text
  AND EXISTS (
    SELECT 1 FROM public.gsa_ad_campaigns c
    WHERE c.id::text=split_part(name,'/',2)
      AND c.advertiser_id=public.gsa_current_advertiser_id()
      AND c.status NOT IN ('completed','cancelled')
  )
);

CREATE POLICY gsa_ad_creative_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id='gsa-ad-creatives' AND (
    public.gsa_admin_has_module('anuncios') OR (
      split_part(name,'/',1)=public.gsa_current_advertiser_id()::text
      AND NOT EXISTS (
        SELECT 1 FROM public.gsa_ad_creatives cr
        WHERE cr.storage_path=name AND cr.status IN ('pending_review','approved')
      )
    )
  )
);

-- Estado de campanha considera a existência física do criativo no Storage privado.
CREATE OR REPLACE FUNCTION public.gsa_ads_refresh_campaign_states()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  v_completed integer:=0;
  v_active integer:=0;
  v_scheduled integer:=0;
  v_review integer:=0;
BEGIN
  UPDATE public.gsa_ad_campaigns SET status='completed'
  WHERE status NOT IN ('completed','cancelled') AND ends_at IS NOT NULL AND ends_at<=now();
  GET DIAGNOSTICS v_completed=ROW_COUNT;

  UPDATE public.gsa_ad_campaigns c SET status='active',activated_at=COALESCE(activated_at,now())
  WHERE c.status NOT IN ('active','paused','completed','cancelled')
    AND c.paid_at IS NOT NULL AND COALESCE(c.starts_at,now())<=now()
    AND (c.ends_at IS NULL OR c.ends_at>now())
    AND EXISTS (SELECT 1 FROM public.gsa_ad_creatives cr WHERE cr.campaign_id=c.id AND cr.status='approved'
      AND ((cr.kind='text' AND COALESCE(NULLIF(trim(cr.headline),''),NULLIF(trim(cr.body),'')) IS NOT NULL)
        OR (cr.kind IN ('image','video') AND public.gsa_ads_validate_creative_object(c.advertiser_id,c.id,cr.kind,cr.storage_path))));
  GET DIAGNOSTICS v_active=ROW_COUNT;
  UPDATE public.gsa_ad_campaigns c SET status='scheduled'
  WHERE c.status NOT IN ('paused','completed','cancelled')
    AND c.paid_at IS NOT NULL AND c.starts_at>now()
    AND EXISTS (SELECT 1 FROM public.gsa_ad_creatives cr WHERE cr.campaign_id=c.id AND cr.status='approved'
      AND ((cr.kind='text' AND COALESCE(NULLIF(trim(cr.headline),''),NULLIF(trim(cr.body),'')) IS NOT NULL)
        OR (cr.kind IN ('image','video') AND public.gsa_ads_validate_creative_object(c.advertiser_id,c.id,cr.kind,cr.storage_path))));
  GET DIAGNOSTICS v_scheduled=ROW_COUNT;

  UPDATE public.gsa_ad_campaigns c SET status='creative_review'
  WHERE c.status NOT IN ('paused','completed','cancelled') AND c.paid_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.gsa_ad_creatives cr WHERE cr.campaign_id=c.id AND cr.status='approved'
      AND ((cr.kind='text' AND COALESCE(NULLIF(trim(cr.headline),''),NULLIF(trim(cr.body),'')) IS NOT NULL)
        OR (cr.kind IN ('image','video') AND public.gsa_ads_validate_creative_object(c.advertiser_id,c.id,cr.kind,cr.storage_path))));
  GET DIAGNOSTICS v_review=ROW_COUNT;

  RETURN jsonb_build_object('success',true,'completed',v_completed,'active',v_active,
    'scheduled',v_scheduled,'creative_review',v_review);
END;
$$;

-- Serving é exclusivamente interno: a Edge calcula hashes e aplica rate limit antes desta RPC.
CREATE OR REPLACE FUNCTION public.gsa_ads_serve(
  p_placement_code text,p_viewer_hash text,p_session_hash text,p_route text,p_device text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_pick record; v_token uuid;
BEGIN
  IF nullif(trim(p_placement_code),'') IS NULL
    OR p_viewer_hash !~ '^[a-f0-9]{64}$' OR p_session_hash !~ '^[a-f0-9]{64}$'
    OR p_device NOT IN ('desktop','tablet','mobile')
    OR p_route IS NULL OR length(p_route)>500 OR left(p_route,1)<>'/' THEN
    RAISE EXCEPTION 'Parametros de entrega invalidos' USING ERRCODE='22023';
  END IF;
  IF NOT public.gsa_ads_consume_rate_limit(p_viewer_hash,'serve_viewer',300,60)
    OR NOT public.gsa_ads_consume_rate_limit(p_session_hash,'serve_session',300,60) THEN
    RAISE EXCEPTION 'Limite de entrega excedido' USING ERRCODE='P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('gsa_ads_serve:global',0));
  PERFORM public.gsa_ads_refresh_campaign_states();

  SELECT c.id campaign_id,c.name,c.slug,c.frequency_model,c.frequency_value,
    a.trade_name,a.legal_name,p.id placement_id,p.code placement_code,
    cr.id creative_id,cr.kind,cr.storage_path,cr.target_url,cr.headline,cr.body,cr.alt_text,
    cr.width,cr.height,cr.duration_seconds
  INTO v_pick
  FROM public.gsa_ad_campaigns c
  JOIN public.gsa_advertisers a ON a.id=c.advertiser_id AND a.status='active'
  JOIN public.gsa_ad_campaign_placements cp ON cp.campaign_id=c.id
  JOIN public.gsa_ad_placements p ON p.id=cp.placement_id AND p.code=p_placement_code AND p.active
  JOIN LATERAL (
    SELECT x.* FROM public.gsa_ad_creatives x
    WHERE x.campaign_id=c.id AND x.status='approved'
      AND ((x.kind='text' AND COALESCE(NULLIF(trim(x.headline),''),NULLIF(trim(x.body),'')) IS NOT NULL)
        OR (x.kind IN ('image','video') AND public.gsa_ads_validate_creative_object(c.advertiser_id,c.id,x.kind,x.storage_path)))
    ORDER BY x.approved_at DESC NULLS LAST,x.created_at DESC LIMIT 1
  ) cr ON true
  WHERE c.status='active' AND c.paid_at IS NOT NULL
    AND COALESCE(c.starts_at,now())<=now() AND (c.ends_at IS NULL OR c.ends_at>now())
    AND p_device=ANY(p.devices) AND public.gsa_ads_route_matches(p.route_pattern,p_route)
    AND (c.impression_limit IS NULL OR c.served_count<c.impression_limit)
    AND (
      c.frequency_model='unlimited'
      OR (c.frequency_model='once_per_session' AND NOT EXISTS (
        SELECT 1 FROM public.gsa_ad_delivery_events e WHERE e.campaign_id=c.id AND e.session_hash=p_session_hash))
      OR (c.frequency_model='once_per_day' AND NOT EXISTS (
        SELECT 1 FROM public.gsa_ad_delivery_events e WHERE e.campaign_id=c.id AND e.viewer_hash=p_viewer_hash AND e.served_at>=current_date))
      OR (c.frequency_model='interval_hours' AND NOT EXISTS (
        SELECT 1 FROM public.gsa_ad_delivery_events e WHERE e.campaign_id=c.id AND e.viewer_hash=p_viewer_hash
          AND e.served_at>=now()-make_interval(hours=>GREATEST(COALESCE(c.frequency_value,1),1))))
      OR (c.frequency_model='daily_limit' AND (
        SELECT count(*) FROM public.gsa_ad_delivery_events e WHERE e.campaign_id=c.id
          AND e.viewer_hash=p_viewer_hash AND e.served_at>=current_date)<GREATEST(COALESCE(c.frequency_value,1),1))
    )
  ORDER BY cp.priority ASC,md5(c.id::text||p_viewer_hash||current_date::text) LIMIT 1;

  IF v_pick.campaign_id IS NULL THEN RETURN jsonb_build_object('success',true,'ad',NULL); END IF;
  INSERT INTO public.gsa_ad_delivery_events(
    campaign_id,placement_id,creative_id,viewer_hash,session_hash,route,device,request_hash
  ) VALUES (
    v_pick.campaign_id,v_pick.placement_id,v_pick.creative_id,p_viewer_hash,p_session_hash,
    p_route,p_device,encode(digest(v_pick.campaign_id::text||':'||p_viewer_hash||':'||p_session_hash||':'||clock_timestamp()::text,'sha256'),'hex')
  ) RETURNING event_token INTO v_token;

  INSERT INTO public.gsa_ad_daily_metrics(campaign_id,placement_id,metric_date,requests,served)
  VALUES(v_pick.campaign_id,v_pick.placement_id,current_date,1,1)
  ON CONFLICT(campaign_id,placement_id,metric_date) DO UPDATE SET
    requests=public.gsa_ad_daily_metrics.requests+1,
    served=public.gsa_ad_daily_metrics.served+1;
  UPDATE public.gsa_ad_campaigns SET served_count=served_count+1 WHERE id=v_pick.campaign_id;

  RETURN jsonb_build_object('success',true,'event_token',v_token,'ad',jsonb_build_object(
    'campaign_id',v_pick.campaign_id,'name',v_pick.name,'slug',v_pick.slug,
    'advertiser_name',COALESCE(v_pick.trade_name,v_pick.legal_name),'placement_code',v_pick.placement_code,
    'creative_id',v_pick.creative_id,'kind',v_pick.kind,'storage_path',v_pick.storage_path,
    'target_url',v_pick.target_url,'headline',v_pick.headline,'body',v_pick.body,'alt_text',v_pick.alt_text,
    'width',v_pick.width,'height',v_pick.height,'duration_seconds',v_pick.duration_seconds));
END;
$$;

-- O portal só salva mídia que já existe no bucket privado e pertence à campanha.
CREATE OR REPLACE FUNCTION public.gsa_advertiser_save_creative(
  p_creative_id uuid,p_campaign_id uuid,p_kind text,p_storage_path text,p_target_url text,
  p_headline text,p_body text,p_alt_text text,p_width integer,p_height integer,p_duration_seconds numeric
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_advertiser_id uuid:=public.gsa_current_advertiser_id();
  v_campaign public.gsa_ad_campaigns;
  v_id uuid;
  v_storage text:=nullif(trim(COALESCE(p_storage_path,'')),'');
  v_target text:=nullif(trim(COALESCE(p_target_url,'')),'');
BEGIN
  IF v_advertiser_id IS NULL OR p_kind NOT IN ('image','video','text') THEN
    RAISE EXCEPTION 'Conta ou tipo de criativo invalido' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_campaign FROM public.gsa_ad_campaigns
  WHERE id=p_campaign_id AND advertiser_id=v_advertiser_id FOR UPDATE;
  IF v_campaign.id IS NULL OR v_campaign.status IN ('completed','cancelled') THEN
    RAISE EXCEPTION 'Campanha nao autorizada para criativos' USING ERRCODE='42501';
  END IF;
  IF v_target IS NOT NULL AND (length(v_target)>2000 OR v_target!~'^https://') THEN
    RAISE EXCEPTION 'URL de destino invalida' USING ERRCODE='22023';
  END IF;

  IF p_kind='text' THEN
    IF v_storage IS NOT NULL OR length(trim(COALESCE(p_headline,''))) NOT BETWEEN 3 AND 180
      OR length(trim(COALESCE(p_body,''))) NOT BETWEEN 3 AND 3000 THEN
      RAISE EXCEPTION 'Criativo textual invalido' USING ERRCODE='22023';
    END IF;
  ELSE
    IF v_storage IS NULL OR length(trim(COALESCE(p_alt_text,''))) NOT BETWEEN 3 AND 500
      OR COALESCE(p_width,0) NOT BETWEEN 1 AND 10000 OR COALESCE(p_height,0) NOT BETWEEN 1 AND 10000
      OR (p_kind='video' AND COALESCE(p_duration_seconds,0) NOT BETWEEN 0.1 AND 3600)
      OR NOT public.gsa_ads_validate_creative_object(v_advertiser_id,p_campaign_id,p_kind,v_storage) THEN
      RAISE EXCEPTION 'Arquivo de criativo invalido ou inexistente' USING ERRCODE='22023';
    END IF;
  END IF;

  IF p_creative_id IS NULL THEN
    INSERT INTO public.gsa_ad_creatives(
      campaign_id,kind,status,storage_path,target_url,headline,body,alt_text,width,height,duration_seconds
    ) VALUES (
      p_campaign_id,p_kind,'draft',v_storage,v_target,nullif(trim(p_headline),''),nullif(trim(p_body),''),
      nullif(trim(p_alt_text),''),p_width,p_height,p_duration_seconds
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.gsa_ad_creatives SET
      kind=p_kind,storage_path=v_storage,target_url=v_target,headline=nullif(trim(p_headline),''),
      body=nullif(trim(p_body),''),alt_text=nullif(trim(p_alt_text),''),width=p_width,height=p_height,
      duration_seconds=p_duration_seconds,status='draft',rejection_reason=NULL
    WHERE id=p_creative_id AND campaign_id=p_campaign_id AND status IN ('draft','rejected')
    RETURNING id INTO v_id;
  END IF;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Criativo nao editavel' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('success',true,'creative_id',v_id,'status','draft');
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_advertiser_submit_creative(p_creative_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_advertiser_id uuid:=public.gsa_current_advertiser_id();
  v_creative public.gsa_ad_creatives;
  v_campaign public.gsa_ad_campaigns;
BEGIN
  SELECT cr.* INTO v_creative FROM public.gsa_ad_creatives cr
  JOIN public.gsa_ad_campaigns c ON c.id=cr.campaign_id
  WHERE cr.id=p_creative_id AND c.advertiser_id=v_advertiser_id AND cr.status IN ('draft','rejected') FOR UPDATE OF cr;
  IF v_creative.id IS NULL THEN RAISE EXCEPTION 'Criativo nao disponivel' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_campaign FROM public.gsa_ad_campaigns WHERE id=v_creative.campaign_id;
  IF v_campaign.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Campanha encerrada' USING ERRCODE='22023'; END IF;
  IF v_creative.kind='text' THEN
    IF COALESCE(NULLIF(trim(v_creative.headline),''),NULLIF(trim(v_creative.body),'')) IS NULL THEN
      RAISE EXCEPTION 'Criativo textual vazio' USING ERRCODE='22023';
    END IF;
  ELSIF NOT public.gsa_ads_validate_creative_object(v_advertiser_id,v_campaign.id,v_creative.kind,v_creative.storage_path) THEN
    RAISE EXCEPTION 'Arquivo do criativo nao esta disponivel' USING ERRCODE='22023';
  END IF;
  UPDATE public.gsa_ad_creatives SET status='pending_review',rejection_reason=NULL WHERE id=p_creative_id;
  RETURN jsonb_build_object('success',true,'creative_id',p_creative_id,'status','pending_review');
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_review_ad_creative(p_creative_id uuid,p_approved boolean,p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_creative public.gsa_ad_creatives;
  v_campaign public.gsa_ad_campaigns;
BEGIN
  IF NOT public.gsa_admin_has_module('anuncios') THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_creative FROM public.gsa_ad_creatives WHERE id=p_creative_id AND status='pending_review' FOR UPDATE;
  IF v_creative.id IS NULL THEN RAISE EXCEPTION 'Criativo nao encontrado ou ja analisado' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_campaign FROM public.gsa_ad_campaigns WHERE id=v_creative.campaign_id;
  IF NOT p_approved AND length(trim(COALESCE(p_reason,'')))<5 THEN
    RAISE EXCEPTION 'Informe o motivo do ajuste' USING ERRCODE='22023';
  END IF;
  IF p_approved THEN
    IF v_creative.kind='text' THEN
      IF COALESCE(NULLIF(trim(v_creative.headline),''),NULLIF(trim(v_creative.body),'')) IS NULL THEN
        RAISE EXCEPTION 'Criativo textual vazio' USING ERRCODE='22023';
      END IF;
    ELSIF NOT public.gsa_ads_validate_creative_object(v_campaign.advertiser_id,v_campaign.id,v_creative.kind,v_creative.storage_path) THEN
      RAISE EXCEPTION 'Arquivo do criativo nao esta disponivel' USING ERRCODE='22023';
    END IF;
  END IF;
  UPDATE public.gsa_ad_creatives SET
    status=CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
    approved_at=CASE WHEN p_approved THEN now() ELSE NULL END,
    rejection_reason=CASE WHEN p_approved THEN NULL ELSE trim(p_reason) END
  WHERE id=p_creative_id;
  PERFORM public.gsa_ads_refresh_campaign_states();
  INSERT INTO public.gsa_ad_audit_logs(actor_type,actor_id,action,entity_type,entity_id,details)
  VALUES(public.gsa_current_actor_type(),public.gsa_current_actor_id(),'REVIEW_AD_CREATIVE','ad_creative',p_creative_id,
    jsonb_build_object('approved',p_approved,'reason',CASE WHEN p_approved THEN NULL ELSE trim(p_reason) END));
  RETURN jsonb_build_object('success',true,'creative_id',p_creative_id,'approved',p_approved);
END;
$$;

-- Snapshot do portal expõe somente dados financeiros necessários ao anunciante.
CREATE OR REPLACE FUNCTION public.gsa_advertiser_portal_snapshot()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_advertiser_id uuid:=public.gsa_current_advertiser_id(); v_result jsonb;
BEGIN
  IF v_advertiser_id IS NULL THEN RAISE EXCEPTION 'Conta de anunciante nao vinculada ou suspensa' USING ERRCODE='42501'; END IF;
  UPDATE public.gsa_advertisers SET last_access_at=now() WHERE id=v_advertiser_id;
  SELECT jsonb_build_object(
    'advertiser',jsonb_build_object(
      'id',a.id,'legal_name',a.legal_name,'trade_name',a.trade_name,'document',a.document,
      'company_name',a.legal_name,'segment',a.segment,'website',a.website,
      'responsible_name',a.responsible_name,'responsible_email',a.responsible_email,
      'responsible_phone',a.responsible_phone,'contact_name',a.responsible_name,
      'contact_email',a.responsible_email,'contact_phone',a.responsible_phone,'status',a.status),
    'requests',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',r.id,'advertiser_id',r.advertiser_id,'protocol',r.protocol,'company_name',r.company_name,
      'document',r.document,'company_size',r.company_size,'segment',r.segment,'contact_name',r.contact_name,
      'contact_email',r.contact_email,'contact_phone',r.contact_phone,'website',r.website,'objective',r.objective,
      'desired_formats',r.desired_formats,'desired_pages',r.desired_pages,'devices',r.devices,
      'desired_start_date',r.desired_start_date,'desired_end_date',r.desired_end_date,
      'intended_budget',r.intended_budget,'needs_creative_service',r.needs_creative_service,
      'notes',r.notes,'status',r.status,'created_at',r.created_at,'updated_at',r.updated_at) ORDER BY r.created_at DESC)
      FROM public.gsa_ad_requests r WHERE r.advertiser_id=a.id),'[]'::jsonb),
    'proposals',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',p.id,'request_id',p.request_id,'status',p.status,'current_version',p.current_version,
      'total_amount',p.total_amount,'valid_until',p.valid_until,'accepted_at',p.accepted_at,
      'accepted_version',p.accepted_version,'accepted_amount',p.accepted_amount,
      'version',to_jsonb(v),'negotiations',COALESCE((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at)
        FROM public.gsa_ad_negotiations n WHERE n.proposal_id=p.id),'[]'::jsonb)) ORDER BY p.created_at DESC)
      FROM public.gsa_ad_proposals p JOIN public.gsa_ad_requests r ON r.id=p.request_id AND r.advertiser_id=a.id
      LEFT JOIN public.gsa_ad_proposal_versions v ON v.proposal_id=p.id AND v.version=p.current_version),'[]'::jsonb),
    'campaigns',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',c.id,'advertiser_id',c.advertiser_id,'proposal_id',c.proposal_id,'name',c.name,'slug',c.slug,
      'status',c.status,'starts_at',c.starts_at,'ends_at',c.ends_at,'devices',c.devices,
      'frequency_model',c.frequency_model,'frequency_value',c.frequency_value,'impression_limit',c.impression_limit,
      'served_count',c.served_count,'paid_at',c.paid_at,'activated_at',c.activated_at,'paused_at',c.paused_at,
      'completed_at',c.completed_at,'cancelled_at',c.cancelled_at,'created_at',c.created_at,'updated_at',c.updated_at,
      'creatives',COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id',cr.id,'campaign_id',cr.campaign_id,'kind',cr.kind,'status',cr.status,'storage_path',cr.storage_path,
        'target_url',cr.target_url,'headline',cr.headline,'body',cr.body,'alt_text',cr.alt_text,
        'width',cr.width,'height',cr.height,'duration_seconds',cr.duration_seconds,
        'rejection_reason',cr.rejection_reason,'approved_at',cr.approved_at,'created_at',cr.created_at)
        ORDER BY cr.created_at DESC) FROM public.gsa_ad_creatives cr WHERE cr.campaign_id=c.id),'[]'::jsonb),
      'payment',(SELECT jsonb_build_object(
        'id',pay.id,'campaign_id',pay.campaign_id,'proposal_id',pay.proposal_id,'provider',pay.provider,
        'provider_reference',pay.provider_reference,'amount',pay.amount,'currency',pay.currency,'status',pay.status,
        'payment_method',pay.payment_method,'checkout_url',pay.checkout_url,'pix_code',pay.pix_code,
        'due_at',pay.due_at,'paid_at',pay.paid_at,'overdue_at',pay.overdue_at,
        'created_at',pay.created_at,'updated_at',pay.updated_at)
        FROM public.gsa_ad_payments pay WHERE pay.campaign_id=c.id),
      'metrics',COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.metric_date)
        FROM public.gsa_ad_daily_metrics m WHERE m.campaign_id=c.id),'[]'::jsonb)) ORDER BY c.created_at DESC)
      FROM public.gsa_ad_campaigns c WHERE c.advertiser_id=a.id),'[]'::jsonb)
  ) INTO v_result FROM public.gsa_advertisers a WHERE a.id=v_advertiser_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_advertiser_payment_checkout_context(p_payment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_advertiser_id uuid:=public.gsa_current_advertiser_id(); v_result jsonb;
BEGIN
  IF v_advertiser_id IS NULL THEN RAISE EXCEPTION 'Conta de anunciante indisponivel' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'payment_id',p.id,'campaign_id',p.campaign_id,'amount',p.amount,'currency',p.currency,
    'status',p.status,'provider',p.provider,'provider_reference',p.provider_reference,
    'checkout_url',p.checkout_url,'due_at',p.due_at,'campaign_name',c.name,
    'customer_name',COALESCE(a.responsible_name,a.trade_name,a.legal_name),
    'customer_email',a.responsible_email,'customer_phone',a.responsible_phone
  ) INTO v_result
  FROM public.gsa_ad_payments p
  JOIN public.gsa_ad_campaigns c ON c.id=p.campaign_id
  JOIN public.gsa_advertisers a ON a.id=c.advertiser_id
  WHERE p.id=p_payment_id AND c.advertiser_id=v_advertiser_id;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Pagamento nao encontrado' USING ERRCODE='P0002'; END IF;
  IF v_result->>'status' IN ('paid','refunded','cancelled') THEN
    RAISE EXCEPTION 'Pagamento nao disponivel para checkout' USING ERRCODE='22023';
  END IF;
  RETURN jsonb_build_object('success',true,'payment',v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_ads_configure_payment_checkout(
  p_payment_id uuid,p_provider text,p_provider_reference text,p_checkout_url text,p_due_at timestamptz
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_payment public.gsa_ad_payments;
  v_provider text:=lower(trim(COALESCE(p_provider,'')));
  v_reference text:=trim(COALESCE(p_provider_reference,''));
  v_checkout text:=trim(COALESCE(p_checkout_url,''));
BEGIN
  IF v_provider!~'^[a-z0-9][a-z0-9_-]{1,49}$'
    OR v_reference!~'^[A-Za-z0-9._:/-]{4,200}$'
    OR length(v_checkout)>2000 OR v_checkout!~'^https://'
    OR p_due_at IS NULL OR p_due_at<=now() OR p_due_at>now()+interval '30 days' THEN
    RAISE EXCEPTION 'Checkout invalido' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_payment FROM public.gsa_ad_payments WHERE id=p_payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Pagamento nao encontrado' USING ERRCODE='P0002'; END IF;
  IF v_payment.status IN ('paid','refunded','cancelled') THEN RAISE EXCEPTION 'Pagamento em estado terminal' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.gsa_ad_payment_events e WHERE e.payment_id=p_payment_id)
    AND (v_payment.provider IS DISTINCT FROM v_provider OR v_payment.provider_reference IS DISTINCT FROM v_reference) THEN
    RAISE EXCEPTION 'Provedor com eventos e imutavel' USING ERRCODE='22023';
  END IF;
  UPDATE public.gsa_ad_payments SET provider=v_provider,provider_reference=v_reference,
    checkout_url=v_checkout,due_at=p_due_at,
    status=CASE WHEN status IN ('failed','overdue') THEN 'processing' ELSE status END,
    overdue_at=CASE WHEN status IN ('failed','overdue') THEN NULL ELSE overdue_at END
  WHERE id=p_payment_id;
  RETURN jsonb_build_object('success',true,'payment_id',p_payment_id,'provider',v_provider,
    'provider_reference',v_reference,'checkout_url',v_checkout);
END;
$$;

-- Wrapper de compatibilidade; a Edge nova envia valor/moeda explicitamente.
CREATE OR REPLACE FUNCTION public.gsa_ads_process_payment_event(
  p_provider text,p_event_id text,p_reference text,p_status text,p_payload jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_amount numeric; v_currency text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'Payload financeiro invalido' USING ERRCODE='22023'; END IF;
  BEGIN v_amount:=nullif(p_payload->>'amount','')::numeric;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Valor do evento invalido' USING ERRCODE='22023'; END;
  v_currency:=upper(trim(COALESCE(p_payload->>'currency','')));
  RETURN public.gsa_ads_process_payment_event(p_provider,p_event_id,p_reference,p_status,v_amount,v_currency,p_payload);
END;
$$;

-- Funções internas gsa_ads_* nunca são chamáveis pelo navegador/PostgREST público.
DO $function_acl$
DECLARE v record;
BEGIN
  FOR v IN
    SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'gsa_ads_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',v.proname,v.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',v.proname,v.args);
  END LOOP;
END;
$function_acl$;

REVOKE ALL ON FUNCTION public.gsa_public_submit_advertising_request(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gsa_public_validate_advertising_protocol(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_public_submit_advertising_request(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_public_validate_advertising_protocol(text) TO service_role;

REVOKE ALL ON FUNCTION public.gsa_current_advertiser_id() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_current_advertiser_id() TO authenticated,service_role;

DO $portal_acl$
DECLARE v record;
BEGIN
  FOR v IN SELECT p.proname,pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'gsa_advertiser_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon',v.proname,v.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated,service_role',v.proname,v.args);
  END LOOP;
END;
$portal_acl$;

DO $admin_acl$
DECLARE v record;
BEGIN
  FOR v IN SELECT p.proname,pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=ANY(ARRAY[
      'gsa_admin_advertising_overview','gsa_admin_configure_ad_payment','gsa_admin_create_ad_proposal',
      'gsa_admin_get_advertiser_invite_target','gsa_admin_link_advertiser_auth','gsa_admin_list_ad_requests',
      'gsa_admin_mark_ad_payment','gsa_admin_review_ad_creative','gsa_admin_update_ad_campaign_status',
      'gsa_admin_update_ad_placement','gsa_admin_update_ad_proposal_status','gsa_admin_update_ad_request_status'
    ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon',v.proname,v.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated,service_role',v.proname,v.args);
  END LOOP;
END;
$admin_acl$;

NOTIFY pgrst,'reload schema';
ROLLBACK;