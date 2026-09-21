docker exec gsa-tv-db psql -U postgres -d postgres -c "
SELECT id, title, duration_s, state, approval_state, rights_ok 
FROM gsa_tv_media_items 
WHERE id = 'media-auto-5ebef4b4-1681-48c4-9e01-319d9f6914bd';
"
docker exec gsa-tv-db psql -U postgres -d postgres -c "
SELECT id, name, media_item_id, planned_duration_s, start_time
FROM gsa_tv_schedule_blocks 
WHERE schedule_version_id = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef'
ORDER BY start_time;
"
