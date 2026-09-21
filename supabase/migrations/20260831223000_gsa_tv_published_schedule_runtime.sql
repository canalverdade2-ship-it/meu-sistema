BEGIN;

ALTER TABLE public.gsa_tv_program_blocks
  ADD COLUMN IF NOT EXISTS media_item_id text REFERENCES public.gsa_tv_media_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS episode_id uuid REFERENCES public.gsa_tv_episodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS live_source_id uuid REFERENCES public.gsa_tv_live_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.gsa_tv_ad_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_reprise boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS gsa_tv_program_blocks_runtime_idx
  ON public.gsa_tv_program_blocks(schedule_version_id,planned_start_offset_s,position);
CREATE UNIQUE INDEX IF NOT EXISTS gsa_tv_one_published_schedule_per_day
  ON public.gsa_tv_schedule_versions(channel_id,broadcast_date)
  WHERE state='published';

CREATE OR REPLACE FUNCTION public.gsa_admin_gsa_tv_schedule_mutate(
  p_sessao_id uuid DEFAULT NULL,p_session_token text DEFAULT NULL,
  p_action text DEFAULT '',p_payload jsonb DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.gsa_tv_admin_context(p_sessao_id,p_session_token);
  ch text:=COALESCE(NULLIF(p_payload->>'channel_id',''),'ch-main');rid uuid;st text;
BEGIN IF p_action='save_version' THEN
  INSERT INTO public.gsa_tv_schedule_versions(id,channel_id,broadcast_date,version,state,title,notes,updated_at)
  VALUES(COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid()),ch,
    (p_payload->>'broadcast_date')::date,
    COALESCE((p_payload->>'version')::int,(SELECT COALESCE(max(version),0)+1 FROM public.gsa_tv_schedule_versions WHERE channel_id=ch AND broadcast_date=(p_payload->>'broadcast_date')::date)),
    'draft',NULLIF(trim(p_payload->>'title'),''),NULLIF(trim(p_payload->>'notes'),''),now())
  ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,notes=EXCLUDED.notes,updated_at=now()
  RETURNING id INTO rid;
 ELSIF p_action='save_block' THEN
  IF NOT EXISTS(SELECT 1 FROM public.gsa_tv_schedule_versions WHERE id=(p_payload->>'schedule_version_id')::uuid AND channel_id=ch AND state='draft') THEN
    RAISE EXCEPTION 'Somente grades em rascunho aceitam alterações.';
  END IF;
  IF NULLIF(p_payload->>'media_item_id','') IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.gsa_tv_media_items m WHERE m.id=p_payload->>'media_item_id' AND m.state='ready' AND m.rights_ok
      AND (m.rights_expires_at IS NULL OR m.rights_expires_at>now())) THEN
    RAISE EXCEPTION 'A mídia do bloco não está pronta ou não possui direitos válidos.';
  END IF;
  INSERT INTO public.gsa_tv_program_blocks(
    id,schedule_version_id,program_id,media_item_id,episode_id,live_source_id,campaign_id,
    block_type,position,planned_start_offset_s,planned_duration_s,cannot_interrupt,is_reprise,safe_cut_points,notes,metadata,updated_at)
  VALUES(COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid()),(p_payload->>'schedule_version_id')::uuid,
    NULLIF(p_payload->>'program_id','')::uuid,NULLIF(p_payload->>'media_item_id',''),NULLIF(p_payload->>'episode_id','')::uuid,
    NULLIF(p_payload->>'live_source_id','')::uuid,NULLIF(p_payload->>'campaign_id','')::uuid,p_payload->>'block_type',
    COALESCE((p_payload->>'position')::int,0),COALESCE((p_payload->>'planned_start_offset_s')::int,0),
    (p_payload->>'planned_duration_s')::int,COALESCE((p_payload->>'cannot_interrupt')::boolean,false),
    COALESCE((p_payload->>'is_reprise')::boolean,false),COALESCE(p_payload->'safe_cut_points','[]'),
    NULLIF(trim(p_payload->>'notes'),''),COALESCE(p_payload->'metadata','{}'),now())  ON CONFLICT(id) DO UPDATE SET program_id=EXCLUDED.program_id,media_item_id=EXCLUDED.media_item_id,
    episode_id=EXCLUDED.episode_id,live_source_id=EXCLUDED.live_source_id,campaign_id=EXCLUDED.campaign_id,
    block_type=EXCLUDED.block_type,position=EXCLUDED.position,planned_start_offset_s=EXCLUDED.planned_start_offset_s,
    planned_duration_s=EXCLUDED.planned_duration_s,cannot_interrupt=EXCLUDED.cannot_interrupt,is_reprise=EXCLUDED.is_reprise,
    safe_cut_points=EXCLUDED.safe_cut_points,notes=EXCLUDED.notes,metadata=EXCLUDED.metadata,updated_at=now()
  RETURNING id INTO rid;
 ELSIF p_action='delete_block' THEN
  DELETE FROM public.gsa_tv_program_blocks b USING public.gsa_tv_schedule_versions v
   WHERE b.id=(p_payload->>'id')::uuid AND b.schedule_version_id=v.id AND v.channel_id=ch AND v.state='draft'
   RETURNING b.id INTO rid;
  IF rid IS NULL THEN RAISE EXCEPTION 'Bloco não encontrado ou grade não editável.'; END IF;
 ELSIF p_action='transition_version' THEN
  st:=p_payload->>'state';
  IF st NOT IN('review','approved','published','cancelled') THEN RAISE EXCEPTION 'Transição inválida.'; END IF;
  IF st='published' THEN
    UPDATE public.gsa_tv_schedule_versions old SET state='cancelled',updated_at=now()
     WHERE old.channel_id=ch AND old.state='published' AND old.broadcast_date=(SELECT broadcast_date FROM public.gsa_tv_schedule_versions WHERE id=(p_payload->>'id')::uuid)
       AND old.id<>(p_payload->>'id')::uuid;
  END IF;
  UPDATE public.gsa_tv_schedule_versions SET state=st,
    approved_by=CASE WHEN st='approved' THEN NULLIF(c->>'actor_id','')::uuid ELSE approved_by END,
    approved_at=CASE WHEN st='approved' THEN now() ELSE approved_at END,
    published_at=CASE WHEN st='published' THEN now() ELSE published_at END,updated_at=now()
   WHERE id=(p_payload->>'id')::uuid AND channel_id=ch
     AND ((state='draft' AND st IN('review','cancelled')) OR (state='review' AND st IN('approved','cancelled')) OR (state='approved' AND st IN('published','cancelled')))
   RETURNING id INTO rid;
  IF rid IS NULL THEN RAISE EXCEPTION 'A transição não é permitida no estado atual.'; END IF; ELSE RAISE EXCEPTION 'Ação de grade não suportada.'; END IF;
 PERFORM public.gsa_tv_write_audit(c,ch,p_action,'schedule_version',rid::text,p_payload);
 RETURN jsonb_build_object('success',true,'id',rid);
END $$;
REVOKE ALL ON FUNCTION public.gsa_admin_gsa_tv_schedule_mutate(uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_gsa_tv_schedule_mutate(uuid,text,text,jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_gsa_tv_advertising_snapshot(
 p_sessao_id uuid DEFAULT NULL,p_session_token text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;
BEGIN
 c:=public.gsa_tv_admin_context(p_sessao_id,p_session_token);
 RETURN jsonb_build_object(
  'campaigns',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC) FROM public.gsa_tv_ad_campaigns x),'[]'::jsonb),
  'assets',COALESCE((SELECT jsonb_agg(to_jsonb(a)||jsonb_build_object('title',m.title,'state',m.state,'approval_state',m.approval_state) ORDER BY m.title) FROM public.gsa_tv_ad_assets a JOIN public.gsa_tv_media_items m ON m.id=a.media_item_id),'[]'::jsonb),
  'server_time',now());
END $$;

CREATE OR REPLACE FUNCTION public.gsa_admin_gsa_tv_advertising_mutate(
 p_sessao_id uuid DEFAULT NULL,p_session_token text DEFAULT NULL,p_action text DEFAULT '',p_payload jsonb DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.gsa_tv_admin_context(p_sessao_id,p_session_token);ch text:=COALESCE(NULLIF(p_payload->>'channel_id',''),'ch-main');rid uuid;
BEGIN IF p_action='save_campaign' THEN
  INSERT INTO public.gsa_tv_ad_campaigns(id,channel_id,advertiser_name,name,starts_at,ends_at,contracted_runs,max_frequency_per_hour,priority,competitor_group,status,metadata,updated_at)
  VALUES(COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid()),ch,trim(p_payload->>'advertiser_name'),trim(p_payload->>'name'),
    (p_payload->>'starts_at')::timestamptz,(p_payload->>'ends_at')::timestamptz,NULLIF(p_payload->>'contracted_runs','')::int,
    NULLIF(p_payload->>'max_frequency_per_hour','')::int,COALESCE((p_payload->>'priority')::int,50),NULLIF(trim(p_payload->>'competitor_group'),''),
    COALESCE(NULLIF(p_payload->>'status',''),'draft'),COALESCE(p_payload->'metadata','{}'),now())
  ON CONFLICT(id) DO UPDATE SET advertiser_name=EXCLUDED.advertiser_name,name=EXCLUDED.name,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,
    contracted_runs=EXCLUDED.contracted_runs,max_frequency_per_hour=EXCLUDED.max_frequency_per_hour,priority=EXCLUDED.priority,
    competitor_group=EXCLUDED.competitor_group,status=EXCLUDED.status,metadata=EXCLUDED.metadata,updated_at=now()
  RETURNING id INTO rid;
 ELSIF p_action='set_campaign_state' THEN
  UPDATE public.gsa_tv_ad_campaigns SET status=p_payload->>'status',updated_at=now()
   WHERE id=(p_payload->>'id')::uuid AND channel_id=ch AND p_payload->>'status' IN ('draft','review','active','paused','completed','expired','cancelled')
   RETURNING id INTO rid;
 ELSIF p_action='link_asset' THEN
  IF NOT EXISTS(SELECT 1 FROM public.gsa_tv_media_items WHERE id=p_payload->>'media_item_id' AND media_kind='advertising' AND state='ready' AND rights_ok AND approval_state='approved') THEN
    RAISE EXCEPTION 'A peça publicitária precisa estar pronta, aprovada e com direitos válidos.';
  END IF;
  INSERT INTO public.gsa_tv_ad_assets(campaign_id,media_item_id,weight)
   VALUES((p_payload->>'campaign_id')::uuid,p_payload->>'media_item_id',COALESCE((p_payload->>'weight')::int,1))
   ON CONFLICT(campaign_id,media_item_id) DO UPDATE SET weight=EXCLUDED.weight;
  rid:=(p_payload->>'campaign_id')::uuid;
 ELSIF p_action='unlink_asset' THEN
  DELETE FROM public.gsa_tv_ad_assets WHERE campaign_id=(p_payload->>'campaign_id')::uuid AND media_item_id=p_payload->>'media_item_id';
  rid:=(p_payload->>'campaign_id')::uuid;
 ELSE RAISE EXCEPTION 'Ação de publicidade não suportada.'; END IF; IF rid IS NULL THEN RAISE EXCEPTION 'Operação publicitária não encontrou o registro solicitado.'; END IF;
 PERFORM public.gsa_tv_write_audit(c,ch,p_action,'advertising',rid::text,p_payload);
 RETURN jsonb_build_object('success',true,'id',rid);
END $$;
REVOKE ALL ON FUNCTION public.gsa_admin_gsa_tv_advertising_snapshot(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.gsa_admin_gsa_tv_advertising_mutate(uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_gsa_tv_advertising_snapshot(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_gsa_tv_advertising_mutate(uuid,text,text,jsonb) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
