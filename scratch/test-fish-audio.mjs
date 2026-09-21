async function testFishAudio() {
  const apiKey = '__FISH_API_KEY_FROM_SECURE_VAULT__';
  
  console.log('Testing Fish Audio API with user key...');

  // Test 1: User info / models
  const endpoints = [
    'https://api.fish.audio/model',
    'https://api.fish.audio/v1/model',
    'https://api.fish.audio/wallet/self/api-credit',
    'https://api.fish.audio/v1/user/self',
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        }
      });
      console.log(`Endpoint ${ep} status:`, res.status);
      const data = await res.json().catch(() => null);
      if (data) {
        console.log(`Response from ${ep}:`, JSON.stringify(data, null, 2).slice(0, 500));
      }
    } catch (e) {
      console.log(`Error on ${ep}:`, e.message);
    }
  }
}

testFishAudio().catch(console.error);
