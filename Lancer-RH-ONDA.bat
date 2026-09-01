@echo off
chcp 65001 >nul
title RH ONDA - Demarrage
cd /d "%~dp0"

echo ============================================
echo            RH ONDA - Plateforme RH
echo ============================================
echo.
echo  Demarrage en cours, merci de patienter...
echo  (la premiere fois peut prendre quelques minutes)
echo.

REM --- 1) Verifier que Docker est demarre -------------------------
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo  Lancement de Docker Desktop...
    start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"

    echo  Attente du demarrage de Docker...
    :attente_docker
    timeout /t 3 >nul
    docker info >nul 2>&1
    if %errorlevel% neq 0 goto attente_docker
)

echo  Docker est pret.
echo.

REM --- 2) Lancer la plateforme ------------------------------------
echo  Lancement de la plateforme RH ONDA...
docker compose up -d --build
if %errorlevel% neq 0 (
    echo.
    echo  [ERREUR] Le demarrage a echoue.
    echo  Verifiez que Docker Desktop est bien installe.
    echo.
    pause
    exit /b 1
)

REM --- 3) Attendre que le site reponde ---------------------------
echo.
echo  Presque pret...
:attente_site
timeout /t 2 >nul
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:8080' -UseBasicParsing -TimeoutSec 3; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 goto attente_site

REM --- 4) Ouvrir le navigateur -----------------------------------
echo  Ouverture de la plateforme dans le navigateur...
start "" "http://localhost:8080"

echo.
echo ============================================
echo   RH ONDA est demarre !
echo   Adresse : http://localhost:8080
echo ============================================
echo.
echo  Vous pouvez fermer cette fenetre.
echo  Pour arreter la plateforme : double-cliquez sur "Arreter-RH-ONDA.bat"
echo.
timeout /t 8 >nul
