const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const distDir = path.join(__dirname, '..', 'dist');
const distIndex = path.join(distDir, 'index.html');
let baseHtml = fs.readFileSync(distIndex, 'utf8');

// Convertir rutas absolutas en relativas para que funcionen con file:///
baseHtml = baseHtml.replace(/href="\/assets\//g, 'href="./assets/');
baseHtml = baseHtml.replace(/src="\/assets\//g, 'src="./assets/');

const screenshotsDir = path.join(__dirname, '..', 'assets', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function captureAsync(tempFileName, outPngName) {
  return new Promise((resolve, reject) => {
    const tempPath = path.join(distDir, tempFileName);
    const outPath = path.join(screenshotsDir, outPngName);
    const fileUrl = 'file:///' + tempPath.replace(/\\/g, '/');

    const cmd = `"${edgePath}" --headless --disable-gpu --screenshot="${outPath}" --window-size=1280,800 "${fileUrl}"`;
    exec(cmd, (err) => {
      if (err) return reject(err);
      if (fs.existsSync(outPath)) {
        console.log(`[OK] Capturado: ${outPngName} (${fs.statSync(outPath).size} bytes)`);
      }
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      resolve();
    });
  });
}

async function main() {
  // 1. Escena: Modo Lindo
  console.log('\n[1/4] Capturando: Modo Lindo...');
  let lindoHtml = baseHtml.replace('<div class="splash-screen" id="splash-screen">', '<div class="splash-screen" id="splash-screen" style="display:none !important;">');
  fs.writeFileSync(path.join(distDir, 'temp_lindo.html'), lindoHtml, 'utf8');
  await captureAsync('temp_lindo.html', 'mdcat-view-lindo.png');

  // 2. Escena: Modo 2 Pantallas (Dividido)
  console.log('\n[2/4] Capturando: Modo 2 Pantallas...');
  let splitHtml = baseHtml.replace('class="app-container mode-lindo"', 'class="app-container mode-dividido"');
  splitHtml = splitHtml.replace('class="view-mode-btn active" data-view-mode="lindo"', 'class="view-mode-btn" data-view-mode="lindo"');
  splitHtml = splitHtml.replace('class="view-mode-btn" data-view-mode="dividido"', 'class="view-mode-btn active" data-view-mode="dividido"');
  splitHtml = splitHtml.replace('<span class="raw-editor-counter" id="raw-editor-counter">0 líneas</span>', '<span class="raw-editor-counter" id="raw-editor-counter">28 líneas • 1.224 chars</span>');

  const sampleMd = `# MDCAT Extended
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
| **F8** | Alternar Modo Enfoque |
| **F9** | Alternar Modo Máquina de Escribir |
| **F10** | Alternar Lectura Biónica |
`;

  splitHtml = splitHtml.replace(
    'placeholder="Escribe o pega aquí tu Markdown en modo crudo..." data-i18n-placeholder="editor.placeholder"></textarea>',
    `placeholder="Escribe o pega aquí tu Markdown en modo crudo..." data-i18n-placeholder="editor.placeholder">${sampleMd}</textarea>`
  );
  splitHtml = splitHtml.replace('<div class="splash-screen" id="splash-screen">', '<div class="splash-screen" id="splash-screen" style="display:none !important;">');

  fs.writeFileSync(path.join(distDir, 'temp_split.html'), splitHtml, 'utf8');
  await captureAsync('temp_split.html', 'mdcat-view-split.png');

  // 3. Escena: Lector TTS con Karaoke
  console.log('\n[3/4] Capturando: Lector TTS con Karaoke...');
  let ttsHtml = baseHtml.replace('class="tts-player-bar" id="tts-player-bar"', 'class="tts-player-bar visible active-speaking" id="tts-player-bar"');
  ttsHtml = ttsHtml.replace('<span class="tts-badge" id="tts-badge" data-i18n="tts.idle">Inactivo</span>', '<span class="tts-badge playing" id="tts-badge">Leyendo</span>');
  ttsHtml = ttsHtml.replace(
    '<button class="tts-btn primary" id="tts-play-btn">',
    `<button class="tts-btn primary" id="tts-play-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Pausar</button><button style="display:none">`
  );
  ttsHtml = ttsHtml.replace('<div class="splash-screen" id="splash-screen">', '<div class="splash-screen" id="splash-screen" style="display:none !important;">');

  fs.writeFileSync(path.join(distDir, 'temp_tts.html'), ttsHtml, 'utf8');
  await captureAsync('temp_tts.html', 'mdcat-view-tts.png');

  // 4. Escena: Modal Acerca de & cyBEERsecurity
  console.log('\n[4/4] Capturando: Modal Acerca de...');
  let aboutHtml = baseHtml.replace('class="modal-overlay" id="about-modal-overlay"', 'class="modal-overlay open" id="about-modal-overlay"');
  aboutHtml = aboutHtml.replace('<div class="splash-screen" id="splash-screen">', '<div class="splash-screen" id="splash-screen" style="display:none !important;">');

  fs.writeFileSync(path.join(distDir, 'temp_about.html'), aboutHtml, 'utf8');
  await captureAsync('temp_about.html', 'mdcat-modal-about.png');

  console.log('\n¡Todas las capturas se generaron con éxito y con rutas relativas!');
}

main().catch(console.error);
