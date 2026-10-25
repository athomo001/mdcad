// Oculta la ventana de consola negra en Windows para comportarse como app nativa GUI
#![windows_subsystem = "windows"]

use mdcat_core::{MarkdownEngine, MdbinContainer, MdbinEnvelope, ProcessedDocument};
use std::path::PathBuf;

/// Parsea una cadena de texto Markdown a través del motor zero-copy de Rust.
#[tauri::command]
fn parse_markdown(content: String) -> Result<ProcessedDocument, String> {
    Ok(MarkdownEngine::parse(&content))
}

/// Lee un archivo Markdown (.md o .markdown) del sistema de archivos local y lo parsea.
#[tauri::command]
fn read_and_parse_file(path: String) -> Result<ProcessedDocument, String> {
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Error al leer el archivo '{}': {}", path, e))?;
    Ok(MarkdownEngine::parse(&content))
}

/// Lee el contenido en texto plano original de un archivo en disco.
#[tauri::command]
fn read_file_content(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Error al leer el archivo '{}': {}", path, e))
}

/// Inspecciona el sobre en texto claro de un contenedor cifrado .mdbin para IA y metadatos.
#[tauri::command]
fn inspect_mdbin_envelope(path: String) -> Result<MdbinEnvelope, String> {
    let bytes = std::fs::read(&path)
        .map_err(|e| format!("No se pudo leer el archivo MDBIN '{}': {}", path, e))?;
    MdbinContainer::read_envelope(&bytes)
        .map_err(|e| format!("Sobre MDBIN no válido: {}", e))
}

/// Descifra y parsea un archivo .mdbin autenticado con contraseña.
#[tauri::command]
fn read_and_decrypt_mdbin(path: String, password: String) -> Result<ProcessedDocument, String> {
    let bytes = std::fs::read(&path)
        .map_err(|e| format!("No se pudo leer el archivo MDBIN '{}': {}", path, e))?;
    let markdown = MdbinContainer::unpack(&bytes, &password)
        .map_err(|e| format!("{}", e))?;
    Ok(MarkdownEngine::parse(&markdown))
}

/// Empaqueta y cifra el documento actual en un archivo .mdbin.
#[tauri::command]
fn export_to_mdbin(path: String, markdown: String, password: String, hint: Option<String>) -> Result<(), String> {
    let bytes = MdbinContainer::pack(&markdown, &password, hint.as_deref())
        .map_err(|e| format!("Error al cifrar el contenedor MDBIN: {}", e))?;
    std::fs::write(&path, bytes)
        .map_err(|e| format!("Error al guardar el archivo '{}': {}", path, e))?;
    Ok(())
}

/// Abre el diálogo nativo de Windows (OpenFileDialog) para seleccionar un archivo .md o .mdbin.
#[tauri::command]
fn open_file_dialog() -> Option<String> {
    let file = rfd::FileDialog::new()
        .add_filter("Documentos Markdown y Cifrados", &["md", "markdown", "mdbin"])
        .add_filter("Markdown (*.md, *.markdown)", &["md", "markdown"])
        .add_filter("Cápsula Cifrada MDBIN (*.mdbin)", &["mdbin"])
        .add_filter("Todos los archivos (*.*)", &["*"])
        .set_title("Abrir documento en MDCAT Extended")
        .pick_file();

    file.map(|p| p.to_string_lossy().to_string())
}

/// Abre el diálogo nativo de Windows (SaveFileDialog) para exportar una cápsula .mdbin.
#[tauri::command]
fn save_file_dialog(default_name: Option<String>) -> Option<String> {
    let mut dialog = rfd::FileDialog::new()
        .add_filter("Cápsula Cifrada MDBIN (*.mdbin)", &["mdbin"])
        .set_title("Exportar como Contenedor Cifrado MDBIN");

    if let Some(name) = default_name {
        dialog = dialog.set_file_name(&name);
    }

    dialog.save_file().map(|p| p.to_string_lossy().to_string())
}

/// Guarda contenido Markdown de texto plano en la ruta de archivo especificada.
#[tauri::command]
fn save_markdown_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content)
        .map_err(|e| format!("Error al guardar el archivo '{}': {}", path, e))?;
    Ok(())
}

/// Abre el diálogo nativo de Windows para guardar un archivo Markdown (.md).
#[tauri::command]
fn save_markdown_dialog(default_name: Option<String>) -> Option<String> {
    let mut dialog = rfd::FileDialog::new()
        .add_filter("Documento Markdown (*.md, *.markdown)", &["md", "markdown"])
        .set_title("Guardar documento Markdown");

    if let Some(name) = default_name {
        dialog = dialog.set_file_name(&name);
    }

    dialog.save_file().map(|p| p.to_string_lossy().to_string())
}

/// Lee el argumento de línea de comandos de Windows (por ejemplo: `mdcat.exe documento.md`).
#[tauri::command]
fn get_cli_argument() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 {
        let candidate = &args[1];
        let path = PathBuf::from(candidate);
        if path.exists() && path.is_file() {
            return Some(path.to_string_lossy().to_string());
        }
    }
    None
}

/// Obtiene la marca de tiempo de última modificación del archivo en milisegundos Unix.
#[tauri::command]
fn get_file_mtime(path: String) -> Option<u64> {
    std::fs::metadata(&path)
        .ok()?
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()
        .map(|d| d.as_millis() as u64)
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct EdgeVoiceDescriptor {
    pub name: String,
    pub short_name: String,
    pub friendly_name: String,
    pub locale: String,
    pub gender: String,
}

/// Obtiene el catálogo de voces neuronales de Microsoft Edge filtrado y ordenado
#[tauri::command]
fn get_edge_voices() -> Vec<EdgeVoiceDescriptor> {
    // Si podemos consultar la lista en línea, filtramos español e inglés
    if let Ok(voices) = msedge_tts::voice::get_voices_list() {
        let mut filtered: Vec<EdgeVoiceDescriptor> = voices
            .into_iter()
            .filter(|v| {
                let loc = v.locale.as_deref().unwrap_or("").to_lowercase();
                loc.starts_with("es-") || loc == "en-us" || loc == "en-gb"
            })
            .map(|v| {
                let short = v.short_name.clone().unwrap_or_else(|| v.name.clone());
                let clean_name = short
                    .replace("Neural", "")
                    .replace("es-MX-", "")
                    .replace("es-ES-", "")
                    .replace("es-CL-", "")
                    .replace("es-CO-", "")
                    .replace("es-AR-", "")
                    .replace("es-US-", "")
                    .replace("en-US-", "")
                    .replace("en-GB-", "");

                let country = match v.locale.as_deref().unwrap_or("") {
                    "es-MX" => "México",
                    "es-ES" => "España",
                    "es-CL" => "Chile",
                    "es-CO" => "Colombia",
                    "es-AR" => "Argentina",
                    "es-US" => "EE.UU.",
                    "en-US" => "EE.UU. (Inglés)",
                    "en-GB" => "Reino Unido (Inglés)",
                    other => other,
                };

                let gender_str = match v.gender.as_deref().unwrap_or("") {
                    "Female" => "Femenina",
                    "Male" => "Masculina",
                    _ => "",
                };

                let friendly = format!("{} ({} - {})", clean_name, country, gender_str);

                EdgeVoiceDescriptor {
                    name: v.name.clone(),
                    short_name: short,
                    friendly_name: friendly,
                    locale: v.locale.unwrap_or_else(|| "es-ES".to_string()),
                    gender: v.gender.unwrap_or_else(|| "Unknown".to_string()),
                }
            })
            .collect();

        // Ordenar primero las voces en español y luego en inglés
        filtered.sort_by(|a, b| {
            let a_es = a.locale.starts_with("es-");
            let b_es = b.locale.starts_with("es-");
            match (a_es, b_es) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.friendly_name.cmp(&b.friendly_name),
            }
        });

        if !filtered.is_empty() {
            return filtered;
        }
    }

    // Catálogo curado de emergencia con las voces más populares de español e inglés
    vec![
        EdgeVoiceDescriptor {
            name: "Microsoft Server Speech Text to Speech Voice (es-MX, DaliaNeural)".into(),
            short_name: "es-MX-DaliaNeural".into(),
            friendly_name: "Dalia (México - Femenina)".into(),
            locale: "es-MX".into(),
            gender: "Female".into(),
        },
        EdgeVoiceDescriptor {
            name: "Microsoft Server Speech Text to Speech Voice (es-MX, JorgeNeural)".into(),
            short_name: "es-MX-JorgeNeural".into(),
            friendly_name: "Jorge (México - Masculina)".into(),
            locale: "es-MX".into(),
            gender: "Male".into(),
        },
        EdgeVoiceDescriptor {
            name: "Microsoft Server Speech Text to Speech Voice (es-ES, AlvaroNeural)".into(),
            short_name: "es-ES-AlvaroNeural".into(),
            friendly_name: "Álvaro (España - Masculina)".into(),
            locale: "es-ES".into(),
            gender: "Male".into(),
        },
        EdgeVoiceDescriptor {
            name: "Microsoft Server Speech Text to Speech Voice (es-ES, ElviraNeural)".into(),
            short_name: "es-ES-ElviraNeural".into(),
            friendly_name: "Elvira (España - Femenina)".into(),
            locale: "es-ES".into(),
            gender: "Female".into(),
        },
        EdgeVoiceDescriptor {
            name: "Microsoft Server Speech Text to Speech Voice (es-CL, CatalinaNeural)".into(),
            short_name: "es-CL-CatalinaNeural".into(),
            friendly_name: "Catalina (Chile - Femenina)".into(),
            locale: "es-CL".into(),
            gender: "Female".into(),
        },
        EdgeVoiceDescriptor {
            name: "Microsoft Server Speech Text to Speech Voice (es-CL, LorenzoNeural)".into(),
            short_name: "es-CL-LorenzoNeural".into(),
            friendly_name: "Lorenzo (Chile - Masculina)".into(),
            locale: "es-CL".into(),
            gender: "Male".into(),
        },
        EdgeVoiceDescriptor {
            name: "Microsoft Server Speech Text to Speech Voice (en-US, JennyNeural)".into(),
            short_name: "en-US-JennyNeural".into(),
            friendly_name: "Jenny (EE.UU. - Femenina Inglés)".into(),
            locale: "en-US".into(),
            gender: "Female".into(),
        },
        EdgeVoiceDescriptor {
            name: "Microsoft Server Speech Text to Speech Voice (en-US, GuyNeural)".into(),
            short_name: "en-US-GuyNeural".into(),
            friendly_name: "Guy (EE.UU. - Masculina Inglés)".into(),
            locale: "en-US".into(),
            gender: "Male".into(),
        },
    ]
}

/// Sintetiza un texto usando la voz neuronal de Microsoft Edge y devuelve el audio MP3 en Base64
#[tauri::command]
fn synthesize_edge_tts(text: String, voice: String, rate: f32) -> Result<String, String> {
    use msedge_tts::tts::client::connect;
    use msedge_tts::tts::SpeechConfig;

    let mut client = connect().map_err(|e| format!("Error conectando a Edge TTS: {}", e))?;

    let rate_percent = ((rate - 1.0) * 100.0).round() as i32;

    // Resolver el nombre exacto canónico que espera el servidor de Microsoft
    let target_voice_name = if voice.contains("Microsoft Server Speech") {
        voice
    } else {
        // Si nos pasan el short_name (ej: "es-MX-DaliaNeural"), buscar el nombre completo
        if let Ok(voices) = msedge_tts::voice::get_voices_list() {
            if let Some(matched) = voices.iter().find(|v| {
                v.short_name.as_deref() == Some(&voice) || v.name == voice || v.name.contains(&voice)
            }) {
                matched.name.clone()
            } else {
                voice
            }
        } else {
            voice
        }
    };

    let config = SpeechConfig {
        voice_name: target_voice_name,
        audio_format: "audio-24khz-48kbitrate-mono-mp3".to_string(),
        pitch: 0,
        rate: rate_percent,
        volume: 0,
    };

    let audio = client
        .synthesize(&text, &config)
        .map_err(|e| format!("Error en síntesis Edge TTS: {}", e))?;

    Ok(data_encoding_base64(&audio.audio_bytes))
}

fn data_encoding_base64(bytes: &[u8]) -> String {
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;

        out.push(CHARSET[((triple >> 18) & 0x3F) as usize] as char);
        out.push(CHARSET[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            out.push(CHARSET[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(CHARSET[(triple & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

#[cfg(target_os = "windows")]
fn trim_entire_process_tree() {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32First, Process32Next, PROCESSENTRY32, TH32CS_SNAPPROCESS,
    };
    use windows_sys::Win32::System::ProcessStatus::K32EmptyWorkingSet;
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcess, GetCurrentProcessId, OpenProcess, PROCESS_QUERY_INFORMATION,
        PROCESS_SET_QUOTA,
    };

    unsafe {
        // 1. Purgar el proceso principal de Rust
        K32EmptyWorkingSet(GetCurrentProcess());

        // 2. Localizar y purgar recursivamente toda la familia de procesos (hijos y nietos de WebView2)
        let my_pid = GetCurrentProcessId();
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot != (-1_isize as _) {
            let mut entries: Vec<PROCESSENTRY32> = Vec::new();
            let mut entry: PROCESSENTRY32 = std::mem::zeroed();
            entry.dwSize = std::mem::size_of::<PROCESSENTRY32>() as u32;

            if Process32First(snapshot, &mut entry) != 0 {
                loop {
                    entries.push(entry);
                    if Process32Next(snapshot, &mut entry) == 0 {
                        break;
                    }
                }
            }
            CloseHandle(snapshot);

            // Rastrear todos los descendientes en el árbol de procesos
            let mut family_pids = std::collections::HashSet::new();
            family_pids.insert(my_pid);

            let mut added = true;
            while added {
                added = false;
                for e in &entries {
                    if family_pids.contains(&e.th32ParentProcessID) && !family_pids.contains(&e.th32ProcessID) {
                        family_pids.insert(e.th32ProcessID);
                        added = true;
                    }
                }
            }

            // Purgar working set de cada proceso hijo/nieto
            for pid in family_pids {
                if pid != my_pid {
                    let child_handle = OpenProcess(
                        PROCESS_SET_QUOTA | PROCESS_QUERY_INFORMATION,
                        0,
                        pid,
                    );
                    if child_handle != std::ptr::null_mut() {
                        K32EmptyWorkingSet(child_handle);
                        CloseHandle(child_handle);
                    }
                }
            }
        }
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    {
        // Optimización equilibrada de consumo de RAM y rendimiento en WebView2:
        let browser_args = [
            "--in-process-gpu",
            "--renderer-process-limit=1",
            "--disable-breakpad",
            "--disable-crash-reporter",
            "--no-crash-upload",
            "--memory-model=low",
            "--disable-gpu-shader-disk-cache",
            "--disable-component-update",
            "--disable-domain-reliability",
            "--js-flags=\"--max-old-space-size=64 --lite-mode\""
        ].join(" ");

        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", browser_args);
    }

    // Hilo en segundo plano que purga la memoria de arranque y mantiene podada la jerarquía (solo WebView2)
    #[cfg(target_os = "windows")]
    std::thread::spawn(|| {
        // Primera poda agresiva tras terminar el renderizado inicial
        std::thread::sleep(std::time::Duration::from_millis(2500));
        trim_entire_process_tree();

        // Poda periódica cada 30 segundos para mantener la memoria al mínimo absoluto
        loop {
            std::thread::sleep(std::time::Duration::from_secs(30));
            trim_entire_process_tree();
        }
    });

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            parse_markdown,
            read_and_parse_file,
            read_file_content,
            inspect_mdbin_envelope,
            read_and_decrypt_mdbin,
            export_to_mdbin,
            open_file_dialog,
            save_file_dialog,
            save_markdown_file,
            save_markdown_dialog,
            get_cli_argument,
            get_file_mtime,
            get_edge_voices,
            synthesize_edge_tts
        ])
        .run(tauri::generate_context!())
        .expect("Error al ejecutar el lector de escritorio MDCAT Extended");
}
