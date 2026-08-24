@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist "工作台.html" (
  start "" "工作台.html"
) else (
  echo 未找到 工作台.html，请确认压缩包已完整解压。
  pause
)
