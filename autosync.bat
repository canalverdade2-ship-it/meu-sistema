@echo off
title GSA HUB - Sincronizacao Automatica
color 0A

echo =======================================================
echo     GSA HUB - SINCRONIZACAO AUTOMATICA EM EXECUCAO
echo =======================================================
echo.

:loop
echo Verificando e baixando atualizacoes do GitHub...
git pull origin main --autostash --no-edit >nul 2>&1

git add .
git diff-index --quiet HEAD || (
    echo Enviando alteracoes para o GitHub...
    git commit -m "Auto Sync" >nul 2>&1
    git push origin main >nul 2>&1
)

echo [OK] Projeto 100%% atualizado! Proxima verificacao em 10s...
echo -------------------------------------------------------

timeout /t 10 >nul
goto loop