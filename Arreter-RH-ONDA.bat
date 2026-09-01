@echo off
chcp 65001 >nul
title RH ONDA - Arret
cd /d "%~dp0"

echo ============================================
echo         RH ONDA - Arret de la plateforme
echo ============================================
echo.
echo  Arret en cours...

docker compose down

echo.
echo  La plateforme est arretee.
echo  Pour la relancer : double-cliquez sur "Lancer-RH-ONDA.bat"
echo.
timeout /t 6 >nul
