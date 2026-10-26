/**
 * @file tts.ts
 * @description Motor de Síntesis de Voz (Text-to-Speech - TTS) de Alta Fidelidad para MDCAT Extended.
 * Conforme a spec/09-motor-texto-a-voz-tts.md e implementado con las capacidades probadas de simulador_v2.
 * - Sincronización visual con resaltado tipo Karaoke (.tts-highlight-active)
 * - Transfonetización técnica bilingüe completa (Cortex, failover, XDR, breadcrumbs, etc.)
 * - Soporte total de voces de Windows con carga asíncrona resiliente y workaround para pausas de Chromium.
 */

import { TauriBridge } from './main';
import { I18nManager } from './i18n';

export interface TtsBlock {
  id: string;
  element: HTMLElement;
  text: string;
  title: string;
}

export interface EdgeVoice {
  name: string;
  short_name: string;
  friendly_name: string;
  locale: string;
  gender: string;
}

/** Diccionario fonético técnico completo importado y expandido de simulador_v2 */
export const PHONETIC_MAP: [RegExp, string][] = [
  // 1. Siglas, marcas y plataformas de ciberseguridad
  [/\bCortex XSIAM\b/gi, 'Cortex Éxiam'],
  [/\bXSIAM\b/gi, 'Éxiam'],
  [/\bCortex XDR\b/gi, 'Cortex Ex-D-R'],
  [/\bXDR Pro\b/gi, 'Ex-D-R Pro'],
  [/\bXDR\b/gi, 'Ex-D-R'],
  [/\bXQL Helper\b/gi, 'Ex-Q-L Jélper'],
  [/\bXQL\b/gi, 'Ex-Q-L'],
  [/\bXDM\b/gi, 'Ex-D-M'],
  [/\bBIOCs?\b/gi, 'B-Ioc'],
  [/\bIOCs?\b/gi, 'I-O-C'],
  [/\bITDR\b/gi, 'I-T-D-R'],
  [/\bASM\b/gi, 'A-S-M'],
  [/\bTIM\b/gi, 'Tim'],
  [/\bCGO\b/gi, 'C-G-O'],
  [/\bEDR\b/gi, 'E-D-R'],
  [/\bSIEM\b/gi, 'Siem'],
  [/\bSOAR\b/gi, 'Soar'],
  [/\bSOC\b/gi, 'Soc'],
  [/\bMITRE ATT&CK\b/gi, 'Mitre Attack'],
  [/\bATT&CK\b/gi, 'Attack'],
  [/\bPearson VUE\b/gi, 'Píerson Viu'],
  [/\bWildFire\b/gi, 'Uáild-fair'],

  // 2. Infraestructura, redes y virtualización
  [/\bfailover\b/gi, 'féil-óver'],
  [/\bproxy\b/gi, 'próxi'],
  [/\bproxies\b/gi, 'próxis'],
  [/\bappliance\b/gi, 'apláians'],
  [/\bappliances\b/gi, 'apláianses'],
  [/\bbuild\b/gi, 'bild'],
  [/\bbuilds\b/gi, 'bilds'],
  [/\bsetup\b/gi, 'sét-ap'],
  [/\bhost\b/gi, 'jost'],
  [/\bhosts\b/gi, 'josts'],
  [/\bcluster\b/gi, 'cláster'],
  [/\bclusters\b/gi, 'clásters'],
  [/\bstorage\b/gi, 'stórich'],
  [/\bbackup\b/gi, 'bák-ap'],
  [/\bbackups\b/gi, 'bák-aps'],
  [/\brollback\b/gi, 'ról-bak'],
  [/\bgateway\b/gi, 'géitwei'],
  [/\bload balancer\b/gi, 'lóud bálanser'],
  [/\bFirewalls?\b/gi, 'Fáier-uol'],
  [/\bfirewalls?\b/gi, 'fáier-uol'],
  [/\bpipelines?\b/gi, 'páiplain'],
  [/\bmiddleware\b/gi, 'mídelwer'],
  [/\bendpoints?\b/gi, 'énd-point'],
  [/\bEndpoints?\b/gi, 'End-point'],
  [/\bdeploy\b/gi, 'diplói'],
  [/\brelease\b/gi, 'rilís'],
  [/\bbranch\b/gi, 'branch'],
  [/\bcommit\b/gi, 'cómit'],
  [/\bpull request\b/gi, 'pul rikuést'],
  [/\blogin\b/gi, 'lóguin'],
  [/\blogout\b/gi, 'lógaut'],

  // 3. Componentes centrales y arquitectura
  [/\bData stitching\b/g, 'Deita stíching'],
  [/\bdata stitching\b/g, 'deita stíching'],
  [/\bAlert grouping\b/g, 'Alért grúping'],
  [/\balert grouping\b/g, 'alért grúping'],
  [/\bLive Terminal\b/gi, 'Láiv Términal'],
  [/\bPlayground\b/gi, 'Pleigraund'],
  [/\bPlaybooks?\b/gi, 'Pleibuk'],
  [/\bsub-playbooks?\b/gi, 'sub-pleibuk'],
  [/\bDatasets?\b/gi, 'Deitaset'],
  [/\bThreat Hunting\b/gi, 'Zret Jánting'],
  [/\bThreat Response Center\b/gi, 'Zret Rispóns Sénter'],
  [/\bAttack Surface Threat Response Center\b/gi, 'Atack Sérfes Zret Rispóns Sénter'],
  [/\bAttack Surface Management\b/gi, 'Atack Sérfes Mánashment'],
  [/\bAttack Surface\b/gi, 'Atack Sérfes'],
  [/\bWar Room\b/gi, 'Guor Rum'],
  [/\bKey Assets?\b/gi, 'Ki Áset'],
  [/\bBroker VM\b/gi, 'Bróker V-M'],
  [/\bBlueprints?\b/gi, 'Blúprint'],

  // 4. Estados y operaciones forenses
  [/\bNew, Under Investigation y Resolved\b/gi, 'Niú, Ánder investiguéishon y Risólvd'],
  [/\bNew\b/g, 'Niú'],
  [/\bResolved\b/gi, 'Risólvd'],
  [/\bClosed\b/gi, 'Clousd'],
  [/\bPending\b/gi, 'Pénding'],
  [/\bEscalated\b/gi, 'Escaléited'],
  [/\bConnection Lost\b/gi, 'Conékshon lost'],
  [/\bConnected\b/gi, 'Conékted'],
  [/\bDisconnected\b/gi, 'Disconékted'],
  [/\bUninstalled\b/gi, 'An-instóld'],
  [/\bVDI Pending Login\b/gi, 'V-D-I pénding lógin'],
  [/\bOffline\b/gi, 'Óflain'],
  [/\bOnline\b/gi, 'Ónlain'],
  [/\bMalware\b/gi, 'Málwer'],
  [/\bFeatured fields?\b/gi, 'Fíchurd filds'],
  [/\bStarring\b/gi, 'Estárring'],
  [/\bstarring\b/gi, 'estárring'],
  [/\bScoring\b/gi, 'Escóring'],
  [/\bscoring\b/gi, 'escóring'],
  [/\bScheduled queries\b/gi, 'Esquediuld cuéris'],
  [/\bscheduled queries\b/gi, 'esquediuld cuéris'],
  [/\bScheduled query\b/gi, 'Esquediuld cuéri'],
  [/\bscheduled query\b/gi, 'esquediuld cuéri'],
  [/\bQuery Library\b/gi, 'Cuéri Láibrari'],
  [/\bCausality chain\b/gi, 'Causaliti chein'],
  [/\bCausality Group Owner\b/gi, 'Causaliti Grup Óuner'],
  [/\bTimeline\b/gi, 'Táimlain'],
  [/\bPhishing\b/gi, 'Físhing'],
  [/\bphishing\b/gi, 'físhing'],
  [/\bMalware scan\b/gi, 'Málwer escán'],
  [/\bmalware scan\b/gi, 'málwer escán'],
  [/\bFile retrieval\b/gi, 'Fáil ritríval'],
  [/\bfile retrieval\b/gi, 'fáil ritríval'],
  [/\bHot storage\b/gi, 'Jot stóradsh'],
  [/\bhot storage\b/gi, 'jot stóradsh'],
  [/\bCold storage\b/gi, 'Cold stóradsh'],
  [/\bcold storage\b/gi, 'cold stóradsh'],
  [/\bFeeds?\b/gi, 'Fid'],
  [/\bLeads?\b/gi, 'Lid'],
  [/\bTriage\b/gi, 'Triásh'],
  [/\btriage\b/gi, 'triásh'],
  [/\bBypass\b/gi, 'Báipas'],
  [/\bbypass\b/gi, 'báipas'],
  [/\bPayloads?\b/gi, 'Péiloud'],
  [/\bHashes?\b/gi, 'Jash'],
  [/\braw\b/gi, 'ro'],
  [/\bActive Directory\b/gi, 'Áctiv Directori'],
  [/\bPowerShell\b/gi, 'Páuer-shel'],
  [/\bLSASS\b/gi, 'Ele-sass'],
  [/\bMimikatz\b/gi, 'Mímicatz'],
  [/\bBrain dumps?\b/gi, 'Brein damp'],
  [/\bPractice exams?\b/gi, 'Práctis ecsam'],

  // 5. Ciberseguridad y explotación
  [/\bbuffer overflow\b/gi, 'báfer óverflou'],
  [/\bzero-day|0-day\b/gi, 'síro-déi'],
  [/\bbackdoor\b/gi, 'bákdor'],
  [/\bransomware\b/gi, 'ránsomwer'],
  [/\bsandbox\b/gi, 'sándbox'],
  [/\bhoneypot\b/gi, 'jónipot'],
  [/\bhandshake\b/gi, 'jándsheik'],

  // 6. Abreviaciones comunes
  [/\bvs\.?\b/gi, 'versus'],
  [/\bej:|\bej\./gi, 'por ejemplo, '],
  [/\bp\.?\s*ej\.?/gi, 'por ejemplo, '],
  [/\bUSD (\d+)/gi, '$1 dólares'],
  [/\b(\d+)%\b/g, '$1 por ciento'],
  [/\bN1\/N2\/N3\b/gi, 'Nivel 1, Nivel 2 o Nivel 3'],
  [/\bN1\/N2\b/gi, 'Nivel 1 o Nivel 2']
];

/** Normaliza secuencias de interfaz como /appliance > Updates -> Save */
export function normalizeUiBreadcrumbs(text: string): string {
  let normalized = text;
  normalized = normalized.replace(/(?:^|\s)\/([a-zA-Z0-9_-]+)/g, ' en el menú $1');
  normalized = normalized.replace(/\s*(?:>|->|→)\s*/g, ', luego ');
  normalized = normalized.replace(/, luego (Save|Guardar|Submit|Apply|Cancel)\b/gi, ', presionar $1');
  return normalized;
}

/** Prepara y limpia texto de Markdown para síntesis oral comprensible */
export function prepareTextForSpeech(rawText: string, title?: string): string {
  if (!rawText) return '';
  let text = (title && title !== 'Introducción' && !rawText.startsWith(title) ? title + '. ' : '') + rawText;

  // 1. URLs y rutas de archivos
  text = text.replace(/https?:\/\/[^\s)]+/gi, ' enlace a la documentación ');
  text = text.replace(/(\/|\.\.\/)[a-zA-Z0-9_\-\.\/]+\.(png|jpg|jpeg|webp|pdf|md)/gi, ' ');

  // 2. Normalización de breadcrumbs y rutas
  text = normalizeUiBreadcrumbs(text);

  // 3. Sintaxis de comandos de terminal, código y scripts
  text = text.replace(/^\s*[$#]\s+/gm, ''); // Quita prompts de consola $ o #
  text = text.replace(/&&/g, ' y luego ');
  text = text.replace(/2>&1/g, ' ');
  text = text.replace(/\r?\n/g, ', '); // Convierte saltos de línea de comandos en pausas fluidas

  // 4. Entidades HTML y caracteres de marcado
  text = text
    .replace(/&amp;/g, ' y ')
    .replace(/&lt;/g, ' menor que ')
    .replace(/&gt;/g, ' mayor que ')
    .replace(/&quot;|&#39;/g, ' ')
    .replace(/\|/g, ', ') // Evita leer barras verticales en tablas Markdown
    .replace(/!=/g, ' distinto de ')
    .replace(/==/g, ' igual a ')
    .replace(/>=/g, ' mayor o igual que ')
    .replace(/<=/g, ' menor o igual que ')
    .replace(/[*_#`~[\]{}()]/g, ' ')
    .replace(/\s+/g, ' ');

  // 5. Aplicar diccionario fonético
  for (const [re, rep] of PHONETIC_MAP) {
    text = text.replace(re, rep);
  }

  return text.trim();
}

export class TtsManager {
  readonly supported: boolean =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window;

  private speaking: boolean = false;
  private paused: boolean = false;
  private rate: number = 1.0;
  private edgeVoices: EdgeVoice[] = [];
  private selectedVoiceUri: string = '';
  private currentAudio: HTMLAudioElement | null = null;
  private i18nManager: I18nManager | null = null;

  private blocks: TtsBlock[] = [];
  private currentBlockIndex: number = 0;
  private headingBlockIndices: number[] = [];
  private playRequestId: number = 0;

  // Elementos del DOM de la barra TTS
  private barElement: HTMLElement | null = null;
  private playBtn: HTMLButtonElement | null = null;
  private stopBtn: HTMLButtonElement | null = null;
  private prevBtn: HTMLButtonElement | null = null;
  private nextBtn: HTMLButtonElement | null = null;
  private prevHeadingBtn: HTMLButtonElement | null = null;
  private nextHeadingBtn: HTMLButtonElement | null = null;
  private headingSelect: HTMLSelectElement | null = null;
  private rateSelect: HTMLSelectElement | null = null;
  private voiceSelect: HTMLSelectElement | null = null;
  private badgeElement: HTMLElement | null = null;
  private infoElement: HTMLElement | null = null;

  isSpeaking(): boolean {
    return this.speaking;
  }

  isPaused(): boolean {
    return this.paused;
  }

  isBarVisible(): boolean {
    return this.barElement?.classList.contains('visible') ?? false;
  }

  setI18nManager(i18n: I18nManager): void {
    this.i18nManager = i18n;
  }

  onLocaleChanged(): void {
    const isEn = this.i18nManager?.getLocale() === 'en';
    if (this.headingSelect && this.blocks.length > 0) {
      const jumpLabel = isEn ? '📑 Jump to section...' : '📑 Saltar a sección...';
      const firstOpt = this.headingSelect.querySelector('option[value=""]');
      if (firstOpt) {
        firstOpt.textContent = jumpLabel;
      }
    }
    this.updateUi();
  }

  async init(): Promise<void> {
    if (!this.supported) {
      console.warn('SpeechSynthesis no está soportado en este entorno.');
      return;
    }

    const savedRate = localStorage.getItem('mdcat_tts_rate');
    if (savedRate) {
      this.rate = parseFloat(savedRate) || 1.0;
    }

    const savedVoice = localStorage.getItem('mdcat_tts_voice');
    if (savedVoice) {
      this.selectedVoiceUri = savedVoice;
    }

    // 1. Cargar voces neuronales de Edge desde Rust
    await this.loadEdgeVoices();

    // 2. Inicializar voces locales de Windows
    this.populateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => this.populateVoices();
    }
    // Reintentos escalonados por si el sistema carga las voces tarde
    setTimeout(() => this.populateVoices(), 200);
    setTimeout(() => this.populateVoices(), 800);
  }

  async loadEdgeVoices(): Promise<void> {
    try {
      const voices = await TauriBridge.getEdgeVoices();
      if (voices && voices.length > 0) {
        this.edgeVoices = voices;
        this.populateVoices();
      }
    } catch (err) {
      console.warn('Aviso: no se pudo consultar el catálogo de voces Edge:', err);
    }
  }

  bindUi(barElement: HTMLElement): void {
    this.barElement = barElement;
    this.playBtn = barElement.querySelector('#tts-play-btn');
    this.stopBtn = barElement.querySelector('#tts-stop-btn');
    this.prevBtn = barElement.querySelector('#tts-prev-btn');
    this.nextBtn = barElement.querySelector('#tts-next-btn');
    this.prevHeadingBtn = barElement.querySelector('#tts-prev-heading-btn');
    this.nextHeadingBtn = barElement.querySelector('#tts-next-heading-btn');
    this.headingSelect = barElement.querySelector('#tts-heading-select');
    this.rateSelect = barElement.querySelector('#tts-rate-select');
    this.voiceSelect = barElement.querySelector('#tts-voice-select');
    this.badgeElement = barElement.querySelector('#tts-badge');
    this.infoElement = barElement.querySelector('#tts-info');

    if (this.rateSelect) {
      this.rateSelect.value = String(this.rate);
      this.rateSelect.addEventListener('change', (e) => {
        this.rate = parseFloat((e.target as HTMLSelectElement).value) || 1.0;
        localStorage.setItem('mdcat_tts_rate', String(this.rate));
        if (this.speaking && !this.paused) {
          this.speakCurrentBlock();
        }
      });
    }

    if (this.voiceSelect) {
      this.voiceSelect.addEventListener('change', (e) => {
        const uri = (e.target as HTMLSelectElement).value;
        this.selectedVoiceUri = uri;
        localStorage.setItem('mdcat_tts_voice', uri);

        if (this.speaking && !this.paused) {
          this.speakCurrentBlock();
        }
      });
    }

    if (this.headingSelect) {
      this.headingSelect.addEventListener('change', (e) => {
        const blockId = (e.target as HTMLSelectElement).value;
        if (blockId) {
          this.playBlockById(blockId);
        }
      });
    }

    this.playBtn?.addEventListener('click', () => this.togglePlay());
    this.stopBtn?.addEventListener('click', () => this.stop());
    this.prevBtn?.addEventListener('click', () => this.prev());
    this.nextBtn?.addEventListener('click', () => this.next());
    this.prevHeadingBtn?.addEventListener('click', () => this.prevHeading());
    this.nextHeadingBtn?.addEventListener('click', () => this.nextHeading());

    const closeBtn = barElement.querySelector('#tts-close-btn');
    closeBtn?.addEventListener('click', () => this.hideBar());

    this.populateVoices();
    this.updateUi();
  }

  showBar(): void {
    if (this.barElement) {
      this.barElement.classList.add('visible');
      if (this.blocks.length === 0) {
        const content = document.getElementById('markdown-content');
        if (content) this.parseDocumentBlocks(content);
      }
      this.updateUi();
    }
  }

  hideBar(): void {
    this.stop();
    if (this.barElement) {
      this.barElement.classList.remove('visible');
    }
  }

  toggleBar(): void {
    if (this.barElement?.classList.contains('visible')) {
      this.hideBar();
    } else {
      this.showBar();
    }
  }

  populateVoices(): void {
    if (!this.voiceSelect) return;

    const localVoices = this.supported ? window.speechSynthesis.getVoices() : [];
    let html = '';

    // 1. Grupo de Voces Neuronales de Edge (Español)
    if (this.edgeVoices.length > 0) {
      const esEdge = this.edgeVoices.filter((v) => v.locale && v.locale.toLowerCase().startsWith('es'));
      const enEdge = this.edgeVoices.filter((v) => v.locale && v.locale.toLowerCase().startsWith('en'));

      if (esEdge.length > 0) {
        html += `<optgroup label="✨ Voces Neuronales en Español (Calidad Humana / Estudio)">`;
        html += esEdge
          .map((v) => `<option value="edge:${v.name}">${v.friendly_name}</option>`)
          .join('');
        html += `</optgroup>`;
      }

      if (enEdge.length > 0) {
        html += `<optgroup label="🌐 Voces Neuronales en Inglés (Técnico / Bilingüe)">`;
        html += enEdge
          .map((v) => `<option value="edge:${v.name}">${v.friendly_name}</option>`)
          .join('');
        html += `</optgroup>`;
      }
    }

    // 2. Grupo de Voces Locales de Windows (Offline)
    if (localVoices.length > 0) {
      html += `<optgroup label="💻 Voces Locales de Windows (Offline)">`;
      html += localVoices
        .map((v) => `<option value="local:${v.voiceURI}">${v.name} (${v.lang})</option>`)
        .join('');
      html += `</optgroup>`;
    }

    if (!html) return;
    this.voiceSelect.innerHTML = html;

    // Restaurar selección previa o seleccionar Dalia Neural / primera en español
    if (this.selectedVoiceUri && this.voiceSelect.querySelector(`option[value="${this.selectedVoiceUri}"]`)) {
      this.voiceSelect.value = this.selectedVoiceUri;
    } else {
      const dalia = this.edgeVoices.find((v) => v.name.includes('Dalia') || v.short_name.includes('Dalia'));
      if (dalia) {
        this.selectedVoiceUri = `edge:${dalia.name}`;
        this.voiceSelect.value = this.selectedVoiceUri;
      } else if (this.edgeVoices.length > 0) {
        this.selectedVoiceUri = `edge:${this.edgeVoices[0].name}`;
        this.voiceSelect.value = this.selectedVoiceUri;
      } else if (localVoices.length > 0) {
        this.selectedVoiceUri = `local:${localVoices[0].voiceURI}`;
        this.voiceSelect.value = this.selectedVoiceUri;
      }
    }
  }

  /**
   * Extrae los párrafos, listas, bloques de código, tablas y encabezados del artículo Markdown para lectura secuencial.
   */
  parseDocumentBlocks(container: HTMLElement): void {
    this.stop();
    this.blocks = [];
    this.currentBlockIndex = 0;
    this.headingBlockIndices = [];

    // Incluir encabezados, párrafos, items de lista, citas, bloques de código pre, tablas y alertas
    const candidateNodes = Array.from(
      container.querySelectorAll<HTMLElement>(
        'h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, tr, .markdown-alert'
      )
    );

    // Filtrar elementos para evitar duplicar nodos anidados (ej. un 'p' o 'code' dentro de un 'li', 'blockquote' o 'pre')
    const filteredNodes = candidateNodes.filter((node) => {
      // Para filas de tabla, sólo procesar si tienen celdas de datos o encabezados
      if (node.tagName === 'TR') {
        return node.querySelector('td, th') !== null;
      }

      // Si el elemento es hijo de otro bloque candidato (ej. <p> dentro de <li>, o <code> dentro de <pre>),
      // dejamos que el elemento padre lo englobe, a menos que el padre sea la tabla o alerta
      const parentCandidate = node.parentElement?.closest<HTMLElement>(
        'h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, tr'
      );
      return !parentCandidate;
    });

    let idx = 0;
    const isEn = this.i18nManager?.getLocale() === 'en';
    const jumpLabel = isEn ? '📑 Jump to section...' : '📑 Saltar a sección...';
    let headingOptions = `<option value="">${jumpLabel}</option>`;

    // Se usa textContent y no innerText: los hijos de .markdown-body tienen `content-visibility: auto`
    // y Chromium devuelve innerText vacío para los bloques que aún no se han pintado (fuera de pantalla
    // o recién insertados), lo que dejaba la lectura sólo con títulos y tablas.
    filteredNodes.forEach((node) => {
      let text = '';
      const isHeading = node.tagName.startsWith('H');
      const isPre = node.tagName === 'PRE';
      const isTableRow = node.tagName === 'TR';

      if (isTableRow) {
        // En tablas, unir las celdas con comas para lectura comprensible
        const cells = Array.from(node.querySelectorAll<HTMLElement>('td, th'))
          .map((c) => (c.textContent || '').trim())
          .filter((t) => t.length > 0);
        text = cells.join(', ');
      } else if (isPre) {
        // En bloques de código o comandos de terminal
        const lines = (node.textContent || '')
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        if (lines.length > 15) {
          text = lines.slice(0, 10).join(', ') + (isEn ? ', and more code lines' : ', y más líneas de código');
        } else {
          text = lines.join(', ');
        }
      } else {
        text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      }

      if (text.length > 1) {
        idx++;
        const blockId = `tts-block-${idx}`;
        const blockIndex = this.blocks.length;

        node.dataset.ttsBlockId = blockId;
        node.classList.add('tts-interactive-block');

        // Si tiene ancla hija generada por pulldown-cmark o ya tiene ID, vincularlo al elemento
        const anchor = node.querySelector<HTMLElement>('a.heading-anchor, a[id]');
        if (anchor && anchor.id && !node.id) {
          node.id = anchor.id;
        }

        if (isHeading) {
          this.headingBlockIndices.push(blockIndex);
          const level = node.tagName.substring(1);
          const indent = '· '.repeat(Math.max(0, parseInt(level, 10) - 1));
          headingOptions += `<option value="${blockId}">${indent}H${level}: ${text.substring(0, 42)}</option>`;
        }

        // Hacer clic directo en cualquier párrafo, bloque de código o título para iniciar la lectura desde ahí
        node.onclick = (e) => {
          if (!(e.target as HTMLElement).closest('a, button, input')) {
            this.playBlockById(blockId);
          }
        };

        this.blocks.push({
          id: blockId,
          element: node,
          text: text,
          title: isHeading ? text : ''
        });
      }
    });

    if (this.headingSelect) {
      this.headingSelect.innerHTML = headingOptions;
    }

    this.updateUi();
  }

  togglePlay(): void {
    if (this.speaking) {
      if (this.paused) {
        if (this.currentAudio) {
          this.currentAudio.play().catch(console.error);
        } else if (this.supported) {
          window.speechSynthesis.resume();
        }
        this.paused = false;
        this.updateUi();
      } else {
        if (this.currentAudio) {
          this.currentAudio.pause();
        } else if (this.supported) {
          window.speechSynthesis.pause();
        }
        this.paused = true;
        this.updateUi();
      }
    } else {
      if (!this.blocks.length) {
        const content = document.getElementById('markdown-content');
        if (content) this.parseDocumentBlocks(content);
      }
      if (!this.blocks.length) return;

      this.speaking = true;
      this.paused = false;
      this.speakCurrentBlock();
    }
  }

  stop(): void {
    this.playRequestId++;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.supported) {
      window.speechSynthesis.cancel();
    }
    this.speaking = false;
    this.paused = false;
    this.clearHighlight();
    this.updateUi();
  }

  prev(): void {
    if (this.currentBlockIndex > 0) {
      this.currentBlockIndex--;
      this.speakCurrentBlock();
    }
  }

  next(): void {
    if (this.currentBlockIndex < this.blocks.length - 1) {
      this.currentBlockIndex++;
      this.speakCurrentBlock();
    }
  }

  prevHeading(): void {
    const prevIdx = [...this.headingBlockIndices].reverse().find((idx) => idx < this.currentBlockIndex);
    if (prevIdx !== undefined) {
      this.currentBlockIndex = prevIdx;
      this.speaking = true;
      this.paused = false;
      this.speakCurrentBlock();
    } else if (this.headingBlockIndices.length > 0) {
      this.currentBlockIndex = this.headingBlockIndices[0];
      this.speaking = true;
      this.paused = false;
      this.speakCurrentBlock();
    }
  }

  nextHeading(): void {
    const nextIdx = this.headingBlockIndices.find((idx) => idx > this.currentBlockIndex);
    if (nextIdx !== undefined) {
      this.currentBlockIndex = nextIdx;
      this.speaking = true;
      this.paused = false;
      this.speakCurrentBlock();
    }
  }

  playHeadingById(targetId: string): void {
    const cleanId = targetId.startsWith('#') ? targetId.slice(1) : targetId;
    let targetEl = document.getElementById(cleanId) as HTMLElement | null;
    if (!targetEl) {
      targetEl = document.querySelector<HTMLElement>(`[id="${cleanId}"], a[name="${cleanId}"]`);
    }
    if (!targetEl) return;

    this.showBar();

    const headingEl = (targetEl.matches('h1, h2, h3, h4, h5, h6')
      ? targetEl
      : targetEl.closest<HTMLElement>('h1, h2, h3, h4, h5, h6')) || targetEl;

    const blockId = headingEl.dataset.ttsBlockId || targetEl.dataset.ttsBlockId;
    if (blockId) {
      this.playBlockById(blockId);
      return;
    }

    const idx = this.blocks.findIndex(
      (b) => b.element === headingEl || b.element === targetEl || b.element.id === cleanId || b.title === (headingEl.innerText?.trim() || '')
    );
    if (idx !== -1) {
      this.currentBlockIndex = idx;
      this.speaking = true;
      this.paused = false;
      this.speakCurrentBlock();
    }
  }

  playBlockById(blockId: string): void {
    const idx = this.blocks.findIndex((b) => b.id === blockId);
    if (idx !== -1) {
      this.showBar();
      this.currentBlockIndex = idx;
      this.speaking = true;
      this.paused = false;
      this.speakCurrentBlock();
    }
  }

  private async speakCurrentBlock(): Promise<void> {
    if (!this.blocks.length) {
      const content = document.getElementById('markdown-content');
      if (content) this.parseDocumentBlocks(content);
    }
    if (!this.blocks.length) return;

    const currentRequestId = ++this.playRequestId;

    // Detener cualquier reproducción previa
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.supported) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
    }

    const block = this.blocks[this.currentBlockIndex];
    if (!block) {
      this.stop();
      return;
    }

    this.highlightCurrentBlock(block.element);
    this.speaking = true;
    this.paused = false;
    this.updateUi();

    // Normalizar fonética
    const spokenText = prepareTextForSpeech(block.text, block.title);

    // 1. Si la voz seleccionada es una voz neuronal de Edge
    if (this.selectedVoiceUri.startsWith('edge:')) {
      const voiceName = this.selectedVoiceUri.replace('edge:', '');
      try {
        if (this.badgeElement) {
          const isEn = this.i18nManager?.getLocale() === 'en';
          this.badgeElement.textContent = isEn ? 'Synthesizing...' : 'Sintetizando...';
        }

        const base64Audio = await TauriBridge.synthesizeEdgeTts(spokenText, voiceName, this.rate);

        // Descartar si el usuario cambió de sección o canceló mientras se sintetizaba
        if (currentRequestId !== this.playRequestId || !this.speaking) {
          return;
        }

        if (base64Audio) {
          // Convertir Base64 a Blob Object URL para máxima compatibilidad con Chromium
          const binary = atob(base64Audio);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'audio/mp3' });
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          this.currentAudio = audio;
          audio.playbackRate = 1.0;

          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            if (this.speaking && !this.paused && currentRequestId === this.playRequestId) {
              if (this.currentBlockIndex < this.blocks.length - 1) {
                this.currentBlockIndex++;
                this.speakCurrentBlock();
              } else {
                this.stop();
              }
            }
          };

          audio.onerror = (e) => {
            console.warn('Error al reproducir audio de voz neuronal, recurriendo a voz local:', e);
            URL.revokeObjectURL(audioUrl);
            if (currentRequestId === this.playRequestId && this.speaking) {
              this.speakWithLocalVoice(spokenText);
            }
          };

          await audio.play();
          this.updateUi();
          return;
        } else {
          console.warn('Respuesta vacía de Edge TTS, usando voz local');
          if (currentRequestId === this.playRequestId && this.speaking) {
            this.speakWithLocalVoice(spokenText);
          }
          return;
        }
      } catch (err) {
        console.warn('Fallo en síntesis Edge TTS, usando voz local de Windows:', err);
        if (currentRequestId === this.playRequestId && this.speaking) {
          this.speakWithLocalVoice(spokenText);
        }
        return;
      }
    }

    // 2. Si la voz seleccionada es una voz local de Windows
    this.speakWithLocalVoice(spokenText);
  }

  private speakWithLocalVoice(spokenText: string): void {
    if (!this.supported) return;

    const currentRequestId = this.playRequestId;
    const utter = new SpeechSynthesisUtterance(spokenText);
    utter.rate = this.rate;

    if (this.selectedVoiceUri.startsWith('local:')) {
      const rawUri = this.selectedVoiceUri.replace('local:', '');
      const voices = window.speechSynthesis.getVoices();
      const matched = voices.find((v) => v.voiceURI === rawUri);
      if (matched) {
        utter.voice = matched;
        utter.lang = matched.lang;
      }
    } else {
      const voices = window.speechSynthesis.getVoices();
      const esVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('es'));
      if (esVoice) {
        utter.voice = esVoice;
        utter.lang = esVoice.lang;
      } else if (voices[0]) {
        utter.voice = voices[0];
        utter.lang = voices[0].lang;
      }
    }

    utter.onend = () => {
      if (this.speaking && !this.paused && currentRequestId === this.playRequestId) {
        if (this.currentBlockIndex < this.blocks.length - 1) {
          this.currentBlockIndex++;
          this.speakCurrentBlock();
        } else {
          this.stop();
        }
      }
    };

    utter.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('Aviso de síntesis TTS local:', e.error);
      }
    };

    window.speechSynthesis.speak(utter);
  }

  private highlightCurrentBlock(el: HTMLElement): void {
    this.clearHighlight();
    el.classList.add('tts-highlight-active');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private clearHighlight(): void {
    document.querySelectorAll('.tts-highlight-active').forEach((el) => {
      el.classList.remove('tts-highlight-active');
    });
  }

  private updateUi(): void {
    if (!this.barElement) return;
    const isEn = this.i18nManager?.getLocale() === 'en';

    if (this.speaking) {
      this.barElement.classList.add('active-speaking');
      if (this.stopBtn) this.stopBtn.disabled = false;
      if (this.prevBtn) this.prevBtn.disabled = this.currentBlockIndex <= 0;
      if (this.nextBtn) this.nextBtn.disabled = this.currentBlockIndex >= this.blocks.length - 1;

      const resumeText = isEn ? 'Resume' : 'Reanudar';
      const pauseText = isEn ? 'Pause' : 'Pausar';
      if (this.playBtn) {
        this.playBtn.innerHTML = this.paused
          ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> ${resumeText}`
          : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> ${pauseText}`;
      }

      if (this.badgeElement) {
        this.badgeElement.textContent = this.paused
          ? (isEn ? 'Paused' : 'Pausado')
          : (isEn ? 'Reading' : 'Leyendo');
        this.badgeElement.className = `tts-badge ${this.paused ? 'paused' : 'playing'}`;
      }

      if (this.headingSelect && this.headingBlockIndices.length > 0) {
        const curHeadingBlockIdx = [...this.headingBlockIndices].reverse().find((idx) => idx <= this.currentBlockIndex);
        if (curHeadingBlockIdx !== undefined && this.blocks[curHeadingBlockIdx]) {
          this.headingSelect.value = this.blocks[curHeadingBlockIdx].id;
        }
      }

      if (this.prevHeadingBtn) {
        this.prevHeadingBtn.disabled = !this.headingBlockIndices.some((idx) => idx < this.currentBlockIndex);
      }
      if (this.nextHeadingBtn) {
        this.nextHeadingBtn.disabled = !this.headingBlockIndices.some((idx) => idx > this.currentBlockIndex);
      }
    } else {
      this.barElement.classList.remove('active-speaking');
      const playText = isEn ? 'Listen' : 'Escuchar';
      if (this.playBtn) {
        this.playBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> ${playText}`;
      }
      if (this.stopBtn) this.stopBtn.disabled = true;
      if (this.prevBtn) this.prevBtn.disabled = true;
      if (this.nextBtn) this.nextBtn.disabled = true;
      if (this.prevHeadingBtn) this.prevHeadingBtn.disabled = false;
      if (this.nextHeadingBtn) this.nextHeadingBtn.disabled = false;

      if (this.badgeElement) {
        this.badgeElement.textContent = isEn ? 'Idle' : 'Inactivo';
        this.badgeElement.className = 'tts-badge';
      }

      if (this.infoElement) {
        this.infoElement.textContent = isEn
          ? `${this.blocks.length} sections available · Click any paragraph or title to listen`
          : `${this.blocks.length} secciones disponibles · Clic en cualquier párrafo o título para escuchar`;
      }
    }
  }
}
