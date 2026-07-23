@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
color 0A
title GSA AUTO SYNC

:: ==========================
:: CONFIGURAÇÃO
:: ==========================
set "PROJETO=C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)"
set "BRANCH=main"
set "REMOTE=origin"
set "INTERVALO=60"
set "LOG=%PROJETO%\autosync.log"

cd /d "%PROJETO%" || (
    echo ERRO: Pasta do projeto não encontrada.
    pause
    exit /b
)

:LOOP

cls
echo ================================================
echo          GSA AUTO SYNC
echo ================================================
echo %date% %time%
echo.

echo ==================================================>>"%LOG%"
echo [%date% %time%] Inicio da sincronizacao>>"%LOG%"

:: ----------------------------------------------------
:: Verifica internet
:: ----------------------------------------------------
ping github.com -n 1 >nul

if errorlevel 1 (
    echo Sem conexao com a internet.
    echo [%date% %time%] Sem internet>>"%LOG%"
    goto ESPERA
)

:: ----------------------------------------------------
:: Atualiza referencias remotas
:: ----------------------------------------------------
echo Verificando GitHub...
git fetch %REMOTE%

:: ----------------------------------------------------
:: Atualizacoes remotas
:: ----------------------------------------------------
for /f %%i in ('git rev-list HEAD..%REMOTE%/%BRANCH% --count') do set REMOTO=%%i

if NOT "!REMOTO!"=="0" (

    echo.
    echo Atualizacoes encontradas no GitHub...
    echo [%date% %time%] Pull>>"%LOG%"

    git pull --rebase %REMOTE% %BRANCH%

)

:: ----------------------------------------------------
:: Alteracoes locais
:: ----------------------------------------------------
git add .

git diff --cached --quiet

if errorlevel 1 (

    echo.
    echo Alteracoes locais encontradas.

    set MSG=Auto Sync %date% %time%

    git commit -m "!MSG!"

    if not errorlevel 1 (

        echo.
        echo Enviando para GitHub...

        git push %REMOTE% %BRANCH%

        if errorlevel 1 (
            echo [%date% %time%] ERRO PUSH>>"%LOG%"
        ) else (
            echo [%date% %time%] PUSH OK>>"%LOG%"
        )

    ) else (

        echo Commit nao realizado.
        echo [%date% %time%] COMMIT IGNORADO>>"%LOG%"

    )

) else (

    echo.
    echo Nenhuma alteracao local.

)

:ESPERA

echo.
echo Proxima verificacao em %INTERVALO% segundos...
timeout /t %INTERVALO% /nobreak >nul

goto LOOP