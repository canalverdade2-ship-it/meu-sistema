import { runSshScript } from './ssh2-run.mjs';

const script = `
set -e
echo "=== STEP 2: PERSISTENCE IN COMPOSE.YML FILES ==="

# 1. /opt/gsa-tv/encoder-engine/compose.yml
sudo cp /opt/gsa-tv/encoder-engine/compose.yml /opt/gsa-tv/encoder-engine/compose.yml.bak
cat << 'EOF' | sudo tee /opt/gsa-tv/encoder-engine/compose.yml > /dev/null
services:
  encoder-engine:
    image: gsa-tv/encoder-engine:1.2.2
    container_name: gsa-tv-encoder-engine
    restart: unless-stopped
    network_mode: host
    env_file: /opt/gsa-tv/control-plane/.env
    environment:
      ENCODER_ENGINE_PORT: "9210"
    cpuset: "0,1,2"
    cpu_shares: 2048
    mem_reservation: 1g
    mem_limit: 3g
    read_only: true
    tmpfs:
      - /tmp:size=64m,mode=1777
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    volumes:
      - /opt/gsa-tv/cache/media:/media:ro
      - /opt/gsa-tv/fallback:/fallback:ro
      - /opt/gsa-tv/preview:/preview:ro
      - /opt/gsa-tv/runtime:/runtime
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "5"
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://127.0.0.1:9210/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]
      interval: 15s
      timeout: 3s
      retries: 3
EOF

# 2. /opt/gsa-tv/compose/compose.yml (ffplayout)
sudo cp /opt/gsa-tv/compose/compose.yml /opt/gsa-tv/compose/compose.yml.bak
cat << 'EOF' | sudo tee /opt/gsa-tv/compose/compose.yml > /dev/null
services:
  ffplayout:
    image: gsa-tv/ffplayout:2.1.0-arm64
    container_name: gsa-tv-ffplayout
    restart: unless-stopped
    command:
      - --db
      - /state/ffplayout.db
      - --listen
      - 0.0.0.0:8787
      - --log-to-console
      - --log-timestamp
    ports:
      - 127.0.0.1:8787:8787
    read_only: true
    tmpfs:
      - /tmp:size=256m,mode=1777
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cpuset: "0,1"
    cpus: 1.5
    cpu_shares: 1024
    mem_reservation: 1g
    mem_limit: 3g
    stop_grace_period: 30s
    volumes:
      - /opt/gsa-tv/config/ffplayout:/state
      - /opt/gsa-tv/playlists:/playlists
      - /opt/gsa-tv/cache/media:/media
      - /opt/gsa-tv/fallback:/fallback:ro
      - /opt/gsa-tv/preview:/public
      - /opt/gsa-tv/logs:/logs
      - /opt/gsa-tv/backups/ffplayout:/backups
    healthcheck:
      test: ["CMD", "curl", "--fail", "--silent", "--show-error", "http://127.0.0.1:8787/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "5"
    networks:
      - gsa-tv-net

networks:
  gsa-tv-net:
    external: true
EOF

# 3. /opt/gsa-tv/control-plane/compose.yml
sudo cp /opt/gsa-tv/control-plane/compose.yml /opt/gsa-tv/control-plane/compose.yml.bak
cat << 'EOF' | sudo tee /opt/gsa-tv/control-plane/compose.yml > /dev/null
services:
  control-plane:
    image: gsa-tv/control-plane:1.8.7
    container_name: gsa-tv-control-plane
    restart: unless-stopped
    network_mode: host
    env_file: .env
    environment:
      ENCODER_ENGINE_URL: http://127.0.0.1:9210
    cpuset: "0,1,2"
    cpu_shares: 512
    mem_reservation: 256m
    mem_limit: 1g
    read_only: true
    tmpfs:
      - /tmp:size=64m,mode=1777
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    volumes:
      - /opt/gsa-tv/playlists:/playlists
      - /opt/gsa-tv/cache/media:/media
      - /opt/gsa-tv/fallback:/fallback:ro
      - /opt/gsa-tv/preview:/preview:ro
      - /opt/gsa-tv/runtime:/runtime
      - /opt/gsa-tv/control-plane/secrets/ffplayout-admin-password:/run/secrets/ffplayout-admin-password:ro
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "5"
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://127.0.0.1:9202/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
EOF

# 4. /opt/gsa-tv/watchdog/compose.yml
sudo cp /opt/gsa-tv/watchdog/compose.yml /opt/gsa-tv/watchdog/compose.yml.bak
cat << 'EOF' | sudo tee /opt/gsa-tv/watchdog/compose.yml > /dev/null
services:
  watchdog:
    image: gsa-tv/watchdog:1.3.0
    container_name: gsa-tv-watchdog
    restart: unless-stopped
    network_mode: host
    env_file: .env
    environment:
      ENCODER_ENGINE_URL: http://127.0.0.1:9210
      FINAL_HLS_FILE: /runtime/hls/program.m3u8
    cpuset: "0,1,2"
    cpu_shares: 512
    mem_reservation: 256m
    mem_limit: 1g
    read_only: true
    tmpfs:
      - /tmp:size=64m,mode=1777
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    volumes:
      - /opt/gsa-tv/preview:/preview:ro
      - /opt/gsa-tv/runtime:/runtime:ro
      - /opt/gsa-tv/watchdog/secrets/ffplayout-admin-password:/run/secrets/ffplayout-admin-password:ro
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "5"
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://127.0.0.1:9204/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
EOF

# 5. /home/opc/gsa-ai/compose.yml
cp /home/opc/gsa-ai/compose.yml /home/opc/gsa-ai/compose.yml.bak
cat << 'EOF' > /home/opc/gsa-ai/compose.yml
services:
  gsa-ai-browser:
    build: .
    container_name: gsa-ai-browser
    restart: unless-stopped
    cpuset: "3"
    cpus: 1.0
    cpu_shares: 128
    mem_limit: 3.5g
    shm_size: 2gb
    ports:
      - "127.0.0.1:6088:6080"
      - "127.0.0.1:9228:9223"
    volumes:
      - ./data/profile:/data/profile
      - ./data/downloads:/data/downloads
    security_opt:
      - no-new-privileges:true
EOF

echo "=== VALIDATING COMPOSE SYNTAX VIA DOCKER COMPOSE CONFIG ==="
(cd /opt/gsa-tv/encoder-engine && sudo docker compose config > /dev/null && echo "encoder-engine: OK")
(cd /opt/gsa-tv/compose && sudo docker compose config > /dev/null && echo "ffplayout: OK")
(cd /opt/gsa-tv/control-plane && sudo docker compose config > /dev/null && echo "control-plane: OK")
(cd /opt/gsa-tv/watchdog && sudo docker compose config > /dev/null && echo "watchdog: OK")
(cd /home/opc/gsa-ai && sudo docker compose config > /dev/null && echo "gsa-ai: OK")

echo "=== STEP 2 COMPLETED SUCCESSFULLY ==="
`;

const res = await runSshScript(script);
console.log(res.stdout);
if (res.stderr) console.error("STDERR:", res.stderr);
