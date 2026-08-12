@echo off
chcp 65001 > nul
title GERAR PASTA DE DEPLOY MANUAL - CLOUDFLARE PAGES
color 0A

echo =======================================================
echo    GSA - GERAR PASTA DIST PARA DEPLOY MANUAL CLOUDFLARE
echo =======================================================
echo.

echo [1/3] Compilando o sistema para producao...
call npm run build

if %errorlevel% neq 0 (
    echo.
    echo =======================================================
    echo   [ERRO] O build falhou! Corrija os erros antes de subir.
    echo =======================================================
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Garantindo arquivos de roteamento SPA e Headers do Cloudflare...
if not exist "dist\_redirects" (
    echo /*    /index.html   200 > "dist\_redirects"
)
if exist "public\_headers" (
    copy /y "public\_headers" "dist\_headers" > nul
)

echo.
echo =======================================================
echo   [SUCESSO] A pasta "dist" esta 100%% pronta e otimizada!
echo.
echo   Como fazer o upload no Cloudflare Pages:
echo   1. Acesse o painel do Cloudflare: https://dash.cloudflare.com
echo   2. Vá em Workers ^& Pages ^> Seu Projeto
echo   3. Clique em "Upload assets" / "Create deployment"
echo   4. Arraste a pasta "dist" (que vamos abrir agora)
echo =======================================================
echo.

echo [3/3] Abrindo a pasta dist no Windows Explorer...
explorer dist

echo.
pause
