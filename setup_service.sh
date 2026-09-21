cat << 'EOF' > /home/opc/shopee_webhook_server.py
import http.server, socketserver, subprocess, json, threading

PORT = 5688

class Handler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        try:
            payload = json.loads(post_data.decode('utf-8'))
            auto_id = payload.get('id')
            if auto_id:
                threading.Thread(target=lambda: subprocess.run(['python3', '/home/opc/worker_shopee_sync.py', auto_id])).start()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'{"message":"Worker iniciado em background"}')
                return
        except Exception as e:
            print('Erro no webhook:', e)
            
        self.send_response(400)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(b'{"error":"Payload invalido"}')
        
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

with socketserver.TCPServer(('0.0.0.0', PORT), Handler) as httpd:
    print(f'Servidor Webhook Shopee rodando na porta {PORT}')
    httpd.serve_forever()
EOF

# Mata qualquer processo anterior na porta 5688
sudo fuser -k 5688/tcp || true

# Cria serviço systemd para ficar sempre rodando e estável
sudo bash -c 'cat << "SERVICEOF" > /etc/systemd/system/shopee-scraping.service
[Unit]
Description=GSA Shopee Scraping Worker Service
After=network.target

[Service]
Type=simple
User=opc
ExecStart=/usr/bin/python3 /home/opc/shopee_webhook_server.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
SERVICEOF'

sudo systemctl daemon-reload
sudo systemctl enable shopee-scraping
sudo systemctl restart shopee-scraping
sudo systemctl status shopee-scraping --no-pager