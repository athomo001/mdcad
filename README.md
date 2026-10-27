<div align="center">

<img src="assets/logo-readme.png" alt="MDCAT Extended" width="128" />

# MDCAT Extended

**Lector y editor de Markdown de escritorio, ligero y portable.**
Núcleo en Rust · Interfaz en TypeScript sin frameworks · Binario único de ~5 MB
Windows · macOS (Intel y Apple Silicon) · Linux

[![Rust](https://img.shields.io/badge/Rust-1.75+-000?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-24C8D8?logo=tauri&logoColor=white)](https://v2.tauri.app/)
[![TypeScript](https://img.shields.io/badge/TypeScript-vanilla-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-10B981)](./LICENSE)
![Estado: alpha](https://img.shields.io/badge/estado-alpha-F59E0B)

[Capturas](#capturas) · [Funciones](#funciones) · [Atajos](#atajos-de-teclado) · [Descarga](#descarga-y-aviso-de-windows) · [Compilar](#compilación) · [Arquitectura](#arquitectura)

<br />

<img src="assets/screenshots/mdcat-view-lindo.png" alt="MDCAT en modo Lindo con el tema Negro" width="100%" />

</div>

## ¿Qué es?

MDCAT Extended es una aplicación de escritorio para **leer, revisar y editar documentos Markdown**, desde notas cortas hasta manuales de más de 100.000 líneas. El parseo lo hace Rust (`pulldown-cmark`) vía Tauri v2 y la interfaz es TypeScript directo sobre el DOM, sin React, Vue ni Angular. El resultado es un `.exe` portable de ~5 MB que arranca al instante.

El mismo código se compila para **Windows, macOS y Linux** sin cambios: basta con [compilarlo](#compilación) en el sistema donde lo vas a usar.

## Capturas

<table>
  <tr>
    <td width="50%">
      <img src="assets/screenshots/mdcat-view-split.png" alt="Modo 2 Pantallas" />
      <p align="center"><b>2 Pantallas</b>: editor y vista previa sincronizados</p>
    </td>
    <td width="50%">
      <img src="assets/screenshots/mdcat-view-tts.png" alt="Barra de lectura en voz alta" />
      <p align="center"><b>Lectura en voz alta</b>: resalta el bloque que se está leyendo</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="assets/screenshots/mdcat-view-lindo.png" alt="Modo Lindo" />
      <p align="center"><b>Lindo</b>: lectura con índice lateral y callouts</p>
    </td>
    <td width="50%">
      <img src="assets/screenshots/mdcat-modal-about.png" alt="Ventana Acerca de" />
      <p align="center"><b>Acerca de</b></p>
    </td>
  </tr>
</table>

## Funciones

### Tres modos de vista

| Modo | Para qué |
| :--- | :--- |
| **Lindo** | Lectura a pantalla completa: tipografía cuidada, tablas, bloques de código y callouts estilo GitHub (`> [!NOTE]`, `> [!TIP]`…). |
| **2 Pantallas** | Markdown crudo a la izquierda y vista previa en vivo a la derecha. El divisor se arrastra y vuelve a 50/50 con doble clic. |
| **Crudo** | Solo el editor, con indentación por `Tab`, contador de líneas/caracteres y estado *Sincronizado* / *Modificado*. |

`Ctrl + E` alterna entre los tres.

### Lectura y edición

- **Cualquier archivo de texto**: además de Markdown abre `.txt`, `.log`, `.csv`, `.json`, `.yaml`, código fuente y más, con `Ctrl + O` o arrastrándolo. La codificación se detecta sola y se puede cambiar desde la barra de estado (reabrir o guardar con UTF-8, UTF-16, Windows-1252, etc.).
- **Recarga automática**: si guardas el archivo desde otro editor (VS Code, Notepad…), MDCAT lo recarga sin perder la posición del scroll. `F5` fuerza la recarga.
- **Guardado** con `Ctrl + S` sobre el archivo original, o diálogo nativo si el documento es nuevo.
- **Índice lateral (TOC)** navegable, generado a partir de los encabezados.
- **Paleta de comandos** (`Ctrl + K`) con búsqueda difusa.
- **Ayudas de lectura**: modo enfoque (`F8`), máquina de escribir (`F9`), lectura biónica (`F10`) y fuente para dislexia (OpenDyslexic, en el menú *Ver*).
- **4 temas**: Blanco, Negro (OLED), Rosa y Verde-Oro.
- **Interfaz bilingüe** ES / EN, cambiable en caliente.

### Lectura en voz alta (TTS)

- Voces neuronales de Edge o voces locales de Windows (sin conexión).
- Diccionario de pronunciación para siglas y términos técnicos (`grep`, `docker`, *EDR*, *MITRE ATT&CK*…).
- Resalta en pantalla el bloque que se está leyendo.
- Saltos por sección desde el TOC, el selector *Saltar a sección…* o con `Alt + ↑` / `Alt + ↓`.

### Documentos cifrados `.mdbin`

- Cifrado **AES-256-GCM** con clave derivada mediante **Argon2id**.
- El contenido descifrado vive solo en memoria y se borra (`zeroize`) al cerrar.
- El archivo es texto plano: un encabezado legible le indica a cualquier IA que está cifrado, con qué algoritmo y parámetros, y que debe pedir la contraseña al usuario para descifrarlo.
- Una cápsula abierta se puede editar; al guardar se vuelve a cifrar pidiendo la contraseña.
- Cualquier `.md` se puede exportar a `.mdbin` desde **Archivo → Exportar como cápsula cifrada .mdbin…** o desde la paleta de comandos (`Ctrl + K`).

## Atajos de teclado

| Atajo | Acción |
| :--- | :--- |
| `Ctrl + O` | Abrir `.md` o `.mdbin` |
| `Ctrl + S` | Guardar |
| `Ctrl + E` | Cambiar modo de vista (Lindo → 2 Pantallas → Crudo) |
| `Ctrl + Shift + L` | Mostrar / ocultar índice lateral |
| `Ctrl + K` | Paleta de comandos |
| `Ctrl + P` | Imprimir / exportar a PDF |
| `F5` · `Ctrl + R` | Recargar desde disco |
| `F7` | Barra de voz (TTS) |
| `F8` | Modo enfoque |
| `F9` | Modo máquina de escribir |
| `F10` | Lectura biónica |
| `Alt + ↑` · `Alt + ↓` | Sección anterior / siguiente en TTS |
| `Esc` | Cerrar ventanas y menús |

## Descarga y aviso de Windows

> [!WARNING]
> Al abrir MDCAT por primera vez, Windows puede mostrar **"Windows protegió su PC"** (Microsoft Defender SmartScreen). **No es un virus**: el aviso aparece porque el ejecutable todavía no tiene firma digital.

**¿Por qué sale?** SmartScreen revisa todo programa descargado de internet. Si el `.exe` no está firmado con un certificado de firma de código (un trámite pagado que identifica al publicador) y aún no lo han descargado suficientes personas, Windows lo marca como "aplicación no reconocida". No significa que haya detectado nada malicioso. Le pasa a casi cualquier programa nuevo de código abierto. Aplica al portable `.exe` y también a los instaladores `.msi` y `-setup.exe`.

**Cómo abrirlo igual:**

1. En el aviso, haz clic en **Más información**.
2. Pulsa **Ejecutar de todas formas**.

Solo hay que hacerlo la primera vez. Otra opción es hacer clic derecho en el `.exe` → **Propiedades** → marcar **Desbloquear** → **Aceptar**.

**¿Cómo sé que es el original?** Descárgalo solo desde las [Releases de GitHub](https://github.com/cybeersecurity/mdcat/releases) y compara su huella SHA-256 con la publicada en la release:

```powershell
Get-FileHash .\MDCAT_Extended_*_Portable.exe -Algorithm SHA256
```

Si prefieres no confiar en ningún binario, el código fuente está completo en este repositorio y puedes [compilarlo tú mismo](#compilación). Lo que compilas en tu propio equipo no muestra el aviso, porque Windows no lo considera descargado.

> [!NOTE]
> MDCAT necesita **WebView2**, que ya viene incluido en Windows 11 y en Windows 10 actualizado. Si el portable no abre en un Windows 10 antiguo, instala el [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) o usa el instalador `-setup.exe`, que lo descarga automáticamente.

## Compilación

### Requisitos

- **Rust** 1.75+ ([rustup.rs](https://rustup.rs/))
- **Node.js** 18+ y npm
- **Windows**: Microsoft Visual C++ Build Tools
- **macOS** (Intel o Apple Silicon): Xcode Command Line Tools (`xcode-select --install`)
- **Linux (Debian/Ubuntu)**: WebKitGTK y dependencias. `./scripts/build-linux.sh --deps` las instala, o a mano:

  ```bash
  sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
    librsvg2-dev libssl-dev libxdo-dev patchelf build-essential
  ```

### Comandos

```bash
git clone https://github.com/athomo001/mdcad.git
cd mdcad
npm install
```

| Comando | Qué hace | Salida |
| :--- | :--- | :--- |
| `npm run tauri dev` | Desarrollo con recarga en caliente | ventana de la app |
| `npm run build:exe` | `.exe` portable rápido (perfil `release`, LTO *thin*) | `target\release\mdcat-tauri.exe` |
| `npm run build:dist` | Binario final optimizado (perfil `dist`) + instaladores MSI/NSIS | `target\dist\` |
| `npm run build:msi` <br> `pwsh scripts/build-binarios.ps1` | Compila versión final `.exe` portable + instaladores `.msi` y `-setup.exe` y los copia directo a `binarios\` | `binarios\` |
| `npm run build:linux` <br> `bash scripts/build-linux.sh` | En Linux: binario + `.deb`, `.rpm` y `.AppImage` (`-- --fast` usa `release`) | `binarios/` |

#### Generación de ejecutables en Windows (`.exe` y `.msi`)

Para compilar y empaquetar todos los binarios listos para distribución en la carpeta `binarios/`:

```powershell
# Todo en uno: .exe portable + instalador .msi + instalador -setup.exe:
pwsh scripts/build-binarios.ps1

# Equivalente vía npm:
npm run build:msi

# Solo el binario portable .exe rápido (sin instaladores):
npm run build:exe
```

#### Compilar en macOS (`.app` y `.dmg`)

Funciona igual en Mac con Intel y con Apple Silicon (M1, M2, M3…); el binario sale nativo para la arquitectura del equipo donde compilas.

```bash
xcode-select --install                                  # compilador (clang), SDK de macOS y git; una sola vez
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"                               # o cierra y abre la terminal
brew install node                                       # requiere Homebrew (brew.sh); o instala Node 18+ desde nodejs.org

git clone https://github.com/athomo001/mdcad.git
cd mdcad
npm install
npm run build:dist
```

La app queda en `target/dist/bundle/macos/MDCAT Extended.app` y el instalador en `target/dist/bundle/dmg/`. Arrastra la `.app` a **Aplicaciones**.

> [!NOTE]
>
> - Lo que compilas en tu Mac abre sin avisos. Si copias la `.app` a otro Mac, Gatekeeper la bloqueará por no estar firmada; se desbloquea con `xattr -cr "/Applications/MDCAT Extended.app"`.
> - Por ahora, abrir un `.md` con doble clic desde Finder arranca la app sin cargar el archivo. Ábrelo con `Cmd + O` o arrastrándolo a la ventana.
> - Las voces locales del TTS son las de macOS; las voces neuronales de Edge funcionan igual que en Windows.

GitHub Actions (`.github/workflows/build.yml`) genera los builds de Windows y Linux al publicar un tag `v*` o al lanzarlo a mano. El de macOS se compila en local con los pasos de arriba.

### Instaladores y asociación de archivos

- **Windows**: MSI (WiX) y `-setup.exe` (NSIS) en español, con la licencia de `src-tauri/installer/licencia.txt`.
- **macOS**: `.app` y `.dmg`.
- **Linux**: `.deb`, `.rpm` y `.AppImage`.
- Se registran `.md`, `.markdown`, `.mdown`, `.mkd` y `.mdbin` (en Linux, vía `MimeType` del `.desktop`).
- En Windows 10/11, si ya había otra app predeterminada para `.md`, cámbiala a mano: clic derecho → *Abrir con* → *Elegir otra aplicación* → MDCAT Extended → *Usar siempre*.

Si cambias el logo o la licencia, regenera los recursos del instalador y los iconos:

```powershell
pwsh scripts/generar-recursos-instalador.ps1
npx tauri icon assets/logo.png
```

### Regenerar las capturas

```bash
npm run build
npx vite preview          # en una terminal
npm run screenshots       # en otra (requiere Microsoft Edge)
```

## Arquitectura

```mermaid
graph LR
    A[".md / .mdbin"] --> B["Núcleo Rust (Tauri v2)"]
    B --> C["Parser: pulldown-cmark"]
    B --> D["Cifrado: AES-256-GCM + Argon2id"]
    B --> E["TTS: Edge + SAPI"]
    B --> F["Vigilante de archivos"]
    C --> G["HTML + TOC + métricas"]
    G --> H["UI: TypeScript + CSS nativo"]
```

- **Sin frameworks SPA**: la interfaz manipula el DOM directamente; el bundle del frontend pesa menos de 80 KB.
- **Workspace mínimo**: `crates/mdcat-core` (parser) y `src-tauri` (aplicación).
- **Compilación rápida**: el perfil `release` usa LTO *thin* para iterar; `dist` reserva `opt-level = "z"` + LTO completo para el binario distribuido. El enlazador es `rust-lld` (`.cargo/config.toml`).



## Historial de Cambios

Consulta el archivo [CHANGELOG.md](./CHANGELOG.md) para revisar el detalle de versiones y mejoras de cada release.

## Licencia

[MIT](./LICENSE) © 2026 cyBEERsecurity y colaboradores de MDCAT Extended.
