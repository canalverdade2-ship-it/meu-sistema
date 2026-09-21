BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_admin_gsa_tv_domain_snapshot(
  p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_context jsonb;
BEGIN
  v_context:=public.gsa_tv_admin_context(p_sessao_id,p_session_token);
  RETURN jsonb_build_object(
    'programs',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.name) FROM public.gsa_tv_programs x),'[]'),
    'series',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.title) FROM public.gsa_tv_series x),'[]'),
    'episodes',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.season_number,x.episode_number) FROM public.gsa_tv_episodes x),'[]'),
    'schedule_versions',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.broadcast_date DESC,x.version DESC) FROM public.gsa_tv_schedule_versions x LIMIT 100),'[]'),
    'blocks',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.position) FROM public.gsa_tv_program_blocks x),'[]'),
    'rights',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC) FROM public.gsa_tv_rights_records x),'[]'),
    'comments',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (SELECT * FROM public.gsa_tv_comments ORDER BY created_at DESC LIMIT 300)x),'[]'),
    'campaigns',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC) FROM public.gsa_tv_ad_campaigns x),'[]'),
    'live_sources',COALESCE((SELECT jsonb_agg(to_jsonb(x)-'endpoint_ciphertext' ORDER BY x.updated_at DESC) FROM public.gsa_tv_live_sources x),'[]'),
    'identity_assets',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.asset_type) FROM public.gsa_tv_identity_assets x),'[]'),
    'graphic_templates',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.name) FROM public.gsa_tv_graphic_templates x),'[]'),
    'on_air_graphics',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC) FROM public.gsa_tv_on_air_graphics x WHERE x.state IN ('preview','on_air')),'[]'),
    'as_run',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.started_at DESC) FROM (SELECT * FROM public.gsa_tv_as_run ORDER BY started_at DESC LIMIT 200)x),'[]'),
    'ai_presenters',COALESCE((SELECT jsonb_agg(to_jsonb(x)-'provider_avatar_id_ciphertext'-'voice_id_ciphertext' ORDER BY x.name) FROM public.gsa_tv_ai_presenters x),'[]'),
    'ai_projects',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC) FROM public.gsa_tv_ai_projects x),'[]'),
    'ai_jobs',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (SELECT * FROM public.gsa_tv_ai_jobs ORDER BY created_at DESC LIMIT 200)x),'[]'),
    'ai_assets',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC) FROM public.gsa_tv_ai_assets x),'[]'),
    'server_time',now()
  );
END $$;

CREATE OR REPLACE FUNCTION public.gsa_admin_gsa_tv_domain_mutate(
  p_sessao_id uuid DEFAULT NULL,p_session_token text DEFAULT NULL,p_action text DEFAULT '',p_payload jsonb DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_context jsonb; v_channel text:=COALESCE(NULLIF(p_payload->>'channel_id',''),'ch-main'); v_id uuid; v_text_id text; v_actor uuid;
BEGIN
  v_context:=public.gsa_tv_admin_context(p_sessao_id,p_session_token);
  v_actor:=NULLIF(v_context->>'actor_id','')::uuid;
  IF p_action='save_program' THEN
    INSERT INTO public.gsa_tv_programs(id,channel_id,name,description,category,default_duration_s,status,clock_template,notes,updated_at)
    VALUES(COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid()),v_channel,trim(p_payload->>'name'),NULLIF(p_payload->>'description',''),NULLIF(p_payload->>'category',''),COALESCE((p_payload->>'default_duration_s')::int,1800),'draft',COALESCE(p_payload->'clock_template','[]'),NULLIF(p_payload->>'notes',''),now())
    ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,category=EXCLUDED.category,default_duration_s=EXCLUDED.default_duration_s,clock_template=EXCLUDED.clock_template,notes=EXCLUDED.notes,updated_at=now() RETURNING id INTO v_id;
  ELSIF p_action='save_series' THEN
    INSERT INTO public.gsa_tv_series(id,channel_id,program_id,title,description,status,updated_at)
    VALUES(COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid()),v_channel,NULLIF(p_payload->>'program_id','')::uuid,trim(p_payload->>'title'),NULLIF(p_payload->>'description',''),'active',now())
    ON CONFLICT(id) DO UPDATE SET program_id=EXCLUDED.program_id,title=EXCLUDED.title,description=EXCLUDED.description,updated_at=now() RETURNING id INTO v_id;
  ELSIF p_action='save_episode' THEN
    INSERT INTO public.gsa_tv_episodes(id,series_id,media_item_id,season_number,episode_number,title,synopsis,updated_at)
    VALUES(COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid()),(p_payload->>'series_id')::uuid,NULLIF(p_payload->>'media_item_id',''),COALESCE((p_payload->>'season_number')::int,1),(p_payload->>'episode_number')::int,trim(p_payload->>'title'),NULLIF(p_payload->>'synopsis',''),now())
    ON CONFLICT(id) DO UPDATE SET media_item_id=EXCLUDED.media_item_id,season_number=EXCLUDED.season_number,episode_number=EXCLUDED.episode_number,title=EXCLUDED.title,synopsis=EXCLUDED.synopsis,updated_at=now() RETURNING id INTO v_id;
  ELSIF p_action='add_comment' THEN
    INSERT INTO public.gsa_tv_comments(channel_id,resource_type,resource_id,parent_id,comment_type,priority,body,author_id,author_name,assigned_to)
    VALUES(v_channel,trim(p_payload->>'resource_type'),trim(p_payload->>'resource_id'),NULLIF(p_payload->>'parent_id','')::uuid,COALESCE(NULLIF(p_payload->>'comment_type',''),'comment'),COALESCE(NULLIF(p_payload->>'priority',''),'normal'),trim(p_payload->>'body'),v_actor,COALESCE(v_context->>'actor_name','Administrador'),NULLIF(p_payload->>'assigned_to','')::uuid) RETURNING id INTO v_id;
  ELSIF p_action='resolve_comment' THEN
    UPDATE public.gsa_tv_comments SET resolved=true,resolved_at=now(),updated_at=now() WHERE id=(p_payload->>'id')::uuid RETURNING id INTO v_id;
  ELSIF p_action='save_rights' THEN
    INSERT INTO public.gsa_tv_rights_records(id,channel_id,media_item_id,status,license_type,territory,platforms,valid_from,valid_until,justification,evidence,approved_by,approved_at,updated_at)
    VALUES(COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid()),v_channel,p_payload->>'media_item_id',COALESCE(NULLIF(p_payload->>'status',''),'pending'),NULLIF(p_payload->>'license_type',''),COALESCE(NULLIF(p_payload->>'territory',''),'worldwide'),COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'platforms','["youtube"]'))),ARRAY['youtube']),NULLIF(p_payload->>'valid_from','')::timestamptz,NULLIF(p_payload->>'valid_until','')::timestamptz,NULLIF(p_payload->>'justification',''),COALESCE(p_payload->'evidence','[]'),CASE WHEN p_payload->>'status'='approved' THEN v_actor END,CASE WHEN p_payload->>'status'='approved' THEN now() END,now())
    ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,license_type=EXCLUDED.license_type,territory=EXCLUDED.territory,platforms=EXCLUDED.platforms,valid_from=EXCLUDED.valid_from,valid_until=EXCLUDED.valid_until,justification=EXCLUDED.justification,evidence=EXCLUDED.evidence,approved_by=EXCLUDED.approved_by,approved_at=EXCLUDED.approved_at,updated_at=now() RETURNING id INTO v_id;
    UPDATE public.gsa_tv_media_items SET rights_ok=(p_payload->>'status'='approved'),rights_expires_at=NULLIF(p_payload->>'valid_until','')::timestamptz,updated_at=now() WHERE id=p_payload->>'media_item_id';
  ELSIF p_action='save_campaign' THEN
    INSERT INTO public.gsa_tv_ad_campaigns(id,channel_id,advertiser_name,name,starts_at,ends_at,contracted_runs,priority,status,metadata,updated_at)
    VALUES(COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid()),v_channel,trim(p_payload->>'advertiser_name'),trim(p_payload->>'name'),(p_payload->>'starts_at')::timestamptz,(p_payload->>'ends_at')::timestamptz,NULLIF(p_payload->>'contracted_runs','')::int,COALESCE((p_payload->>'priority')::int,50),COALESCE(NULLIF(p_payload->>'status',''),'draft'),COALESCE(p_payload->'metadata','{}'),now())
    ON CONFLICT(id) DO UPDATE SET advertiser_name=EXCLUDED.advertiser_name,name=EXCLUDED.name,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,contracted_runs=EXCLUDED.contracted_runs,priority=EXCLUDED.priority,status=EXCLUDED.status,metadata=EXCLUDED.metadata,updated_at=now() RETURNING id INTO v_id;
  ELSIF p_action='save_presenter' THEN
    INSERT INTO public.gsa_tv_ai_presenters(id,channel_id,name,role,status,visual_profile,voice_profile,editorial_profile,reference_assets,updated_at)
    VALUES(COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid()),v_channel,trim(p_payload->>'name'),trim(p_payload->>'role'),'draft',COALESCE(p_payload->'visual_profile','{}'),COALESCE(p_payload->'voice_profile','{}'),COALESCE(p_payload->'editorial_profile','{}'),COALESCE(p_payload->'reference_assets','[]'),now())
    ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,role=EXCLUDED.role,visual_profile=EXCLUDED.visual_profile,voice_profile=EXCLUDED.voice_profile,editorial_profile=EXCLUDED.editorial_profile,reference_assets=EXCLUDED.reference_assets,identity_version=public.gsa_tv_ai_presenters.identity_version+1,updated_at=now() RETURNING id INTO v_id;
  ELSIF p_action='save_ai_project' THEN
    INSERT INTO public.gsa_tv_ai_projects(id,channel_id,name,project_type,brief,autonomy_mode,state,created_by,metadata,updated_at)
    VALUES(COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid()),v_channel,trim(p_payload->>'name'),trim(p_payload->>'project_type'),trim(p_payload->>'brief'),COALESCE(NULLIF(p_payload->>'autonomy_mode',''),'assisted'),'draft',v_actor,COALESCE(p_payload->'metadata','{}'),now())
    ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,project_type=EXCLUDED.project_type,brief=EXCLUDED.brief,autonomy_mode=EXCLUDED.autonomy_mode,metadata=EXCLUDED.metadata,updated_at=now() RETURNING id INTO v_id;
  ELSE RAISE EXCEPTION 'Ação de domínio não suportada.' USING ERRCODE='22023'; END IF;
  PERFORM public.gsa_tv_write_audit(v_context,v_channel,p_action,'gsa_tv_domain',v_id::text,p_payload);
  RETURN jsonb_build_object('success',true,'id',v_id);
END $$;

REVOKE ALL ON FUNCTION public.gsa_admin_gsa_tv_domain_snapshot(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.gsa_admin_gsa_tv_domain_mutate(uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_gsa_tv_domain_snapshot(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_gsa_tv_domain_mutate(uuid,text,text,jsonb) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
