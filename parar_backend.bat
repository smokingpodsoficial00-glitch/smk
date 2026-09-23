@echo off
title Parar Backend Smoking Pods
echo Encerrando processo na porta 3006...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3006" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a
)
echo Backend finalizado.
timeout /t 2 >nul
