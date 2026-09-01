@echo off
chcp 65001 >nul
title RH ONDA - Installation de la sauvegarde automatique
cd /d "%~dp0"

REM ============================================================
REM  A LANCER UNE SEULE FOIS sur le PC du client.
REM  Enregistre une tache Windows qui execute "Sauvegarder-RH-ONDA.bat"
REM  chaque semaine, automatiquement, sans aucune action de l'utilisateur.
REM
REM  AUCUN droit administrateur requis : la tache est creee pour
REM  l'utilisateur courant uniquement.
REM ============================================================

echo ============================================================
echo    Installation de la sauvegarde hebdomadaire RH ONDA
echo ============================================================
echo.
echo  Frequence  : chaque LUNDI a 12h00
echo  Rattrapage : si le PC etait eteint, la sauvegarde se fait
echo               des le prochain demarrage.
echo  Admin      : NON requis.
echo.

set "TASKBAT=%~dp0Sauvegarder-RH-ONDA.bat"
set "TASKDIR=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$bat = $env:TASKBAT;" ^
  "$dir = $env:TASKDIR.TrimEnd('\');" ^
  "$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/c \"' + $bat + '\"') -WorkingDirectory $dir;" ^
  "$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 12:00;" ^
  "$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10);" ^
  "Register-ScheduledTask -TaskName 'RH ONDA - Sauvegarde hebdomadaire' -Action $action -Trigger $trigger -Settings $settings -Description 'Sauvegarde automatique hebdomadaire de la base de donnees RH ONDA' -Force -ErrorAction Stop | Out-Null;" ^
  "Write-Host '[OK] Tache planifiee creee avec succes (sans admin).'"

if %errorlevel% neq 0 (
    echo.
    echo  [ERREUR] La creation de la tache a echoue.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   Termine ! La sauvegarde se fera automatiquement chaque
echo   semaine dans le dossier "sauvegardes".
echo.
echo   (Pour desactiver : ouvrir "Planificateur de taches" Windows
echo    et supprimer "RH ONDA - Sauvegarde hebdomadaire")
echo ============================================================
echo.
pause
