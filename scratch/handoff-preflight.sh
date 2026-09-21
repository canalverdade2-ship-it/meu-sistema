set -eu
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --pull=never --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "SELECT id,desired_state,signal_state,playout_state FROM public.gsa_tv_channels; SELECT id,enabled FROM public.gsa_tv_graphics WHERE id='70faed0c-f6b5-4b01-b80f-493bdbda6708'; SELECT column_name FROM information_schema.columns WHERE table_name='gsa_tv_jobs' ORDER BY ordinal_position;"
sudo grep -nE 'flock|MIN_FREE|35|retain|KEEP|tar |gzip|mktemp|trap' /opt/gsa-tv/backup/gsa-tv-backup-full.sh | grep -viE 'password|token|secret|postgresql|authorization'
sudo find /opt/gsa-tv/backup -maxdepth 2 -type f -printf '%s %f\n' | sort -nr | head -n 10
