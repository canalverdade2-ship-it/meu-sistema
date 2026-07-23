@echo off
chcp 65001 >nul
title SINCRONIZAR COMPLETO - GITHUB AUTO
color 0D

:LOOP

echo =======================================================
echo     GSA - SINCRONIZACAO AUTOMATICA COM O GITHUB
echo =======================================================
echo.

for /f %%i in ('git branch --show-current') do set BRANCH=%%i

echo Branch atual: %BRANCH%
echo.

echo [1/4] Baixando novidades do GitHub...
git pull --rebase origin %BRANCH%

echo.
echo [2/4] Preparando arquivos alterados...
git add .

echo.
echo [3/4] Gravando alteracoes...
git diff --cached --quiet

if errorlevel 1 (
    git commit -m "Sincronizacao automatica - %date% %time%"
) else (
    echo Nenhuma alteracao para gravar.
)

echo.
echo [4/4] Enviando para o GitHub...
git push origin %BRANCH%

echo.
echo Aguardando 1 segundo...
timeout /t 1 /nobreak >nul

goto LOOP