set -e
sudo -n cp -n /etc/nginx/nginx.conf /etc/nginx/nginx.conf.before-private-20260913
sudo -n python3 - <<'PY'
from pathlib import Path
p=Path('/etc/nginx/nginx.conf')
s=p.read_text()
marker='        # Static Uploads directory'
assert marker in s and 'location ^~ /uploads/private/' not in s
s=s.replace(marker,'''        location ^~ /uploads/private/ {
            proxy_pass http://127.0.0.1:9095;
            proxy_set_header Host $host;
            proxy_set_header Authorization $http_authorization;
            proxy_set_header X-Gsa-Session-Id $http_x_gsa_session_id;
            proxy_set_header X-Gsa-Session-Token $http_x_gsa_session_token;
            add_header Cache-Control "private, no-store" always;
        }

'''+marker)
p.write_text(s)
PY
sudo -n nginx -t
sudo -n nginx -s reload
curl -s -o /dev/null -w 'private anonymous HTTP %{http_code}\n' https://api.147-15-43-141.nip.io/uploads/private/client-docs/audit-placeholder.pdf
