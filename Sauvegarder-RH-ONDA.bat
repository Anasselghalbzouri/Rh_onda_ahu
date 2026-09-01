@echo off
chcp 65001 >nul
title RH ONDA - Sauvegarde
cd /d "%~dp0"

REM Copie la base SQLite dans le dossier "sauvegardes" avec la date du jour.
REM Garde les 12 dernieres sauvegardes (env. 3 mois en hebdomadaire).
REM Fonctionne aussi bien en double-clic qu'en tache planifiee (pas de pause bloquante).

powershell -NoProfile -ExecutionPolicy Bypass -Command "$src = Join-Path '%~dp0' 'backend\database\database.sqlite'; $dest = Join-Path '%~dp0' 'sauvegardes'; if (-not (Test-Path $src)) { Write-Host '[ERREUR] Base introuvable : ' $src; exit 1 }; New-Item -ItemType Directory -Force -Path $dest | Out-Null; $stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm'; $out = Join-Path $dest ('database_' + $stamp + '.sqlite'); Copy-Item $src $out -Force; $log = Join-Path $dest 'journal-sauvegardes.txt'; Add-Content -Encoding UTF8 $log ((Get-Date -Format 'yyyy-MM-dd HH:mm') + '  ->  ' + (Split-Path $out -Leaf)); Get-ChildItem $dest -Filter 'database_*.sqlite' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 12 | Remove-Item -Force; Write-Host ('[OK] Sauvegarde creee : ' + $out)"

REM timeout (et non pause) : n'immobilise jamais la tache planifiee.
timeout /t 5 >nul 2>&1
