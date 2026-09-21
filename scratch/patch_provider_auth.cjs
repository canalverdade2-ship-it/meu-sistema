const fs = require('fs');
const p = 'supabase/functions/gsa-auth-session/index.ts';
let s = fs.readFileSync(p, 'utf8');
const oldText = "  | 'complete_client_recovery';\r\n  | 'request_provider_registration_code'";
const newText = "  | 'complete_client_recovery'\r\n  | 'request_provider_registration_code'";
if (!s.includes(oldText)) throw new Error('auth union anchor not found');
s = s.replace(oldText, newText);
fs.writeFileSync(p, s, 'utf8');
console.log('provider auth union fixed');