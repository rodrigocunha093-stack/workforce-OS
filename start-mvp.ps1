Set-Location -LiteralPath "C:\Users\LOJA1321\Documents\Codex\2026-06-04\quero-me-conectar-a-outra-conta\outputs\mvp-web-proprio"
"Iniciando MVP em $(Get-Date)" | Out-File -FilePath ".\start-mvp.log" -Encoding utf8
& "C:\Program Files\nodejs\node.exe" "server.js" *>> ".\start-mvp.log"
"Node finalizou com codigo $LASTEXITCODE em $(Get-Date)" | Out-File -FilePath ".\start-mvp.log" -Append -Encoding utf8
Read-Host "Pressione Enter para fechar"
