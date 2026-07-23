@echo off
chcp 65001 > nul
title GSA HUB - Sincronização Automática
color 0A

echo =======================================================
echo     GSA HUB - SINCRONIZAÇÃO AUTOMÁTICA EM EXECUÇÃO
echo =======================================================
echo.

:loop
echo [%time:~0,8%] Verificando e baixando atualizações do GitHub...
git pull origin main --autostash --no-edit >nul 2>&1

git add .
git diff-index --quiet HEAD || (
    echo [%time:~0,8%] Enviando alterações para o GitHub...
    git commit -m "Auto Sync - %date% %time:~0,8%" >nul 2>&1
    git push origin main >nul 2>&1
)

echo [%time:~0,8%] [OK] Projeto 100%% atualizado! Próxima verificação em 10s...
echo -------------------------------------------------------

timeout /t 10 >nul
goto loop