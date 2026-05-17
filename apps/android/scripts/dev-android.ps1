& "$PSScriptRoot/check-android.ps1"
if (-not $?) {
  exit 1
}

function Convert-SdkPath {
  param([string] $RawPath)

  if (-not $RawPath) {
    return $null
  }

  return $RawPath.Replace("\\", [System.IO.Path]::DirectorySeparatorChar).Replace("\:", ":")
}

function Get-LocalSdkDir {
  param([string] $AndroidRoot)

  $localProperties = Join-Path $AndroidRoot "local.properties"
  if (-not (Test-Path $localProperties)) {
    return $null
  }

  $sdkLine = Get-Content $localProperties | Where-Object { $_.StartsWith("sdk.dir=") } | Select-Object -First 1
  if (-not $sdkLine) {
    return $null
  }

  return Convert-SdkPath $sdkLine.Substring("sdk.dir=".Length)
}

function Find-AndroidSdk {
  param([string] $AndroidRoot)

  $candidates = @(
    (Get-LocalSdkDir $AndroidRoot),
    $env:ANDROID_SDK_ROOT,
    $env:ANDROID_HOME,
    "D:\Android\Sdk",
    "C:\Android\Sdk",
    (Join-Path $env:LOCALAPPDATA "Android\Sdk")
  ) | Where-Object { $_ } | Select-Object -Unique

  foreach ($candidate in $candidates) {
    $adb = Join-Path $candidate "platform-tools\adb.exe"
    $emulator = Join-Path $candidate "emulator\emulator.exe"
    if ((Test-Path $adb) -and (Test-Path $emulator)) {
      return $candidate
    }
  }

  return $null
}

function Find-GradleCommand {
  if (Test-Path "$PSScriptRoot/../gradlew.bat") {
    return "$PSScriptRoot/../gradlew.bat"
  }
  if (Get-Command gradle -ErrorAction SilentlyContinue) {
    return "gradle"
  }
  if (Test-Path "C:\Gradle\gradle-8.10.2\bin\gradle.bat") {
    return "C:\Gradle\gradle-8.10.2\bin\gradle.bat"
  }

  return $null
}

function Get-DeviceRows {
  param([string] $Adb)

  & $Adb devices -l | Select-Object -Skip 1 | Where-Object { $_.Trim() }
}

function Get-ReadyDeviceSerial {
  param([string] $Adb)

  $rows = Get-DeviceRows $Adb
  foreach ($row in $rows) {
    if ($row -match "^(\S+)\s+device\b") {
      return $Matches[1]
    }
  }

  return $null
}

function Has-OfflineEmulator {
  param([string] $Adb)

  $rows = Get-DeviceRows $Adb
  return ($rows -join "`n") -match "\boffline\b"
}

function Get-RunningAndroidEmulator {
  param([string] $SdkDir)

  $emulatorRoot = Join-Path $SdkDir "emulator"
  Get-Process | Where-Object {
    try {
      ($_.ProcessName -eq "emulator" -or $_.ProcessName -eq "qemu-system-x86_64") -and
      $_.Path -and
      $_.Path.StartsWith($emulatorRoot, [System.StringComparison]::OrdinalIgnoreCase)
    } catch {
      $false
    }
  }
}

function Stop-AndroidEmulator {
  param([string] $SdkDir)

  Get-RunningAndroidEmulator $SdkDir | Stop-Process -Force
}

function Wait-ForDevice {
  param(
    [string] $Adb,
    [int] $TimeoutSeconds = 180
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $serial = Get-ReadyDeviceSerial $Adb
    if ($serial) {
      return $serial
    }

    Start-Sleep -Seconds 2
  }

  return $null
}

function Wait-ForBoot {
  param(
    [string] $Adb,
    [string] $Serial,
    [int] $TimeoutSeconds = 180
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $bootCompleted = (& $Adb -s $Serial shell getprop sys.boot_completed 2>$null).Trim()
    if ($bootCompleted -eq "1") {
      return $true
    }

    Start-Sleep -Seconds 2
  }

  return $false
}

function Test-ServerHealth {
  param([string] $Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

Push-Location "$PSScriptRoot/.."
try {
  $androidRoot = (Get-Location).Path
  $sdkDir = Find-AndroidSdk $androidRoot
  if (-not $sdkDir) {
    Write-Host "Android SDK is unavailable. Install Android Studio or set ANDROID_SDK_ROOT."
    exit 1
  }

  $env:ANDROID_SDK_ROOT = $sdkDir
  $env:ANDROID_HOME = $sdkDir
  if (-not $env:GRADLE_USER_HOME) {
    $env:GRADLE_USER_HOME = "C:\Gradle\user-home"
  }

  $adb = Join-Path $sdkDir "platform-tools\adb.exe"
  $emulator = Join-Path $sdkDir "emulator\emulator.exe"
  $gradleCommand = Find-GradleCommand
  if (-not $gradleCommand) {
    Write-Host "Gradle is unavailable in this environment."
    exit 1
  }

  Write-Host "Using Android SDK: $sdkDir"
  if (-not (Test-ServerHealth "http://127.0.0.1:8787/health")) {
    Write-Host "Server health is not reachable at http://127.0.0.1:8787/health."
    Write-Host "The Android app will still launch; start 'pnpm dev:server' in another terminal for online chat."
  }

  & $adb start-server | Out-Host

  $serial = Get-ReadyDeviceSerial $adb
  if (-not $serial) {
    $serial = Wait-ForDevice $adb 10
  }
  if (-not $serial -and ((Has-OfflineEmulator $adb) -or (Get-RunningAndroidEmulator $sdkDir))) {
    Write-Host "Found a stuck Android emulator. Restarting it for a clean demo session..."
    Stop-AndroidEmulator $sdkDir
    Start-Sleep -Seconds 3
    & $adb kill-server | Out-Null
    Start-Sleep -Seconds 1
    & $adb start-server | Out-Host
  }

  $serial = Get-ReadyDeviceSerial $adb
  if (-not $serial) {
    $avds = @(& $emulator -list-avds | Where-Object { $_.Trim() })
    if (-not $avds) {
      Write-Host "No Android Virtual Device found. Create one in Android Studio Device Manager first."
      exit 1
    }

    $preferredAvd = if ($env:QWEN_ANDROID_AVD) { $env:QWEN_ANDROID_AVD } else { "Pixel_7" }
    $avdName = if ($avds -contains $preferredAvd) { $preferredAvd } else { $avds[0] }
    Write-Host "Starting Android emulator: $avdName"
    Start-Process -FilePath $emulator -ArgumentList @("-avd", $avdName, "-no-snapshot-load")

    $serial = Wait-ForDevice $adb
    if (-not $serial) {
      Write-Host "Timed out waiting for Android emulator to connect."
      exit 1
    }
  }

  Write-Host "Using Android device: $serial"
  if (-not (Wait-ForBoot $adb $serial)) {
    Write-Host "Timed out waiting for Android device boot completion."
    exit 1
  }

  & $adb -s $serial shell input keyevent 82 | Out-Null

  & $gradleCommand --no-daemon --max-workers=1 :app:assembleDebug
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  $apkPath = Join-Path $androidRoot "app\build\outputs\apk\debug\app-debug.apk"
  if (-not (Test-Path $apkPath)) {
    Write-Host "Debug APK was not found: $apkPath"
    exit 1
  }

  & $adb -s $serial install -r $apkPath
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Replace install failed. Reinstalling com.qianwen.demo cleanly..."
    & $adb -s $serial uninstall com.qianwen.demo | Out-Host
    & $adb -s $serial install -r $apkPath
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  }

  & $adb -s $serial shell am start -n com.qianwen.demo/.MainActivity
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  Write-Host "Android app is running on $serial."
  exit 0
} finally {
  Pop-Location
}
