<#
    build-hostinger.ps1
    ---------------------------------------------------------------------------
    Construit le dossier livrable "RH ONDA" pret a etre uploade sur un
    hebergement mutualise Hostinger (plan "Unlimited Web Hosting" ou similaire).

    Meme principe que build-portable.ps1, mais SANS runtime PHP embarque
    (Hostinger fournit deja PHP) : seulement le backend Laravel (avec vendor/
    et le frontend React compile dans public/) + un .env pret a l'emploi.

    Ce que fait le script :
      1. Compile le frontend React (build Vite) -> frontend\build.
      2. Copie le backend Laravel + installe les dependances de production.
      3. Copie le build frontend DANS backend\public (SPA + API sur un seul
         domaine, cf. routes\web.php).
      4. Genere backend\.env a partir de .env.production (reutilise une
         APP_KEY stable stockee dans .env a la racine).
      5. Produit un .zip pret a uploader sur Hostinger.

    Outils requis SUR TON POSTE (build uniquement) : composer, npm, php.

    Utilisation :
      powershell -ExecutionPolicy Bypass -File build-hostinger.ps1
      (option) -Out "chemin\du\dossier"   pour changer le dossier de sortie
      (option) -AppUrl "https://votredomaine.com"   pour fixer APP_URL

    Apres le build :
      1. Verifie/edite le .env genere dans le dossier de sortie si besoin.
      2. Uploade le contenu du dossier "backend" sur Hostinger (File Manager
         ou FTP), ou uploade directement le .zip produit puis extrais-le
         via le File Manager Hostinger.
      3. Dans hPanel, pointe le document root du domaine sur backend/public.
      4. Verifie les permissions en ecriture de storage/, bootstrap/cache/
         et database/database.sqlite.
      5. Lance "php artisan migrate --force" via SSH (si disponible) ou via
         un script one-shot uploade temporairement.
#>
[CmdletBinding()]
param(
    [string]$Out = "livraison-hostinger",
    [string]$AppUrl = "https://votredomaine.com"
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
    if ($LASTEXITCODE -ge 8) { throw "robocopy a echoue ($src -> $dst), code $LASTEXITCODE" }
    $global:LASTEXITCODE = 0
}

# ---------------------------------------------------------------------------
Step "1/6  Verification des outils de build"
Need composer "Installe Composer : https://getcomposer.org/"
Need npm      "Installe Node.js  : https://nodejs.org/"
Need php      "Installe PHP 8.3  : necessaire pour generer l'APP_KEY."
Info "composer, npm et php presents."

# ---------------------------------------------------------------------------
Step "2/6  Preparation du dossier de sortie"
$outDir = Join-Path $root $Out
if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
New-Item -ItemType Directory -Force $outDir | Out-Null
Info "Dossier : $outDir"

# ---------------------------------------------------------------------------
Step "3/6  Copie du backend Laravel (sans vendor/tests) + dependances de prod"
$bk = Join-Path $outDir "backend"
Robo (Join-Path $root "backend") $bk `
    @('/XD', 'vendor', 'node_modules', 'tests', '.git')
Remove-Item (Join-Path $bk ".env") -ErrorAction SilentlyContinue
Get-ChildItem (Join-Path $bk "storage\logs") -Filter *.log -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem (Join-Path $bk "database") -Filter *.sqlite-journal -ErrorAction SilentlyContinue | Remove-Item -Force
if (Test-Path (Join-Path $bk "database\database.sqlite")) {
    Info "Base SQLite embarquee (donnees actuelles) : backend\database\database.sqlite"
} else {
    Info "ATTENTION : aucune base database.sqlite trouvee - une base vierge sera creee au 1er lancement."
}

$ErrorActionPreference = 'Continue'
composer install --working-dir "$bk" --no-dev --optimize-autoloader --no-interaction --prefer-dist
$code = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($code -ne 0) { throw "composer install a echoue (code $code)." }

# ---------------------------------------------------------------------------
Step "4/6  Build du frontend React (Vite) -> copie dans backend\public"
Push-Location (Join-Path $root "frontend")
try {
    $ErrorActionPreference = 'Continue'
    # npm install plutot que npm ci : le lockfile de ce projet derive parfois
    # sur des dependances optionnelles transitives, ce qui fait echouer le
    # mode strict de npm ci meme juste apres un npm install reussi.
    npm install
    $code = $LASTEXITCODE
    if ($code -eq 0) { npm run build; $code = $LASTEXITCODE }
}
finally {
    Pop-Location
    $ErrorActionPreference = 'Stop'
}
if ($code -ne 0) { throw "build du frontend a echoue (code $code)." }
# /api est un chemin relatif (frontend\src\api.js) : le build sert la SPA et
# l'API depuis le meme domaine, pas de CORS ni de sous-domaine necessaire.
Robo (Join-Path $root "frontend\build") (Join-Path $bk "public") @()
Info "SPA compile copie dans backend\public\"

# ---------------------------------------------------------------------------
Step "5/6  Generation de backend\.env (a partir de .env.production)"
$envTemplate = Join-Path $root "backend\.env.production"
if (-not (Test-Path $envTemplate)) { throw "backend\.env.production introuvable." }

# APP_KEY stable : reutilisee depuis le .env racine si present, sinon
# generee une fois puis sauvegardee a la racine pour les prochains builds
# (une cle qui change rend les donnees deja chiffrees illisibles).
$rootEnv = Join-Path $root ".env"
$appKey = $null
if (Test-Path $rootEnv) {
    $line = Get-Content $rootEnv | Where-Object { $_ -match '^\s*APP_KEY\s*=' } | Select-Object -First 1
    if ($line) { $appKey = ($line -replace '^\s*APP_KEY\s*=', '').Trim() }
}
if (-not $appKey) {
    Info "Aucune APP_KEY existante trouvee : generation d'une nouvelle cle."
    $appKey = (php -r "echo 'base64:' . base64_encode(random_bytes(32));").Trim()
    Set-Content -Path $rootEnv -Value "APP_KEY=$appKey" -Encoding UTF8
    Info "Cle sauvegardee dans .env (racine) - NE PAS SUPPRIMER, a reutiliser aux prochains builds."
}

(Get-Content $envTemplate) `
    -replace '^APP_KEY=.*$', "APP_KEY=$appKey" `
    -replace '^APP_URL=.*$', "APP_URL=$AppUrl" |
    Set-Content -Path (Join-Path $bk ".env") -Encoding UTF8
Info "backend\.env genere avec APP_URL=$AppUrl"

# ---------------------------------------------------------------------------
Step "6/6  Compression en .zip"
$zipPath = Join-Path $root "$Out.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $outDir '*') -DestinationPath $zipPath -CompressionLevel Optimal
Info "Archive : $zipPath"

# ---------------------------------------------------------------------------
Write-Host "`n===================================================" -ForegroundColor Green
Write-Host " PACKAGE HOSTINGER PRET :" -ForegroundColor Green
Write-Host "   $outDir" -ForegroundColor Green
Write-Host "   $zipPath" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
Write-Host @"

ETAPES SUIVANTES SUR HOSTINGER (hPanel) :
  1. Uploade "$Out.zip" via File Manager, puis extrais-le
     (ou uploade le dossier "backend" directement en FTP).
  2. Dans hPanel > domaine, regle le document root sur : backend/public
  3. Verifie les permissions en ecriture de :
       backend/storage, backend/bootstrap/cache, backend/database
  4. En SSH : cd vers backend puis
       php artisan migrate --force
       php artisan config:cache
  5. Active le SSL gratuit Hostinger sur le domaine.
  6. Verifie que backend\.env contient bien le bon APP_URL avant l'upload
     (relance avec -AppUrl "https://tondomaine.com" si besoin).
"@ -ForegroundColor Yellow
