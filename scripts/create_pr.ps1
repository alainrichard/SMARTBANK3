param(
    [string]$Title = "fix(smartbank3): repository fixes + CI",
    [string]$Body = "This PR contains fixes for build/runtime issues, CI, and containerization. Please review and merge.",
    [string]$Base = "main",
    [string]$Head = "fix/smartbank3"
)

# Requires: set environment variable GITHUB_TOKEN with a personal access token
if (-not $env:GITHUB_TOKEN) {
    Write-Error "GITHUB_TOKEN not found in environment. Export a PAT to GITHUB_TOKEN and retry."
    exit 1
}

$remote = git remote get-url origin 2>$null
if (-not $remote) {
    Write-Error "Unable to detect git remote 'origin'. Ensure this repo has a remote named origin."
    exit 1
}

# Parse owner/repo from remote URL
if ($remote -match '[:/]([^/]+/[^/.]+)(\.git)?$') {
    $repoFull = $matches[1]
} else {
    Write-Error "Failed to parse remote URL: $remote"
    exit 1
}

$json = @{ title = $Title; head = $Head; base = $Base; body = $Body } | ConvertTo-Json

$uri = "https://api.github.com/repos/$repoFull/pulls"

# Create PR
$resp = Invoke-RestMethod -Uri $uri -Method Post -Headers @{ Authorization = "token $($env:GITHUB_TOKEN)"; 'User-Agent' = 'smartbank3-agent' } -Body $json -ContentType 'application/json' -ErrorAction Stop

Write-Output "Created PR: $($resp.html_url)"
