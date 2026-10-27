# Registro de Cambios (Changelog) — MDCAT Extended

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.1.7] — 2026-10-27

### Añadido (Added)
- **Versiones para todos los sistemas en cada release**: Windows (instaladores `-setup.exe` y `.msi`, y `.exe` portable), macOS (`.dmg` universal para Intel y Apple Silicon) y Linux (`.deb`, `.rpm` y `.AppImage`), compiladas automáticamente en GitHub Actions a partir del código del repositorio.
- Cada release incluye `SHA256SUMS.txt` con las huellas de todos los archivos.

---

## [1.1.6] — 2026-10-27

### Añadido (Added)
- **Archivos de texto plano**: además de Markdown se abre cualquier archivo de texto (`.txt`, `.log`, `.csv`, `.json`, `.yaml`, `.ini`, código fuente, archivos sin extensión…), tanto con `Ctrl + O` como arrastrándolo a la ventana. Los que no son Markdown se muestran tal cual, con resaltado según su tipo; los `.txt` y `.log` ajustan las líneas largas. Los archivos binarios se rechazan con un aviso.
- **Codificación del documento**: la codificación se detecta al abrir (UTF-8, UTF-8 con BOM, UTF-16, Windows-1252…), así que los `.txt` antiguos de Windows con tildes y eñes ya no fallan. Desde la barra de estado se puede **reabrir** el archivo con otra codificación (si se ven caracteres raros como `Ã±`) o **guardarlo** convertido a otra. Al guardar se respeta la codificación original, y si un carácter no existe en la codificación elegida se avisa en vez de corromper el archivo.
- **Editar cápsulas `.mdbin` abiertas**: una cápsula descifrada se puede editar, y al guardar (`Ctrl + S`) se vuelve a cifrar sobre el mismo archivo pidiendo la contraseña.
- **Fuente para dislexia (OpenDyslexic)**: en *Ver → Fuente para Dislexia* o en la paleta de comandos. Aplica OpenDyslexic con más espaciado al área de lectura (el código conserva su fuente monoespaciada) y se recuerda entre sesiones. La fuente va incluida en la aplicación, así que funciona sin conexión.
- **Nuevo diálogo de contraseña** para cifrar y descifrar `.mdbin`, que reemplaza las ventanas nativas `prompt()`: botón para mostrar u ocultar la contraseña, confirmación y medidor de fortaleza al cifrar, aviso de Bloq Mayús, advertencia de que la pista queda visible sin contraseña, indicador de progreso mientras se deriva la clave y textos en español e inglés.

### Cambiado (Changed)
- **Formato `.mdbin` 2.0 (RFC-001 rev. 2.0)**: las cápsulas nuevas son texto plano, así que las IAs pueden leerlas completas en vez de descartarlas como binarias. El encabezado indica que el documento está cifrado, con qué algoritmo (AES-256-GCM) y con qué parámetros de Argon2id, sal y nonce, y pide que se solicite la contraseña al usuario. Incluye una receta en Python para descifrarlo. Las cápsulas `.mdbin` del formato binario anterior ya no se pueden abrir.
- El encabezado completo queda autenticado: si alguien altera la pista, la cápsula ya no descifra. Las cápsulas también resisten la conversión de saltos de línea que hacen Git o algunos editores.

### Seguridad (Security)
- La pista de una cápsula `.mdbin` se insertaba como HTML en el diálogo de contraseña; un archivo manipulado podía inyectar marcado en la aplicación. Ahora se muestra como texto.

---

## [1.1.5] — 2026-10-26

### Añadido (Added)
- **Pestañas de documentos**:
  - Cada archivo se abre en su propia pestaña, ya sea con `Ctrl + O` (ahora permite seleccionar varios archivos a la vez), arrastrándolo a la ventana, con doble clic en el Explorador o pasándolo por línea de comandos.
  - Cada pestaña conserva sus cambios sin guardar (indicados con un punto), su posición de lectura y su recarga automática al cambiar el archivo en disco.
  - Reordenamiento arrastrando; cierre con `✕`, clic central o `Ctrl + W`; navegación con `Ctrl + Tab` / `Ctrl + Shift + Tab`.
  - La ventana principal recuerda las pestañas abiertas para la próxima sesión.
- **Instancia única**: abrir otro archivo con MDCAT ya abierto lo agrega como pestaña en la última ventana usada, en vez de lanzar otra ventana.
- **Separar y unir ventanas**:
  - Arrastrar una pestaña fuera de la ventana la abre en una ventana nueva; soltarla sobre otra ventana de MDCAT la une a esa ventana.
  - Menú contextual de pestaña: *Mover a una ventana nueva*, *Mover a: …*, *Unir todas las ventanas aquí*, *Cerrar las demás pestañas*.
- **Exportar a `.mdbin` desde el menú**: nueva opción *Archivo → Exportar como cápsula cifrada .mdbin…* (antes solo existía en la paleta de comandos).

### Corregido (Fixed)
- **Lector de voz (TTS) empezaba por el final del documento**: los párrafos, listas y bloques de código fuera de pantalla quedaban excluidos de la lectura (solo se leían títulos y tablas), por lo que en documentos con pocos títulos la lectura saltaba al final. Ahora se leen todos los bloques en orden desde el inicio.
- **Ventana en blanco o congelada**: la consulta del catálogo de voces, la síntesis de voz, la lectura de archivos grandes y el cifrado `.mdbin` corrían en el hilo de la ventana; con conexión lenta o documentos grandes la ventana quedaba en blanco. Ahora se ejecutan en segundo plano y la interfaz sigue respondiendo.
- **Comunicación lenta con el núcleo de Rust**: la política de seguridad (CSP) bloqueaba el canal IPC rápido de Tauri y obligaba a usar el canal de respaldo. Se habilitó `ipc:` en `connect-src`.
- **Arrastrar archivos desde el Explorador** ahora abre el archivo desde su ruta real (con recarga automática y guardado), y admite varios archivos a la vez.
- **Recargar (`F5`) perdía la posición de lectura**: se restaura correctamente el desplazamiento del visor.
- **Exportar a `.mdbin` una cápsula ya abierta** generaba un archivo vacío sin avisar; ahora se muestra un aviso.
- **Lectura biónica** se mantiene activa al cambiar de pestaña en lugar de restaurar contenido del documento anterior.

---

## [1.1.1] — 2026-10-25

### Corregido (Fixed)
- **Árbol y jerarquía de la Tabla de Contenidos (TOC)**:
  - Corregido error de maquetación flexbox donde los subárboles de encabezados (`ul.toc-sublist`) se insertaban como hijos directos de filas flex con orientación horizontal (`row`). Esto causaba que las subsecciones fueran desplazadas fuera de la pantalla hacia la derecha, expandiendo artificialmente el contenedor padre y generando un enorme espacio vacío vertical entre secciones.
  - Se aisló la fila interactiva del título (`div.toc-item-row`) respecto a su subárbol (`ul.toc-sublist`), el cual ahora se renderiza naturalmente como bloque anidado inferior.
- **Scrollbar horizontal no deseado en el TOC**:
  - Restringido el eje horizontal en la barra lateral con `overflow-x: hidden !important;`, eliminando de raíz la barra de desplazamiento horizontal en el panel de navegación.
- **Barras de desplazamiento nativas de Windows**:
  - Eliminados los scrollbars blancos toscos nativos de Windows WebView2 mediante la integración de `color-scheme: dark` / `light` en [`theme.css`](file:///d:/Proyectos/mdcat/src/styles/theme.css).
  - Diseñados scrollbars globales ultradelgados (6 px) estilo Studio con esquinas redondeadas y colores adaptados dinámicamente a los 4 temas oficiales (`blanco`, `negro`, `rosa`, `verde-dorado`).
- **ScrollSpy y seguimiento de lectura**:
  - Optimizado el resaltado de la sección activa al desplazarse por el documento, aplicando el resplandor de acento solo a la fila del título actual y realizando auto-scroll suave en el TOC.

### Añadido (Added)
- **Nodos colapsables con chevron interactivo en el TOC**:
  - Incorporado un botón chevron (`▼` / `▶`) en cada sección que contiene subsecciones, permitiendo plegar y desplegar ramas jerárquicas a gusto del lector.
- **Líneas guía visuales de indentación**:
  - Las sublistas anidadas ahora exhiben una línea guía vertical sutil (`border-left: 1px solid var(--border-subtle)`), mejorando drásticamente la legibilidad en documentos de alta densidad técnica.
- **Documentación de compilación en el README**:
  - Documentada explícitamente la invocación directa del script [`scripts/build-binarios.ps1`](file:///d:/Proyectos/mdcat/scripts/build-binarios.ps1) y sus comandos equivalentes en `npm` (`npm run build:msi`, `npm run build:exe`, `npm run build:dist`).

---

## [1.1.0] — 2026-10-25

### Añadido (Added)
- **Núcleo de alto rendimiento en Rust (`pulldown-cmark`)**:
  - Parser multihilo zero-copy capaz de procesar más de 100.000 líneas en milisegundos.
  - Soporte completo para GitHub Flavored Markdown (GFM), tablas dinámicas y checklists interactivos.
  - Bloques de llamada semánticos (*Callouts* con estilo Glow para NOTE, TIP, IMPORTANT, WARNING, CAUTION).
- **Desktop Runner en Tauri v2**:
  - Generación de un único binario `.exe` portable de ~5 MB con consumo de RAM inferior a 35 MB.
  - Generadores de instaladores nativos para Windows: MSI (WiX) y `-setup.exe` (NSIS) con asociación de extensiones (`.md`, `.markdown`, `.mdown`, `.mkd`, `.mdbin`).
- **Frontend ultraliviano en Vanilla TypeScript + HTML5 / CSS3**:
  - Micro-bundle de menos de 85 KB compilado con Vite/esbuild, sin frameworks SPA pesados (cero React, cero Angular).
- **Los 4 temas oficiales de alto contraste**:
  - `blanco`: Clean White / Paper Light para lectura diurna.
  - `negro`: OLED Black (#000000 puro) para descanso visual absoluto.
  - `rosa`: Sakura / Cyber-Rose con acentos pastel.
  - `verde-dorado`: Emerald & Gold (fondo bosque profundo con acentos oro pulido).
- **Modos de visualización avanzados**:
  - Modo Lindo (vista de lectura embellecida).
  - Modo Crudo (editor Markdown sincronizado).
  - Modo 2 Pantallas (vista dividida con divisor ajustable).
  - Modo Lectura Biónica (fijación sacádica mediante negritas visuales).
  - Paleta de comandos interactiva estilo Raycast (`Ctrl + K`).
- **Síntesis de voz neuronal (TTS)**:
  - Lectura en voz alta sincronizada con Edge TTS y voces locales SAPI.
- **Seguridad y Criptografía**:
  - Soporte del estándar de contenedor cifrado RFC-001 `.mdbin` (AES-256-GCM + Argon2id).
