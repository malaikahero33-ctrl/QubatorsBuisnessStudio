# Qubators Business Studio - local server
# No Node or Python needed. Run:  powershell -NoProfile -ExecutionPolicy Bypass -File .\start-studio.ps1
# Then open http://localhost:8765/   (Press Ctrl+C to stop)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8765

$mimes = @{
  '.html'  = 'text/html; charset=utf-8'
  '.css'   = 'text/css; charset=utf-8'
  '.js'    = 'application/javascript; charset=utf-8'
  '.json'  = 'application/json; charset=utf-8'
  '.md'    = 'text/markdown; charset=utf-8'
  '.svg'   = 'image/svg+xml'
  '.png'   = 'image/png'
  '.jpg'   = 'image/jpeg'
  '.jpeg'  = 'image/jpeg'
  '.ico'   = 'image/x-icon'
  '.woff2' = 'font/woff2'
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
$listener.Start()

Write-Host ''
Write-Host '  Qubators Business Studio' -ForegroundColor Cyan
Write-Host "  http://localhost:$port/" -ForegroundColor White
Write-Host '  Sign in with any email + a 4+ character password.'
Write-Host ('  Customer tracking: http://localhost:{0}/#/track  (try QB-1041)' -f $port)
Write-Host '  Press Ctrl+C to stop.' -ForegroundColor DarkGray
Write-Host ''

while ($true) {
  try {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $stream.ReadTimeout = 5000

    $buf = New-Object byte[] 16384
    $mem = New-Object System.IO.MemoryStream
    $req = ''
    while ($true) {
      $n = $stream.Read($buf, 0, $buf.Length)
      if ($n -le 0) { break }
      $mem.Write($buf, 0, $n)
      $req = [System.Text.Encoding]::ASCII.GetString($mem.ToArray())
      if ($req -match "`r`n`r`n") { break }
    }

    $parts = ($req -split "`r`n")[0] -split ' '
    if ($parts.Count -lt 2) { $client.Close(); continue }

    $url  = ($parts[1] -split '\?')[0]
    $path = [uri]::UnescapeDataString($url)
    if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }
    $full = Join-Path $root ($path.TrimStart('/') -replace '/', '\')
    if (-not $full.StartsWith($root)) { $full = Join-Path $root 'index.html' }

    $isFile = (Test-Path -LiteralPath $full -PathType Leaf) -and ([System.IO.Path]::GetExtension($full).ToLower() -ne '.ps1')

    if ($isFile) {
      $ext  = [System.IO.Path]::GetExtension($full).ToLower()
      $type = if ($mimes.ContainsKey($ext)) { $mimes[$ext] } else { 'application/octet-stream' }
      $body = [System.IO.File]::ReadAllBytes($full)
      $head = "HTTP/1.1 200 OK`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
    } else {
      $body = [System.Text.Encoding]::UTF8.GetBytes('<h1>404 - not found</h1>')
      $head = "HTTP/1.1 404 Not Found`r`nContent-Type: text/html; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
    }

    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    $stream.Write($body, 0, $body.Length)
    $stream.Flush()
  } catch {
    # ignore dropped connections and keep serving
  }
  try { $client.Close() } catch {}
}
