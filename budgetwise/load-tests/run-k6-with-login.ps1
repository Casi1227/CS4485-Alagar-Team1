param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("smoke", "ramp", "stress")]
  [string]$Scenario,

  [Parameter(Mandatory = $false)]
  [string]$Email = "test@example.com",

  [Parameter(Mandatory = $false)]
  [string]$Password = "your_password",

  [Parameter(Mandatory = $false)]
  [string]$BaseUrl = "http://localhost:5001",

  [switch]$EnableWrites
)

$ErrorActionPreference = "Stop"

$scriptName = switch ($Scenario) {
  "smoke" { "k6-smoke.js" }
  "ramp" { "k6-ramp.js" }
  "stress" { "k6-stress.js" }
}

Write-Host "Logging in user $Email against $BaseUrl ..."
$loginBody = @{
  email = $Email
  password = $Password
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod `
  -Method Post `
  -Uri "$BaseUrl/api/auth/login" `
  -ContentType "application/json" `
  -Body $loginBody

if (-not $loginResponse.token) {
  throw "Login succeeded but no token was returned."
}

$token = [string]$loginResponse.token
$writesFlag = if ($EnableWrites.IsPresent) { "1" } else { "0" }

$scriptsPath = Join-Path (Get-Location) "load-tests"

Write-Host "Running $scriptName (writes enabled: $writesFlag) ..."
docker run --rm -i `
  --add-host=host.docker.internal:host-gateway `
  -e "BASE_URL=http://host.docker.internal:5001" `
  -e "TOKEN=$token" `
  -e "ENABLE_WRITES=$writesFlag" `
  -v "${scriptsPath}:/scripts" `
  grafana/k6 run "/scripts/$scriptName"
