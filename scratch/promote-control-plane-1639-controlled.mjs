import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
compose=/opt/gsa-tv/control-plane/compose.yml
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
before=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -F '|' -c "select desired_state,playout_state,signal_state from public.gsa_tv_channels where id='ch-main'")
echo "before_state|$before"
case "$before" in running'|'*'|'sending) ;; *) exit 1;; esac
before_pid=$(sudo docker top gsa-tv-control-plane -eo pid,args | awk '/[f]fmpeg/{print $1;exit}')
echo "before_pid|$before_pid"
sudo cp "$compose" "$compose.before-1.6.39"

rollback() {
  echo 'ROLLBACK|starting' >&2
  sudo cp "$compose.before-1.6.39" "$compose"
  sudo docker compose -p control-plane --project-directory /opt/gsa-tv/control-plane -f "$compose" up -d --force-recreate >&2 || true
}
trap 'rc=$?; if [ "$rc" -ne 0 ]; then rollback; fi; exit "$rc"' EXIT

sudo sed -i -E 's#gsa-tv/control-plane:1\.6\.[0-9]+#gsa-tv/control-plane:1.6.39#' "$compose"
grep -q 'gsa-tv/control-plane:1.6.39' "$compose"
sudo docker compose -p control-plane --project-directory /opt/gsa-tv/control-plane -f "$compose" up -d --force-recreate

healthy=0
for i in $(seq 1 60); do
  if [ "$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}' 2>/dev/null || true)" = healthy ]; then healthy=1; break; fi
  sleep 1
done
test "$healthy" -eq 1

restored=0
for i in $(seq 1 60); do
  row=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -F '|' -c "select desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main'")
  case "$row" in
    running'|'program'|'sending'|') restored=1; break ;;
  esac
  sleep 1
done
echo "restored_state|$row"
test "$restored" -eq 1

encoder_count=$(sudo docker top gsa-tv-control-plane -eo pid,args | grep -c '[f]fmpeg' || true)
test "$encoder_count" -eq 1
new_pid=$(sudo docker top gsa-tv-control-plane -eo pid,args | awk '/[f]fmpeg/{print $1;exit}')
cmd=$(sudo docker top gsa-tv-control-plane -eo pid,args | grep '[f]fmpeg')
printf '%s' "$cmd" | grep -F 'zmq=bind_address=' >/dev/null
echo "program_pid|$new_pid"
echo "encoder_count|$encoder_count"

take_job=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','media_take','pending',0,'{\"media_item_id\":\"media-gsa-agora-nature-narrated-v1\",\"source\":\"post_1639_restore_media\"}'::jsonb) returning id")
take_row=''
for i in $(seq 1 45); do
  take_row=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -F '|' -c "select status,coalesce(error_message,'') from public.gsa_tv_jobs where id='$take_job'")
  case "$take_row" in completed'|'*) break;; failed'|'*) echo "$take_row"; exit 1;; esac
  sleep 1
done
case "$take_row" in completed'|'*) ;; *) echo "$take_row"; exit 1;; esac
for i in $(seq 1 30); do
  media_state=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -F '|' -c "select desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main'")
  case "$media_state" in running'|'media:media-gsa-agora-nature-narrated-v1'|'sending'|') break;; esac
  sleep 1
done
case "$media_state" in running'|'media:media-gsa-agora-nature-narrated-v1'|'sending'|') ;; *) echo "$media_state"; exit 1;; esac
new_pid=$(sudo docker top gsa-tv-control-plane -eo pid,args | awk '/[f]fmpeg/{print $1;exit}')
cmd=$(sudo docker top gsa-tv-control-plane -eo pid,args | grep '[f]fmpeg')
printf '%s' "$cmd" | grep -F 'zmq=bind_address=' >/dev/null
printf '%s' "$cmd" | grep -F 'media/1/gsa-agora-nature/render/gsa-agora-nature-narrated-v1.mp4' >/dev/null
echo "media_take|$take_row|$media_state"
echo "media_pid|$new_pid"

job=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','graphics_reload','pending',0,'{\"source\":\"post_1639_same_pid_proof\"}'::jsonb) returning id")
jobrow=''
for i in $(seq 1 30); do
  jobrow=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -F '|' -c "select status,coalesce(error_message,''),coalesce(result::text,'') from public.gsa_tv_jobs where id='$job'")
  case "$jobrow" in completed'|'*) break;; failed'|'*) echo "$jobrow"; exit 1;; esac
  sleep 1
done
case "$jobrow" in completed'|'*) ;; *) echo "$jobrow"; exit 1;; esac
after_reload_pid=$(sudo docker top gsa-tv-control-plane -eo pid,args | awk '/[f]fmpeg/{print $1;exit}')
test "$after_reload_pid" = "$new_pid"
echo "graphics_reload|$jobrow"
echo "same_pid_after_graphics_reload|$after_reload_pid"

sudo docker inspect gsa-tv-control-plane --format 'container|{{.Config.Image}}|{{.State.Status}}|{{.State.Health.Status}}'
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select 'channel',status,desired_state,playout_state,signal_state,coalesce(last_error,''),last_signal_at from public.gsa_tv_channels where id='ch-main'"
trap - EXIT
`;

const result = await runSshScript(script, 300000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
