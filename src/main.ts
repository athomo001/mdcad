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
import { TabStrip, TabMenuItem } from './tabs';

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

/** Estado serializable de una pestaña; viaja tal cual entre ventanas al separarlas o unirlas. */
export interface TabSnapshot {
  path: string | null;
  title: string;
  raw: string;
  dirty: boolean;
  scrollTop: number;
  /** Cápsula .mdbin descifrada en memoria: nunca se guarda ni se recarga sobre su ruta. */
  encrypted: boolean;
  doc: ProcessedDocument | null;
}

interface DocTab extends TabSnapshot {
  id: string;
  mtime: number | null;
  /** Documento de bienvenida intacto: se reemplaza al abrir el primer archivo. */
  welcome: boolean;
}

export interface WindowSummary {
  label: string;
  title: string;
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
   * Abre el diálogo nativo de Windows (OpenFileDialog) vía Rust; permite elegir varios archivos.
   */
  static async openFileDialog(): Promise<string[]> {
    if (this.isTauriAvailable()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string[]>('open_file_dialog');
    }
    return [];
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
   * Obtiene los archivos pasados como argumento en la consola o al abrir desde el Explorador.
   * Solo la ventana principal recibe rutas.
   */
  static async getCliPaths(): Promise<string[]> {
    if (this.isTauriAvailable()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string[]>('get_cli_paths');
    }
    return [];
  }

  // --- Ventanas y pestañas --------------------------------------------------

  static async getWindowLabel(): Promise<string> {
    if (!this.isTauriAvailable()) return 'main';
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    return getCurrentWebviewWindow().label;
  }

  /** Pestañas con las que debe arrancar una ventana creada al separar una pestaña. */
  static async takePendingTabs(): Promise<TabSnapshot[]> {
    if (!this.isTauriAvailable()) return [];
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<TabSnapshot[]>('take_pending_tabs');
  }

  static async listOtherWindows(): Promise<WindowSummary[]> {
    if (!this.isTauriAvailable()) return [];
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<WindowSummary[]>('list_other_windows');
  }

  static async moveTabsToWindow(target: string, tabs: TabSnapshot[]): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('move_tabs_to_window', { target, tabs });
  }

  /**
   * Entrega la pestaña a la ventana bajo el cursor o a una ventana nueva.
   * Devuelve la etiqueta destino, o null si la pestaña se queda aquí.
   */
  static async dropTabAtCursor(tab: TabSnapshot, allowNewWindow: boolean, onlyNewWindow = false): Promise<string | null> {
    if (!this.isTauriAvailable()) return null;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string | null>('drop_tab_at_cursor', { tab, allowNewWindow, onlyNewWindow });
  }

  static async gatherWindowsInto(): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('gather_windows_into');
  }

  static async setWindowTitle(title: string): Promise<void> {
    document.title = title;
    if (this.isTauriAvailable()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_window_title', { title });
    }
  }

  static async closeCurrentWindow(): Promise<void> {
    if (this.isTauriAvailable()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('close_current_window');
    }
  }

  /** Escucha un evento dirigido a esta ventana (emitido desde Rust con `emit_to`). */
  static async onWindowEvent<T>(event: string, handler: (payload: T) => void): Promise<void> {
    if (!this.isTauriAvailable()) return;
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    await getCurrentWebviewWindow().listen<T>(event, (e) => handler(e.payload));
  }

  /** Archivos soltados desde el Explorador de Windows sobre la ventana. */
  static async onFileDrop(handler: (paths: string[]) => void): Promise<void> {
    if (!this.isTauriAvailable()) return;
    const { getCurrentWebview } = await import('@tauri-apps/api/webview');
    await getCurrentWebview().onDragDropEvent((e) => {
      if (e.payload.type === 'drop') handler(e.payload.paths);
    });
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

/** Documento de bienvenida que se muestra cuando no hay archivos abiertos. */
const WELCOME_MARKDOWN = `# MDCAT Extended
Lector y visor de Markdown ultraliviano de nueva generación para Windows.

> [!NOTE]
> Parseo nativo zero-copy en Rust a más de 100.000 líneas en milisegundos, 4 temas de color de alto contraste, lectura con síntesis de voz neuronal y vigilancia automática de archivos en tiempo real.

## Primeros Pasos
- Abre cualquier archivo Markdown presionando **Ctrl + O** o arrástralo directamente a esta ventana. Cada archivo se abre en su propia pestaña.
- Arrastra una pestaña fuera de la ventana para separarla, o suéltala sobre otra ventana de MDCAT para unirlas.
- Si editas tu archivo en cualquier editor externo (como Notepad o VS Code) y lo guardas, **MDCAT se actualiza automáticamente al instante**.
- Presiona **F5** en cualquier momento para recargar el archivo abierto desde el disco sin perder tu posición de lectura.
- Presiona **Ctrl + K** para desplegar la paleta de comandos rápida.
- Presiona **F7** para abrir la barra de lectura en voz alta (Text-to-Speech) con voces neuronales de alta fidelidad.

## Atajos de Teclado
| Atajo | Función |
| :--- | :--- |
| **Ctrl + O** | Abrir documento Markdown o cápsula .mdbin |
| **Ctrl + W** | Cerrar la pestaña actual |
| **Ctrl + Tab** / **Ctrl + Shift + Tab** | Pestaña siguiente / anterior |
| **F5** / **Ctrl + R** | Recargar documento actual desde el disco |
| **F7** | Activar / Ocultar barra de voz (TTS) |
| **F8** | Alternar Modo Enfoque (atenuar párrafos secundarios) |
| **F9** | Alternar Modo Máquina de Escribir (centrado al 50vh) |
| **F10** | Alternar Lectura Biónica (fijación sacádica) |
| **Ctrl + P** | Exportar a PDF limpio e imprimir |
| **Ctrl + K** | Paleta de comandos interactiva |
`;

/** Nombre de archivo de una ruta de Windows o POSIX. */
function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() || path;
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

  // Pestañas de documentos: la vista muestra siempre la activa y las demás guardan su estado
  private tabs: DocTab[] = [];
  private activeTabId: string | null = null;
  private nextTabId = 1;
  private tabStrip: TabStrip | null = null;
  private windowLabel = 'main';

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
    this.bindTabStrip();
    this.initSplash();

    this.windowLabel = await TauriBridge.getWindowLabel();
    await this.bindWindowEvents();

    // 0. Ventana creada al separar una pestaña: arranca con las pestañas que le entregaron
    const pendingTabs = await TauriBridge.takePendingTabs();
    if (pendingTabs.length > 0) {
      pendingTabs.forEach((tab) => this.addTab(tab));
      return;
    }

    // 1. Archivos pasados por CLI o con doble clic en Windows (uno o varios)
    const cliPaths = await TauriBridge.getCliPaths();
    if (cliPaths.length > 0) {
      await this.openPaths(cliPaths);
      if (this.tabs.length > 0) return;
    }

    // 2. Restaurar las pestañas de la última sesión de la ventana principal
    if (this.windowLabel === 'main') {
      const session = this.loadSession();
      await this.openPaths(session.paths, true);
      const activeTab = this.tabs.find((t) => t.path === session.active);
      if (activeTab) await this.activateTab(activeTab.id);
      if (this.tabs.length > 0) return;
    }

    // 3. Documento inicial sobrio y profesional
    this.openWelcomeTab();
  }

  private openWelcomeTab(): void {
    const isEn = this.i18nManager.getLocale() === 'en';
    this.addTab(
      { path: null, title: isEn ? 'Welcome' : 'Bienvenida', raw: WELCOME_MARKDOWN, dirty: false, scrollTop: 0, encrypted: false, doc: null },
      { welcome: true }
    );
  }

  private initSplash(): void {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;

    // Desvanecimiento suave en menos de 900ms
    setTimeout(() => {
      splash.classList.add('fade-out');
    }, 850);
  }

  // ---------------------------------------------------------------------------
  // Pestañas de documentos
  // ---------------------------------------------------------------------------

  private bindTabStrip(): void {
    const root = document.getElementById('tab-strip');
    if (!root) return;
    this.tabStrip = new TabStrip(root, {
      activate: (id) => void this.activateTab(id),
      close: (id) => this.closeTab(id),
      reorder: (id, toIndex) => this.reorderTab(id, toIndex),
      dropOutsideWindow: (id) => void this.dropTabOutsideWindow(id),
      menuItems: (id) => this.tabMenuItems(id),
      newTab: () => void this.handleOpenNativeFileDialog(),
    });
  }

  /** Eventos que Rust envía a esta ventana: archivos abiertos desde fuera y pestañas movidas. */
  private async bindWindowEvents(): Promise<void> {
    await TauriBridge.onWindowEvent<string[]>('mdcat://open-paths', (paths) => void this.openPaths(paths));
    await TauriBridge.onWindowEvent<TabSnapshot[]>('mdcat://tab-incoming', (tabs) => {
      tabs.forEach((tab) => this.addTab(tab));
    });
    await TauriBridge.onWindowEvent<string>('mdcat://gather', (target) => void this.sendAllTabsTo(target));
    await TauriBridge.onFileDrop((paths) => {
      const docs = paths.filter((p) => /\.(md|markdown|mdbin)$/i.test(p));
      void this.openPaths(docs);
    });
  }

  private getActiveTab(): DocTab | null {
    return this.tabs.find((t) => t.id === this.activeTabId) ?? null;
  }

  /** Agrega una pestaña y la activa. La bienvenida intacta se reemplaza en lugar de acumularse. */
  private addTab(snapshot: TabSnapshot, options: { welcome?: boolean; mtime?: number | null } = {}): void {
    const tab: DocTab = { ...snapshot, id: `tab-${this.nextTabId++}`, mtime: options.mtime ?? null, welcome: options.welcome ?? false };
    const active = this.getActiveTab();
    if (active?.welcome && !this.isDirty) {
      this.tabs.splice(this.tabs.indexOf(active), 1, tab);
      this.activeTabId = null;
    } else {
      this.tabs.push(tab);
    }
    void this.activateTab(tab.id);
  }

  private async activateTab(id: string): Promise<void> {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab || this.activeTabId === id) return;

    this.captureActiveTab();
    this.activeTabId = id;
    this.renderTabs();
    await this.loadTabIntoView(tab);
    this.persistSession();
  }

  /** Guarda en la pestaña activa lo que hoy vive en la vista (edición, scroll, documento). */
  private captureActiveTab(): void {
    const tab = this.getActiveTab();
    if (!tab) return;
    if (this.editorDebounceTimer) {
      clearTimeout(this.editorDebounceTimer);
      this.editorDebounceTimer = null;
    }
    tab.raw = this.currentRawMarkdown;
    tab.dirty = this.isDirty;
    tab.doc = this.currentDoc;
    tab.mtime = this.lastFileMtime;
    tab.scrollTop = this.readerViewport?.scrollTop ?? 0;
    if (tab.dirty) tab.welcome = false;
  }

  private async loadTabIntoView(tab: DocTab): Promise<void> {
    this.stopFileWatcher();
    const container = document.getElementById('markdown-content');
    const bionicWasActive = BionicReader.isActive();
    if (container) BionicReader.disable(container);

    // Las cápsulas .mdbin no tienen ruta editable: guardar pide "Guardar como" para no pisar el cifrado
    this.currentFilePath = tab.encrypted ? null : tab.path;
    this.currentRawMarkdown = tab.raw;
    this.lastFileMtime = tab.mtime;

    if (!tab.doc) {
      tab.doc = await TauriBridge.parseMarkdown(tab.raw);
      if (tab.id !== this.activeTabId) return;
    }
    this.applyProcessedDocument(tab.doc);
    if (container && bionicWasActive) BionicReader.enable(container);

    if (this.rawEditorTextarea) {
      this.rawEditorTextarea.value = tab.raw;
    }
    this.setDirty(tab.dirty);
    this.updateEditorCounter();

    const scrollTop = tab.scrollTop;
    requestAnimationFrame(() => {
      if (this.readerViewport) this.readerViewport.scrollTop = scrollTop;
    });

    if (this.currentFilePath) {
      this.startFileWatcher(this.currentFilePath);
    }
    void TauriBridge.setWindowTitle(`${tab.title} — MDCAT Extended`);
  }

  private renderTabs(): void {
    this.tabStrip?.render(
      this.tabs.map((t) => ({
        id: t.id,
        title: t.title,
        tooltip: t.path ?? t.title,
        dirty: t.id === this.activeTabId ? this.isDirty : t.dirty,
      })),
      this.activeTabId
    );
  }

  private closeTab(id: string): boolean {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return false;

    const dirty = id === this.activeTabId ? this.isDirty : tab.dirty;
    if (dirty) {
      const isEn = this.i18nManager.getLocale() === 'en';
      const question = isEn
        ? `"${tab.title}" has unsaved changes. Close it anyway?`
        : `"${tab.title}" tiene cambios sin guardar. ¿Cerrarla de todas formas?`;
      if (!confirm(question)) return false;
    }

    this.removeTab(id);
    if (this.tabs.length === 0) this.openWelcomeTab();
    return true;
  }

  private closeOtherTabs(keepId: string): void {
    for (const tab of this.tabs.filter((t) => t.id !== keepId)) {
      this.closeTab(tab.id);
    }
  }

  /** Quita la pestaña sin preguntar; si era la activa, activa la vecina. */
  private removeTab(id: string): void {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    this.tabs.splice(idx, 1);

    if (id === this.activeTabId) {
      this.activeTabId = null;
      this.stopFileWatcher();
      const next = this.tabs[Math.min(idx, this.tabs.length - 1)];
      if (next) void this.activateTab(next.id);
    }
    this.renderTabs();
    this.persistSession();
  }

  private reorderTab(id: string, toIndex: number): void {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const [tab] = this.tabs.splice(idx, 1);
    this.tabs.splice(Math.min(toIndex, this.tabs.length), 0, tab);
    this.renderTabs();
    this.persistSession();
  }

  private cycleTab(step: number): void {
    if (this.tabs.length < 2) return;
    const idx = this.tabs.findIndex((t) => t.id === this.activeTabId);
    const next = this.tabs[(idx + step + this.tabs.length) % this.tabs.length];
    void this.activateTab(next.id);
  }

  private snapshotTab(id: string): TabSnapshot | null {
    if (id === this.activeTabId) this.captureActiveTab();
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return null;
    const { path, title, raw, dirty, scrollTop, encrypted, doc } = tab;
    return { path, title, raw, dirty, scrollTop, encrypted, doc };
  }

  /** La pestaña ya vive en otra ventana: se quita de aquí y, si no queda ninguna, se cierra la ventana. */
  private detachLocalTab(id: string): void {
    this.removeTab(id);
    if (this.tabs.length === 0) {
      void TauriBridge.closeCurrentWindow();
    }
  }

  /** Pestaña soltada fuera de la ventana: se une a la ventana bajo el cursor o abre una nueva. */
  private async dropTabOutsideWindow(id: string): Promise<void> {
    const snapshot = this.snapshotTab(id);
    if (!snapshot) return;
    try {
      // Con una sola pestaña no tiene sentido crear otra ventana: solo se permite unirla a otra
      const target = await TauriBridge.dropTabAtCursor(snapshot, this.tabs.length > 1);
      if (target) this.detachLocalTab(id);
    } catch (err) {
      console.error('No se pudo mover la pestaña:', err);
    }
  }

  private async moveTabToNewWindow(id: string): Promise<void> {
    const snapshot = this.snapshotTab(id);
    if (!snapshot) return;
    try {
      const target = await TauriBridge.dropTabAtCursor(snapshot, true, true);
      if (target) this.detachLocalTab(id);
    } catch (err) {
      console.error('No se pudo crear la ventana:', err);
    }
  }

  private async moveTabToWindow(id: string, target: string): Promise<void> {
    const snapshot = this.snapshotTab(id);
    if (!snapshot) return;
    try {
      await TauriBridge.moveTabsToWindow(target, [snapshot]);
      this.detachLocalTab(id);
    } catch (err) {
      console.error('No se pudo mover la pestaña:', err);
    }
  }

  /** Otra ventana pidió unir todo en ella: se le entregan las pestañas y esta ventana se cierra. */
  private async sendAllTabsTo(target: string): Promise<void> {
    this.captureActiveTab();
    const snapshots = this.tabs
      .filter((t) => !t.welcome)
      .map((t) => this.snapshotTab(t.id))
      .filter((s): s is TabSnapshot => s !== null);
    try {
      if (snapshots.length > 0) await TauriBridge.moveTabsToWindow(target, snapshots);
      this.tabs = [];
      this.activeTabId = null;
      await TauriBridge.closeCurrentWindow();
    } catch (err) {
      console.error('No se pudieron unir las ventanas:', err);
    }
  }

  private async tabMenuItems(id: string): Promise<TabMenuItem[]> {
    const isEn = this.i18nManager.getLocale() === 'en';
    const others = await TauriBridge.listOtherWindows();
    const single = this.tabs.length < 2;

    return [
      { label: isEn ? 'Close tab' : 'Cerrar pestaña', action: () => this.closeTab(id) },
      { label: isEn ? 'Close other tabs' : 'Cerrar las demás pestañas', action: () => this.closeOtherTabs(id), disabled: single },
      'separator',
      { label: isEn ? 'Move to new window' : 'Mover a una ventana nueva', action: () => void this.moveTabToNewWindow(id), disabled: single || !TauriBridge.isTauriAvailable() },
      ...others.map((w) => ({
        label: `${isEn ? 'Move to' : 'Mover a'}: ${w.title}`,
        action: () => void this.moveTabToWindow(id, w.label),
      })),
      'separator',
      { label: isEn ? 'Merge all windows here' : 'Unir todas las ventanas aquí', action: () => void TauriBridge.gatherWindowsInto(), disabled: others.length === 0 },
    ];
  }

  /** Abre varias rutas, cada una en su pestaña. Con `silent` no avisa de archivos que ya no existen. */
  private async openPaths(paths: string[], silent = false): Promise<void> {
    for (const path of paths) {
      try {
        await this.openDocumentByPath(path);
      } catch (err) {
        if (!silent) {
          const isEn = this.i18nManager.getLocale() === 'en';
          this.showToast(`${isEn ? '❌ Could not open' : '❌ No se pudo abrir'}: ${fileNameOf(path)}`);
        }
      }
    }
  }

  /** Solo la ventana principal recuerda sus pestañas para la próxima vez. */
  private persistSession(): void {
    if (this.windowLabel !== 'main') return;
    const paths = this.tabs.filter((t) => t.path && !t.encrypted).map((t) => t.path as string);
    const active = this.getActiveTab();
    try {
      localStorage.setItem('mdcat_open_tabs', JSON.stringify({ paths, active: active?.path ?? null }));
    } catch {}
  }

  private loadSession(): { paths: string[]; active: string | null } {
    try {
      const saved = JSON.parse(localStorage.getItem('mdcat_open_tabs') || 'null');
      if (saved && Array.isArray(saved.paths)) return saved;
    } catch {}
    // Versiones anteriores solo recordaban un archivo
    const legacy = localStorage.getItem('mdcat_last_opened_file');
    return { paths: legacy ? [legacy] : [], active: legacy };
  }

  /** Abre un archivo en su propia pestaña; si ya está abierto, solo lo activa. */
  private async openDocumentByPath(path: string): Promise<void> {
    const existing = this.tabs.find((t) => t.path !== null && t.path.toLowerCase() === path.toLowerCase());
    if (existing) {
      await this.activateTab(existing.id);
      return;
    }

    if (path.endsWith('.mdbin')) {
      try {
        const env = await TauriBridge.inspectMdbin(path);
        this.openMdbinModal(path, env.document_hint);
      } catch {
        this.openMdbinModal(path);
      }
      return;
    }

    try {
      const doc = await TauriBridge.readFile(path);

      let raw = '';
      try {
        raw = await TauriBridge.readFileContent(path);
      } catch (e) {
        console.warn('No se pudo leer texto plano directo:', e);
      }

      const mtime = await TauriBridge.getFileMtime(path);
      this.addTab({ path, title: fileNameOf(path), raw, dirty: false, scrollTop: 0, encrypted: false, doc }, { mtime });
    } catch (err) {
      console.error('Error al abrir archivo por ruta:', err);
      throw err;
    }
  }

  /**
   * Recarga el documento actual desde el disco preservando la posición exacta de lectura
   */
  async reloadCurrentDocument(silent = false): Promise<void> {
    if (this.currentFilePath) {
      try {
        const scrollPos = this.readerViewport?.scrollTop ?? 0;
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

        if (this.readerViewport) this.readerViewport.scrollTop = scrollPos;
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
    // Si la pestaña ya conocía su fecha, se conserva: así se detectan cambios hechos mientras estaba en segundo plano
    if (this.lastFileMtime === null) {
      TauriBridge.getFileMtime(path).then((mtime) => {
        if (this.currentFilePath === path && this.lastFileMtime === null) this.lastFileMtime = mtime;
      });
    }

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
    const changed = this.isDirty !== dirty;
    this.isDirty = dirty;
    if (changed) this.renderTabs();
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
          const baseName = fileNameOf(targetPath);

          // La pestaña pasa a representar el archivo recién guardado
          const tab = this.getActiveTab();
          if (tab) {
            Object.assign(tab, { path: targetPath, title: baseName, encrypted: false, welcome: false });
            this.renderTabs();
            this.persistSession();
            void TauriBridge.setWindowTitle(`${baseName} — MDCAT Extended`);
          }
          this.startFileWatcher(targetPath);
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

    if (!tocItems || tocItems.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'toc-empty-msg';
      emptyLi.textContent = this.i18nManager.getLocale() === 'en' ? 'No headings found' : 'Sin encabezados';
      tocList.appendChild(emptyLi);
      return;
    }

    const appendItems = (items: TocItem[], parent: HTMLElement) => {
      for (const item of items) {
        const hasChildren = Boolean(item.children && item.children.length > 0);

        // 1. Nodo de lista que contiene la fila del título y su posible subárbol
        const li = document.createElement('li');
        li.className = `toc-node level-${item.level}`;

        // 2. Fila visual interactiva aislada (evita bugs de flexbox y saltos de altura vertical)
        const row = document.createElement('div');
        row.className = `toc-item-row level-${item.level}`;
        row.dataset.targetId = item.id;

        // 3. Botón de alternar subsecciones o espaciador para alinear texto
        if (hasChildren) {
          const toggleBtn = document.createElement('button');
          toggleBtn.className = 'toc-toggle-btn expanded';
          toggleBtn.title = 'Alternar subsecciones';
          toggleBtn.setAttribute('aria-label', `Alternar subsecciones de ${item.text}`);
          toggleBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
          toggleBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            const sublistEl = li.querySelector<HTMLElement>(':scope > .toc-sublist');
            if (sublistEl) {
              const isCollapsed = sublistEl.classList.toggle('collapsed');
              toggleBtn.classList.toggle('expanded', !isCollapsed);
              toggleBtn.classList.toggle('collapsed', isCollapsed);
            }
          };
          row.appendChild(toggleBtn);
        } else {
          const spacer = document.createElement('span');
          spacer.className = 'toc-toggle-spacer';
          row.appendChild(spacer);
        }

        // 4. Enlace con el texto del título y anclaje suave
        const a = document.createElement('a');
        a.href = `#${item.id}`;
        a.className = 'toc-link';
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
          if (this.ttsManager.isSpeaking() || this.ttsManager.isBarVisible()) {
            this.ttsManager.playHeadingById(item.id);
          }
        };
        row.appendChild(a);

        // 5. Botón de síntesis de voz (TTS) al extremo derecho
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
        row.appendChild(ttsBtn);

        li.appendChild(row);

        // 6. Si tiene hijos, se incrustan en su propia lista como bloque independiente
        if (hasChildren && item.children) {
          const subList = document.createElement('ul');
          subList.className = 'toc-sublist';
          appendItems(item.children, subList);
          li.appendChild(subList);
        }

        parent.appendChild(li);
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
            document.querySelectorAll<HTMLElement>('.toc-item-row').forEach((row) => {
              const isActive = row.dataset.targetId === id;
              row.classList.toggle('active', isActive);
              const link = row.querySelector<HTMLElement>('.toc-link');
              if (link) {
                link.classList.toggle('active', isActive);
              }
              if (isActive) {
                row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
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
    const selectedPaths = await TauriBridge.openFileDialog();
    await this.openPaths(selectedPaths);
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
    // Las cápsulas abiertas solo traen el HTML renderizado, no el Markdown: no hay nada que volver a cifrar
    if (!this.currentRawMarkdown.trim()) {
      const isEn = this.i18nManager.getLocale() === 'en';
      this.showToast(isEn ? 'This tab has no Markdown text to encrypt' : 'Esta pestaña no tiene texto Markdown para cifrar');
      return;
    }

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
      const path = this.pendingMdbinPath;
      const doc = await TauriBridge.readAndDecryptMdbin(path, password);
      this.closeMdbinModal();
      this.addTab({ path, title: fileNameOf(path), raw: '', dirty: false, scrollTop: 0, encrypted: true, doc });
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (this.activeTabId) this.closeTab(this.activeTabId);
      } else if (e.ctrlKey && (e.key === 'Tab' || e.key === 'PageDown' || e.key === 'PageUp')) {
        e.preventDefault();
        this.cycleTab(e.key === 'PageUp' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
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

    // 5. Arrastrar y Soltar archivos. En escritorio Tauri entrega las rutas (ver bindWindowEvents);
    // este manejador cubre el modo navegador, donde solo hay acceso al contenido.
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      for (const file of Array.from(e.dataTransfer?.files ?? [])) {
        if (/\.(md|markdown)$/i.test(file.name)) {
          const raw = await file.text();
          this.addTab({ path: null, title: file.name, raw, dirty: false, scrollTop: 0, encrypted: false, doc: null });
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

    document.getElementById('action-export-mdbin')?.addEventListener('click', () => {
      this.closeMenus();
      void this.exportCurrentDocumentToMdbin();
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
