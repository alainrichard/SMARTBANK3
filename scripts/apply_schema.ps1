param(
  [string]$Host = 'localhost',
  [string]$Port = '5432',
  [string]$User = 'postgres',
  [string]$Database = 'smartbank_db',
  [string]$File = 'database/schema.sql'
)

if (-not (Test-Path $File)) {
  Write-Error "Schema file not found: $File"
  exit 1
}

Write-Host "Applying schema to $User@$Host:$Port/$Database from $File"

if (-not $env:PGPASSWORD) {
  $secure = Read-Host -Prompt "Enter DB password" -AsSecureString
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  $env:PGPASSWORD = $plain
}

# Use psql available in PATH
psql -h $Host -p $Port -U $User -d $Database -f $File
