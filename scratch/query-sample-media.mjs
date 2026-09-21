import { runSshScript } from './ssh2-run.mjs';
const script = `
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' /opt/gsa-tv/control-plane/.env)
psql "$DB_URL" -X -P pager=off -c "
SELECT id, title, original_filename, duration_s, state, approval_state, rights_ok, drive_path, metadata
FROM public.gsa_tv_media_items
WHERE id IN ('media-builder-news-0909', 'media-builder-hist-0909');
"
`;
const res = await runSshScript(script, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
