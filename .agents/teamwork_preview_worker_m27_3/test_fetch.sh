#!/usr/bin/env bash
docker exec -i gsa-tv-control-plane node -e "
(async () => {
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(5000)
    });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Body:', text.slice(0, 300));
  } catch(e) {
    console.error('Fetch error:', e.message);
  }
})();
"
