import { Client } from 'ssh2';
import { readInfraKey, runSshScript } from './ssh2-run.mjs';

const files = {
  '/home/opc/cp-compose-1.8.0.yml': `services:
  control-plane:
    image: gsa-tv/control-plane:1.8.0
    container_name: gsa-tv-control-plane
    restart: unless-stopped
    network_mode: host
    env_file: .env
    environment:
      ENCODER_ENGINE_URL: http://127.0.0.1:9210
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
`,
  '/home/opc/watchdog-compose-1.3.0.yml': `services:
  watchdog:
    image: gsa-tv/watchdog:1.3.0
    container_name: gsa-tv-watchdog
    restart: unless-stopped
    network_mode: host
    env_file: .env
    environment:
      ENCODER_ENGINE_URL: http://127.0.0.1:9210
      FINAL_HLS_FILE: /runtime/hls/program.m3u8
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
`,
};
const conn = new Client();
await new Promise((resolve, reject) => { conn.on('ready', resolve); conn.on('error', reject); conn.connect({host:'147.15.43.141',port:22,username:'opc',privateKey:readInfraKey(),readyTimeout:15000}); });
const sftp = await new Promise((resolve,reject)=>conn.sftp((e,s)=>e?reject(e):resolve(s)));
for (const [path,data] of Object.entries(files)) await new Promise((resolve,reject)=>{ const w=sftp.createWriteStream(path,{flags:'w',mode:0o600}); w.on('close',resolve); w.on('error',reject); w.end(data); });
conn.end();
await new Promise(resolve=>setTimeout(resolve,500));
await runSshScript("sudo install -o opc -g opc -m 0644 /home/opc/cp-compose-1.8.0.yml /opt/gsa-tv/control-plane/compose.yml\nsudo install -o opc -g opc -m 0644 /home/opc/watchdog-compose-1.3.0.yml /opt/gsa-tv/watchdog/compose.yml\nrm -f /home/opc/cp-compose-1.8.0.yml /home/opc/watchdog-compose-1.3.0.yml\n",60000);
process.stdout.write('prepared\n');
