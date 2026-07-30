# Creates Rogue Outreach Azure app + Mail.Send + client secret.
# Prerequisites: az login --allow-no-subscriptions
# Usage: powershell -File outreach/setup-m365.ps1

$ErrorActionPreference = "Stop"

Write-Host "Checking Azure login..."
$accountJson = az account show 2>$null
if (-not $accountJson) {
  Write-Host "Not logged in. Starting device login..."
  az login --use-device-code --allow-no-subscriptions
  $accountJson = az account show
}
$account = $accountJson | ConvertFrom-Json

$tenantId = $account.tenantId
Write-Host "Tenant: $tenantId ($($account.user.name))"

$displayName = "Rogue Outreach"
$existing = az ad app list --display-name $displayName --query "[0].appId" -o tsv
if ($existing) {
  Write-Host "App already exists: $existing"
  $appId = $existing
} else {
  Write-Host "Creating app registration..."
  $app = az ad app create --display-name $displayName --sign-in-audience AzureADMyOrg | ConvertFrom-Json
  $appId = $app.appId
  Write-Host "Created appId: $appId"
}

$graphAppId = "00000003-0000-0000-c000-000000000000"
$mailSendId = "b633e1c5-b582-4048-a93e-9f11b44c7e96"

Write-Host "Adding Mail.Send (application) permission..."
az ad app permission add --id $appId --api $graphAppId --api-permissions ($mailSendId + "=Role") | Out-Null

$sp = az ad sp list --filter "appId eq '$appId'" --query "[0].id" -o tsv
if (-not $sp) {
  Write-Host "Creating service principal..."
  az ad sp create --id $appId | Out-Null
}

Write-Host "Creating client secret (expires 24 months)..."
$secret = az ad app credential reset --id $appId --append --display-name "rogue-outreach" --years 2 | ConvertFrom-Json

$secretPath = Join-Path $PSScriptRoot ".m365-secrets.local"
$lines = @(
  "AZURE_TENANT_ID=$tenantId"
  "AZURE_CLIENT_ID=$appId"
  ("AZURE_CLIENT_SECRET=" + $secret.password)
  "ROGUE_FROM_EMAIL=01@roguemodern.com"
)
Set-Content -Path $secretPath -Value ($lines -join "`n")

Write-Host ""
Write-Host "=== Grant admin consent (required) ==="
Write-Host ("Open: https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/" + $appId)
Write-Host ("Or try: az ad app permission admin-consent --id " + $appId)
Write-Host ""
Write-Host "=== Add these Cursor cloud secrets ==="
Get-Content $secretPath
Write-Host ""
Write-Host "Secrets also saved to outreach/.m365-secrets.local (gitignored). Delete after pasting into Cursor."
