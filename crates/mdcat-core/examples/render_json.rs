//! Lee Markdown por stdin e imprime el `ProcessedDocument` en JSON.
//! Lo usa `scripts/capture_screenshots.cjs` para simular el backend de Tauri en el navegador.

use std::io::Read;

fn main() {
    let mut markdown = String::new();
    std::io::stdin()
        .read_to_string(&mut markdown)
        .expect("No se pudo leer stdin");
    let doc = mdcat_core::MarkdownEngine::parse(&markdown);
    println!("{}", serde_json::to_string(&doc).expect("No se pudo serializar"));
}
