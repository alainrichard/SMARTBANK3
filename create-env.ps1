param()
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host ""
Write-Host "SmartBank AI v3 - Setup" -ForegroundColor Cyan
Write-Host ""
$pw = Read-Host "Enter your PostgreSQL password (press Enter if none)"

$bePath = $scriptDir + "\backend\.env"
$aiPath = $scriptDir + "\ai\.env"

$beLines = @(
    "NODE_ENV=development",
    "PORT=5000",
    "DB_HOST=localhost",
    "DB_PORT=5432",
    "DB_NAME=smartbank_db",
    "DB_USER=postgres",
    "DB_PASSWORD=" + $pw,
    "JWT_SECRET=smartbank_jwt_secret_32chars_minimum_here",
    "JWT_EXPIRES_IN=2h",
    "JWT_REFRESH_SECRET=smartbank_refresh_secret_32chars_here",
    "JWT_REFRESH_EXPIRES_IN=7d",
    "AI_SERVICE_URL=http://localhost:8000",
    "FRONTEND_URL=http://localhost:3000",
    "SMTP_HOST=smtp.gmail.com",
    "SMTP_PORT=587",
    "SMTP_USER=",
    "SMTP_PASS="
)

$aiLines = @(
    "DB_HOST=localhost",
    "DB_PORT=5432",
    "DB_NAME=smartbank_db",
    "DB_USER=postgres",
    "DB_PASSWORD=" + $pw,
    "AI_PORT=8000",
    "FLASK_ENV=development"
)

[System.IO.File]::WriteAllLines($bePath, $beLines, [System.Text.Encoding]::UTF8)
Write-Host "Created: $bePath" -ForegroundColor Green

[System.IO.File]::WriteAllLines($aiPath, $aiLines, [System.Text.Encoding]::UTF8)
Write-Host "Created: $aiPath" -ForegroundColor Green

Write-Host ""
Write-Host "Done! Now run:" -ForegroundColor Yellow
Write-Host "  createdb -U postgres smartbank_db"
Write-Host "  psql -U postgres -d smartbank_db -f database\schema.sql"
Write-Host "  cd backend ; npm install ; npm run dev"
Write-Host "  cd ai ; python app.py"
Write-Host ""
Read-Host "Press Enter to close"
