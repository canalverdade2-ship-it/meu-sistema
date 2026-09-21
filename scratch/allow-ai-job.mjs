import { runSshScript } from './ssh2-run.mjs';

async function updateMutateFunction() {
  const script = `
sudo docker exec gsa-tv-control-plane node -e '
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  try {
    console.log("Adding ai_flow_vids_generate to gsa_admin_gsa_tv_mutate...");
    await pool.query(\`
      CREATE OR REPLACE FUNCTION public.gsa_admin_gsa_tv_mutate(
        p_sessao_id uuid DEFAULT NULL::uuid,
        p_session_token text DEFAULT NULL::text,
        p_action text DEFAULT \'\'::text,
        p_payload jsonb DEFAULT \'{}\'::jsonb
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO \'public\', \'pg_temp\'
      AS \\$BODY\\$
      DECLARE
        v_context jsonb;
        v_action text := lower(trim(COALESCE(p_action,\'\')));
        v_channel_id text := COALESCE(NULLIF(p_payload->>\'channel_id\',\'\'),\'ch-main\');
        v_uuid uuid;
        v_job_type text;
        v_rule_scope text;
        v_rule_type text;
        v_rule_id uuid;
        v_media_id text;
        v_drive_path text;
      BEGIN
        v_context := public.gsa_tv_admin_context(p_sessao_id, p_session_token);

        IF v_action=\'update_channel\' THEN
          UPDATE public.gsa_tv_channels
          SET
            name=COALESCE(NULLIF(trim(p_payload->>\'name\'),\'\'),name),
            quality_profile=p_payload->>\'quality_profile\',
            config=(config - \'stream_key\' - \'youtube_stream_key\' - \'rtmp_key\') ||
              (COALESCE(p_payload->\'config\',\'{}\'::jsonb) - \'stream_key\' - \'youtube_stream_key\' - \'rtmp_key\'),
            updated_at=now()
          WHERE id=v_channel_id;
          PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,\'channel_updated\',\'channel\',v_channel_id,p_payload);
          RETURN jsonb_build_object(\'success\',true);

        ELSIF v_action=\'enqueue_job\' THEN
          v_job_type := lower(trim(COALESCE(p_payload->>\'job_type\',\'\')));
          IF v_job_type NOT IN (
            \'compile_playlist\',\'cache_warmup\',\'cache_cleanup\',\'purge_media_files\',
            \'probe_media\',\'validate_schedule\',\'playout_reload\',\'health_check\',
            \'stream_start\',\'stream_pause\',\'stream_resume\',\'stream_stop\',
            \'credentials_check\',\'relay_check\',\'graphics_reload\',\'live_take\',
            \'live_return\',\'ai_flow_vids_generate\'
          ) THEN
            RAISE EXCEPTION \'Tipo de tarefa operacional não permitido.\' USING ERRCODE=\'22023\';
          END IF;
          IF EXISTS (SELECT 1 FROM public.gsa_tv_jobs WHERE channel_id=v_channel_id AND job_type=v_job_type AND status IN (\'pending\',\'running\')) THEN
            -- Se já estiver pendente ou rodando, retorna sucesso com id existente
            SELECT id INTO v_uuid FROM public.gsa_tv_jobs WHERE channel_id=v_channel_id AND job_type=v_job_type AND status IN (\'pending\',\'running\') LIMIT 1;
            RETURN jsonb_build_object(\'success\',true,\'id\',v_uuid,\'status\',\'already_running\');
          END IF;
          INSERT INTO public.gsa_tv_jobs(channel_id,job_type,status,progress,payload)
          VALUES(v_channel_id,v_job_type,\'pending\',0,COALESCE(p_payload->\'payload\',\'{}\'::jsonb)) RETURNING id INTO v_uuid;
          PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,\'job_enqueued\',\'job\',v_uuid::text,jsonb_build_object(\'job_type\',v_job_type));
          RETURN jsonb_build_object(\'success\',true,\'id\',v_uuid,\'status\',\'pending\');

        ELSIF v_action=\'resolve_incident\' THEN
          v_uuid := NULLIF(p_payload->>\'id\',\'\')::uuid;
          UPDATE public.gsa_tv_incidents SET resolved=true,resolved_at=now() WHERE id=v_uuid AND NOT resolved;
          IF NOT FOUND THEN RAISE EXCEPTION \'Incidente não encontrado ou já resolvido.\' USING ERRCODE=\'P0002\'; END IF;
          PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,\'incident_resolved\',\'incident\',v_uuid::text,\'{}\'::jsonb);
          RETURN jsonb_build_object(\'success\',true);
        END IF;

        RAISE EXCEPTION \'Ação administrativa da GSA TV não permitida.\' USING ERRCODE=\'42501\';
      END;
      \\$BODY\\$;
    \`);
    console.log("SUCCESSFULLY updated gsa_admin_gsa_tv_mutate with ai_flow_vids_generate!");
  } catch(e) {
    console.error("Error:", e.message);
  } finally {
    await pool.end();
  }
}
run();
'
`;
  const res = await runSshScript(script);
  console.log('STDOUT:\n', res.stdout);
}

updateMutateFunction().catch(console.error);
