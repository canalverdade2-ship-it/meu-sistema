import { runSshScript } from './ssh2-run.mjs';

const url = "https://flow-content.google/video/7b6d2982-05f9-4ff1-bb50-4a00afbfaea6?Expires=1788859590&KeyName=labs-flow-prod-cdn-key&Signature=xzYl7O98WhbVT1jQrtk458aHGeE";
const res = await runSshScript(`curl -sI "${url}"`, 15000);
console.log(res.stdout);
