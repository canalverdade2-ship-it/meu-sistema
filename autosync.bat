@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title GSA - SINCRONIZACAO AUTOMATICA
color 0D

:: Usa a pasta onde este arquivo BAT esta salvo
cd /d "%~dp0"

:LOOP

cls
echo =======================================================
echo       GSA - SINCRONIZACAO AUTOMATICA GITHUB
echo =======================================================
echo.

:: Descobre a branch atual
for /f %%i in ('git branch --show-current') do set "BRANCH=%%i"

echo Branch atual: !BRANCH!
echo.

:: Verifica se ja existe conflito pendente
if exist ".git\rebase-merge" goto CONFLITO
if exist ".git\rebase-apply" goto CONFLITO
if exist ".git\MERGE_HEAD" goto CONFLITO

echo [1/4] Preparando alteracoes do computador...

git add -A
git diff --cached --quiet

if errorlevel 1 (
    git commit -m "Sincronizacao automatica - %date% %time%"

    if errorlevel 1 (
        echo.
        echo ERRO ao criar o commit.
        timeout /t 3 /nobreak >nul
        goto LOOP
    )
) else (
    echo Nenhuma alteracao local para gravar.
)

echo.
echo [2/4] Baixando alteracoes do GitHub...

git pull --rebase origin !BRANCH!

if errorlevel 1 goto CONFLITO

echo.
echo [3/4] Enviando alteracoes para o GitHub...

git push origin !BRANCH!

if errorlevel 1 (
    echo.
    echo ERRO ao enviar para o GitHub.
    timeout /t 3 /nobreak >nul
    goto LOOP
)

echo.
echo [4/4] Sincronizacao concluida com sucesso.
echo.
echo Nova verificacao em 1 segundo...

timeout /t 1 /nobreak >nul
goto LOOP


:CONFLITO

cls
color 0C

echo =======================================================
echo                 CONFLITO DETECTADO
echo =======================================================
echo.
echo O arquivo foi alterado no computador e no GitHub.
echo.
echo Escolha qual versao deve permanecer em todos os
echo arquivos que estiverem em conflito:
echo.
echo [1] Manter a versao do COMPUTADOR
echo [2] Manter a versao do GITHUB
echo [3] Parar para resolver manualmente
echo.

choice /c 123 /n /m "Digite 1, 2 ou 3: "

if errorlevel 3 goto MANUAL
if errorlevel 2 goto ESCOLHER_GITHUB
if errorlevel 1 goto ESCOLHER_COMPUTADOR


:ESCOLHER_COMPUTADOR

echo.
echo Mantendo a versao do COMPUTADOR...

:: Durante rebase, THEIRS representa o commit local
if exist ".git\rebase-merge" (
    git checkout --theirs -- .
    goto CONTINUAR_REBASE
)

if exist ".git\rebase-apply" (
    git checkout --theirs -- .
    goto CONTINUAR_REBASE
)

:: Durante merge normal, OURS representa o computador
if exist ".git\MERGE_HEAD" (
    git checkout --ours -- .
    git add -A
    git commit -m "Conflito resolvido mantendo o computador"
    goto RESOLVIDO
)

goto MANUAL


:ESCOLHER_GITHUB

echo.
echo Mantendo a versao do GITHUB...

:: Durante rebase, OURS representa a base do GitHub
if exist ".git\rebase-merge" (
    git checkout --ours -- .
    goto CONTINUAR_REBASE
)

if exist ".git\rebase-apply" (
    git checkout --ours -- .
    goto CONTINUAR_REBASE
)

:: Durante merge normal, THEIRS representa o GitHub
if exist ".git\MERGE_HEAD" (
    git checkout --theirs -- .
    git add -A
    git commit -m "Conflito resolvido mantendo o GitHub"
    goto RESOLVIDO
)

goto MANUAL


:CONTINUAR_REBASE

git add -A

set "GIT_EDITOR=true"
git rebase --continue

:: Pode existir outro conflito no proximo commit do rebase
if exist ".git\rebase-merge" goto CONFLITO
if exist ".git\rebase-apply" goto CONFLITO

if errorlevel 1 goto MANUAL

goto RESOLVIDO


:RESOLVIDO

color 0A

echo.
echo =======================================================
echo            CONFLITO RESOLVIDO COM SUCESSO
echo =======================================================
echo.
echo Enviando a versao escolhida para o GitHub...

git push origin !BRANCH!

if errorlevel 1 (
    echo.
    echo Nao foi possivel enviar agora.
    echo O sistema tentara novamente.
)

timeout /t 3 /nobreak >nul
goto LOOP


:MANUAL

color 0E

echo.
echo =======================================================
echo          SINCRONIZACAO INTERROMPIDA
echo =======================================================
echo.
echo Resolva o conflito manualmente antes de abrir
echo este arquivo novamente.
echo.
pause
exit /b