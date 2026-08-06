#!/bin/bash
pkill -f server_webhook.js || true
pkill cloudflared || true
nohup /usr/bin/node /tmp/server_webhook.js > /tmp/webhook.log 2>&1 &
nohup /tmp/cloudflared tunnel --url http://localhost:5679 --no-autoupdate > /tmp/cloudflared.log 2>&1 &
echo "STARTED"
