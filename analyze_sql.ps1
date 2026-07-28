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
            $report += "- **$filename:$($i+1)** - ALTO/MEDIO - Uso de `EXCEPTION WHEN OTHERS` genérico sem repasse do erro. Pode mascarar bugs críticos."
        }

        if ($line -match "(?i)SELECT\s+\*\s+FROM" -and $line -notmatch "jsonb_array_elements") {
            $report += "- **$filename:$($i+1)** - MEDIO - Uso de `SELECT *` ao invés de listar colunas explicitamente (Anti-padrão de manutenção)."
        }

        if ($line -match "(?i)CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_\.]+)") {
            $inFunc = $true
            $funcStart = $i
            $funcName = $matches[2]
        } elseif ($inFunc -and $line.Trim() -match "(?i)^END;\s*\$$") {
            $inFunc = $false
            $funcLen = $i - $funcStart
            if ($funcLen -gt 150) {
                $report += "- **$filename:$($funcStart+1)** - MEDIO - Função `` muito longa ($funcLen linhas). Deve ser refatorada para reduzir complexidade e melhorar manutenibilidade."
            }
        }
        
        if ($line -match "(?i)^\s*(created_at|updated_at|status)\s+[a-z]+" -and $line -notmatch "(?i)DEFAULT") {
             $report += "- **$filename:$($i+1)** - BAIXO - Coluna padrão (created_at/updated_at/status) sem DEFAULT."
        }
    }
}

$report | Out-File -FilePath 'audit_report.txt' -Encoding UTF8
