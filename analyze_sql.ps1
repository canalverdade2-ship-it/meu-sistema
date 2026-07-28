$directory = 'c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\supabase\migrations'
$files = Get-ChildItem -Path $directory -Filter *.sql | Sort-Object Name -Descending | Select-Object -First 20

Write-Host "Analisando $($files.Count) arquivos..."
$report = @()

foreach ($file in $files) {
    $lines = Get-Content $file.FullName
    $filename = $file.Name

    $inFunc = $false
    $funcStart = 0
    $funcName = ""

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]

        if ($line -match "(?i)EXCEPTION\s+WHEN\s+OTHERS") {
            $report += "- **:** - CRÍTICO/ALTO - Uso de `EXCEPTION WHEN OTHERS` genérico sem repasse do erro. Mascara falhas graves e pode corromper regras de negócio."
        }

        if ($line -match "(?i)SELECT\s+\*\s+FROM" -and $line -notmatch "jsonb_array_elements") {
            $report += "- **:** - MÉDIO/BAIXO - Uso de `SELECT *` ao invés de projetar as colunas (Anti-padrão de manutenção, pode quebrar views/funções)."
        }

        if ($line -match "(?i)CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_\.]+)") {
            $inFunc = $true
            $funcStart = $i
            $funcName = $matches[2]
        } elseif ($inFunc -and $line.Trim() -match "(?i)^END;\s*\$$") {
            $inFunc = $false
            $funcLen = $i - $funcStart
            if ($funcLen -gt 150) {
                $report += "- **:** - MÉDIO - Função `` muito longa ($funcLen linhas). Aumenta risco de falhas de lógica e dificulta a manutenção."
            }
        }
        
        if ($line -match "(?i)^\s*(created_at|updated_at|status)\s+[a-z]+" -and $line -notmatch "(?i)DEFAULT") {
             $report += "- **:** - BAIXO - Coluna padrão (created_at/updated_at/status) sem DEFAULT."
        }
        
        if ($line -match "(?i)CREATE\s+TRIGGER" -and $line -notmatch "(?i)FOR\s+EACH\s+STATEMENT") {
            # triggers review
            $report += "- **:** - MÉDIO - Trigger identificado. Revisar se causa lentidão ou poderia ser substituído por operações em lote (Verificar índices associados às funções trigger)."
        }
    }
}

$report | Out-File -FilePath 'audit_report.txt' -Encoding UTF8
