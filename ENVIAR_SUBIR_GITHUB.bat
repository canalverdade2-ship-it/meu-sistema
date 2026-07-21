@echo off
chcp 65001 > nul
title SUBIR ARQUIVOS PARA O GITHUB (GIT PUSH)
color 0A

echo =======================================================
echo           GSA - SUBIR ALTERAÇÕES PARA O GITHUB
echo =======================================================
echo.

echo [1/3] Adicionando arquivos alterados...
git add .

echo.
set /p msg="Digite a mensagem da alteração (ou pressione ENTER para mensagem padrao): "
if "%msg%"=="" (
    set msg=Atualizacao automatica - %date% %time%
)

echo.
echo [2/3] Criando commit: "%msg%"
git commit -m "%msg%"

echo.
echo [3/3] Enviando para o GitHub (push)...
git push origin main

echo.
if %errorlevel% equ 0 (
    echo =======================================================
    echo   [SUCESSO] Arquivos enviados para o GitHub com sucesso!
    echo =======================================================
) else (
    echo =======================================================
    echo   [ERRO] Houve uma falha ao enviar para o GitHub.
    echo =======================================================
)

echo.
pause
