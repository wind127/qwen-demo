param(
  [int[]]$Ports = @(8787, 5173, 5174, 5175),
  [string[]]$ProcessNames = @()
)

$ErrorActionPreference = "Stop"

Write-Host "Checking residual demo processes on ports: $($Ports -join ', ')"

$connections = Get-NetTCPConnection -ErrorAction SilentlyContinue |
  Where-Object { $Ports -contains $_.LocalPort -or $Ports -contains $_.RemotePort }

$processIds = @()

if ($connections) {
  $processIds += $connections |
    Where-Object { $_.OwningProcess -and $_.OwningProcess -gt 0 } |
    Select-Object -ExpandProperty OwningProcess -Unique
} else {
  Write-Host "No residual demo port connections found."
}

$matchedByName = @()
foreach ($processName in $ProcessNames) {
  $normalizedName = $processName -replace "\.exe$", ""
  $matchedByName += Get-Process -Name $normalizedName -ErrorAction SilentlyContinue
}

if ($matchedByName) {
  Write-Host "Matched processes by name:"
  $matchedByName |
    Sort-Object ProcessName, Id |
    Select-Object Id, ProcessName, Path |
    Format-Table -AutoSize

  $processIds += $matchedByName |
    Select-Object -ExpandProperty Id -Unique
}

$processIds = $processIds | Sort-Object -Unique

if (-not $processIds) {
  if ($connections) {
    Write-Host "Connections were found, but no owning process could be resolved."
    $connections | Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, State, OwningProcess |
      Format-Table -AutoSize
  } else {
    Write-Host "No residual demo processes found."
  }
  exit 0
}

if ($connections) {
  Write-Host "Matched connections:"
  $connections |
    Sort-Object LocalPort, RemotePort, OwningProcess |
    Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, State, OwningProcess |
    Format-Table -AutoSize
}

Write-Host "Stopping processes:"
foreach ($processId in $processIds) {
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if (-not $process) {
    Write-Host "PID $processId already exited."
    continue
  }

  $path = if ($process.Path) { $process.Path } else { "<unknown path>" }
  Write-Host "Stopping PID $processId ($($process.ProcessName)) $path"
  Stop-Process -Id $processId -Force
}

Start-Sleep -Milliseconds 500

$remainingConnections = Get-NetTCPConnection -ErrorAction SilentlyContinue |
  Where-Object { $Ports -contains $_.LocalPort -or $Ports -contains $_.RemotePort }

if ($remainingConnections) {
  Write-Host "Some connections are still visible after cleanup:"
  $remainingConnections |
    Sort-Object LocalPort, RemotePort, OwningProcess |
    Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, State, OwningProcess |
    Format-Table -AutoSize
  exit 1
}

Write-Host "Demo residual processes cleared."
