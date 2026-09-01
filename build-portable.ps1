<#
    build-portable.ps1
    ---------------------------------------------------------------------------
    Construit le dossier livrable « RH ONDA » PORTABLE — SANS Docker, SANS
    installation sur le PC client. Le client extrait le dossier et double-clique
    « Lancer-RH-ONDA.bat ».

    Ce que fait le script :
      1. Prépare un runtime PHP 8.3 portable (téléchargé une fois dans tools\php).
      2. Copie le backend Laravel + installe les dépendances de production.
      3. Compile le frontend React (build Vite) et le place dans public/.
      4. Génère backend\.env (réutilise l'APP_KEY du .env racine).
      5. Génère php.ini (extensions requises) et le lanceur.
      6. Ajoute les scripts de sauvegarde et un LISEZ-MOI.

    Outils requis SUR TON POSTE (build uniquement, pas chez le client) :
      composer, npm.  (PHP portable est téléchargé automatiquement.)

    Utilisation :
      powershell -ExecutionPolicy Bypass -File build-portable.ps1
      (option) -Out "chemin\du\dossier"   pour changer le dossier de sortie
#>
[CmdletBinding()]
param(
    [string]$Out = "livraison-portable"
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Info($m) { Write-Host "    $m" -ForegroundColor Gray }
function Need($cmd, $hint) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "'$cmd' introuvable sur ce poste. $hint"
    }
}
function Robo($src, $dst, [string[]]$extra) {
    $roboArgs = @($src, $dst, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP') + $extra
    robocopy @roboArgs | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy a échoué ($src -> $dst), code $LASTEXITCODE" }
    $global:LASTEXITCODE = 0
}

# ---------------------------------------------------------------------------
Step "1/9  Vérification des outils de build"
Need composer "Installe Composer : https://getcomposer.org/"
Need npm      "Installe Node.js  : https://nodejs.org/"
Info "composer et npm présents."

# ---------------------------------------------------------------------------
Step "2/9  Runtime PHP 8.3 portable"
$phpSrc = Join-Path $root "tools\php"
if (Test-Path (Join-Path $phpSrc "php.exe")) {
    Info "PHP portable déjà présent : $phpSrc (aucun téléchargement)."
}
else {
    $listUrl = "https://windows.php.net/downloads/releases/"
    Info "Recherche du dernier PHP 8.3 (NTS x64) sur $listUrl ..."
    $html = (Invoke-WebRequest -Uri $listUrl -UseBasicParsing).Content
    $names = [regex]::Matches($html, 'php-8\.3\.\d+-nts-Win32-vs16-x64\.zip') |
        ForEach-Object { $_.Value } | Sort-Object -Unique
    if (-not $names) {
        throw "Aucun build PHP 8.3 NTS x64 trouvé. Place manuellement un PHP portable dans tools\php\ (php.exe à la racine)."
    }
    $file = $names | Sort-Object { [version]([regex]::Match($_, '8\.3\.\d+').Value) } | Select-Object -Last 1
    $url = $listUrl + $file
    $zip = Join-Path $env:TEMP $file
    Info "Téléchargement : $url"
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    $sha = (Get-FileHash $zip -Algorithm SHA256).Hash
    Info "SHA256 : $sha"
    Info "(note : vérifie ce hash sur windows.php.net si tu veux le certifier)"
    New-Item -ItemType Directory -Force $phpSrc | Out-Null
    Expand-Archive -Path $zip -DestinationPath $phpSrc -Force
    Remove-Item $zip -Force
    Info "PHP portable extrait dans $phpSrc"
}

# ---------------------------------------------------------------------------
Step "3/9  Préparation du dossier de sortie"
$outDir = Join-Path $root $Out
if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
New-Item -ItemType Directory -Force $outDir | Out-Null
Info "Dossier : $outDir"

# ---------------------------------------------------------------------------
Step "4/9  Copie du runtime PHP + php.ini"
Robo $phpSrc (Join-Path $outDir "php") @()
$ini = @"
[PHP]
extension_dir = "ext"
extension=pdo_sqlite
extension=sqlite3
extension=mbstring
extension=openssl
extension=fileinfo
extension=zip
extension=curl
memory_limit = 512M
date.timezone = Africa/Casablanca
"@
Set-Content -Path (Join-Path $outDir "php\php.ini") -Value $ini -Encoding ASCII
Info "php.ini généré (pdo_sqlite, sqlite3, mbstring, openssl, fileinfo, zip, curl)."

# ---------------------------------------------------------------------------
Step "5/9  Copie du backend Laravel (sans vendor/tests)"
Robo (Join-Path $root "backend") (Join-Path $outDir "backend") `
    @('/XD', 'vendor', 'node_modules', 'tests', '.git')
# Nettoyage : on génère notre propre .env, pas de logs ni journal SQLite.
$bk = Join-Path $outDir "backend"
Remove-Item (Join-Path $bk ".env") -ErrorAction SilentlyContinue
Get-ChildItem (Join-Path $bk "storage\logs") -Filter *.log -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem (Join-Path $bk "database") -Filter *.sqlite-journal -ErrorAction SilentlyContinue | Remove-Item -Force
if (Test-Path (Join-Path $bk "database\database.sqlite")) {
    Info "Base SQLite embarquée (données actuelles) : backend\database\database.sqlite"
} else {
    Info "ATTENTION : aucune base database.sqlite trouvée — une base vierge sera créée au 1er lancement."
}

# ---------------------------------------------------------------------------
Step "6/9  Dépendances PHP de production (composer install --no-dev)"
# composer écrit sur stderr : sous ErrorActionPreference=Stop, PowerShell 5.1
# transforme ces lignes en erreur fatale et avorte l'étape. On relâche donc
# temporairement et on se fie au vrai code de sortie ($LASTEXITCODE).
$ErrorActionPreference = 'Continue'
composer install --working-dir "$bk" --no-dev --optimize-autoloader --no-interaction --prefer-dist
$code = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($code -ne 0) { throw "composer install a échoué (code $code)." }

# ---------------------------------------------------------------------------
Step "7/9  Build du frontend React (Vite)"
Push-Location (Join-Path $root "frontend")
try {
    # npm écrit aussi sur stderr : même précaution que composer ci-dessus.
    $ErrorActionPreference = 'Continue'
    if (Test-Path "package-lock.json") { npm ci } else { npm install }
    $code = $LASTEXITCODE
    if ($code -eq 0) { npm run build; $code = $LASTEXITCODE }
}
finally {
    Pop-Location
    $ErrorActionPreference = 'Stop'
}
if ($code -ne 0) { throw "build du frontend a échoué (code $code)." }
# Le build est copié DANS public/ pour être servi par le même PHP (/api relatif).
Robo (Join-Path $root "frontend\build") (Join-Path $bk "public") @()
Info "SPA compilé copié dans backend\public\"

# ---------------------------------------------------------------------------
Step "8/9  Génération de backend\.env"
$appKeyLine = Get-Content (Join-Path $root ".env") |
    Where-Object { $_ -match '^\s*APP_KEY\s*=' } | Select-Object -First 1
if (-not $appKeyLine) { throw "APP_KEY introuvable dans le .env racine — impossible de générer backend\.env." }
$appKey = ($appKeyLine -replace '^\s*APP_KEY\s*=', '').Trim()
$envContent = @"
APP_NAME="RH ONDA"
APP_ENV=production
APP_KEY=$appKey
APP_DEBUG=false
APP_URL=http://localhost:8000

LOG_CHANNEL=stack
LOG_LEVEL=error

# SQLite — DB_DATABASE volontairement absent : Laravel utilise
# database/database.sqlite relatif à l'app, donc portable où qu'on l'extraie.
DB_CONNECTION=sqlite

# Pilotes fichier : aucune table session/cache requise en base.
SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=sync
"@
Set-Content -Path (Join-Path $bk ".env") -Value $envContent -Encoding UTF8
Info "APP_KEY réutilisée depuis le .env racine (données chiffrées restent lisibles)."

# ---------------------------------------------------------------------------
Step "9/9  Lanceur, sauvegardes et LISEZ-MOI"

# --- Lanceur portable ---
$launcher = @'
@echo off
chcp 65001 >nul
title RH ONDA - Plateforme RH
set "BASE=%~dp0"
set "PHP=%BASE%php\php.exe"
set "INI=%BASE%php\php.ini"
set "EXT=%BASE%php\ext"
set "APP=%BASE%backend"
cd /d "%APP%"

echo ============================================
echo            RH ONDA - Plateforme RH
echo ============================================
echo.
echo  Preparation de la base de donnees...
"%PHP%" -c "%INI%" -d extension_dir="%EXT%" artisan config:clear >nul 2>&1
"%PHP%" -c "%INI%" -d extension_dir="%EXT%" artisan migrate --force
if %errorlevel% neq 0 (
    echo.
    echo  [ERREUR] Preparation de la base impossible.
    pause
    exit /b 1
)

REM Ouvre le navigateur 4 secondes apres (le temps que le serveur demarre).
start "" powershell -NoProfile -Command "Start-Sleep 4; Start-Process 'http://localhost:8000'"

echo.
echo ============================================
echo   RH ONDA demarre sur http://localhost:8000
echo.
echo   >> Laissez CETTE FENETRE OUVERTE pendant l'utilisation.
echo   >> Fermez-la pour arreter la plateforme.
echo ============================================
echo.
"%PHP%" -c "%INI%" -d extension_dir="%EXT%" artisan serve --host=127.0.0.1 --port=8000
'@
Set-Content -Path (Join-Path $outDir "Lancer-RH-ONDA.bat") -Value $launcher -Encoding ASCII

# --- Scripts de sauvegarde (memes fichiers, structure backend\ identique) ---
foreach ($f in @("Sauvegarder-RH-ONDA.bat", "Installer-Sauvegarde-Auto.bat")) {
    if (Test-Path (Join-Path $root $f)) {
        Copy-Item (Join-Path $root $f) (Join-Path $outDir $f) -Force
    }
}

# --- LISEZ-MOI client ---
$readme = @"
========================================================
   RH ONDA - Plateforme RH (version portable)
========================================================

INSTALLATION : AUCUNE.
Ce dossier contient tout ce qu'il faut (aucun logiciel a installer).

--------------------------------------------------------
DEMARRER LA PLATEFORME
--------------------------------------------------------
1. Double-cliquez sur   Lancer-RH-ONDA.bat
2. Le navigateur s'ouvre tout seul sur http://localhost:8000
3. Laissez la fenetre noire OUVERTE tant que vous utilisez la plateforme.

Pour ARRETER : fermez simplement la fenetre noire.

--------------------------------------------------------
SAUVEGARDE AUTOMATIQUE (recommande, une seule fois)
--------------------------------------------------------
Double-cliquez sur   Installer-Sauvegarde-Auto.bat
  (aucun droit administrateur requis).
La base sera sauvegardee automatiquement chaque semaine
dans le dossier "sauvegardes".

--------------------------------------------------------
IMPORTANT
--------------------------------------------------------
- Toutes vos donnees sont dans :  backend\database\database.sqlite
- Ne supprimez pas ce fichier. Il contient TOUTES les donnees.
========================================================
"@
Set-Content -Path (Join-Path $outDir "LISEZ-MOI.txt") -Value $readme -Encoding UTF8

# ---------------------------------------------------------------------------
Write-Host "`n===================================================" -ForegroundColor Green
Write-Host " PACKAGE PORTABLE CONSTRUIT :" -ForegroundColor Green
Write-Host "   $outDir" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
Write-Host @"

ETAPE SUIVANTE OBLIGATOIRE (test a froid) :
  1. Double-clique "$Out\Lancer-RH-ONDA.bat"
  2. Verifie : connexion, une page (ex. Personnel/Dashboard),
     et surtout un IMPORT/EXPORT Excel (extension zip).
  Ce test avec le PHP portable est le seul moyen de valider
  que les extensions et le .env sont corrects.

Puis compresse le dossier "$Out" en .zip et livre-le au client.
"@ -ForegroundColor Yellow
