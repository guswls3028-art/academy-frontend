# 바탕화면 "Academy Frontend" 바로가기 생성/덮어쓰기
# 사용: 프론트 폴더에서 실행
#   pwsh -ExecutionPolicy Bypass -File scripts/create-desktop-shortcut.ps1
# 창이 바로 꺼질 때: 이 스크립트 실행 후 바탕화면 "Academy Frontend" 다시 실행

$Desktop = [Environment]::GetFolderPath('Desktop')
$FrontendRoot = $PSScriptRoot | Split-Path -Parent
# 루트의 Academy-Frontend.bat 사용 (경로 단순, 바로가기 오류 방지)
$BatPath = Join-Path $FrontendRoot "Academy-Frontend.bat"

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

Write-Host "바탕화면 바로가기 생성됨: $Desktop\Academy Frontend.lnk" -ForegroundColor Green
Write-Host "대상: $BatPath" -ForegroundColor Cyan
Write-Host "이제 바탕화면에서 'Academy Frontend'를 더블클릭하세요." -ForegroundColor Cyan
