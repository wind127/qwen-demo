$required = @(
  "apps/ios/QianwenApp.xcodeproj/project.pbxproj",
  "apps/ios/QianwenApp/QianwenApp.swift",
  "apps/ios/QianwenApp/Models.swift",
  "apps/ios/QianwenApp/QianwenApiClient.swift",
  "apps/ios/QianwenApp/QianwenStore.swift",
  "apps/ios/QianwenApp/ConversationListView.swift",
  "apps/ios/QianwenApp/ChatView.swift",
  "apps/ios/QianwenApp/StatusView.swift",
  "apps/ios/QianwenAppTests/ChatSseParserTests.swift"
)

$missing = $required | Where-Object { -not (Test-Path $_) }
if ($missing) {
  Write-Error ("Missing iOS project files: " + ($missing -join ", "))
  exit 1
}

if (Get-Command xcodebuild -ErrorAction SilentlyContinue) {
  Write-Host "xcodebuild detected. On macOS run: xcodebuild -project apps/ios/QianwenApp.xcodeproj -scheme QianwenApp -sdk iphonesimulator build"
} else {
  Write-Host "iOS native project structure check passed. xcodebuild is unavailable in this Windows environment."
}
