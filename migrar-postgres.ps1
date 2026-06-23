$env:PGHOST = "localhost"
$env:PGPORT = "5432"
$env:PGDATABASE = "meu_sistema"
$env:PGUSER = "postgres"
$env:PGPASSWORD = Read-Host "Senha do PostgreSQL"

Write-Host ""
Write-Host "Auditando dados locais antes da migracao..."
node migrate-local-to-postgres.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "Auditoria falhou. Nenhum dado foi alterado."
    exit 1
}

Write-Host ""
$confirmation = Read-Host "Digite MIGRAR para criar o esquema e copiar os dados"
if ($confirmation -cne "MIGRAR") {
    Write-Host "Migracao cancelada. O piloto continua usando armazenamento local."
    exit 0
}

node migrate-local-to-postgres.js --apply
if ($LASTEXITCODE -ne 0) {
    Write-Host "Migracao falhou. Os arquivos locais permanecem preservados."
    exit 1
}

Write-Host ""
Write-Host "Reiniciando dashboard com PostgreSQL conectado..."
Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq "node.exe" -and $_.CommandLine -match "server.js" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
node server.js
