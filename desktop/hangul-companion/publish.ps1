param(
    [string]$DotNetPath = "dotnet",
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "dist")
)

$ErrorActionPreference = "Stop"
$version = "1.0.0"
$project = Join-Path $PSScriptRoot "Academy.HangulCompanion.csproj"
$releaseRoot = Join-Path $OutputDirectory "windows-$version"
$publishDirectory = Join-Path $releaseRoot "publish"
$packageDirectory = Join-Path $releaseRoot "package"
$zipPath = Join-Path $releaseRoot "Academy-Hangul-Companion-Windows-$version.zip"
$manifestPath = Join-Path $releaseRoot "hangul-companion-manifest.json"

New-Item -ItemType Directory -Path $publishDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $packageDirectory -Force | Out-Null

& $DotNetPath publish $project -c Release -r win-x64 --self-contained true `
    -p:PublishSingleFile=true -p:PublishTrimmed=false -p:DebugType=None -p:DebugSymbols=false `
    -o $publishDirectory
if ($LASTEXITCODE -ne 0) {
    throw "한글 연결 프로그램 publish가 실패했습니다."
}

$executable = Join-Path $publishDirectory "Academy.HangulCompanion.exe"
if (-not (Test-Path -LiteralPath $executable)) {
    throw "publish 결과 실행 파일을 찾을 수 없습니다."
}

Copy-Item -LiteralPath $executable -Destination (Join-Path $packageDirectory "Academy.HangulCompanion.exe") -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "README.md") -Destination (Join-Path $packageDirectory "README.md") -Force

@"
Academy 한글 연결 프로그램 v$version

1. 이 ZIP을 모두 풉니다.
2. Academy.HangulCompanion.exe를 두 번 누릅니다.
3. 설치 완료 안내를 확인합니다. 관리자 권한은 필요하지 않습니다.
4. Academy 도구의 AI 시험지 타이핑에서 검수본을 만든 뒤 '한글에서 열기'를 누릅니다.

프로그램은 기존 한글 문서를 저장하거나 닫지 않습니다.
제거: Academy.HangulCompanion.exe --uninstall
"@ | Set-Content -LiteralPath (Join-Path $packageDirectory "설치방법.txt") -Encoding utf8

$packageFiles = @(
    (Join-Path $packageDirectory "Academy.HangulCompanion.exe"),
    (Join-Path $packageDirectory "README.md"),
    (Join-Path $packageDirectory "설치방법.txt")
)
Compress-Archive -Path $packageFiles -DestinationPath $zipPath -CompressionLevel Optimal -Force
$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
$size = (Get-Item -LiteralPath $zipPath).Length

[ordered]@{
    version = $version
    r2_key = "tools/problem-studio/hangul-companion/windows/$version/Academy-Hangul-Companion-Windows-$version.zip"
    filename = "Academy-Hangul-Companion-Windows-$version.zip"
    sha256 = $hash
    size_bytes = $size
} | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding utf8

Write-Output ([pscustomobject]@{
    ZipPath = $zipPath
    ManifestPath = $manifestPath
    Sha256 = $hash
    SizeBytes = $size
})
