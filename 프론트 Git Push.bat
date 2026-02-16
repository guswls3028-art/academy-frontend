@echo off
chcp 65001 >nul
title 프론트 Git Push
cd /d C:\academyfront
echo.
echo [academyfront] git add -A
git add -A
echo.
echo [academyfront] git status
git status
echo.
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Update"
  git push
) else (
  echo 변경 없음. push 할 내용이 없습니다.
)
echo.
pause
