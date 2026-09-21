cat << 'EOF' > /home/opc/start_pgrst.sh
#!/bin/bash
sudo pkill -f postgrest
sudo bash -c "nohup /usr/local/bin/postgrest /etc/postgrest.conf > /tmp/postgrest.log 2>&1 &"
EOF
chmod +x /home/opc/start_pgrst.sh
/home/opc/start_pgrst.sh