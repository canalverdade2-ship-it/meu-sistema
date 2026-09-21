# ============================================================
# PREFLIGHT DE ISOLAMENTO -- GSA HUB Audit Suite
# Vers?o: 1.0 -- 2026-09-16
# Prop?sito: Garantir que NENHUM teste conecta em produ??o
# ============================================================

$ErrorActionPreference = "Stop"
$failures = @()

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " PREFLIGHT DE ISOLAMENTO -- GSA HUB AUDIT" -ForegroundColor Cyan  
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ----------------------------------------------------------
# 1. Verificar vari?veis de ambiente
# ----------------------------------------------------------
Write-Host "[1/6] Verificando vari?veis de ambiente..." -ForegroundColor Yellow

$supabaseUrl = $env:SUPABASE_URL
$supabaseKey = $env:SUPABASE_ANON_KEY
$supabaseServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY

# Verificar se aponta para produ??o
$prodIndicators = @(
  "supabase.co",
  "147.15.43.141",
  "app.supabase.com"
)

foreach ($indicator in $prodIndicators) {
  if ($supabaseUrl -match [regex]::Escape($indicator)) {
    $failures += "CRITICO: SUPABASE_URL aponta para producao: $($supabaseUrl -replace '(key=)[^&]+','$1[MASKED]')"
  }
}

# Verificar URL local esperada
$localIndicators = @("localhost", "127.0.0.1", "0.0.0.0")
$isLocal = $false
foreach ($local in $localIndicators) {
  if ($supabaseUrl -match $local) {
    $isLocal = $true
    break
  }
}

if (-not $isLocal -and $supabaseUrl) {
  $failures += "AVISO: SUPABASE_URL nao aponta para localhost/127.0.0.1. Valor: $(if($supabaseUrl){'[SET]'}else{'[NAO DEFINIDA]'})"
}

Write-Host "  SUPABASE_URL: $(if($isLocal){'[LOCAL OK]'}else{'[VERIFICAR]'})" -ForegroundColor $(if($isLocal){'Green'}else{'Yellow'})

# ----------------------------------------------------------
# 2. Verificar .env local vs produ??o
# ----------------------------------------------------------
Write-Host "[2/6] Verificando arquivos .env..." -ForegroundColor Yellow

$envFile = ".env"
$envLocalFile = ".env.local"

foreach ($ef in @($envFile, $envLocalFile)) {
  if (Test-Path $ef) {
    $content = Get-Content $ef -Raw
    foreach ($indicator in $prodIndicators) {
      if ($content -match [regex]::Escape($indicator)) {
        $failures += "CRITICO: Arquivo $ef contem referencia a producao ($indicator)"
      }
    }
    Write-Host "  $ef : Verificado" -ForegroundColor Green
  } else {
    Write-Host "  $ef : Nao encontrado (OK para ambiente de teste)" -ForegroundColor Gray
  }
}

# ----------------------------------------------------------
# 3. Verificar se Docker/Supabase local est? rodando
# ----------------------------------------------------------
Write-Host "[3/6] Verificando Supabase local..." -ForegroundColor Yellow

try {
  $supabaseStatus = & npx supabase status 2>&1
  if ($supabaseStatus -match "supabase local development setup is running") {
    Write-Host "  Supabase local: RODANDO" -ForegroundColor Green
  } elseif ($supabaseStatus -match "not running") {
    $failures += "BLOQUEIO: Supabase local nao esta rodando. Execute: supabase start"
  } else {
    Write-Host "  Supabase local: Status desconhecido" -ForegroundColor Yellow
    Write-Host "  Output: $($supabaseStatus | Select-Object -First 3)" -ForegroundColor Gray
  }
} catch {
  $failures += "BLOQUEIO: supabase CLI nao encontrado ou Docker indisponivel. Detalhes: $_"
}

# ----------------------------------------------------------
# 4. Testar conectividade local (deve funcionar)
# ----------------------------------------------------------
Write-Host "[4/6] Testando conectividade local..." -ForegroundColor Yellow

try {
  $localResponse = Invoke-WebRequest -Uri "http://localhost:54321/rest/v1/" -TimeoutSec 5 -ErrorAction SilentlyContinue
  if ($localResponse.StatusCode -eq 200 -or $localResponse.StatusCode -eq 400) {
    Write-Host "  Supabase local API: ACESSIVEL (HTTP $($localResponse.StatusCode))" -ForegroundColor Green
  }
} catch {
  Write-Host "  Supabase local API: Nao acessivel (pode ser normal se nao iniciado)" -ForegroundColor Yellow
}

# ----------------------------------------------------------
# 5. Verificar endpoints VPS de produ??o (N?O devem estar acess?veis pelos testes)
# ----------------------------------------------------------
Write-Host "[5/6] Verificando isolamento de producao..." -ForegroundColor Yellow

$prodEnvVars = @{
  "VITE_SUPABASE_URL"     = $env:VITE_SUPABASE_URL
  "NEXT_PUBLIC_SUPABASE_URL" = $env:NEXT_PUBLIC_SUPABASE_URL
}

foreach ($varName in $prodEnvVars.Keys) {
  $val = $prodEnvVars[$varName]
  if ($val) {
    foreach ($indicator in $prodIndicators) {
      if ($val -match [regex]::Escape($indicator)) {
        $failures += "CRITICO: $varName aponta para producao. Os testes usarao dados reais!"
      }
    }
  }
}

Write-Host "  Variaveis de frontend: Verificadas" -ForegroundColor Green

# ----------------------------------------------------------
# 6. Verificar playwright.config
# ----------------------------------------------------------
Write-Host "[6/6] Verificando playwright.config..." -ForegroundColor Yellow

if (Test-Path "playwright.config.ts") {
  $pwConfig = Get-Content "playwright.config.ts" -Raw
  if ($pwConfig -match "147\.15\.43\.141") {
    $failures += "CRITICO: playwright.config.ts aponta para VPS de producao (147.15.43.141)"
  }
  if ($pwConfig -match "localhost:3000" -or $pwConfig -match "localhost:5173") {
    Write-Host "  playwright.config.ts: Aponta para localhost (OK)" -ForegroundColor Green
  } else {
    Write-Host "  playwright.config.ts: URL base nao identificada claramente" -ForegroundColor Yellow
  }
}

# ----------------------------------------------------------
# RESULTADO FINAL
# ----------------------------------------------------------
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " RESULTADO DO PREFLIGHT" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if ($failures.Count -eq 0) {
  Write-Host " STATUS: PASSOU - Nenhuma conexao de producao detectada" -ForegroundColor Green
  Write-Host " Timestamp: $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')" -ForegroundColor Green
  Write-Host ""
  exit 0
} else {
  Write-Host " STATUS: FALHOU - $($failures.Count) problema(s) detectado(s):" -ForegroundColor Red
  foreach ($f in $failures) {
    Write-Host "  - $f" -ForegroundColor Red
  }
  Write-Host ""
  Write-Host " ABORTANDO: Os testes NAO podem prosseguir com conexoes de producao." -ForegroundColor Red
  exit 1
}

