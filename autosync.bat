@echo off
title GSA Auto Sync

cd /d "C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)"

:loop

git pull --rebase

git add .

git diff --cached --quiet
if errorlevel 1 (
    git commit -m "Auto Sync"
    git push
)

timeout /t 2 >nul

goto loop