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

Push-Location "$PSScriptRoot/.."
try {
  $localProperties = Join-Path (Get-Location) "local.properties"
  $localSdkDir = $null
  if (Test-Path $localProperties) {
    $sdkLine = Get-Content $localProperties | Where-Object { $_.StartsWith("sdk.dir=") } | Select-Object -First 1
    if ($sdkLine) {
      $localSdkDir = Convert-SdkPath $sdkLine.Substring("sdk.dir=".Length)
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

  if (-not $gradleCommand) {
    Write-Host "Gradle is unavailable in this environment."
    exit 1
  }

  & $gradleCommand --no-daemon --max-workers=1 :app:testDebugUnitTest
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
