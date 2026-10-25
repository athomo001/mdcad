/**
 * @file capture_screenshots.js
 * @description Generador automatizado de capturas de pantalla de alta fidelidad para el README de MDCAT.
 * Conexión mediante Chrome DevTools Protocol (CDP) nativo sobre Microsoft Edge.
 */

const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = 'http://localhost:4173';
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
  }

  async waitForOpen() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    return this.send('Runtime.evaluate', {
      expression: `(() => { ${expression} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
  }

  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`[Screenshot guardado]: ${path.basename(filePath)} (${fs.statSync(filePath).size} bytes)`);
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  console.log('[1/5] Iniciando Microsoft Edge con CDP en puerto 9222...');
  const edgeProc = spawn(EDGE_PATH, [
    '--remote-debugging-port=9222',
    '--headless=new',
    '--hide-scrollbars',
    '--window-size=1400,900',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${path.join(os.tmpdir(), 'mdcat-cdp-profile')}`,
    'about:blank',
  ]);

  edgeProc.on('error', (err) => {
    console.error('Error al lanzar Edge:', err);
    process.exit(1);
  });

  // Esperar a que el puerto 9222 responda
  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    try {
      const res = await fetch('http://127.0.0.1:9222/json/list');
      const list = await res.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch {}
  }

  if (!wsUrl) {
    console.error('No se pudo conectar al endpoint CDP de Edge.');
    edgeProc.kill();
    process.exit(1);
  }

  console.log('[2/5] Conectado al protocolo CDP de Edge:', wsUrl);
  const client = new CdpClient(wsUrl);
  await client.waitForOpen();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1400,
    height: 900,
    deviceScaleFactor: 1.5,
    mobile: false,
  });

  console.log('[3/5] Navegando a', TARGET_URL);
  await client.send('Page.navigate', { url: TARGET_URL });
  await sleep(2000);

  // En el navegador no existe el backend de Rust: se renderiza el documento de bienvenida
  // con mdcat-core y se inyecta un `__TAURI_INTERNALS__` simulado que devuelve ese resultado.
  const { result } = await client.eval(`return document.getElementById('raw-markdown-editor').value;`);
  const processedJson = execFileSync('cargo', ['run', '-q', '-p', 'mdcat-core', '--example', 'render_json'], {
    cwd: path.join(__dirname, '..'),
    input: result.value,
    encoding: 'utf-8',
  });
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      const processed = ${processedJson.trim()};
      const responses = { parse_markdown: processed, get_edge_voices: [] };
      window.__TAURI_INTERNALS__ = {
        invoke: async (cmd) => (cmd in responses ? responses[cmd] : null),
        transformCallback: () => 0,
      };
    `,
  });
  await client.send('Page.reload');
  await sleep(2000);

  // Asegurar que el splash screen desaparezca de inmediato
  await client.eval(`
    const splash = document.getElementById('splash-screen');
    if (splash) splash.remove();
  `);
  await sleep(600);

  // -------------------------------------------------------------
  // Escena 1: Modo Lectura Embellecida (Lindo)
  // -------------------------------------------------------------
  console.log('[4/5] Capturando Escena 1: Modo Lindo...');
  await client.eval(`
    document.getElementById('view-mode-lindo-btn')?.click();
    const activeTema = document.querySelector('.theme-chip[data-theme="negro"]');
    if (activeTema) activeTema.click();
  `);
  await sleep(600);
  await client.screenshot(path.join(OUTPUT_DIR, 'mdcat-view-lindo.png'));

  // -------------------------------------------------------------
  // Escena 2: Modo 2 Pantallas / Split View
  // -------------------------------------------------------------
  console.log('[4/5] Capturando Escena 2: Modo 2 Pantallas (Dividido)...');
  await client.eval(`
    document.getElementById('view-mode-split-btn')?.click();
  `);
  await sleep(600);
  await client.screenshot(path.join(OUTPUT_DIR, 'mdcat-view-split.png'));

  // -------------------------------------------------------------
  // Escena 3: Lector TTS Neuronal con Karaoke Sync
  // -------------------------------------------------------------
  console.log('[4/5] Capturando Escena 3: Barra de Síntesis de Voz (TTS)...');
  await client.eval(`
    document.getElementById('view-mode-lindo-btn')?.click();
    const ttsBar = document.getElementById('tts-player-bar');
    if (ttsBar) ttsBar.classList.add('visible');

    // Resaltar un párrafo simulando reproducción activa
    const blocks = document.querySelectorAll('h2, p');
    if (blocks.length > 2) {
      blocks[2].classList.add('tts-highlight-active');
    }
    const badge = document.getElementById('tts-badge');
    if (badge) {
      badge.textContent = 'Leyendo';
      badge.className = 'tts-badge playing';
    }
  `);
  await sleep(600);
  await client.screenshot(path.join(OUTPUT_DIR, 'mdcat-view-tts.png'));

  // -------------------------------------------------------------
  // Escena 4: Modal Acerca de & cyBEERsecurity
  // -------------------------------------------------------------
  console.log('[4/5] Capturando Escena 4: Modal Acerca de & cyBEERsecurity...');
  await client.eval(`
    const ttsBar = document.getElementById('tts-player-bar');
    if (ttsBar) ttsBar.classList.remove('visible');
    const activePara = document.querySelector('.tts-highlight-active');
    if (activePara) activePara.classList.remove('tts-highlight-active');

    const modal = document.getElementById('about-modal-overlay');
    if (modal) modal.classList.add('open');
  `);
  await sleep(600);
  await client.screenshot(path.join(OUTPUT_DIR, 'mdcat-modal-about.png'));

  console.log('[5/5] Todas las capturas generadas con éxito.');
  client.close();
  edgeProc.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error durante la captura:', err);
  process.exit(1);
});
