import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
BASE='https://api.147-15-43-141.nip.io/gsa-tv'
echo '=== UNAUTHENTICATED EXTERNAL ROUTES ==='
for spec in 'GET /health' 'GET /status' 'PUT /preview/token' 'GET /live-console/snapshot' 'GET /preview/program.m3u8' 'GET /media/no-such-id/preview/token'; do
  method=$(echo "$spec" | cut -d' ' -f1); path=$(echo "$spec" | cut -d' ' -f2)
  tmp=$(mktemp)
  code=$(curl -ksS --max-time 12 -X "$method" -o "$tmp" -w '%{http_code}' "$BASE$path" || true)
  size=$(wc -c < "$tmp")
  ctype=$(curl -ksSI --max-time 8 "$BASE$path" 2>/dev/null | awk -F': ' 'tolower($1)=="content-type"{gsub(/\r/,"",$2);print $2;exit}')
  echo "$method|$path|status=$code|bytes=$size|type=$ctype"
  rm -f "$tmp"
done
echo '=== CORS/SECURITY HEADERS ==='
curl -ksSI --max-time 12 -H 'Origin: https://evil.example' "$BASE/health" | grep -Ei 'HTTP/|access-control|strict-transport|content-security|x-content|x-frame|referrer|server:' || true
echo '=== NGINX ROUTING CONFIG (NO SECRETS) ==='
sudo nginx -T 2>/dev/null | grep -nE 'server_name|location .*gsa-tv|proxy_pass.*9202|alias.*/opt/gsa-tv|client_max_body_size|proxy_read_timeout' | head -n 240
echo '=== FIREWALL/SELINUX ==='
getenforce 2>/dev/null || true
sudo firewall-cmd --state 2>/dev/null || true
sudo firewall-cmd --list-all 2>/dev/null || true
echo '=== FILE PERMISSIONS FOR CONFIG/SECRETS ==='
sudo find /opt/gsa-tv -maxdepth 3 -type f -printf '%m %u:%g %s %p\n' 2>/dev/null | grep -E '/\.env$|/secrets/|state.*\.json$' | sort
echo '=== WORLD WRITABLE GSA FILES ==='
sudo find /opt/gsa-tv -xdev -type f -perm -0002 -printf '%m %u:%g %s %p\n' 2>/dev/null | head -n 100
echo '=== LISTENERS ON FIREWALL-OPEN PORTS ==='
sudo ss -lntp | grep -E ':(5680|6379|8080|3001|9999|4000|5000)\\b' || true
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
