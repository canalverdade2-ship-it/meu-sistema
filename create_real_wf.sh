cat << 'WORKFLOW_EOF' > /tmp/real_scraping_wf.json
{
  "id": "AAAABBBBCCCCDDDD",
  "name": "Scraping Shopee (Real)",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "gsa-produtos-scraping",
        "options": { "rawBody": false },
        "responseMode": "onReceived"
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300],
      "webhookId": "gsa-produtos-scraping"
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "const https = require('https');\nconst http = require('http');\n\nconst body = $input.first().json.body || $input.first().json;\nconst autoId = body.id;\nconst targetUrl = body.target_url;\nconst margemLucro = body.margem_lucro || 100;\n\nconst SUPABASE_URL = 'https://api.147-15-43-141.nip.io';\nconst SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs';\nconst SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzM5NTY0MDksImV4cCI6MjA4OTUzMjQwOX0.08mVk0H6sqdVU-pMuynZNaXHjH2U9gr_F99poHvtqno';\n\nasync function postLog(passo, status, mensagem, progresso) {\n  const data = JSON.stringify({ automacao_id: autoId, passo, status, mensagem, progresso });\n  return new Promise((resolve) => {\n    const req = https.request(SUPABASE_URL + '/rest/v1/automacao_scraping_logs', {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY, 'Prefer': 'return=minimal' },\n      rejectUnauthorized: false\n    }, (res) => { res.on('data', () => {}); res.on('end', resolve); });\n    req.on('error', () => resolve());\n    req.write(data);\n    req.end();\n  });\n}\n\nasync function downloadCSV(url) {\n  return new Promise((resolve, reject) => {\n    https.get(url, { rejectUnauthorized: false }, (res) => {\n      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {\n        return downloadCSV(res.headers.location).then(resolve).catch(reject);\n      }\n      let data = '';\n      res.on('data', (chunk) => data += chunk);\n      res.on('end', () => resolve(data));\n    }).on('error', reject);\n  });\n}\n\nfunction parseCSV(csvText) {\n  const lines = csvText.split('\\n');\n  const header = lines[0].replace(/^\\uFEFF/, '').split(',');\n  const results = [];\n  for (let i = 1; i < lines.length; i++) {\n    if (!lines[i].trim()) continue;\n    const values = [];\n    let current = '', inQuotes = false;\n    for (const ch of lines[i]) {\n      if (ch === '\"') { inQuotes = !inQuotes; }\n      else if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; }\n      else { current += ch; }\n    }\n    values.push(current.trim());\n    const obj = {};\n    header.forEach((h, idx) => obj[h.trim()] = values[idx] || '');\n    results.push(obj);\n  }\n  return results;\n}\n\ntry {\n  await postLog('requisicao', 'executando', '\\ud83d\\udfe0 Motor Shopee Feed CSV: Baixando cat\\u00e1logo de afiliados...', 20);\n  \n  const csvText = await downloadCSV(targetUrl);\n  const products = parseCSV(csvText);\n  const total = products.length;\n  \n  await postLog('processamento', 'executando', `CSV baixado com sucesso. ${total} produtos encontrados. Iniciando import...`, 40);\n  \n  let novos = 0, atualizados = 0, erros = 0;\n  const BATCH = 200;\n  \n  for (let i = 0; i < total; i += BATCH) {\n    const batch = products.slice(i, i + BATCH);\n    const rows = batch.map(p => {\n      const custoRaw = parseFloat(p.sale_price || p.price) || 0;\n      const custo = Math.round(custoRaw * 100) / 100;\n      const venda = Math.round(custo * (1 + margemLucro / 100) * 100) / 100;\n      return {\n        codigo_produto: 'SHOPEE_' + (p.itemid || ''),\n        nome: (p.title || 'Sem nome').substring(0, 500),\n        descricao: (p.description || '').substring(0, 5000),\n        valor_custo: custo,\n        valor: venda,\n        porcentagem_lucro: margemLucro,\n        imagem_url: p.image_link || '',\n        imagem_url_2: p.image_link_3 || '',\n        categoria: p.global_category1 || '',\n        visivel_na_loja: true,\n        status: 'ativo',\n        tipo_cliente: 'pf',\n        avaliacao_media: Math.min(parseFloat(p.item_rating) || 0, 5),\n        identificador_preferencial: 'interno'\n      };\n    }).filter(r => r.valor > 0 && r.nome !== 'Sem nome');\n    \n    const upsertData = JSON.stringify(rows);\n    await new Promise((resolve) => {\n      const req = https.request(SUPABASE_URL + '/rest/v1/produtos', {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n          'apikey': SERVICE_KEY,\n          'Authorization': 'Bearer ' + SERVICE_KEY,\n          'Prefer': 'resolution=merge-duplicates,return=minimal'\n        },\n        rejectUnauthorized: false\n      }, (res) => {\n        res.on('data', () => {});\n        res.on('end', () => {\n          if (res.statusCode < 300) novos += rows.length;\n          else erros += rows.length;\n          resolve();\n        });\n      });\n      req.on('error', () => { erros += rows.length; resolve(); });\n      req.write(upsertData);\n      req.end();\n    });\n    \n    const progresso = Math.min(40 + Math.round((i / total) * 55), 95);\n    if (i % (BATCH * 5) === 0) {\n      await postLog('processamento', 'executando', `Processando lote de produtos (${Math.min(i + BATCH, total)} / ${total})...`, progresso);\n    }\n  }\n  \n  await postLog('concluido', 'sucesso', `Sincroniza\\u00e7\\u00e3o 100% conclu\\u00edda com sucesso! ${novos} novo(s) e ${atualizados} atualizado(s) no cat\\u00e1logo da loja com a margem de ${margemLucro}%.`, 100);\n  \n  return [{ json: { success: true, novos, atualizados, erros, total } }];\n} catch (err) {\n  await postLog('erro', 'erro', 'Falha no scraping: ' + err.message, 0);\n  return [{ json: { success: false, error: err.message } }];\n}"
      },
      "name": "Scraping Engine",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [550, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "Scraping Engine",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": true,
  "settings": {
    "executionOrder": "v1",
    "saveDataErrorExecution": "all",
    "saveDataSuccessExecution": "all",
    "executionTimeout": 600
  }
}
WORKFLOW_EOF
echo "=== JSON criado ==="
cat /tmp/real_scraping_wf.json | python3 -m json.tool > /dev/null 2>&1 && echo "JSON VALID" || echo "JSON INVALID"