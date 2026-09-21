sudo -n nginx -T 2>/dev/null | grep -n -A 12 -B 3 '/uploads'
find /var/www/uploads -mindepth 1 -maxdepth 2 -type d | head -60
