docker exec -i gsa-tv-control-plane cat /opt/gsa-tv/bin/night-production.py | grep -n -C 15 "media_issue" || true
