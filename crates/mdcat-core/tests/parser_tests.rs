//! Pruebas de integración del motor de análisis sintáctico mdcat-core.
//! Siguiendo TDD en la frontera pública (seam) de MarkdownEngine.

use mdcat_core::{HeadingLevel, MarkdownEngine};

#[test]
fn test_parse_simple_markdown_generates_correct_toc_and_metrics() {
    let input = "# Título Principal\n\nEste es un párrafo de prueba.\n\n## Subsección 1\n\nContenido de la subsección.";
    let doc = MarkdownEngine::parse(input);

    assert_eq!(doc.toc.len(), 1);
    assert_eq!(doc.toc[0].text, "Título Principal");
    assert_eq!(doc.toc[0].level, HeadingLevel::H1);
    assert_eq!(doc.toc[0].children.len(), 1);
    assert_eq!(doc.toc[0].children[0].text, "Subsección 1");
    assert_eq!(doc.toc[0].children[0].level, HeadingLevel::H2);

    assert_eq!(doc.metrics.heading_count, 2);
    assert!(doc.metrics.word_count >= 10);
    assert!(!doc.content_hash.is_empty());
}

#[test]
fn test_parse_github_admonition_callouts() {
    let input = "> [!NOTE]\n> Esta es una nota informativa para la comunidad.";
    let doc = MarkdownEngine::parse(input);

    assert!(doc.ast_html.contains("data-callout=\"note\""));
    assert!(doc.ast_html.contains("Esta es una nota informativa"));
}

#[test]
fn test_parse_gfm_task_lists() {
    let input = "- [ ] Tarea pendiente\n- [x] Tarea completada con éxito";
    let doc = MarkdownEngine::parse(input);

    assert!(doc.ast_html.contains("type=\"checkbox\""));
    assert!(doc.ast_html.contains("checked"));
}

#[test]
fn test_security_neutralizes_malicious_javascript_links() {
    let input = "[Enlace sospechoso](javascript:alert('pwned'))";
    let doc = MarkdownEngine::parse(input);

    assert!(!doc.ast_html.contains("href=\"javascript:"));
}

#[test]
fn test_parse_massive_100k_lines_document() {
    use std::time::Instant;

    // Generar 100.000 líneas sintéticas representativas de una auditoría masiva
    let mut massive_md = String::with_capacity(4 * 1024 * 1024);
    for i in 1..=10_000 {
        massive_md.push_str(&format!("## Sección {}\n\n", i));
        massive_md.push_str("Este es un párrafo de prueba técnica en la auditoría de seguridad.\n");
        massive_md.push_str("- [ ] Verificación de control de acceso\n");
        massive_md.push_str("- [x] Validación criptográfica de tokens\n");
        massive_md.push_str("> [!NOTE]\n> Nota de evidencia de laboratorio.\n\n");
    }

    let start = Instant::now();
    let doc = MarkdownEngine::parse(&massive_md);
    let duration = start.elapsed();

    println!("Tiempo para parsear documento masivo: {:?}", duration);

    assert_eq!(doc.metrics.heading_count, 10_000);
    assert!(doc.metrics.word_count > 100_000);
    assert!(!doc.ast_html.is_empty());
    // Debe procesar a velocidad de vértigo (< 2 segundos incluso en modo debug sin optimizaciones)
    assert!(duration.as_secs() < 3);
}

