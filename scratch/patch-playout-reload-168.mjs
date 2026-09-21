import fs from 'node:fs';
const p='infrastructure/gsa-tv/services/playout-api/src/app.js';
let s=fs.readFileSync(p,'utf8');
const old=`    case "playout_reload": {\n      const compiled = await compilePlaylist();\n      if (streamState.desired === "running")\n        await startStream(streamState.mode || "program", true);\n      return compiled;\n    }`;
const neu=`    case "playout_reload": {\n      const compiled = await compilePlaylist();\n      await ffplayoutProcess("restart");\n      await waitForHls();\n      if (streamState.desired === "running") await startStream(streamState.mode || "program", true);\n      return { ...compiled, ffplayout_restarted: true };\n    }`;
if(!s.includes(old)) throw new Error('playout_reload block not found');
s=s.replace(old,neu);fs.writeFileSync(p,s);console.log('patched playout_reload');
