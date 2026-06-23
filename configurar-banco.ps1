$env:PGHOST = "localhost"
$env:PGPORT = "5432"
$env:PGDATABASE = "meu_sistema"
$env:PGUSER = "postgres"
$env:PGPASSWORD = Read-Host "Senha do PostgreSQL"

Write-Host "Testando conexão..."
node check-db.js

if ($LASTEXITCODE -eq 0) {
    Get-CimInstance Win32_Process |
        Where-Object { $_.Name -eq "node.exe" -and $_.CommandLine -match "server.js" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
    Write-Host "Iniciando dashboard em http://localhost:4173/"
    node server.js
}
