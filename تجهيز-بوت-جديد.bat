@echo off
chcp 65001 >nul
title نسخة البوت لسيرفر ثاني
cd /d "%~dp0"
node newbot.js
echo.
pause
