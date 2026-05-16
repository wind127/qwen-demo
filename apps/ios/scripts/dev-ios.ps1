& "$PSScriptRoot/check-ios.ps1"
if (-not $?) {
  exit 1
}

if (Get-Command xcodebuild -ErrorAction SilentlyContinue) {
  Push-Location "$PSScriptRoot/.."
  try {
    xcodebuild -project QianwenApp.xcodeproj -scheme QianwenApp -sdk iphonesimulator build
    if ($LASTEXITCODE -ne $null) {
      exit $LASTEXITCODE
    }
    if ($?) {
      exit 0
    }
    exit 1
  } finally {
    Pop-Location
  }
}

Write-Host "xcodebuild is unavailable in this environment."
Write-Host "Run this script on macOS with Xcode installed."
exit 1
