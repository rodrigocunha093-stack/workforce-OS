$dashboard = "http://localhost:4173"

Write-Host "Dashboard:"
try {
    Invoke-RestMethod "$dashboard/api/db-status" | ConvertTo-Json
} catch {
    Write-Error "Dashboard indisponível em $dashboard"
}

Write-Host "`nCloudflared:"
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($cloudflared) {
    cloudflared --version
} else {
    Write-Warning "cloudflared ainda não está instalado."
}

Write-Host "`nServiço Cloudflared:"
Get-Service -Name "cloudflared*" -ErrorAction SilentlyContinue |
    Select-Object Name, Status, DisplayName
