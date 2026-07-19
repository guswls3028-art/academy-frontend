$schemeRoot = "HKCU:\Software\Classes\academy-hangul"
if (Test-Path -LiteralPath $schemeRoot) {
    Remove-Item -LiteralPath $schemeRoot -Recurse -Force
    Write-Host "academy-hangul 연결 프로그램 등록을 제거했습니다."
} else {
    Write-Host "등록된 academy-hangul 연결 프로그램이 없습니다."
}
