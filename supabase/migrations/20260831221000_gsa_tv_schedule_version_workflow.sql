BEGIN;
CREATE OR REPLACE FUNCTION public.gsa_admin_gsa_tv_schedule_mutate(p_sessao_id uuid DEFAULT NULL,p_session_token text DEFAULT NULL,p_action text DEFAULT '',p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.gsa_tv_admin_context(p_sessao_id,p_session_token);ch text:=COALESCE(NULLIF(p_payload->>'channel_id',''),'ch-main');rid uuid;st text;
BEGIN
 IF p_action='save_version' THEN
  INSERT INTO public.gsa_tv_schedule_versions(id,channel_id,broadcast_date,version,state,title,notes,updated_at) VALUES(COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid()),ch,(p_payload->>'broadcast_date')::date,COALESCE((p_payload->>'version')::int,(SELECT COALESCE(max(version),0)+1 FROM public.gsa_tv_schedule_versions WHERE channel_id=ch AND broadcast_date=(p_payload->>'broadcast_date')::date)),'draft',NULLIF(trim(p_payload->>'title'),''),NULLIF(trim(p_payload->>'notes'),''),now()) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,notes=EXCLUDED.notes,updated_at=now() RETURNING id INTO rid;
 ELSIF p_action='save_block' THEN
  IF NOT EXISTS(SELECT 1 FROM public.gsa_tv_schedule_versions WHERE id=(p_payload->>'schedule_version_id')::uuid AND channel_id=ch AND state='draft') THEN RAISE EXCEPTION 'Somente grades em rascunho aceitam alterações.';END IF;
  INSERT INTO public.gsa_tv_program_blocks(id,schedule_version_id,program_id,block_type,position,planned_start_offset_s,planned_duration_s,cannot_interrupt,safe_cut_points,notes,updated_at) VALUES(COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid()),(p_payload->>'schedule_version_id')::uuid,NULLIF(p_payload->>'program_id','')::uuid,p_payload->>'block_type',COALESCE((p_payload->>'position')::int,0),COALESCE((p_payload->>'planned_start_offset_s')::int,0),(p_payload->>'planned_duration_s')::int,COALESCE((p_payload->>'cannot_interrupt')::boolean,false),COALESCE(p_payload->'safe_cut_points','[]'),NULLIF(trim(p_payload->>'notes'),''),now()) ON CONFLICT(id) DO UPDATE SET program_id=EXCLUDED.program_id,block_type=EXCLUDED.block_type,position=EXCLUDED.position,planned_start_offset_s=EXCLUDED.planned_start_offset_s,planned_duration_s=EXCLUDED.planned_duration_s,cannot_interrupt=EXCLUDED.cannot_interrupt,safe_cut_points=EXCLUDED.safe_cut_points,notes=EXCLUDED.notes,updated_at=now() RETURNING id INTO rid;
 ELSIF p_action='transition_version' THEN
  st:=p_payload->>'state';IF st NOT IN('review','approved','published','cancelled') THEN RAISE EXCEPTION 'Transição inválida.';END IF;
  UPDATE public.gsa_tv_schedule_versions SET state=st,approved_by=CASE WHEN st='approved' THEN NULLIF(c->>'actor_id','')::uuid ELSE approved_by END,approved_at=CASE WHEN st='approved' THEN now() ELSE approved_at END,published_at=CASE WHEN st='published' THEN now() ELSE published_at END,updated_at=now() WHERE id=(p_payload->>'id')::uuid AND channel_id=ch AND ((state='draft' AND st IN('review','cancelled')) OR (state='review' AND st IN('approved','cancelled')) OR (state='approved' AND st IN('published','cancelled'))) RETURNING id INTO rid;
  IF rid IS NULL THEN RAISE EXCEPTION 'A transição não é permitida no estado atual.';END IF;
 ELSE RAISE EXCEPTION 'Ação de grade não suportada.';END IF;
 PERFORM public.gsa_tv_write_audit(c,ch,p_action,'schedule_version',rid::text,p_payload);RETURN jsonb_build_object('success',true,'id',rid);
END$$;
REVOKE ALL ON FUNCTION public.gsa_admin_gsa_tv_schedule_mutate(uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_gsa_tv_schedule_mutate(uuid,text,text,jsonb) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';COMMIT;
