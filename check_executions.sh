sudo docker exec n8n node -e '
const fs = require("fs");
const executions = JSON.parse(fs.readFileSync("/tmp/wf_check.json"));
console.log(JSON.stringify(executions, null, 2).slice(0, 1000));
'
