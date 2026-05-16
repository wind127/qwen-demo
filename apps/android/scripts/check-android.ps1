$required = @(
  "apps/android/settings.gradle.kts",
  "apps/android/build.gradle.kts",
  "apps/android/app/build.gradle.kts",
  "apps/android/app/src/main/AndroidManifest.xml",
  "apps/android/app/src/main/java/com/qianwen/demo/MainActivity.kt",
  "apps/android/app/src/main/java/com/qianwen/demo/data/ChatSseParser.kt",
  "apps/android/app/src/test/java/com/qianwen/demo/data/ChatSseParserTest.kt",
  "apps/android/app/src/test/java/com/qianwen/demo/ui/QianwenViewModelTest.kt"
)

$missing = $required | Where-Object { -not (Test-Path $_) }
if ($missing) {
  Write-Error ("Missing Android project files: " + ($missing -join ", "))
  exit 1
}

$manifest = Get-Content "apps/android/app/src/main/AndroidManifest.xml" -Raw
if ($manifest -notmatch 'android:usesCleartextTraffic="true"') {
  Write-Error "Android local demo requires android:usesCleartextTraffic=true so the emulator can call http://10.0.2.2:8787."
  exit 1
}

Write-Host "Android native project structure check passed."
Write-Host "To build after installing Android Studio / Gradle: cd apps/android; .\gradlew.bat :app:assembleDebug"
