& "$PSScriptRoot/check-android.ps1"
if (-not $?) {
  exit 1
}

Push-Location "$PSScriptRoot/.."
try {
  $localProperties = Join-Path (Get-Location) "local.properties"
  $localSdkDir = $null
  if (Test-Path $localProperties) {
    $sdkLine = Get-Content $localProperties | Where-Object { $_.StartsWith("sdk.dir=") } | Select-Object -First 1
    if ($sdkLine) {
      $localSdkDir = $sdkLine.Substring("sdk.dir=".Length).Replace("\\", [System.IO.Path]::DirectorySeparatorChar)
    }
  }
  if ($localSdkDir) {
    $env:ANDROID_SDK_ROOT = $localSdkDir
    $env:ANDROID_HOME = $localSdkDir
  } else {
    if (-not $env:ANDROID_SDK_ROOT) {
      $env:ANDROID_SDK_ROOT = "C:\Android\Sdk"
    }
    if (-not $env:ANDROID_HOME) {
      $env:ANDROID_HOME = $env:ANDROID_SDK_ROOT
    }
  }
  if (-not $env:GRADLE_USER_HOME) {
    $env:GRADLE_USER_HOME = "C:\Gradle\user-home"
  }

  $gradleCommand = $null
  if (Test-Path "$PSScriptRoot/../gradlew.bat") {
    $gradleCommand = "$PSScriptRoot/../gradlew.bat"
  } elseif (Get-Command gradle -ErrorAction SilentlyContinue) {
    $gradleCommand = "gradle"
  } elseif (Test-Path "C:\Gradle\gradle-8.10.2\bin\gradle.bat") {
    $gradleCommand = "C:\Gradle\gradle-8.10.2\bin\gradle.bat"
  }

  if ($gradleCommand) {
    & $gradleCommand --max-workers=1 :app:assembleDebug
    exit $LASTEXITCODE
  }

  Write-Host "Gradle is unavailable in this environment."
  Write-Host "Install Android Studio or Gradle, then run: cd apps/android; .\gradlew.bat :app:assembleDebug"
  exit 1
} finally {
  Pop-Location
}
