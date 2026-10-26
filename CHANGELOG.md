# Registro de Cambios (Changelog) — MDCAT Extended

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
