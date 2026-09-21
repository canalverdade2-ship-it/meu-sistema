sudo sed -i '/proxy_pass http:\/\/127.0.0.1:3001;/a \            proxy_read_timeout 600s;\n            proxy_send_timeout 600s;' /etc/nginx/nginx.conf
sudo systemctl reload nginx