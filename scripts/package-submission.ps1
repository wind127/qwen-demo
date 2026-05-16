param(
  [string]$OutputPath,
  [switch]$IncludeConversationRecords
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $OutputPath) {
  $OutputPath = Join-Path $repoRoot "qwen-demo-submission-code-docs.zip"
}

$outputFullPath = [System.IO.Path]::GetFullPath($OutputPath)
$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$stageRoot = Join-Path $tempRoot ("qwen-demo-submission-" + [System.Guid]::NewGuid().ToString("N"))

function Assert-UnderPath {
  param(
    [string]$Path,
    [string]$ParentPath,
    [string]$Label
  )

  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $fullParent = [System.IO.Path]::GetFullPath($ParentPath).TrimEnd('\') + '\'
  if (-not $fullPath.StartsWith($fullParent, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "$Label is outside expected parent path: $fullPath"
  }
}

function Test-ExcludedPath {
  param([string]$RelativePath)

  $normalized = $RelativePath.Replace('/', '\')
  $fileName = [System.IO.Path]::GetFileName($normalized)
  $segments = $normalized -split '\\'

  if ($segments -contains ".git") { return $true }
  if ($segments -contains ".idea") { return $true }
  if ($segments -contains "node_modules") { return $true }
  if ($segments -contains "dist") { return $true }
  if ($segments -contains "build") { return $true }
  if ($segments -contains ".gradle") { return $true }
  if ($segments -contains "DerivedData") { return $true }
  if ($segments -contains "coverage") { return $true }
  if ($segments -contains ".expo") { return $true }
  if ($segments -contains ".turbo") { return $true }
  if ($segments -contains ".vite") { return $true }

  if ($fileName -in @(".env", ".env.local", "local.properties")) { return $true }
  if ($fileName -like "*.zip" -or $fileName -like "*.apk" -or $fileName -like "*.aab" -or $fileName -like "*.xcarchive") {
    return $true
  }

  if ($normalized -like ".codex\*.log") { return $true }
  if ($normalized -eq ".codex\qwen-demo-storage.json") { return $true }
  if (
    -not $IncludeConversationRecords -and
    $segments.Length -eq 1 -and
    ($fileName -match '[^\x00-\x7F]') -and
    ($fileName -like "*.md" -or $fileName -like "*.txt")
  ) {
    return $true
  }

  return $false
}

function Get-RelativePathCompat {
  param(
    [string]$BasePath,
    [string]$FullPath
  )

  $baseUri = New-Object System.Uri (($BasePath.TrimEnd('\') + '\'))
  $fileUri = New-Object System.Uri $FullPath
  return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($fileUri).ToString()).Replace('/', '\')
}

Assert-UnderPath -Path $stageRoot -ParentPath $tempRoot -Label "Staging directory"
if (Test-Path $stageRoot) {
  Remove-Item -LiteralPath $stageRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $stageRoot | Out-Null

try {
  $files = Get-ChildItem -LiteralPath $repoRoot -Recurse -File -Force |
    Where-Object {
      $relativePath = Get-RelativePathCompat -BasePath $repoRoot -FullPath $_.FullName
      -not (Test-ExcludedPath $relativePath)
    }

  foreach ($file in $files) {
    $relativePath = Get-RelativePathCompat -BasePath $repoRoot -FullPath $file.FullName
    $targetPath = Join-Path $stageRoot $relativePath
    $targetDir = Split-Path -Parent $targetPath
    if (-not (Test-Path $targetDir)) {
      New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }
    Copy-Item -LiteralPath $file.FullName -Destination $targetPath -Force
  }

  if (Test-Path $outputFullPath) {
    Assert-UnderPath -Path $outputFullPath -ParentPath $repoRoot -Label "Output zip"
    Remove-Item -LiteralPath $outputFullPath -Force
  }

  Compress-Archive -Path (Join-Path $stageRoot "*") -DestinationPath $outputFullPath -Force
  Write-Host "Submission package created: $outputFullPath"
  Write-Host "Included files: $($files.Count)"
  Write-Host "Conversation records included: $($IncludeConversationRecords.IsPresent)"
} finally {
  if (Test-Path $stageRoot) {
    Assert-UnderPath -Path $stageRoot -ParentPath $tempRoot -Label "Staging directory"
    Remove-Item -LiteralPath $stageRoot -Recurse -Force
  }
}
