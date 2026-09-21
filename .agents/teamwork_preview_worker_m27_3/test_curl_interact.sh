#!/usr/bin/env bash
docker exec -i gsa-tv-control-plane curl -i -s -X POST https://generativelanguage.googleapis.com/v1beta/interactions -H "Content-Type: application/json" -d '{}'
