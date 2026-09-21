import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
echo '=== HOST ==='
date -Ins; uptime; uname -a
free -h; swapon --show --bytes
df -hT / /var/lib/docker /opt/gsa-tv 2>/dev/null; df -ih / /var/lib/docker /opt/gsa-tv 2>/dev/null
vmstat 1 5
echo '=== KERNEL NETWORK/IO ERRORS ==='
nstat -az 2>/dev/null | grep -E 'TcpRetransSegs|TcpExtTCPTimeouts|Udp(InErrors|RcvbufErrors|SndbufErrors)|IpInDiscards' || true
sudo dmesg --level=err,warn --since '48 hours ago' 2>/dev/null | tail -n 120 || true
echo '=== DOCKER RESOURCES ==='
sudo docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}|{{.BlockIO}}|{{.PIDs}}' | sort
echo '=== GSA CONTAINER HARDENING/MOUNTS ==='
for c in gsa-tv-control-plane gsa-tv-encoder-engine gsa-tv-watchdog gsa-tv-ffplayout gsa-tv-playlist-compiler gsa-tv-media-worker gsa-tv-cache-manager; do
  sudo docker inspect "$c" --format '{{.Name}}|image={{.Config.Image}}|restart={{.HostConfig.RestartPolicy.Name}}|readonly={{.HostConfig.ReadonlyRootfs}}|privileged={{.HostConfig.Privileged}}|user={{.Config.User}}|oom={{.State.OOMKilled}}|restarts={{.RestartCount}}|health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|mem={{.HostConfig.Memory}}|cpus={{.HostConfig.NanoCpus}}|pids={{.HostConfig.PidsLimit}}|log={{.HostConfig.LogConfig.Type}}:{{json .HostConfig.LogConfig.Config}}' 2>/dev/null || true
  sudo docker inspect "$c" --format '{{range .Mounts}}{{$.Name}}|mount={{.Type}}:{{.Source}}=>{{.Destination}} rw={{.RW}}{{println}}{{end}}' 2>/dev/null || true
done
echo '=== LOG FILE SIZES ==='
sudo find /var/lib/docker/containers -maxdepth 2 -name '*-json.log' -printf '%s %p\n' 2>/dev/null | sort -nr | head -n 30
echo '=== PROCESSES/ZOMBIES ==='
ps -eo stat,pid,ppid,user,etimes,pcpu,pmem,rss,comm --sort=-pcpu | head -n 40
ps -eo stat,pid,ppid,user,etimes,comm | awk '$1 ~ /^Z/ {print}' | head -n 50
echo '=== EXTERNAL LISTENERS ==='
sudo ss -lntup | awk '$5 !~ /127.0.0.1|\[::1\]/ {print}' | head -n 160
echo '=== RTMP/HLS LIVE ASSERTIONS ==='
curl -fsS http://127.0.0.1:9210/health; echo
date +%s; sudo stat -c '%Y %s %n' /opt/gsa-tv/runtime/hls/program.m3u8
sudo find /opt/gsa-tv/runtime/hls -maxdepth 1 -type f -name 'program_*.ts' -mmin -1 | wc -l
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
