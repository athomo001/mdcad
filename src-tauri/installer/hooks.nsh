; Personalización del instalador NSIS de MDCAT Extended.
; Tauri incluye este archivo antes de declarar las páginas, así que estas
; definiciones reemplazan los textos genéricos de bienvenida y final.

!define MUI_HEADERIMAGE_RIGHT

!define MUI_WELCOMEPAGE_TITLE "Bienvenido a MDCAT Extended"
!define MUI_WELCOMEPAGE_TEXT "MDCAT Extended es un lector y editor de Markdown ultraliviano hecho en Rust.$\r$\n$\r$\n  • Modo lectura embellecida, editor con vista previa en vivo y modo crudo$\r$\n  • Índice lateral, 4 temas de color y lectura enfocada$\r$\n  • Lectura en voz alta con voces neuronales$\r$\n  • Cápsulas cifradas .mdbin$\r$\n$\r$\nAl instalarlo podrás abrir tus archivos .md con doble clic.$\r$\n$\r$\nHaz clic en Siguiente para continuar."

!define MUI_FINISHPAGE_TITLE "MDCAT Extended está listo"
!define MUI_FINISHPAGE_TEXT "La instalación terminó. Haz doble clic en cualquier archivo .md para abrirlo con MDCAT Extended.$\r$\n$\r$\nSi Windows los abre con otra aplicación: clic derecho → Abrir con → Elegir otra aplicación → MDCAT Extended → Usar siempre."
