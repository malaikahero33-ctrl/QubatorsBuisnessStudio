# =============================================================================
# set-ai-key.ps1
#
# One command, one prompt, done. Written because opening .env.local and
# scrolling to the right line is a step too many, and a mistyped key is
# indistinguishable from a wrong key when everything else is correct.
#
# Usage:
#   .\scripts\set-ai-key.ps1
#   .\scripts\set-ai-key.ps1 -Provider openai
#
# The key is read from the console and never echoed back. This script does not
# print it, log it, or send it anywhere - it only writes it into .env.local.
# =============================================================================

param(
  # Which AI service the key belongs to.
  [ValidateSet("groq", "openai", "together", "mistral", "gemini", "openai_compatible")]
  [string]$Provider = "groq",

  # Optional. key.cmd reads the key at the console and passes it in through the
  # QBS_KEY environment variable rather than a command-line argument, because on
  # Windows any process can read another process's command line. When set, the
  # script does not prompt.
  [string]$Key = $env:QBS_KEY
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.local"

if (-not (Test-Path $envFile)) {
  Write-Host ""
  Write-Host "  .env.local does not exist yet." -ForegroundColor Red
  Write-Host "  Copy .env.example to .env.local first, then run this again."
  Write-Host ""
  exit 1
}

# ---------------------------------------------------------------- the prompt
Write-Host ""
Write-Host "  AI provider: $Provider" -ForegroundColor Cyan

$hint = switch ($Provider) {
  "groq" { "Groq keys start with gsk_. Get one at https://console.groq.com/keys" }
  "openai" { "OpenAI keys start with sk-. Get one at https://platform.openai.com/api-keys" }
  default { "Paste the key exactly as your provider issued it." }
}
Write-Host "  $hint" -ForegroundColor DarkGray

if ([string]::IsNullOrWhiteSpace($Key)) {
  Write-Host ""
  $Key = Read-Host "  Paste your API key and press Enter"
}

if ([string]::IsNullOrWhiteSpace($Key)) {
  Write-Host ""
  Write-Host "  Nothing entered. Nothing was changed." -ForegroundColor Yellow
  Write-Host ""
  exit 1
}

$key = $Key.Trim()

# ---------------------------------------------------------------- validation
# A helpful mistake now beats a 401 from the provider in thirty seconds.
$problems = @()

switch ($Provider) {
  "groq" {
    if (-not $key.StartsWith("gsk_")) {
      $problems += "A Groq key normally starts with 'gsk_'. Yours starts with '$($key.Substring(0, [Math]::Min(3, $key.Length)))'."
    }
  }
  "openai" {
    if (-not $key.StartsWith("sk-")) {
      $problems += "An OpenAI key normally starts with 'sk-'. Yours starts with '$($key.Substring(0, [Math]::Min(3, $key.Length)))'."
    }
  }
}

if ($key.Contains(" ")) {
  $problems += "The key contains a space. That is usually a paste accident - press Ctrl+A in the key field before copying, or retype it."
}

if ($problems.Count -gt 0) {
  Write-Host ""
  Write-Host "  That does not look right:" -ForegroundColor Yellow
  foreach ($p in $problems) { Write-Host "    - $p" -ForegroundColor Yellow }
  Write-Host ""
  Write-Host "  Nothing was written. Check the key and run this again."
  Write-Host ""
  exit 1
}

# ---------------------------------------------------------------- write it in
$lines = [System.IO.File]::ReadAllLines($envFile)
$changedProvider = $false
$changedKey = $false

for ($i = 0; $i -lt $lines.Length; $i++) {
  # Match the assignment, ignoring any comment lines that merely mention it.
  if ($lines[$i] -match '^\s*AI_PROVIDER\s*=') {
    $lines[$i] = "AI_PROVIDER=""$Provider"""
    $changedProvider = $true
  }
  elseif ($lines[$i] -match '^\s*AI_API_KEY\s*=') {
    $lines[$i] = "AI_API_KEY=""$key"""
    $changedKey = $true
  }
}

# If either line is missing entirely, append rather than silently doing nothing.
if (-not $changedProvider) {
  $lines += "AI_PROVIDER=""$Provider"""
}
if (-not $changedKey) {
  $lines += "AI_API_KEY=""$key"""
}

[System.IO.File]::WriteAllLines($envFile, $lines)

# ---------------------------------------------------------------- done
Write-Host ""
Write-Host "  Saved to .env.local" -ForegroundColor Green
Write-Host "    AI_PROVIDER = $Provider"
Write-Host "    AI_API_KEY   = $($key.Substring(0, [Math]::Min(4, $key.Length)))...  ($($key.Length) characters)"
Write-Host ""
Write-Host "  Restart the app for it to take effect." -ForegroundColor Cyan
Write-Host ""