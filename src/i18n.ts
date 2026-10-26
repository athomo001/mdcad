/**
 * @file i18n.ts
 * @description Sistema de Internacionalización Bilingüe (i18n ES / EN) conforme a spec/06-sistema-i18n-bilingue.md.
 * Paridad idiomática total, conmutación instantánea reactiva (Zero-Flicker) y persistencia en localStorage.
 */

export type SupportedLocale = 'es' | 'en';

export interface TranslationSchema {
  common: {
    save: string;
    saveTitle: string;
    savedToast: string;
    splitResetToast: string;
    reloadedToast: string;
    autoUpdatedToast: string;
    noFileToast: string;
  };
  viewMode: {
    lindo: string;
    lindoTitle: string;
    split: string;
    splitTitle: string;
    crudo: string;
    crudoTitle: string;
  };
  editor: {
    title: string;
    synced: string;
    modified: string;
    lines: string;
    chars: string;
    placeholder: string;
  };
  menu: {
    file: string;
    open: string;
    saveFile: string;
    exportPdf: string;
    exportMdbin: string;
    close: string;
    view: string;
    viewLindo: string;
    viewSplit: string;
    viewCrudo: string;
    toggleSidebar: string;
    focusMode: string;
    typewriterMode: string;
    ttsBar: string;
    bionicMode: string;
    help: string;
    shortcuts: string;
    markdownGuide: string;
    reportIssue: string;
    checkUpdates: string;
    about: string;
    themeLabel: string;
    themes: {
      blanco: string;
      negro: string;
      rosa: string;
      verdeDorado: string;
    };
  };
  metrics: {
    words: string;
    chars: string;
    readingTime: string;
    coreEngine: string;
  };
  toc: {
    title: string;
    empty: string;
  };
  tabs: {
    openTitle: string;
  };
  tts: {
    play: string;
    pause: string;
    resume: string;
    stop: string;
    speed: string;
    voice: string;
    reading: string;
    paused: string;
    idle: string;
    clickToRead: string;
    jumpToSection: string;
    sectionsAvailable: string;
    synthesizing: string;
    prevHeadingTitle: string;
    nextHeadingTitle: string;
    prevBlockTitle: string;
    nextBlockTitle: string;
    stopTitle: string;
    closeTitle: string;
  };
  about: {
    title: string;
    tagline: string;
    communityOrigin: string;
    communityText: string;
    coreSpec: string;
    runnerSpec: string;
    uiSpec: string;
    mascotSpec: string;
    license: string;
  };
  mdbin: {
    title: string;
    subtitle: string;
    desc: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    decryptBtn: string;
    cancelBtn: string;
    error: string;
  };
}

export const TRANSLATIONS: Record<SupportedLocale, TranslationSchema> = {
  es: {
    common: {
      save: 'Guardar',
      saveTitle: 'Guardar documento (Ctrl+S)',
      savedToast: 'Documento guardado exitosamente',
      splitResetToast: 'División restablecida al 50% / 50%',
      reloadedToast: 'Documento recargado desde el disco',
      autoUpdatedToast: 'Actualizado automáticamente',
      noFileToast: 'No hay archivo abierto para recargar',
    },
    viewMode: {
      lindo: '📖 Lindo',
      lindoTitle: 'Modo Lectura Embellecida',
      split: '⚡ 2 Pantallas',
      splitTitle: 'Modo 2 Pantallas: Editor en vivo + Vista Linda',
      crudo: '📝 Crudo',
      crudoTitle: 'Modo Crudo: Solo Editor',
    },
    editor: {
      title: 'Editor Markdown (Modo Crudo)',
      synced: 'Sincronizado',
      modified: 'Modificado',
      lines: 'líneas',
      chars: 'caracteres',
      placeholder: 'Escribe o pega aquí tu Markdown en modo crudo...',
    },
    menu: {
      file: 'Archivo',
      open: 'Abrir archivo Markdown...',
      saveFile: 'Guardar cambios',
      exportPdf: 'Exportar a PDF / Imprimir...',
      exportMdbin: 'Exportar como cápsula cifrada .mdbin...',
      close: 'Cerrar visor',
      view: 'Ver',
      viewLindo: 'Modo Lectura (Lindo)',
      viewSplit: 'Modo 2 Pantallas (Dividido)',
      viewCrudo: 'Modo Crudo (Solo Editor)',
      toggleSidebar: 'Alternar Barra Lateral',
      focusMode: 'Modo Enfoque',
      typewriterMode: 'Modo Máquina de Escribir',
      ttsBar: 'Barra de Lectura de Voz (TTS)',
      bionicMode: 'Alternar Lectura Biónica',
      help: 'Ayuda',
      shortcuts: 'Atajos y Comandos',
      markdownGuide: 'Guía de Sintaxis Markdown',
      reportIssue: 'Reportar un Problema',
      checkUpdates: 'Buscar Actualizaciones...',
      about: 'Acerca de MDCAT Extended',
      themeLabel: 'Tema:',
      themes: {
        blanco: 'Blanco',
        negro: 'Negro',
        rosa: 'Rosa',
        verdeDorado: 'Verde-Oro',
      },
    },
    metrics: {
      words: 'palabras',
      chars: 'caracteres',
      readingTime: 'min de lectura',
      coreEngine: 'MDCAT Core (Rust)',
    },
    toc: {
      title: 'Contorno (TOC)',
      empty: 'Sin encabezados detectados',
    },
    tabs: {
      openTitle: 'Abrir archivo en una pestaña nueva (Ctrl+O)',
    },
    tts: {
      play: 'Escuchar',
      pause: 'Pausar',
      resume: 'Reanudar',
      stop: 'Detener',
      speed: 'Velocidad',
      voice: 'Voz',
      reading: 'Leyendo',
      paused: 'Pausado',
      idle: 'Inactivo',
      clickToRead: 'Haz clic en cualquier párrafo para escuchar',
      jumpToSection: '📑 Saltar a sección...',
      sectionsAvailable: 'secciones disponibles · Clic en cualquier párrafo o título para escuchar',
      synthesizing: 'Sintetizando...',
      prevHeadingTitle: 'Título anterior',
      nextHeadingTitle: 'Título siguiente',
      prevBlockTitle: 'Bloque anterior',
      nextBlockTitle: 'Bloque siguiente',
      stopTitle: 'Detener lectura',
      closeTitle: 'Cerrar barra TTS',
    },
    about: {
      title: 'MDCAT Extended',
      tagline: 'Lector y analizador de Markdown de nueva generación, ultra liviano, seguro y optimizado para documentos masivos.',
      communityOrigin: 'Origen',
      communityText: 'Nacido e impulsado con orgullo desde la comunidad cyBEERsecurity. Hacking etilico, ciberseguridad, cerveza y código libre.',
      coreSpec: 'Rust (Zero-Copy multihilo)',
      runnerSpec: 'Tauri v2 (Binario ~6 MB)',
      uiSpec: 'Vanilla TS + CSS nativo',
      mascotSpec: 'Fluffy Orange Cat (8-Bit)',
      license: 'Licencia MIT • Código Abierto',
    },
    mdbin: {
      title: 'Cápsula Cifrada MDBIN',
      subtitle: 'AES-256-GCM • Argon2id',
      desc: 'Este documento está protegido con cifrado de grado militar. Ingresa la frase de paso para descifrarlo directamente en memoria RAM.',
      passwordLabel: 'Contraseña de Acceso:',
      passwordPlaceholder: 'Escribe la contraseña de desbloqueo...',
      decryptBtn: 'Descifrar Documento',
      cancelBtn: 'Cancelar',
      error: 'Contraseña incorrecta o el archivo ha sido alterado.',
    },
  },
  en: {
    common: {
      save: 'Save',
      saveTitle: 'Save document (Ctrl+S)',
      savedToast: 'Document saved successfully',
      splitResetToast: 'Split view reset to 50% / 50%',
      reloadedToast: 'Document reloaded from disk',
      autoUpdatedToast: 'Automatically updated',
      noFileToast: 'No open file to reload',
    },
    viewMode: {
      lindo: '📖 Formatted',
      lindoTitle: 'Formatted Reading Mode',
      split: '⚡ 2-Screens',
      splitTitle: '2-Screens Mode: Live Editor + Formatted View',
      crudo: '📝 Raw',
      crudoTitle: 'Raw Mode: Editor Only',
    },
    editor: {
      title: 'Markdown Editor (Raw Mode)',
      synced: 'Synced',
      modified: 'Modified',
      lines: 'lines',
      chars: 'characters',
      placeholder: 'Type or paste your raw Markdown here...',
    },
    menu: {
      file: 'File',
      open: 'Open Markdown file...',
      saveFile: 'Save changes',
      exportPdf: 'Export to PDF / Print...',
      exportMdbin: 'Export as encrypted .mdbin capsule...',
      close: 'Close reader',
      view: 'View',
      viewLindo: 'Formatted View (Rich)',
      viewSplit: '2-Screens View (Split)',
      viewCrudo: 'Raw Mode (Editor Only)',
      toggleSidebar: 'Toggle Sidebar',
      focusMode: 'Focus Mode',
      typewriterMode: 'Typewriter Mode',
      ttsBar: 'Voice Reader Bar (TTS)',
      bionicMode: 'Toggle Bionic Reading',
      help: 'Help',
      shortcuts: 'Shortcuts & Commands',
      markdownGuide: 'Markdown Syntax Guide',
      reportIssue: 'Report an Issue',
      checkUpdates: 'Check for Updates...',
      about: 'About MDCAT Extended',
      themeLabel: 'Theme:',
      themes: {
        blanco: 'Light',
        negro: 'OLED',
        rosa: 'Sakura',
        verdeDorado: 'Emerald',
      },
    },
    metrics: {
      words: 'words',
      chars: 'characters',
      readingTime: 'min read',
      coreEngine: 'MDCAT Core (Rust)',
    },
    toc: {
      title: 'Outline (TOC)',
      empty: 'No headings detected',
    },
    tabs: {
      openTitle: 'Open file in a new tab (Ctrl+O)',
    },
    tts: {
      play: 'Listen',
      pause: 'Pause',
      resume: 'Resume',
      stop: 'Stop',
      speed: 'Speed',
      voice: 'Voice',
      reading: 'Reading',
      paused: 'Paused',
      idle: 'Idle',
      clickToRead: 'Click any paragraph to listen',
      jumpToSection: '📑 Jump to section...',
      sectionsAvailable: 'sections available · Click any paragraph or title to listen',
      synthesizing: 'Synthesizing...',
      prevHeadingTitle: 'Previous heading',
      nextHeadingTitle: 'Next heading',
      prevBlockTitle: 'Previous block',
      nextBlockTitle: 'Next block',
      stopTitle: 'Stop reading',
      closeTitle: 'Close TTS bar',
    },
    about: {
      title: 'MDCAT Extended',
      tagline: 'Next-generation, ultra-lightweight, secure Markdown reader and analyzer optimized for massive documents.',
      communityOrigin: 'Origin',
      communityText: 'Born and proudly driven by the cyBEERsecurity community. Ethylic hacking, cybersecurity, beer and open source code.',
      coreSpec: 'Rust (Zero-Copy multithreaded)',
      runnerSpec: 'Tauri v2 (~6 MB Binary)',
      uiSpec: 'Vanilla TS + Native CSS',
      mascotSpec: 'Fluffy Orange Cat (8-Bit)',
      license: 'MIT License • Open Source',
    },
    mdbin: {
      title: 'Encrypted MDBIN Capsule',
      subtitle: 'AES-256-GCM • Argon2id',
      desc: 'This document is protected with military-grade encryption. Enter the passphrase to decrypt directly into RAM memory.',
      passwordLabel: 'Access Passphrase:',
      passwordPlaceholder: 'Enter unlock password...',
      decryptBtn: 'Decrypt Document',
      cancelBtn: 'Cancel',
      error: 'Incorrect password or file has been tampered with.',
    },
  },
};

export class I18nManager {
  private currentLocale: SupportedLocale = 'es';
  private listeners: ((locale: SupportedLocale) => void)[] = [];

  init(): void {
    const saved = localStorage.getItem('mdcat_preferred_locale') as SupportedLocale;
    if (saved && (saved === 'es' || saved === 'en')) {
      this.currentLocale = saved;
    } else {
      const navLang = navigator.language.toLowerCase();
      this.currentLocale = navLang.startsWith('es') ? 'es' : 'en';
    }
    this.applyToDom();
  }

  getLocale(): SupportedLocale {
    return this.currentLocale;
  }

  setLocale(locale: SupportedLocale): void {
    if (this.currentLocale === locale) return;
    this.currentLocale = locale;
    localStorage.setItem('mdcat_preferred_locale', locale);
    this.applyToDom();
    this.listeners.forEach((fn) => fn(locale));
  }

  toggleLocale(): void {
    this.setLocale(this.currentLocale === 'es' ? 'en' : 'es');
  }

  t(): TranslationSchema {
    return TRANSLATIONS[this.currentLocale];
  }

  onChange(listener: (locale: SupportedLocale) => void): void {
    this.listeners.push(listener);
  }

  applyToDom(): void {
    const t = this.t();

    // 1. Atributo lang en html
    document.documentElement.lang = this.currentLocale;

    // 2. Elementos con data-i18n (texto o contenido)
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      const val = this.getNestedValue(t, key);
      if (typeof val === 'string') {
        el.textContent = val;
      }
    });

    // 3. Elementos con data-i18n-title (atributos title accesibles)
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (!key) return;
      const val = this.getNestedValue(t, key);
      if (typeof val === 'string') {
        el.setAttribute('title', val);
      }
    });

    // 4. Elementos con data-i18n-placeholder (inputs y textareas)
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      const val = this.getNestedValue(t, key);
      if (typeof val === 'string') {
        (el as HTMLInputElement | HTMLTextAreaElement).placeholder = val;
      }
    });

    // 5. Indicador de idioma en la cabecera
    const langBtn = document.getElementById('lang-toggle-btn');
    if (langBtn) {
      langBtn.textContent = this.currentLocale.toUpperCase();
      langBtn.title = this.currentLocale === 'es' ? 'Cambiar a Inglés' : 'Switch to Spanish';
    }
  }

  private getNestedValue(obj: any, path: string): string | null {
    const parts = path.split('.');
    let curr = obj;
    for (const part of parts) {
      if (curr && typeof curr === 'object' && part in curr) {
        curr = curr[part];
      } else {
        return null;
      }
    }
    return typeof curr === 'string' ? curr : null;
  }
}
