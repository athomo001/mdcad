# MDCAT Extended

> [!WARNING]
> **Proyecto en preparación — Ultra Alpha.**
> Por ahora solo se está armando la infraestructura y el diseño de lo que se construirá en los próximos días. Todavía no hay código funcional, ni releases, ni instrucciones de instalación. Todo lo descrito aquí puede cambiar.

---

## ¿Qué es MDCAT?

MDCAT Extended es un **lector y analizador de Markdown de nueva generación**: rápido, seguro y con una interfaz moderna. Está pensado para leer documentación técnica pesada (incluso archivos de más de 100.000 líneas) sin perder fluidez.

Un mismo motor escrito en **Rust** se usará en tres formatos:

- **Aplicación de escritorio** para Windows y Linux (Tauri v2), liviana en memoria.
- **Versión web** que corre en el navegador mediante WebAssembly.
- **Herramienta de consola** (`mdcat`) con salida enriquecida en la terminal.

## Funcionalidades planificadas

- Renderizado de Markdown con GFM, callouts, fórmulas (KaTeX) y diagramas (Mermaid).
- Resaltado de código con temas claro y oscuro.
- Índice de contenidos automático y búsqueda difusa dentro del documento.
- Command Palette (`Ctrl+K`) y atajos de teclado.
- Apertura segura de archivos no confiables (sanitización estricta, CSP, protección XSS).
- Formato cifrado propio **`.mdbin`** (AES-256-GCM + Argon2id).
- Anotaciones y notas guardadas en archivos aparte, sin modificar el original.
- Lectura en voz alta (texto a voz) en español, incluso offline.
- Interfaz bilingüe español / inglés.
- Despliegue con Docker para la versión web.

## Stack tecnológico previsto

| Capa | Tecnología |
| :--- | :--- |
| Motor central | Rust (`pulldown-cmark`) |
| Interfaz | Angular 18+ (Standalone Components, Signals) |
| Escritorio | Tauri v2 |
| Web | WebAssembly (`wasm-bindgen`) |
| Consola | CLI nativo en Rust |
| Contenedores | Docker multi-stage |

## Estado

| Etapa | Estado |
| :--- | :--- |
| Investigación y especificación | 🟡 En curso |
| Infraestructura base del repositorio | 🟡 En curso |
| Motor de parseo en Rust | ⚪ Pendiente |
| Interfaz y app de escritorio | ⚪ Pendiente |
| Primera versión usable | ⚪ Pendiente |

---

*Este README se irá actualizando a medida que el proyecto avance.*
