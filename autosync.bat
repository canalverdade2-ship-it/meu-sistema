@echo off
title GSA AUTO SYNC
color 0A

cd /d "C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)"

:LOOP

for /f %%i in ('git branch --show-current') do set BRANCH=%%i

git status --porcelain >nul

git add .

git diff --cached --quiet

if errorlevel 1 (
    echo Alteracoes encontradas...
    git commit -m "Auto Sync"
    git pull --rebase origin %BRANCH%
    git push origin %BRANCH%
)

timeout /t 1 /nobreak >nul

goto LOOP