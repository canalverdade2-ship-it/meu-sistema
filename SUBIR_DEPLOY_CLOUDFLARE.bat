@echo off
chcp 65001 > nul
title SUBIR DEPLOY PARA O CLOUDFLARE PAGES
color 0B

echo =======================================================
echo         GSA - SUBIR DEPLOY PARA O CLOUDFLARE PAGES
echo =======================================================
echo.

echo [1/3] Limpando e gerando build de producao...
call npm run build

if %errorlevel% neq 0 (
    echo.
    echo =======================================================
    echo   [ERRO] O build falhou! Verifique as mensagens acima.
    echo =======================================================
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Verificando arquivos de roteamento e headers SPA...
if not exist "dist\_redirects" (
    echo /*    /index.html   200 > "dist\_redirects"
)
if exist "public\_headers" (
    copy /y "public\_headers" "dist\_headers" > nul
)

echo.
echo [3/3] Enviando build para o Cloudflare Pages...
call npx wrangler pages deploy dist --project-name gsa-hub

echo.
if %errorlevel% equ 0 (
    echo =======================================================
    echo   [SUCESSO] Deploy no Cloudflare concluido com sucesso!
    echo =======================================================
) else (
    echo =======================================================
    echo   [INFO/AVISO] Ocorreu uma pendencia no deploy automatico.
    echo   Se for o primeiro acesso, faça login no terminal com:
    echo   npx wrangler login
    echo =======================================================
)

echo.
pause
