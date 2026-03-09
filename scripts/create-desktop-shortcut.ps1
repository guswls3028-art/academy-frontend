# 바탕화면 "Academy Frontend" 바로가기 생성/덮어쓰기
# 사용: 프론트 폴더에서 실행
#   pwsh -ExecutionPolicy Bypass -File scripts/create-desktop-shortcut.ps1
# 또는 바탕화면에서 더블클릭 시 바로 꺼지는 경우, 이 스크립트를 한 번 실행한 뒤 다시 "Academy Frontend" 실행

$Desktop = [Environment]::GetFolderPath('Desktop')
$FrontendRoot = $PSScriptRoot | Split-Path -Parent
$BatPath = Join-Path $FrontendRoot "scripts\run-local-frontend.bat"

if (-not (Test-Path $BatPath)) {
  Write-Host "[오류] 배치 파일을 찾을 수 없습니다: $BatPath" -ForegroundColor Red
  exit 1
}

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$Desktop\Academy Frontend.lnk")
$Shortcut.TargetPath = $BatPath
$Shortcut.WorkingDirectory = $FrontendRoot
$Shortcut.Description = "Academy Frontend (9999 로컬 개발)"
$Shortcut.Save()

Write-Host "바탕화면 바로가기가 생성되었습니다: $Desktop\Academy Frontend.lnk" -ForegroundColor Green
Write-Host "이제 바탕화면에서 'Academy Frontend'를 더블클릭하면 됩니다." -ForegroundColor Cyan
