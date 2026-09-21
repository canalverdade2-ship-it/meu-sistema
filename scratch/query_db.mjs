import { runSshScript } from './ssh2-run.mjs';

async function main() {
  try {
    const res = await runSshScript(`
cat << 'EOF' > /tmp/query.sh
#!/bin/bash
DURATION_S=$(cat /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-02-v2/qc/duration.txt 2>/dev/null | awk '{print int($1 + 0.5)}')
if [ -z "$DURATION_S" ]; then DURATION_S=360; fi

sudo -u postgres /usr/pgsql-15/bin/psql -d gsahub -p 5433 -c "
INSERT INTO public.gsa_tv_media_items 
(id, channel_id, title, original_filename, duration_s, state, rights_ok, drive_path)
VALUES (
    'media-gsa-news-2026-09-02-v2-final', 
    'ch-main', 
    'GSA News - 02/09/2026 (V2)', 
    'gsa-news-2026-09-02-v2-final.mp4', 
    $DURATION_S, 
    'ready', 
    true, 
    '/media/1/news/gsa-news-2026-09-02-v2/video/gsa-news-2026-09-02-v2-final.mp4'
) ON CONFLICT (id) DO UPDATE SET duration_s = EXCLUDED.duration_s;
"

sudo -u postgres /usr/pgsql-15/bin/psql -d gsahub -p 5433 -c "
INSERT INTO public.gsa_tv_jobs(channel_id, job_type, status, progress, payload)
VALUES('ch-main', 'media_take', 'pending', 0,
jsonb_build_object('media_item_id', 'media-gsa-news-2026-09-02-v2-final'));
"
EOF

chmod +x /tmp/query.sh
sudo /tmp/query.sh
    `, 60000);
    console.log(res.stdout);
    if (res.stderr) console.error(res.stderr);
  } catch (err) {
    console.error(err);
  }
}

main();
