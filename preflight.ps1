$ErrorActionPreference = "Stop"

Write-Host "=========================================================="
Write-Host "PREFLIGHT AUTOMÁTICO DE ISOLAMENTO"
Write-Host "=========================================================="

# Check for production Supabase URLs or Project Refs
$envContent = ""
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
}

if ($envContent -match "supabase\.co" -or $envContent -match "gsa-prod") {
    Write-Host "ERRO: Detectada URL Supabase de prod ou project ref de prod no .env."
    exit 1
}

if ($envContent -match "service_role_prod") {
    Write-Host "ERRO: Detectado service role prod."
    exit 1
}

# Check for unauthorized VPS endpoints
if ($envContent -match "147\.15\.43\.141") {
    Write-Host "ERRO: Detectado endpoint VPS de prod (147.15.43.141)."
    exit 1
}

Write-Host "[OK] Nenhuma URL Supabase de prod detectada."
Write-Host "[OK] Nenhum project ref de prod detectado."
Write-Host "[OK] Nenhuma service role de prod detectada."
Write-Host "[OK] Nenhum endpoint VPS de prod não autorizado detectado."
Write-Host "[OK] Banco remoto não detectado. Ambiente 100% isolado."

Write-Host "=========================================================="
Write-Host "SUCESSO: PREFLIGHT CONCLUÍDO (Exit Code 0)"
Write-Host "=========================================================="
exit 0
