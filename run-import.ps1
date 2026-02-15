#!/usr/bin/env pwsh
<#
.SYNOPSIS
WordPress to Sanity Article Import Script

.DESCRIPTION
Imports articles with comments and ratings from WordPress JSON exports to Sanity CMS.
This script handles setting the API token and running the import.

.PARAMETER Token
The Sanity API token (required)

.EXAMPLE
.\run-import.ps1 -Token "sxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

.NOTES
Get your token from: https://manage.sanity.io/ -> API -> Tokens
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Token,
    
    [Parameter(Mandatory=$false)]
    [switch]$Help
)

# Show help if requested
if ($Help) {
    Write-Host @"

╔════════════════════════════════════════════════════════════════╗
║    WordPress to Sanity Article Import                          ║
╚════════════════════════════════════════════════════════════════╝

USAGE:
  .\run-import.ps1 -Token "YOUR_SANITY_API_TOKEN"

GET YOUR TOKEN:
  1. Go to https://manage.sanity.io/
  2. Select project: leo (g45aygyb)
  3. Go to: API > Tokens
  4. Create a new token with "Editor" role
  5. Copy the token value

EXAMPLE:
  .\run-import.ps1 -Token "sxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

WHAT WILL BE IMPORTED:
  • 5,316+ articles with full content
  • 10,000+ comments linked to articles
  • Ratings (average, count, total)
  • Article metadata (date, language, slug)

ESTIMATED TIME: 30-60 minutes

"@
    exit 0
}

Write-Host "`n" -NoNewline
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║    WordPress to Sanity Article Import                          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host "`n📊 Import Configuration:" -ForegroundColor Yellow
Write-Host "   Project ID: g45aygyb"
Write-Host "   Dataset:    production"
Write-Host "   Articles:   5,316+"
Write-Host "   Comments:   10,000+"

Write-Host "`n🔑 Setting API Token..." -ForegroundColor Yellow
$env:SANITY_TOKEN = $Token

Write-Host "✅ Token configured"

Write-Host "`n▶️  Starting import..." -ForegroundColor Green
Write-Host "   (This may take 30-60 minutes)`n"

# Run the import script
& node import-wp-articles.mjs

# Check result
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n" -NoNewline
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║    ✅ Import Completed Successfully!                           ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    
    Write-Host "`n📖 Next Steps:" -ForegroundColor Yellow
    Write-Host "   1. View in Sanity Studio: npm run dev"
    Write-Host "   2. Check articles and comments in dashboard"
    Write-Host "   3. Update frontend to display comments"
    
    Write-Host "`n📚 Documentation:" -ForegroundColor Yellow
    Write-Host "   • QUICK_IMPORT_GUIDE.md"
    Write-Host "   • IMPORT_ARTICLES_README.md"
    Write-Host "   • IMPORT_STATUS.md"
} else {
    Write-Host "`n" -NoNewline
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║    ❌ Import Failed with Error Code: $LASTEXITCODE" -ForegroundColor Red
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Red
    
    Write-Host "`n❓ Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   • Check that your SANITY_TOKEN is correct"
    Write-Host "   • Verify token has 'Editor' or higher permissions"
    Write-Host "   • Check internet connection"
    Write-Host "   • Review IMPORT_ARTICLES_README.md for more help"
}

Write-Host "`n"
