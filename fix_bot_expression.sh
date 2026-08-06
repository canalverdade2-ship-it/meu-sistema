sudo docker exec n8n n8n export:workflow --id=axrrRfvSTGkcFvXo --output=/tmp/wf_bot.json
sudo docker exec n8n node -e '
const fs = require("fs");
const wfs = JSON.parse(fs.readFileSync("/tmp/wf_bot.json"));
const node = wfs[0].nodes.find(n => n.name === "Responder Cliente");
node.parameters.bodyParameters.parameters[1].value = "=\"?? Ol?! Eu sou o assistente virtual da GSA.\\n\\nRecebi sua mensagem: *\" + ($json.body.data.message?.conversation || $json.body.data.message?.extendedTextMessage?.text || \"mensagem\") + \"*\\n\\nSeu atendimento j? foi registrado no nosso sistema!\"";
fs.writeFileSync("/tmp/wf_bot.json", JSON.stringify(wfs, null, 2));
'
sudo docker exec n8n n8n import:workflow --input=/tmp/wf_bot.json
sudo docker exec n8n n8n publish:workflow --id=axrrRfvSTGkcFvXo
sudo docker restart n8n
