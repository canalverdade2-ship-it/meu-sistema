sudo docker exec n8n n8n export:workflow --all --output=/tmp/wf_check.json
sudo docker exec n8n node -e 'console.log(JSON.parse(require("fs").readFileSync("/tmp/wf_check.json")).map(w => ({id: w.id, name: w.name, active: w.active})))'
