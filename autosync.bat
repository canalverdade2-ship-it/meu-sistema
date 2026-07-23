@echo off
title GSA Auto Sync

cd /d "C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)"

:loop

git add .

git diff --cached --quiet
if errorlevel 1 (
    echo.
    echo ======================================
    echo [%date% %time%] Alteracao detectada...
    echo ======================================

    git pull --rebase

    git commit -m "Auto Sync"

    git push

    echo.
    echo Sincronizacao concluida!
)

timeout /t 2 >nul

goto loop