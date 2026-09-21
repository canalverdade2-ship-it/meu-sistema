import { runSshScript } from './ssh2-run.mjs';

async function createRecentAiJobsRpc() {
  const sql = `
CREATE OR REPLACE FUNCTION public.gsa_tv_get_recent_ai_jobs()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $BODY$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'preset_id', payload->>'preset_id',
        'title', COALESCE(payload->>'title', 'Edição GSA TV'),
        'status', status,
        'progress', COALESCE(progress, 0),
        'current_stage', COALESCE(current_stage, ''),
        'created_at', created_at,
        'finished_at', finished_at,
        'error_message', error_message
      )
      ORDER BY created_at DESC
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT DISTINCT ON (payload->>'preset_id') *
    FROM public.gsa_tv_jobs
    WHERE job_type = 'ai_flow_vids_generate'
      AND payload->>'preset_id' IS NOT NULL
      AND created_at > now() - interval '24 hours'
    ORDER BY payload->>'preset_id', created_at DESC
  ) sub;
$BODY$;

GRANT EXECUTE ON FUNCTION public.gsa_tv_get_recent_ai_jobs() TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
`;

  const script = `
cat << 'EOSQL' > /tmp/create_recent_ai_jobs.sql
${sql}
EOSQL

psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -f /tmp/create_recent_ai_jobs.sql
rm -f /tmp/create_recent_ai_jobs.sql
`;

  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout, res.stderr);
}

createRecentAiJobsRpc().catch(console.error);
