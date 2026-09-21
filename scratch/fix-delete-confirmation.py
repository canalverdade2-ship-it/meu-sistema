from pathlib import Path
p=Path('src/lib/r2Storage.ts')
s=p.read_text(encoding='utf-8')
a=s.index('  const realPaths = normalized.filter')
b=s.index('\n}\n', a)
s=s[:a]+'''  const headers = await getAuthHeaders();
  headers['Content-Type'] = 'application/json';

  // Both backends can retain a copy after a fallback or migration.
  // Do not report deletion until each backend confirms it.
  const results = await Promise.allSettled(
    [VPS_API_URL, R2_WORKER_URL].map(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/delete`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ paths: normalized }),
      });
      const result = await response.json() as { success?: boolean };
      if (!response.ok || result.success !== true) {
        throw new Error('O armazenamento não confirmou a exclusão.');
      }
    }),
  );
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('Não foi possível confirmar a exclusão em todos os armazenamentos. Tente novamente.');
  }'''+s[b:]
p.write_text(s,encoding='utf-8')
