const fs = require('fs');
let content = fs.readFileSync('gsa-auth-session.ts', 'utf8');

const triggerCode = `
    if (body.action === 'trigger_webhook') {
      const webhookUrl = body.payload?.webhookUrl as string;
      const data = body.payload?.data as any;
      if (!webhookUrl) return json({ error: 'webhookUrl_required' }, 400, allowedOrigin);
      
      const targetUrl = webhookUrl.replace('localhost', '172.19.0.1').replace('127.0.0.1', '172.19.0.1');
      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const text = await response.text();
        return json({ success: true, status: response.status, data: text }, 200, allowedOrigin);
      } catch (err: any) {
        return json({ error: err.message }, 500, allowedOrigin);
      }
    }
`;

if (!content.includes('trigger_webhook')) {
  content = content.replace("if (body.action === 'process_partner_appeal_outbox') {", triggerCode + "\n    if (body.action === 'process_partner_appeal_outbox') {");
  fs.writeFileSync('gsa-auth-session.ts', content);
}