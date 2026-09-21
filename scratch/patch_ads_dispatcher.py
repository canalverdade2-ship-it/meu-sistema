from pathlib import Path

root = Path(r"C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)")
p = root / "gsa-auth-session.ts"
s = p.read_text(encoding="utf-8")
old = "import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';"
new = old + "\nimport { handleRequest as handleAdsPublic } from './gsa-ads-public.ts';\nimport { handleRequest as handleAdsAdmin } from './gsa-ads-admin.ts';"
if "handleAdsPublic" not in s:
    assert old in s
    s = s.replace(old, new, 1)
marker = "export async function handleRequest(request: Request) {\n  const endpointPath = new URL(request.url).pathname;"
replacement = marker + "\n  if (endpointPath.endsWith('/gsa-ads-public')) return handleAdsPublic(request);\n  if (endpointPath.endsWith('/gsa-ads-admin')) return handleAdsAdmin(request);"
if "endpointPath.endsWith('/gsa-ads-public')" not in s:
    assert marker in s
    s = s.replace(marker, replacement, 1)
p.write_text(s, encoding="utf-8", newline="\n")
print("dispatcher patched")
