@echo off
title Backend & Tunel Cloudflare - Smoking Pods
cd /d "%~dp0backend"

echo ===================================================
echo     SMOKING PODS - BACKEND & CONEXAO VERCEL
echo ===================================================
echo.

echo 1. Verificando se o backend ja esta ativo na porta 3006...
netstat -aon | findstr ":3006" | findstr "LISTENING" >nul
if %errorlevel% neq 0 (
    echo [OK] Iniciando Backend Node.js...
    start "Backend Node (Porta 3006)" /min node server.js
    timeout /t 3 >nul
) else (
    echo [OK] Backend ja esta rodando na porta 3006.
)

echo.
echo 2. Iniciando Tunel Cloudflare para Vercel...
echo    Acesse: https://device-visible-chances-citations.trycloudflare.com
echo.
cloudflared.exe tunnel --url http://127.0.0.1:3006 --no-autoupdate
pause
