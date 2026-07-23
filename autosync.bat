@echo off
title GSA AUTO SYNC
color 0A

:: Caminho do projeto
cd /d "C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)"

:LOOP

echo.
echo ======================================
echo %date% %time%
echo ======================================

:: Descobre automaticamente a branch
for /f %%i in ('git branch --show-current') do set BRANCH=%%i

:: Adiciona alterações
git add .

:: Commit apenas se houver alterações
git diff --cached --quiet

if errorlevel 1 (
    git commit -m "Auto Sync"
)

:: Atualiza do GitHub
git pull --rebase origin %BRANCH%

:: Envia alterações
git push origin %BRANCH%

:: Aguarda 1 segundo
timeout /t 1 /nobreak >nul

goto LOOP