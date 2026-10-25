# Genera el logo con transparencia y las imágenes de marca de los instaladores (NSIS y WiX)
# a partir de assets/icon.jpg, y la licencia RTF desde src-tauri/installer/licencia.txt.
# Ejecutar de nuevo solo si cambia el logo o la licencia:
#   pwsh scripts/generar-recursos-instalador.ps1
#   npx tauri icon assets/logo.png   (regenera los iconos de src-tauri/icons)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$Root = (Get-Item (Split-Path -Parent $MyInvocation.MyCommand.Path)).Parent.FullName
$OutDir = Join-Path $Root "src-tauri\installer"
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

# 1. Logo PNG: quita el fondo blanco de las esquinas con un relleno por inundación
$Source = [System.Drawing.Bitmap]::new((Join-Path $Root "assets\icon.jpg"))
$Logo = [System.Drawing.Bitmap]::new($Source.Width, $Source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($Logo); $g.DrawImage($Source, 0, 0, $Source.Width, $Source.Height); $g.Dispose()
$Source.Dispose()

$w = $Logo.Width; $h = $Logo.Height
$visited = New-Object 'bool[]' ($w * $h)
$stack = [System.Collections.Generic.Stack[int]]::new()
foreach ($p in @(0, ($w - 1), (($h - 1) * $w), ($h * $w - 1))) { $stack.Push($p) }
while ($stack.Count -gt 0) {
    $i = $stack.Pop()
    if ($visited[$i]) { continue }
    $visited[$i] = $true
    $x = $i % $w; $y = [math]::Floor($i / $w)
    $c = $Logo.GetPixel($x, $y)
    if ($c.R -lt 200 -or $c.G -lt 200 -or $c.B -lt 200) { continue }
    $Logo.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
    if ($x -gt 0) { $stack.Push($i - 1) }
    if ($x -lt $w - 1) { $stack.Push($i + 1) }
    if ($y -gt 0) { $stack.Push($i - $w) }
    if ($y -lt $h - 1) { $stack.Push($i + $w) }
}
$Logo.Save((Join-Path $Root "assets\logo.png"), [System.Drawing.Imaging.ImageFormat]::Png)

# Paleta de la app
$Dark   = [System.Drawing.Color]::FromArgb(11, 11, 15)
$Dark2  = [System.Drawing.Color]::FromArgb(36, 20, 6)
$Orange = [System.Drawing.Color]::FromArgb(249, 115, 22)
$Muted  = [System.Drawing.Color]::FromArgb(161, 161, 170)

function New-Canvas([int]$Width, [int]$Height) {
    $bmp = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $gr = [System.Drawing.Graphics]::FromImage($bmp)
    $gr.SmoothingMode = "AntiAlias"
    $gr.InterpolationMode = "HighQualityBicubic"
    $gr.TextRenderingHint = "AntiAliasGridFit"
    $gr.Clear([System.Drawing.Color]::White)
    return $bmp, $gr
}

function Draw-DarkPanel($gr, [int]$Width, [int]$Height) {
    $rect = [System.Drawing.Rectangle]::new(0, 0, $Width, $Height)
    $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, $Dark, $Dark2, 90)
    $gr.FillRectangle($brush, $rect); $brush.Dispose()
    $gr.FillRectangle([System.Drawing.SolidBrush]::new($Orange), $Width - 3, 0, 3, $Height)
}

function Draw-Centered($gr, [string]$Text, [string]$Font, [float]$Size, $Style, $Color, [int]$Width, [int]$Y) {
    $f = [System.Drawing.Font]::new($Font, $Size, $Style, [System.Drawing.GraphicsUnit]::Pixel)
    $fmt = [System.Drawing.StringFormat]::new(); $fmt.Alignment = "Center"
    $gr.DrawString($Text, $f, [System.Drawing.SolidBrush]::new($Color), [System.Drawing.RectangleF]::new(4, $Y, $Width - 8, 200), $fmt)
    $f.Dispose()
}

function Draw-Brand($gr, [int]$PanelWidth, [int]$LogoSize, [int]$Top) {
    $gr.DrawImage($Logo, [int](($PanelWidth - $LogoSize) / 2), $Top, $LogoSize, $LogoSize)
    $y = $Top + $LogoSize + 10
    Draw-Centered $gr "MDCAT" "Segoe UI" 26 ([System.Drawing.FontStyle]::Bold) $Orange $PanelWidth $y
    Draw-Centered $gr "Extended" "Segoe UI" 15 ([System.Drawing.FontStyle]::Regular) ([System.Drawing.Color]::White) $PanelWidth ($y + 32)
    Draw-Centered $gr "Lector y editor de Markdown ultraliviano" "Segoe UI" 11 ([System.Drawing.FontStyle]::Regular) $Muted $PanelWidth ($y + 60)
}

function Save-Bmp($bmp, $gr, [string]$Name) {
    $gr.Dispose()
    $bmp.Save((Join-Path $OutDir $Name), [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
}

# 2. NSIS: barra lateral de bienvenida/final (164x314)
$bmp, $gr = New-Canvas 164 314
Draw-DarkPanel $gr 164 314
Draw-Brand $gr 164 104 56
Save-Bmp $bmp $gr "nsis-sidebar.bmp"

# 3. NSIS: cabecera de páginas (150x57), logo a la derecha
$bmp, $gr = New-Canvas 150 57
$gr.DrawImage($Logo, 150 - 52, 3, 50, 50)
Save-Bmp $bmp $gr "nsis-header.bmp"

# 4. WiX: diálogo de bienvenida/final (493x312), el texto de WiX va a la derecha del panel
$bmp, $gr = New-Canvas 493 312
Draw-DarkPanel $gr 164 312
Draw-Brand $gr 164 104 56
Save-Bmp $bmp $gr "wix-dialog.bmp"

# 5. WiX: banner superior (493x58), el título de WiX va a la izquierda
$bmp, $gr = New-Canvas 493 58
$gr.DrawImage($Logo, 493 - 54, 4, 50, 50)
$gr.FillRectangle([System.Drawing.SolidBrush]::new($Orange), 0, 56, 493, 2)
Save-Bmp $bmp $gr "wix-banner.bmp"

$Logo.Dispose()

# 6. Licencia en RTF: WiX solo muestra RTF, y la conversión automática de Tauri rompe los acentos
$Rtf = [System.Text.StringBuilder]::new("{\rtf1\ansi\ansicpg1252\deff0{\fonttbl{\f0 Segoe UI;}}\viewkind4\uc1\pard\f0\fs18 ")
foreach ($ch in (Get-Content (Join-Path $OutDir "licencia.txt") -Raw -Encoding UTF8).Replace("`r", "").ToCharArray()) {
    switch ($ch) {
        "`n" { [void]$Rtf.Append("\par`n") }
        "\" { [void]$Rtf.Append("\\") }
        "{" { [void]$Rtf.Append("\{") }
        "}" { [void]$Rtf.Append("\}") }
        default {
            if ([int]$ch -gt 127) { [void]$Rtf.Append("\u$([int]$ch)?") } else { [void]$Rtf.Append($ch) }
        }
    }
}
[void]$Rtf.Append("}")
[System.IO.File]::WriteAllText((Join-Path $OutDir "licencia.rtf"), $Rtf.ToString(), [System.Text.Encoding]::ASCII)

Write-Host "Recursos generados en $OutDir y assets\logo.png" -ForegroundColor Green
