@echo off
chcp 65001 > nul
title BAIXAR E ATUALIZAR ARQUIVOS DO GITHUB (GIT PULL)
color 0B

echo =======================================================
echo        GSA - BAIXAR ATUALIZAÇÕES DO GITHUB
echo =======================================================
echo.

echo [1/1] Baixando arquivos mais recentes do GitHub (pull com autostash)...
git pull origin main --autostash --no-edit

echo.
if %errorlevel% equ 0 (
    echo =======================================================
    echo   [SUCESSO] Seu projeto esta 100%% atualizado com o GitHub!
    echo =======================================================
) else (
    echo =======================================================
    echo   [AVISO] Houve um problema ao baixar as atualizacoes.
    echo =======================================================
)

echo.
pause
