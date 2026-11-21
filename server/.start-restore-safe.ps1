$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$passwordFile = Join-Path $PSScriptRoot ".rls-test-passwords.local"
$secretFile = Join-Path $PSScriptRoot ".rls-test-secret.local"

if (-not (Test-Path -LiteralPath $passwordFile -PathType Leaf)) {
  throw "Arquivo local de senhas não encontrado; nenhuma API foi iniciada."
}

$credentials = Get-Content -LiteralPath $passwordFile -Raw | ConvertFrom-Json
$operationalPassword = [string]$credentials.operational
$administrativePassword = [string]$credentials.administrative

if ([string]::IsNullOrWhiteSpace($operationalPassword) -or
    [string]::IsNullOrWhiteSpace($administrativePassword)) {
  throw "Senhas locais ausentes ou inválidas; nenhuma API foi iniciada."
}

$operational = [Uri]::EscapeDataString($operationalPassword)
$administrative = [Uri]::EscapeDataString($administrativePassword)

$databaseUrl = "postgresql://mil_app_login:${operational}@127.0.0.1:5434/mil_contabil_restore_teste"
$adminDatabaseUrl = "postgresql://mil_platform_login:${administrative}@127.0.0.1:5434/mil_contabil_restore_teste"

function Assert-RestoreTarget {
  param(
    [Parameter(Mandatory = $true)][string]$ConnectionUrl,
    [Parameter(Mandatory = $true)][string]$ExpectedUser
  )

  try {
    $uri = [Uri]$ConnectionUrl
  } catch {
    throw "URL de conexão inválida; nenhuma API foi iniciada."
  }

  $userInfo = $uri.UserInfo
  $separator = $userInfo.IndexOf(":")
  $username = if ($separator -ge 0) {
    [Uri]::UnescapeDataString($userInfo.Substring(0, $separator))
  } else {
    ""
  }

  if ($uri.Scheme -ne "postgresql" -or
      $uri.Host -ne "127.0.0.1" -or
      $uri.Port -ne 5434 -or
      $uri.AbsolutePath -ne "/mil_contabil_restore_teste" -or
      $uri.Query -ne "" -or
      $uri.Fragment -ne "" -or
      $username -ne $ExpectedUser) {
    throw "Destino de conexão fora do banco local de restauração; nenhuma API foi iniciada."
  }
}

Assert-RestoreTarget -ConnectionUrl $databaseUrl -ExpectedUser "mil_app_login"
Assert-RestoreTarget -ConnectionUrl $adminDatabaseUrl -ExpectedUser "mil_platform_login"

if (-not (Test-Path -LiteralPath $secretFile -PathType Leaf)) {
  throw "Arquivo local de contexto RLS não encontrado; nenhuma API foi iniciada."
}

$rlsContextSecret = (Get-Content -LiteralPath $secretFile -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($rlsContextSecret)) {
  throw "Segredo local de contexto RLS inválido; nenhuma API foi iniciada."
}

$env:DATABASE_URL = $databaseUrl
$env:ADMIN_DATABASE_URL = $adminDatabaseUrl
$env:RLS_CONTEXT_SECRET = $rlsContextSecret
$env:DISABLE_BACKGROUND_JOBS = "true"
$env:NODE_ENV = "development"
$env:PORT = "4010"

Write-Host "Destinos validados: PostgreSQL local 127.0.0.1:5434/mil_contabil_restore_teste."
Write-Host "Iniciando MIL Contabil IA na porta 4010..."

cmd /c npm run dev
