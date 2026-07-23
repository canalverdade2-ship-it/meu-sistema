@echo off
...

:LOOP

git pull origin main

git add .

git commit -m "..."

git push origin main

timeout /t 1 /nobreak >nul
goto LOOP