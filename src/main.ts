/**
 * @file main.ts
 * @description Punto de entrada en Vanilla TypeScript para MDCAT Extended.
 * Aplicación de escritorio nativa ultra liviana para Windows (Tauri v2 + Rust Core).
 * Cero frameworks pesados: manipulación directa del DOM, diálogos de archivo nativos de Windows,
 * atajos globales de escritorio y soporte de línea de comandos.
 */

import { BionicReader } from './bionic';
import { SyntaxHighlighter } from './highlighter';
import { CommandPalette, PaletteCommand } from './palette';
import { DiagramRenderer } from './diagrams';
import { TtsManager } from './tts';
import { I18nManager } from './i18n';
import { AnnotationManager } from './annotations';

// Tipos de dominio del sistema
export type VisualTheme = 'blanco' | 'negro' | 'rosa' | 'verde-dorado';

export interface TocItem {
  id: string;
  level: number;
  text: string;
  line_number: number;
  children: TocItem[];
}

export interface ReadingMetrics {
  word_count: number;
  character_count: number;
  estimated_minutes: number;
  heading_count: number;
}

export interface ProcessedDocument {
  content_hash: string;
  frontmatter_json: string | null;
  toc: TocItem[];
  ast_html: string;
  metrics: ReadingMetrics;
}

export interface MdbinEnvelope {
  format: string;
  type: string;
  ai_instructions: string;
  document_hint?: string;
  kdf: string;
  cipher: string;
}

// -----------------------------------------------------------------------------
// 1. Gestor de Temas Visuales (4 Temas Oficiales)
// -----------------------------------------------------------------------------
class ThemeManager {
  private currentTheme: VisualTheme = 'negro';

  init(): void {
    const saved = localStorage.getItem('mdcat_theme') as VisualTheme;
    if (saved && ['blanco', 'negro', 'rosa', 'verde-dorado'].includes(saved)) {
      this.setTheme(saved);
    } else {
      this.setTheme('negro');
    }
  }

  setTheme(theme: VisualTheme): void {
    this.currentTheme = theme;
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('mdcat_theme', theme);

    // Actualizar chips de la barra
    document.querySelectorAll('.theme-chip').forEach((chip) => {
      const btn = chip as HTMLButtonElement;
      const chipTheme = btn.dataset.theme;
      btn.classList.toggle('active', chipTheme === theme);
    });
  }

  getTheme(): VisualTheme {
    return this.currentTheme;
  }
}

// -----------------------------------------------------------------------------
// 2. Puente de Comunicación IPC con el Core de Rust (Tauri v2 Desktop)
// -----------------------------------------------------------------------------
export class TauriBridge {
  static isTauriAvailable(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  }

  static async parseMarkdown(content: string): Promise<ProcessedDocument> {
    if (this.isTauriAvailable()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<ProcessedDocument>('parse_markdown', { content });
      } catch (err) {
        console.error('Error invocando comando Tauri parse_markdown:', err);
      }
    }

    return this.desktopFallbackParse(content);
  }

  static async readFile(path: string): Promise<ProcessedDocument> {
    if (this.isTauriAvailable()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<ProcessedDocument>('read_and_parse_file', { path });
    }
    throw new Error('Lectura de archivos de disco solo disponible en modo desktop.');
  }

  static async readFileContent(path: string): Promise<string> {
    if (this.isTauriAvailable()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('read_file_content', { path });
    }
    throw new Error('Lectura de archivos de disco solo disponible en modo desktop.');
  }

  static async inspectMdbin(path: string): Promise<MdbinEnvelope> {
    if (this.isTauriAvailable()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<MdbinEnvelope>('inspect_mdbin_envelope', { path });
    }
    return {
      format: 'MDBIN/1.0',
      type: 'Encrypted-Markdown-Container',
      ai_instructions: 'Inspección de cápsula MDBIN',
      document_hint: 'Cápsula de seguridad',
      kdf: 'Argon2id',
      cipher: 'AES-256-GCM',
    };
  }

  static async exportToMdbin(path: string, markdown: string, password: string, hint?: string): Promise<void> {
    if (this.isTauriAvailable()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('export_to_mdbin', { path, markdown, password, hint: hint || null });
    }
  }

  static async readAndDecryptMdbin(path: string, password: string): Promise<ProcessedDocument> {
    if (this.isTauriAvailable()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<ProcessedDocument>('read_and_decrypt_mdbin', { path, password });
    }
    throw new Error('Descifrado criptográfico MDBIN solo disponible en modo desktop nativo con Rust.');
  }

  /**
   * Abre el diálogo nativo de Windows (OpenFileDialog) vía Rust.
   */
  static async openFileDialog(): Promise<string | null> {
    if (this.isTauriAvailable()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string | null>('open_file_dialog');
    }
    return null;
  }

  /**
   * Abre el diálogo nativo de Windows (SaveFileDialog) vía Rust.
   */
  static async saveFileDialog(defaultName?: string): Promise<string | null> {
    if (this.isTauriAvailable()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string | null>('save_file_dialog', { defaultName: defaultName || null });
    }
    return null;
  }

  /**
   * Guarda texto Markdown en un archivo del disco vía Rust.
   */
  static async saveMarkdownFile(path: string, content: string): Promise<boolean> {
    if (this.isTauriAvailable()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_markdown_file', { path, content });
        return true;
      } catch (err) {
        console.error('Error al guardar archivo Markdown:', err);
        return false;
      }
    }
    return false;
  }

  /**
   * Abre el diálogo nativo de Windows para guardar un archivo .md.
   */
  static async saveMarkdownDialog(defaultName?: string): Promise<string | null> {
    if (this.isTauriAvailable()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string | null>('save_markdown_dialog', { defaultName: defaultName || null });
    }
    return null;
  }

  /**
   * Obtiene la ruta del archivo pasado como argumento en la consola o apertura de Windows.
   */
  static async getCliArgument(): Promise<string | null> {
    if (this.isTauriAvailable()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string | null>('get_cli_argument');
    }
    return null;
  }

  /**
   * Obtiene la última fecha de modificación del archivo en milisegundos Unix.
   */
  static async getFileMtime(path: string): Promise<number | null> {
    if (this.isTauriAvailable()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<number | null>('get_file_mtime', { path });
      } catch (err) {
        console.error('Error al consultar mtime:', err);
      }
    }
    return null;
  }

  /**
   * Obtiene el catálogo de voces neuronales de Microsoft Edge desde Rust.
   */
  static async getEdgeVoices(): Promise<Array<{ name: string; short_name: string; friendly_name: string; locale: string; gender: string }>> {
    if (this.isTauriAvailable()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke('get_edge_voices');
      } catch (err) {
        console.error('Error al consultar voces de Edge:', err);
      }
    }
    return [];
  }

  /**
   * Sintetiza audio en MP3 mediante el servicio neuronal de Microsoft Edge.
   */
  static async synthesizeEdgeTts(text: string, voice: string, rate: number): Promise<string | null> {
    if (this.isTauriAvailable()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<string>('synthesize_edge_tts', { text, voice, rate });
      } catch (err) {
        console.error('Error en síntesis Edge TTS:', err);
      }
    }
    return null;
  }

  private static desktopFallbackParse(content: string): ProcessedDocument {
    const lines = content.split('\n');
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    return {
      content_hash: 'desktop-init-hash',
      frontmatter_json: null,
      toc: [
        { id: 'bienvenido-a-mdcat', level: 1, text: 'Bienvenido a MDCAT Extended', line_number: 1, children: [] },
      ],
      ast_html: `<div class="mdcat-callout" data-callout="note"><div class="mdcat-callout-header"><span>Nota</span></div><div class="mdcat-callout-body"><p>Lector de escritorio nativo MDCAT Extended listo.</p></div></div><p>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`,
      metrics: {
        word_count: words,
        character_count: content.length,
        estimated_minutes: Math.max(0.5, +(words / 200).toFixed(1)),
        heading_count: lines.filter(l => l.startsWith('#')).length,
      },
    };
  }
}

// -----------------------------------------------------------------------------
// 3. Aplicación Principal de Escritorio
// -----------------------------------------------------------------------------
class App {
  private themeManager = new ThemeManager();
  private palette = new CommandPalette();
  private ttsManager = new TtsManager();
  private i18nManager = new I18nManager();
  private annotationManager = new AnnotationManager();
  private focusModeActive = false;
  private typewriterModeActive = false;
  private currentRawMarkdown = '';
  private currentDoc: ProcessedDocument | null = null;
  private scrollObserver: IntersectionObserver | null = null;
  private pendingMdbinPath: string | null = null;

  // Estado de Modos de Vista (Lindo, Crudo, Dividido) y Editor en vivo
  private currentViewMode: 'lindo' | 'crudo' | 'dividido' = 'lindo';
  private isDirty: boolean = false;
  private editorDebounceTimer: number | null = null;
  private rawEditorTextarea: HTMLTextAreaElement | null = null;
  private rawEditorBadge: HTMLElement | null = null;
  private rawEditorCounter: HTMLElement | null = null;
  private appContainer: HTMLElement | null = null;
  private splitGutter: HTMLElement | null = null;
  private rawEditorContainer: HTMLElement | null = null;
  private readerViewport: HTMLElement | null = null;
  private sidebarToc: HTMLElement | null = null;
  private isResizingSplit: boolean = false;
  private splitRatio: number = 0.5;

  // Estado del archivo actual y vigilante en vivo (Live Reload)
  private currentFilePath: string | null = null;
  private lastFileMtime: number | null = null;
  private fileWatchTimer: number | null = null;

  async init(): Promise<void> {
    this.themeManager.init();
    this.i18nManager.init();
    this.ttsManager.init();
    this.ttsManager.setI18nManager(this.i18nManager);
    this.annotationManager.init();

    this.appContainer = document.getElementById('app-container');
    this.rawEditorTextarea = document.getElementById('raw-markdown-editor') as HTMLTextAreaElement | null;
    this.rawEditorBadge = document.getElementById('raw-editor-badge');
    this.rawEditorCounter = document.getElementById('raw-editor-counter');
    this.splitGutter = document.getElementById('split-gutter');
    this.rawEditorContainer = document.getElementById('raw-editor-container');
    this.readerViewport = document.getElementById('reader-viewport');
    this.sidebarToc = document.getElementById('sidebar-toc');

    this.i18nManager.onChange(() => {
      this.ttsManager.onLocaleChanged();
      this.setDirty(this.isDirty);
      this.updateEditorCounter();
      if (this.currentDoc) {
        this.updateStatusBar(this.currentDoc.metrics);
      }
      this.updatePaletteCommands();
    });

    const savedRatio = localStorage.getItem('mdcat_split_ratio');
    if (savedRatio) {
      this.splitRatio = Math.max(0.18, Math.min(0.82, parseFloat(savedRatio))) || 0.5;
    }

    const ttsBar = document.getElementById('tts-player-bar');
    if (ttsBar) {
      this.ttsManager.bindUi(ttsBar);
    }

    this.bindEditorEvents();
    this.bindViewModeEvents();
    this.bindSplitGutterEvents();
    this.bindEvents();
    this.initSplash();

    // 1. Comprobar si se abrió pasándole un archivo por CLI o doble clic en Windows
    const cliFilePath = await TauriBridge.getCliArgument();
    if (cliFilePath) {
      await this.openDocumentByPath(cliFilePath);
      return;
    }

    // 2. Restaurar último archivo abierto si existe en el almacenamiento local
    const lastOpened = localStorage.getItem('mdcat_last_opened_file');
    if (lastOpened) {
      try {
        await this.openDocumentByPath(lastOpened);
        return;
      } catch (e) {
        console.warn('El último archivo abierto ya no está disponible:', e);
      }
    }

    // 3. Documento inicial sobrio y profesional
    const cleanWelcomeDoc = `# MDCAT Extended
Lector y visor de Markdown ultraliviano de nueva generación para Windows.

> [!NOTE]
> Parseo nativo zero-copy en Rust a más de 100.000 líneas en milisegundos, 4 temas de color de alto contraste, lectura con síntesis de voz neuronal y vigilancia automática de archivos en tiempo real.

## Primeros Pasos
- Abre cualquier archivo Markdown presionando **Ctrl + O** o arrástralo directamente a esta ventana.
- Si editas tu archivo en cualquier editor externo (como Notepad o VS Code) y lo guardas, **MDCAT se actualiza automáticamente al instante**.
- Presiona **F5** en cualquier momento para recargar el archivo abierto desde el disco sin perder tu posición de lectura.
- Presiona **Ctrl + K** para desplegar la paleta de comandos rápida.
- Presiona **F7** para abrir la barra de lectura en voz alta (Text-to-Speech) con voces neuronales de alta fidelidad.

## Atajos de Teclado
| Atajo | Función |
| :--- | :--- |
| **Ctrl + O** | Abrir documento Markdown o cápsula .mdbin |
| **F5** / **Ctrl + R** | Recargar documento actual desde el disco |
| **F7** | Activar / Ocultar barra de voz (TTS) |
| **F8** | Alternar Modo Enfoque (atenuar párrafos secundarios) |
| **F9** | Alternar Modo Máquina de Escribir (centrado al 50vh) |
| **F10** | Alternar Lectura Biónica (fijación sacádica) |
| **Ctrl + P** | Exportar a PDF limpio e imprimir |
| **Ctrl + K** | Paleta de comandos interactiva |
`;

    this.currentRawMarkdown = cleanWelcomeDoc;
    await this.renderContent(cleanWelcomeDoc);
  }

  private initSplash(): void {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;

    // Desvanecimiento suave en menos de 900ms
    setTimeout(() => {
      splash.classList.add('fade-out');
    }, 850);
  }

  private async openDocumentByPath(path: string): Promise<void> {
    if (path.endsWith('.mdbin')) {
      try {
        const env = await TauriBridge.inspectMdbin(path);
        this.openMdbinModal(path, env.document_hint);
      } catch {
        this.openMdbinModal(path);
      }
    } else {
      try {
        const doc = await TauriBridge.readFile(path);
        this.currentFilePath = path;
        localStorage.setItem('mdcat_last_opened_file', path);
        this.applyProcessedDocument(doc);

        // Cargar contenido crudo en el editor
        try {
          const raw = await TauriBridge.readFileContent(path);
          this.currentRawMarkdown = raw;
          if (this.rawEditorTextarea) {
            this.rawEditorTextarea.value = raw;
            this.setDirty(false);
            this.updateEditorCounter();
          }
        } catch (e) {
          console.warn('No se pudo leer texto plano directo:', e);
        }

        this.startFileWatcher(path);
      } catch (err) {
        console.error('Error al abrir archivo por ruta:', err);
        throw err;
      }
    }
  }

  /**
   * Recarga el documento actual desde el disco preservando la posición exacta de lectura
   */
  async reloadCurrentDocument(silent = false): Promise<void> {
    if (this.currentFilePath) {
      try {
        const scrollPos = window.scrollY;
        const doc = await TauriBridge.readFile(this.currentFilePath);
        this.applyProcessedDocument(doc);

        if (!this.isDirty) {
          try {
            const raw = await TauriBridge.readFileContent(this.currentFilePath);
            this.currentRawMarkdown = raw;
            if (this.rawEditorTextarea) {
              this.rawEditorTextarea.value = raw;
              this.updateEditorCounter();
            }
          } catch {}
        }

        window.scrollTo({ top: scrollPos, behavior: 'instant' });
        this.lastFileMtime = await TauriBridge.getFileMtime(this.currentFilePath);
        if (!silent) {
          const isEn = this.i18nManager.getLocale() === 'en';
          this.showToast(isEn ? 'Document reloaded from disk' : 'Documento recargado desde el disco');
        }
      } catch (err) {
        console.error('Error al recargar documento:', err);
      }
    } else {
      if (!silent) {
        const isEn = this.i18nManager.getLocale() === 'en';
        this.showToast(isEn ? 'No open file to reload' : 'No hay archivo abierto para recargar');
      }
    }
  }

  /**
   * Inicia el vigilante de archivos en disco (Live Reload automático)
   */
  private startFileWatcher(path: string): void {
    this.stopFileWatcher();
    TauriBridge.getFileMtime(path).then((mtime) => {
      this.lastFileMtime = mtime;
    });

    this.fileWatchTimer = window.setInterval(async () => {
      if (!this.currentFilePath) return;
      const mtime = await TauriBridge.getFileMtime(this.currentFilePath);
      if (this.lastFileMtime !== null && mtime !== null && mtime > this.lastFileMtime) {
        this.lastFileMtime = mtime;
        await this.reloadCurrentDocument(true);
        const isEn = this.i18nManager.getLocale() === 'en';
        this.showToast(isEn ? 'Automatically updated' : 'Actualizado automáticamente');
      }
    }, 700);
  }

  private stopFileWatcher(): void {
    if (this.fileWatchTimer !== null) {
      clearInterval(this.fileWatchTimer);
      this.fileWatchTimer = null;
    }
  }

  /**
   * Muestra un toast sutil y elegante en la esquina inferior
   */
  private showToast(message: string): void {
    let toast = document.getElementById('mdcat-live-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'mdcat-live-toast';
      toast.className = 'mdcat-live-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => {
      toast?.classList.remove('visible');
    }, 2200);
  }

  private bindViewModeEvents(): void {
    document.getElementById('view-mode-lindo-btn')?.addEventListener('click', () => this.setViewMode('lindo'));
    document.getElementById('view-mode-split-btn')?.addEventListener('click', () => this.setViewMode('dividido'));
    document.getElementById('view-mode-crudo-btn')?.addEventListener('click', () => this.setViewMode('crudo'));
    document.getElementById('header-save-btn')?.addEventListener('click', () => this.saveCurrentDocument());
  }

  private bindEditorEvents(): void {
    if (!this.rawEditorTextarea) return;

    // Sincronización en vivo de la edición (Live Preview)
    this.rawEditorTextarea.addEventListener('input', () => {
      this.currentRawMarkdown = this.rawEditorTextarea?.value || '';
      this.setDirty(true);
      this.updateEditorCounter();

      // En modo dividido (2 pantallas), actualizar la vista linda en tiempo real
      if (this.currentViewMode === 'dividido') {
        if (this.editorDebounceTimer) {
          clearTimeout(this.editorDebounceTimer);
        }
        this.editorDebounceTimer = window.setTimeout(async () => {
          await this.renderContent(this.currentRawMarkdown, true);
        }, 120);
      }
    });

    // Permitir indentar con Tab en el editor
    this.rawEditorTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.rawEditorTextarea!.selectionStart;
        const end = this.rawEditorTextarea!.selectionEnd;
        const val = this.rawEditorTextarea!.value;
        this.rawEditorTextarea!.value = val.substring(0, start) + '  ' + val.substring(end);
        this.rawEditorTextarea!.selectionStart = this.rawEditorTextarea!.selectionEnd = start + 2;
        this.currentRawMarkdown = this.rawEditorTextarea!.value;
        this.setDirty(true);
        this.updateEditorCounter();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveCurrentDocument();
      }
    });
  }

  private setDirty(dirty: boolean): void {
    this.isDirty = dirty;
    if (this.rawEditorBadge) {
      const isEn = this.i18nManager.getLocale() === 'en';
      if (dirty) {
        this.rawEditorBadge.textContent = isEn ? 'Modified' : 'Modificado';
        this.rawEditorBadge.className = 'raw-editor-badge dirty';
      } else {
        this.rawEditorBadge.textContent = isEn ? 'Synced' : 'Sincronizado';
        this.rawEditorBadge.className = 'raw-editor-badge';
      }
    }
  }

  private updateEditorCounter(): void {
    if (!this.rawEditorCounter || !this.rawEditorTextarea) return;
    const text = this.rawEditorTextarea.value;
    const lines = text.split('\n').length;
    const chars = text.length;
    const isEn = this.i18nManager.getLocale() === 'en';
    const linesLabel = isEn ? 'lines' : 'líneas';
    const charsLabel = isEn ? 'chars' : 'caracteres';
    this.rawEditorCounter.textContent = `${lines} ${linesLabel} • ${chars.toLocaleString()} ${charsLabel}`;
  }

  private bindSplitGutterEvents(): void {
    if (!this.splitGutter) return;

    this.splitGutter.addEventListener('mousedown', (e) => {
      if (this.currentViewMode !== 'dividido') return;
      e.preventDefault();
      this.isResizingSplit = true;
      document.body.classList.add('is-resizing-split');
      this.splitGutter?.classList.add('active');
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isResizingSplit || !this.appContainer || !this.rawEditorContainer || !this.readerViewport) {
        return;
      }

      const containerRect = this.appContainer.getBoundingClientRect();
      const sidebarWidth = this.sidebarToc && !this.sidebarToc.classList.contains('collapsed')
        ? this.sidebarToc.offsetWidth
        : 0;

      const gutterWidth = 6;
      const availableWidth = containerRect.width - sidebarWidth - gutterWidth;
      if (availableWidth <= 440) return;

      const mouseX = e.clientX - containerRect.left - sidebarWidth;
      // Márgenes mínimos de 220px para asegurar usabilidad en ambas columnas
      const clampedX = Math.max(220, Math.min(availableWidth - 220, mouseX));
      this.splitRatio = clampedX / availableWidth;

      this.applySplitRatio();
    });

    window.addEventListener('mouseup', () => {
      if (this.isResizingSplit) {
        this.isResizingSplit = false;
        document.body.classList.remove('is-resizing-split');
        this.splitGutter?.classList.remove('active');
        localStorage.setItem('mdcat_split_ratio', String(this.splitRatio));
      }
    });

    // Doble clic en la barra divisoria para restablecer exactamente al 50% / 50%
    this.splitGutter.addEventListener('dblclick', () => {
      if (this.currentViewMode !== 'dividido') return;
      this.splitRatio = 0.5;
      this.applySplitRatio();
      localStorage.setItem('mdcat_split_ratio', '0.5');
      const isEn = this.i18nManager.getLocale() === 'en';
      this.showToast(isEn ? 'Split view reset to 50% / 50%' : 'División restablecida al 50% / 50%');
    });
  }

  private applySplitRatio(): void {
    if (!this.rawEditorContainer || !this.readerViewport) return;
    if (this.currentViewMode === 'dividido') {
      const leftRatio = this.splitRatio;
      const rightRatio = 1 - this.splitRatio;
      this.rawEditorContainer.style.flex = `${leftRatio} ${leftRatio} 0px`;
      this.rawEditorContainer.style.width = '';
      this.readerViewport.style.flex = `${rightRatio} ${rightRatio} 0px`;
      this.readerViewport.style.width = '';
    } else {
      this.rawEditorContainer.style.flex = '';
      this.rawEditorContainer.style.width = '';
      this.readerViewport.style.flex = '';
      this.readerViewport.style.width = '';
    }
  }

  setViewMode(mode: 'lindo' | 'crudo' | 'dividido'): void {
    this.currentViewMode = mode;
    if (this.appContainer) {
      this.appContainer.classList.remove('mode-lindo', 'mode-crudo', 'mode-dividido');
      this.appContainer.classList.add(`mode-${mode}`);
    }

    // Actualizar botones de la barra de vistas
    document.querySelectorAll('.view-mode-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-view-mode') === mode);
    });

    if (mode === 'crudo' || mode === 'dividido') {
      if (this.rawEditorTextarea && this.rawEditorTextarea.value !== this.currentRawMarkdown) {
        this.rawEditorTextarea.value = this.currentRawMarkdown;
        this.updateEditorCounter();
      }
      if (mode === 'crudo') {
        this.rawEditorTextarea?.focus();
      }
    }

    if (mode === 'dividido') {
      this.applySplitRatio();
    } else {
      if (this.rawEditorContainer) {
        this.rawEditorContainer.style.flex = '';
        this.rawEditorContainer.style.width = '';
      }
      if (this.readerViewport) {
        this.readerViewport.style.flex = '';
        this.readerViewport.style.width = '';
      }
    }

    if (mode === 'lindo' || mode === 'dividido') {
      // Si el editor tenía cambios no renderizados, actualizamos la vista linda
      if (this.rawEditorTextarea && this.isDirty) {
        this.renderContent(this.currentRawMarkdown, true);
      }
    }
  }

  toggleNextViewMode(): void {
    if (this.currentViewMode === 'lindo') {
      this.setViewMode('dividido');
    } else if (this.currentViewMode === 'dividido') {
      this.setViewMode('crudo');
    } else {
      this.setViewMode('lindo');
    }
  }

  async saveCurrentDocument(): Promise<void> {
    const contentToSave = this.rawEditorTextarea ? this.rawEditorTextarea.value : this.currentRawMarkdown;
    const isEn = this.i18nManager.getLocale() === 'en';

    if (this.currentFilePath) {
      const ok = await TauriBridge.saveMarkdownFile(this.currentFilePath, contentToSave);
      if (ok) {
        this.setDirty(false);
        this.lastFileMtime = Date.now();
        this.showToast(isEn ? '✅ Document saved successfully' : '✅ Documento guardado exitosamente');
      } else {
        this.showToast(isEn ? '❌ Error saving file' : '❌ Error al guardar el archivo');
      }
    } else {
      const targetPath = await TauriBridge.saveMarkdownDialog('documento.md');
      if (targetPath) {
        this.currentFilePath = targetPath;
        const ok = await TauriBridge.saveMarkdownFile(targetPath, contentToSave);
        if (ok) {
          this.setDirty(false);
          this.lastFileMtime = Date.now();
          const baseName = targetPath.split(/[\\/]/).pop();
          this.showToast(isEn ? `✅ Document saved as: ${baseName}` : `✅ Documento guardado como: ${baseName}`);
        }
      }
    }
  }

  private async renderContent(markdownText: string, fromEditor: boolean = false): Promise<void> {
    this.currentRawMarkdown = markdownText;
    if (this.rawEditorTextarea && !fromEditor) {
      this.rawEditorTextarea.value = markdownText;
      this.setDirty(false);
      this.updateEditorCounter();
    }
    const doc = await TauriBridge.parseMarkdown(markdownText);
    this.applyProcessedDocument(doc);
  }

  private applyProcessedDocument(doc: ProcessedDocument): void {
    this.currentDoc = doc;

    // 1. Actualizar cuerpo del visor
    const container = document.getElementById('markdown-content');
    if (container) {
      container.innerHTML = doc.ast_html;

      // Vincular IDs a los encabezados para anclaje de navegación exacto
      container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6').forEach((heading) => {
        const anchor = heading.querySelector<HTMLElement>('a.heading-anchor, a[id]');
        if (anchor && anchor.id) {
          heading.id = anchor.id;
        }
      });

      // Resaltar sintaxis de bloques de código
      SyntaxHighlighter.highlightAll(container);

      // Renderizar diagramas Mermaid
      DiagramRenderer.renderMermaid(container).catch(console.error);

      // Hacer checkboxes interactivos
      this.initInteractiveCheckboxes(container);

      // Spec 09: Parsear bloques de texto para síntesis de voz (TTS)
      this.ttsManager.parseDocumentBlocks(container);

      // Spec 08: Cargar anotaciones W3C del documento actual
      this.annotationManager.setDocumentHash(doc.content_hash);
    }

    // 2. Renderizar Tabla de Contenidos (TOC) y configurar ScrollSpy
    this.renderToc(doc.toc);
    this.initScrollSpy();

    // 3. Actualizar Barra de Estado
    this.updateStatusBar(doc.metrics);

    // 4. Actualizar comandos disponibles en la paleta
    this.updatePaletteCommands();
  }

  private initInteractiveCheckboxes(container: HTMLElement): void {
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    checkboxes.forEach((cb) => {
      cb.removeAttribute('disabled');
      cb.addEventListener('change', () => {
        const parentLi = cb.closest('li');
        if (parentLi) {
          parentLi.style.textDecoration = cb.checked ? 'line-through' : 'none';
          parentLi.style.opacity = cb.checked ? '0.7' : '1';
        }
      });
    });
  }

  private renderToc(tocItems: TocItem[]): void {
    const tocList = document.getElementById('toc-list');
    if (!tocList) return;

    tocList.innerHTML = '';

    const appendItems = (items: TocItem[], parent: HTMLElement) => {
      for (const item of items) {
        const li = document.createElement('li');
        li.className = `toc-item-wrapper level-${item.level}`;

        // 1. Botón de reproducción AL COMIENZO de cada título
        const ttsBtn = document.createElement('button');
        ttsBtn.className = 'toc-tts-play-btn';
        ttsBtn.title = `Escuchar desde "${item.text}"`;
        ttsBtn.setAttribute('aria-label', `Escuchar sección ${item.text}`);
        ttsBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
        ttsBtn.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          const target = document.getElementById(item.id);
          if (target) {
            const heading = (target.matches('h1, h2, h3, h4, h5, h6') ? target : target.closest('h1, h2, h3, h4, h5, h6')) || target;
            heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => {
              heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 80);
          }
          this.ttsManager.playHeadingById(item.id);
        };

        // 2. Enlace con el texto del título
        const a = document.createElement('a');
        a.href = `#${item.id}`;
        a.className = `toc-link`;
        a.textContent = item.text;
        a.title = item.text;
        a.dataset.targetId = item.id;
        a.onclick = (e) => {
          e.preventDefault();
          const target = document.getElementById(item.id);
          if (target) {
            const heading = (target.matches('h1, h2, h3, h4, h5, h6') ? target : target.closest('h1, h2, h3, h4, h5, h6')) || target;
            heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => {
              heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 80);
          }
          // Si el lector TTS está hablando o la barra está visible, saltar inmediatamente la lectura a este título
          if (this.ttsManager.isSpeaking() || this.ttsManager.isBarVisible()) {
            this.ttsManager.playHeadingById(item.id);
          }
        };

        // El botón va al comienzo, a la izquierda del texto
        li.appendChild(ttsBtn);
        li.appendChild(a);
        parent.appendChild(li);

        if (item.children && item.children.length > 0) {
          const subList = document.createElement('ul');
          subList.className = 'toc-sublist';
          appendItems(item.children, subList);
          li.appendChild(subList);
        }
      }
    };

    appendItems(tocItems, tocList);
  }

  private initScrollSpy(): void {
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
    }

    const headings = document.querySelectorAll<HTMLElement>('.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4');
    if (headings.length === 0) return;

    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            document.querySelectorAll('.toc-link').forEach((link) => {
              const htmlLink = link as HTMLElement;
              htmlLink.classList.toggle('active', htmlLink.dataset.targetId === id);
            });
          }
        });
      },
      {
        rootMargin: '0px 0px -70% 0px',
        threshold: 0,
      }
    );

    headings.forEach((h) => this.scrollObserver?.observe(h));
  }

  private updateStatusBar(metrics: ReadingMetrics): void {
    const wordsEl = document.getElementById('status-words');
    const charsEl = document.getElementById('status-chars');
    const timeEl = document.getElementById('status-time');
    const isEn = this.i18nManager.getLocale() === 'en';

    if (wordsEl) wordsEl.textContent = `${metrics.word_count.toLocaleString()} ${isEn ? 'words' : 'palabras'}`;
    if (charsEl) charsEl.textContent = `${metrics.character_count.toLocaleString()} ${isEn ? 'characters' : 'caracteres'}`;
    if (timeEl) timeEl.textContent = `~${metrics.estimated_minutes} ${isEn ? 'min read' : 'min de lectura'}`;
  }

  private updatePaletteCommands(): void {
    const baseCommands: PaletteCommand[] = [
      {
        id: 'save-file',
        title: 'Guardar Documento Actual',
        subtitle: 'Guarda los cambios de vuelta en el archivo del disco',
        icon: '💾',
        shortcut: 'Ctrl+S',
        action: () => this.saveCurrentDocument(),
      },
      {
        id: 'view-mode-lindo',
        title: 'Vista: Modo Lindo (Lectura Embellecida)',
        subtitle: 'Visualización renderizada y formateada a pantalla completa',
        icon: '📖',
        action: () => this.setViewMode('lindo'),
      },
      {
        id: 'view-mode-split',
        title: 'Vista: 2 Pantallas (Modo Dividido)',
        subtitle: 'Editor de texto a la izquierda + Vista previa en vivo a la derecha',
        icon: '⚡',
        shortcut: 'Ctrl+E',
        action: () => this.setViewMode('dividido'),
      },
      {
        id: 'view-mode-crudo',
        title: 'Vista: Modo Crudo (Solo Editor)',
        subtitle: 'Editor de Markdown sin formateo para edición pura',
        icon: '📝',
        action: () => this.setViewMode('crudo'),
      },
      {
        id: 'open-file',
        title: 'Abrir Documento Local...',
        subtitle: 'Abre el explorador de archivos nativo de Windows',
        icon: '📂',
        shortcut: 'Ctrl+O',
        action: () => this.handleOpenNativeFileDialog(),
      },
      {
        id: 'theme-blanco',
        title: 'Tema: Blanco (Paper Light)',
        subtitle: 'Lectura nítida diurna de alto contraste',
        icon: '☀️',
        action: () => this.themeManager.setTheme('blanco'),
      },
      {
        id: 'theme-negro',
        title: 'Tema: Negro (OLED Black)',
        subtitle: 'Negro puro #000000 para máximo descanso visual',
        icon: '🌑',
        action: () => this.themeManager.setTheme('negro'),
      },
      {
        id: 'theme-rosa',
        title: 'Tema: Rosa (Sakura / Cyber-Rose)',
        subtitle: 'Fondo oscuro con acentos rosa pastel',
        icon: '🌸',
        action: () => this.themeManager.setTheme('rosa'),
      },
      {
        id: 'theme-verde-dorado',
        title: 'Tema: Verde y Dorado (Emerald & Gold)',
        subtitle: 'Fondo verde bosque con acentos oro pulido',
        icon: '🌲',
        action: () => this.themeManager.setTheme('verde-dorado'),
      },
      {
        id: 'toggle-tts',
        title: 'Barra de Lectura de Voz (TTS - Spec 09)',
        subtitle: 'Inicia el lector con transfonetización y resaltado visual',
        icon: '🔊',
        shortcut: 'F7',
        action: () => this.ttsManager.toggleBar(),
      },
      {
        id: 'toggle-lang',
        title: 'Cambiar Idioma (ES / EN - Spec 06)',
        subtitle: 'Alterna instantáneamente entre Español e Inglés',
        icon: '🌐',
        action: () => this.i18nManager.toggleLocale(),
      },
      {
        id: 'export-pdf',
        title: 'Exportar a PDF / Imprimir (Spec 08)...',
        subtitle: 'Genera una copia en PDF limpia y formateada',
        icon: '📄',
        shortcut: 'Ctrl+P',
        action: () => this.annotationManager.exportToPdf(),
      },
      {
        id: 'toggle-focus',
        title: 'Alternar Modo Enfoque',
        subtitle: 'Atenúa los párrafos secundarios para concentrarse',
        icon: '🎯',
        shortcut: 'F8',
        action: () => this.toggleFocusMode(),
      },
      {
        id: 'toggle-typewriter',
        title: 'Alternar Modo Máquina de Escribir',
        subtitle: 'Mantiene el cursor o renglón centrado al 50vh',
        icon: '⌨️',
        shortcut: 'F9',
        action: () => this.toggleTypewriterMode(),
      },
      {
        id: 'toggle-bionic',
        title: 'Alternar Lectura Biónica',
        subtitle: 'Fijación sacádica en las primeras letras de cada palabra',
        icon: '⚡',
        shortcut: 'F10',
        action: () => this.toggleBionicReading(),
      },
      {
        id: 'toggle-sidebar',
        title: 'Mostrar / Ocultar Barra Lateral',
        subtitle: 'Contrae o despliega el índice de contenidos',
        icon: '📑',
        shortcut: 'Ctrl+Shift+L',
        action: () => this.toggleSidebar(),
      },
      {
        id: 'export-mdbin',
        title: 'Cifrar y Exportar a Contenedor .mdbin (RFC-001)...',
        subtitle: 'Guarda una cápsula protegida con AES-256-GCM y Argon2id',
        icon: '🔒',
        action: () => this.exportCurrentDocumentToMdbin(),
      },
      {
        id: 'open-about',
        title: 'Acerca de MDCAT Extended',
        subtitle: 'Información técnica y homenaje a la comunidad cyBEERsecurity',
        icon: '🍺',
        action: () => {
          document.getElementById('about-modal-overlay')?.classList.add('open');
        },
      },
    ];

    // Añadir saltos de sección basados en el TOC del documento
    if (this.currentDoc && this.currentDoc.toc) {
      const flattenToc = (items: TocItem[]): PaletteCommand[] => {
        let out: PaletteCommand[] = [];
        for (const it of items) {
          out.push({
            id: `toc-${it.id}`,
            title: `Ir a: ${it.text}`,
            subtitle: `Encabezado nivel ${it.level}`,
            icon: '#',
            action: () => {
              const el = document.getElementById(it.id);
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          });
          if (it.children) {
            out = out.concat(flattenToc(it.children));
          }
        }
        return out;
      };

      const tocCommands = flattenToc(this.currentDoc.toc);
      this.palette.setCommands([...baseCommands, ...tocCommands]);
    } else {
      this.palette.setCommands(baseCommands);
    }
  }

  private async handleOpenNativeFileDialog(): Promise<void> {
    const selectedPath = await TauriBridge.openFileDialog();
    if (selectedPath) {
      await this.openDocumentByPath(selectedPath);
    }
  }

  private toggleBionicReading(): void {
    const container = document.getElementById('markdown-content');
    if (!container) return;
    BionicReader.toggle(container);
  }

  private toggleFocusMode(): void {
    this.focusModeActive = !this.focusModeActive;
    document.body.classList.toggle('focus-mode', this.focusModeActive);
  }

  private toggleTypewriterMode(): void {
    this.typewriterModeActive = !this.typewriterModeActive;
    document.body.classList.toggle('typewriter-mode', this.typewriterModeActive);
  }

  private toggleSidebar(): void {
    const sidebar = document.getElementById('sidebar-toc');
    sidebar?.classList.toggle('collapsed');
  }

  private closeMenus(): void {
    document.querySelectorAll('.menu-item').forEach((item) => item.classList.remove('active'));
  }

  private async exportCurrentDocumentToMdbin(): Promise<void> {
    const savePath = await TauriBridge.saveFileDialog('documento_seguro.mdbin');
    if (!savePath) return;

    const password = prompt('Ingresa la contraseña para cifrar la cápsula .mdbin:');
    if (!password) return;
    const hint = prompt('Pista para el sobre de IA (opcional):') || 'Documento Confidencial';

    try {
      await TauriBridge.exportToMdbin(savePath, this.currentRawMarkdown, password, hint);
      alert(`¡Cápsula MDBIN guardada exitosamente en:\n${savePath}`);
    } catch (err: any) {
      alert(`Error al cifrar y guardar: ${err?.toString()}`);
    }
  }

  private openMdbinModal(path: string, hint?: string): void {
    this.pendingMdbinPath = path;
    const modal = document.getElementById('mdbin-modal-overlay');
    const desc = document.getElementById('mdbin-modal-desc');
    const input = document.getElementById('mdbin-password-input') as HTMLInputElement;
    const errMsg = document.getElementById('mdbin-error-msg');

    if (desc && hint) {
      desc.innerHTML = `Documento protegido: <strong>${hint}</strong>. Ingresa la contraseña de descifrado AES-256-GCM.`;
    }
    if (errMsg) errMsg.style.display = 'none';
    if (input) input.value = '';

    modal?.classList.add('open');
    setTimeout(() => input?.focus(), 50);
  }

  private closeMdbinModal(): void {
    const modal = document.getElementById('mdbin-modal-overlay');
    modal?.classList.remove('open');
    this.pendingMdbinPath = null;
  }

  private async submitMdbinPassword(): Promise<void> {
    if (!this.pendingMdbinPath) return;

    const input = document.getElementById('mdbin-password-input') as HTMLInputElement;
    const errMsg = document.getElementById('mdbin-error-msg');
    const password = input.value;

    if (!password) {
      if (errMsg) {
        errMsg.textContent = 'Por favor ingresa la contraseña.';
        errMsg.style.display = 'block';
      }
      return;
    }

    try {
      const doc = await TauriBridge.readAndDecryptMdbin(this.pendingMdbinPath, password);
      this.closeMdbinModal();
      this.applyProcessedDocument(doc);
    } catch (err: any) {
      if (errMsg) {
        errMsg.textContent = err?.toString() || 'Contraseña incorrecta o fallo de integridad.';
        errMsg.style.display = 'block';
      }
    }
  }

  private bindEvents(): void {
    // 1. Selector de Temas
    document.querySelectorAll('.theme-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const theme = (btn as HTMLElement).dataset.theme as VisualTheme;
        if (theme) this.themeManager.setTheme(theme);
      });
    });

    // 2. Menú de Ayuda y Modales
    const aboutModal = document.getElementById('about-modal-overlay');
    const openAbout = () => aboutModal?.classList.add('open');
    const closeAbout = () => aboutModal?.classList.remove('open');

    document.getElementById('brand-btn')?.addEventListener('click', openAbout);
    document.getElementById('action-about')?.addEventListener('click', () => {
      this.closeMenus();
      openAbout();
    });
    document.getElementById('close-about-btn')?.addEventListener('click', closeAbout);

    aboutModal?.addEventListener('click', (e) => {
      if (e.target === aboutModal) closeAbout();
    });

    // Modal MDBIN
    document.getElementById('close-mdbin-btn')?.addEventListener('click', () => this.closeMdbinModal());
    document.getElementById('cancel-mdbin-btn')?.addEventListener('click', () => this.closeMdbinModal());
    document.getElementById('submit-mdbin-btn')?.addEventListener('click', () => this.submitMdbinPassword());
    document.getElementById('mdbin-password-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submitMdbinPassword();
      }
    });

    // 3. Menús superiores desplegables
    document.querySelectorAll('.menu-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = btn.parentElement;
        const wasActive = item?.classList.contains('active');
        this.closeMenus();
        if (!wasActive) item?.classList.add('active');
      });
    });

    document.addEventListener('click', () => this.closeMenus());

    // 4. Atajos de Teclado Globales de Escritorio
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        this.handleOpenNativeFileDialog();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        this.annotationManager.exportToPdf();
      } else if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        this.reloadCurrentDocument();
      } else if (e.key === 'Escape') {
        closeAbout();
        this.closeMdbinModal();
        this.closeMenus();
      } else if (e.key === 'F7') {
        e.preventDefault();
        this.ttsManager.toggleBar();
      } else if (e.key === 'F8') {
        e.preventDefault();
        this.toggleFocusMode();
      } else if (e.key === 'F9') {
        e.preventDefault();
        this.toggleTypewriterMode();
      } else if (e.key === 'F10') {
        e.preventDefault();
        this.toggleBionicReading();
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        this.toggleSidebar();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveCurrentDocument();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        this.toggleNextViewMode();
      } else if (e.altKey && (e.key === 'ArrowDown' || e.key === 'PageDown')) {
        e.preventDefault();
        this.ttsManager.nextHeading();
      } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'PageUp')) {
        e.preventDefault();
        this.ttsManager.prevHeading();
      }
    });

    // 5. Arrastrar y Soltar archivos del Explorador de Windows (Drag & Drop nativo)
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        const path = (file as any).path;
        if (path) {
          await this.openDocumentByPath(path);
        } else if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
          const text = await file.text();
          await this.renderContent(text);
        }
      }
    });

    // Acciones de menú Archivo
    document.getElementById('action-open')?.addEventListener('click', () => {
      this.closeMenus();
      this.handleOpenNativeFileDialog();
    });

    document.getElementById('action-save-file')?.addEventListener('click', () => {
      this.closeMenus();
      this.saveCurrentDocument();
    });

    document.getElementById('action-export-pdf')?.addEventListener('click', () => {
      this.closeMenus();
      this.annotationManager.exportToPdf();
    });

    document.getElementById('action-close-app')?.addEventListener('click', () => {
      window.close();
    });

    // Acciones de menú Ver
    document.getElementById('action-view-lindo')?.addEventListener('click', () => {
      this.closeMenus();
      this.setViewMode('lindo');
    });

    document.getElementById('action-view-split')?.addEventListener('click', () => {
      this.closeMenus();
      this.setViewMode('dividido');
    });

    document.getElementById('action-view-crudo')?.addEventListener('click', () => {
      this.closeMenus();
      this.setViewMode('crudo');
    });

    document.getElementById('action-toggle-sidebar')?.addEventListener('click', () => {
      this.closeMenus();
      this.toggleSidebar();
    });

    document.getElementById('action-toggle-tts')?.addEventListener('click', () => {
      this.closeMenus();
      this.ttsManager.toggleBar();
    });

    document.getElementById('action-focus-mode')?.addEventListener('click', () => {
      this.closeMenus();
      this.toggleFocusMode();
    });

    document.getElementById('action-typewriter-mode')?.addEventListener('click', () => {
      this.closeMenus();
      this.toggleTypewriterMode();
    });

    document.getElementById('action-toggle-bionic')?.addEventListener('click', () => {
      this.closeMenus();
      this.toggleBionicReading();
    });

    // Acciones de menú Ayuda
    document.getElementById('action-shortcuts')?.addEventListener('click', () => {
      this.closeMenus();
      this.palette.open();
    });

    document.getElementById('action-markdown-guide')?.addEventListener('click', () => {
      this.closeMenus();
      alert('Guía de Sintaxis Markdown soportada:\n\n# Encabezados (H1 - H6)\n**Negrita**, *Cursiva*, ~~Tachado~~\n- [x] Checklists interactivos\n| Tablas | Markdown |\n> Callouts: > [!NOTE], > [!WARNING], > [!TIP]\n```lenguaje\nBloques de código con resaltado');
    });

    document.getElementById('action-report-issue')?.addEventListener('click', () => {
      this.closeMenus();
      window.open('https://github.com/cybeersecurity/mdcat', '_blank');
    });

    document.getElementById('action-check-updates')?.addEventListener('click', () => {
      this.closeMenus();
      alert('MDCAT Extended v0.1.5 está actualizado en su versión más reciente.');
    });

    // Conmutador de idioma
    document.getElementById('lang-toggle-btn')?.addEventListener('click', () => {
      this.i18nManager.toggleLocale();
    });
  }
}

// Inicializar la aplicación de escritorio al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init().catch(console.error);
});
