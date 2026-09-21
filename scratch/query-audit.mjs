import { runSshScript } from './ssh2-run.mjs';
const script = `
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' /opt/gsa-tv/control-plane/.env)
psql "$DB_URL" -X -P pager=off -c "
SELECT actor, action, resource_type, resource_id, details, created_at
FROM public.gsa_tv_audit_log
WHERE resource_id IN ('media-builder-news-0909', 'media-builder-hist-0909')
   OR details::text LIKE '%gsa-manha-news%'
ORDER BY created_at DESC
LIMIT 10;
"
`;
const res = await runSshScript(script, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
