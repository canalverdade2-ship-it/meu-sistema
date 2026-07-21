@echo off
chcp 65001 > nul
title SINCRONIZAR COMPLETO - GITHUB (SUBIR E BAIXAR)
color 0D

echo =======================================================
echo     GSA - SINCRONIZAÇÃO COMPLETA COM O GITHUB
echo =======================================================
echo.

echo [Step 1/4] Baixando novidades do GitHub...
git pull origin main

echo.
echo [Step 2/4] Preparando arquivos alterados localmente...
git add .

echo.
set /p msg="Digite a descricao das suas alteracoes (ou ENTER para padrao): "
if "%msg%"=="" (
    set msg=Sincronizacao automatica - %date% %time%
)

echo.
echo [Step 3/4] Gravando alteracoes no sistema: "%msg%"
git commit -m "%msg%"

echo.
echo [Step 4/4] Enviando tudo para o GitHub...
git push origin main

echo.
if %errorlevel% equ 0 (
    echo =======================================================
    echo   [SUCESSO] Sincronizacao concluida com sucesso!
    echo =======================================================
) else (
    echo =======================================================
    echo   [AVISO] Verifique as mensagens acima para detalhes.
    echo =======================================================
)

echo.
pause
