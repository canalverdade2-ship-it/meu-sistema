@echo off

:loop
git pull --rebase
git add .
git commit -m "Auto Sync"
git push

timeout /t 60 >nul

goto loop