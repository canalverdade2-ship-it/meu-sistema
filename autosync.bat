@echo off
chcp 65001 > nul

:loop
git pull origin main --autostash --no-edit >nul 2>&1
git add .
git diff-index --quiet HEAD || git commit -m "Auto Sync" >nul 2>&1
git push origin main >nul 2>&1

timeout /t 10 >nul
goto loop