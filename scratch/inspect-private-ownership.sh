sudo -n nginx -T 2>/dev/null | head -25
sudo -n -u postgres psql -p 5433 -d gsahub -Atc "SELECT pg_get_functiondef('gsa_provision_auth_identity_internal(text,uuid,text,uuid)'::regprocedure);" | grep -n -A 12 -B 3 'metadata'
find /var/www/uploads/private -type f | awk -F/ '{print $6, $7 ~ /^[0-9a-f-]{36}$/ ? "uuid-owner" : "other"}' | sort | uniq -c
