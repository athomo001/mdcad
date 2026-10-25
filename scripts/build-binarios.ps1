param(
    [switch]$Minor,
    [switch]$Major,
    [string]$SetVersion = "",
    # Compila con el perfil "release" (rápido) en vez de "dist" (binario más pequeño)
    [switch]$Fast
)

$ErrorActionPreference = "Stop"

$WorkspaceRoot = (Get-Item (Split-Path -Parent $MyInvocation.MyCommand.Path)).Parent.FullName
Set-Location $WorkspaceRoot

# 1. Leer version actual de Cargo.toml
$CargoTomlPath = Join-Path $WorkspaceRoot "Cargo.toml"
$CargoContent = Get-Content $CargoTomlPath -Raw
if ($CargoContent -notmatch 'version\s*=\s*"(\d+)\.(\d+)\.(\d+)"') {
    Write-Host "Error: No se pudo leer la version actual en Cargo.toml" -ForegroundColor Red
    exit 1
}
$CurMajor = [int]$Matches[1]; $CurMinor = [int]$Matches[2]; $CurPatch = [int]$Matches[3]
$CurrentVersion = "$CurMajor.$CurMinor.$CurPatch"

# 2. Calcular nueva version
if ($SetVersion -ne "") {
    if ($SetVersion -notmatch '^\d+\.\d+\.\d+$') {
        Write-Host "Error: El formato de version debe ser X.Y.Z (ejemplo: 0.2.0)" -ForegroundColor Red
        exit 1
    }
    $NewVersion = $SetVersion
} elseif ($Major) {
    $NewVersion = "$($CurMajor + 1).0.0"
} elseif ($Minor) {
    $NewVersion = "$CurMajor.$($CurMinor + 1).0"
} else {
    $NewVersion = "$CurMajor.$CurMinor.$($CurPatch + 1)"
}
Write-Host "`n[1/3] Version: $CurrentVersion -> $NewVersion" -ForegroundColor Cyan

# 3. Sincronizar version en los manifiestos
$NewCargoContent = $CargoContent -replace 'version\s*=\s*"\d+\.\d+\.\d+"', "version = `"$NewVersion`""
Set-Content -Path $CargoTomlPath -Value $NewCargoContent -NoNewline

$Manifests = @{
    "package.json"              = '"version":\s*"\d+\.\d+\.\d+"'
    "src-tauri\tauri.conf.json" = '"version":\s*"\d+\.\d+\.\d+"'
}
foreach ($File in $Manifests.Keys) {
    $Path = Join-Path $WorkspaceRoot $File
    $Content = Get-Content $Path -Raw
    Set-Content -Path $Path -Value ($Content -replace $Manifests[$File], "`"version`": `"$NewVersion`"") -NoNewline
}
$IndexHtmlPath = Join-Path $WorkspaceRoot "index.html"
$IndexContent = Get-Content $IndexHtmlPath -Raw
Set-Content -Path $IndexHtmlPath -Value ($IndexContent -replace 'v\d+\.\d+\.\d+\s*•', "v$NewVersion •") -NoNewline

# 4. Cerrar instancias abiertas para evitar bloqueo de archivos en Windows
Get-Process -Name "mdcat*" -ErrorAction SilentlyContinue | Stop-Process -Force

# 5. Compilar frontend + binario Tauri y generar instaladores MSI/NSIS
$CargoProfile = if ($Fast) { "release" } else { "dist" }
Write-Host "`n[2/3] Compilando con Tauri (perfil '$CargoProfile')..." -ForegroundColor Green
npx tauri build -- --profile $CargoProfile
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Fallo la compilacion de Tauri." -ForegroundColor Red
    exit 1
}

# 6. Copiar resultados a binarios/
Write-Host "`n[3/3] Copiando binarios..." -ForegroundColor Green
$OutDir = Join-Path $WorkspaceRoot "target\$CargoProfile"
$BinariosDir = Join-Path $WorkspaceRoot "binarios"
New-Item -ItemType Directory -Path $BinariosDir -Force | Out-Null

$Portable = Join-Path $BinariosDir "MDCAT_Extended_${NewVersion}_Portable.exe"
Copy-Item (Join-Path $OutDir "mdcat-tauri.exe") $Portable -Force
Get-ChildItem (Join-Path $OutDir "bundle") -Recurse -Include *.msi, *-setup.exe |
    Where-Object { $_.Name -like "*$NewVersion*" } |
    Copy-Item -Destination $BinariosDir -Force

Get-ChildItem $BinariosDir -File | Where-Object { $_.Name -like "*$NewVersion*" } | ForEach-Object {
    Write-Host ("  [OK] binarios\{0} ({1} MB)" -f $_.Name, [math]::Round($_.Length / 1MB, 2)) -ForegroundColor Cyan
}
Write-Host "`nCompilacion v$NewVersion lista en binarios/" -ForegroundColor Green
