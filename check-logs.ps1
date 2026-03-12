Write-Host "=== ASTRO LOGS ===" -ForegroundColor Green
Get-Content astro.log -Tail 50
Write-Host "`n=== PAYLOAD LOGS ===" -ForegroundColor Yellow
Get-Content payload.log -Tail 50
Write-Host "`n=== WEBHOOK STATUS ===" -ForegroundColor Cyan
Write-Host "Look for these messages:"
Write-Host "✅ Webhook sent for articles update: [slug]" -ForegroundColor Green
Write-Host "🔄 Webhook received: { type: 'update'..." -ForegroundColor Green
Read-Host "Press Enter to exit"