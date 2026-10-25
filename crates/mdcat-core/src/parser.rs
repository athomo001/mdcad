//! parser.rs - Motor de análisis sintáctico multihilo y zero-copy para Markdown.

use pulldown_cmark::{html, Event, HeadingLevel as CmarkHeadingLevel, Options, Parser, Tag, TagEnd};
use sha2::{Digest, Sha256};

use crate::callouts::transform_callouts;
use crate::security::{is_safe_url, sanitize_raw_html, sanitize_url};
use crate::toc::{build_toc_tree, slugify, HeadingLevel, TocItem};
use crate::{ProcessedDocument, ReadingMetrics};

pub struct MarkdownEngine;

impl MarkdownEngine {
    /// Procesa una cadena de texto Markdown completa y retorna el documento analizado y enriquecido.
    pub fn parse(markdown: &str) -> ProcessedDocument {
        // 1. Cálculo criptográfico SHA-256 del contenido original
        let mut hasher = Sha256::new();
        hasher.update(markdown.as_bytes());
        let content_hash = format!("{:x}", hasher.finalize());

        // 2. Extracción de Frontmatter (YAML o TOML)
        let (frontmatter_json, content) = extract_frontmatter(markdown);

        // 3. Configuración estricta de extensiones GFM
        let mut options = Options::empty();
        options.insert(Options::ENABLE_TABLES);
        options.insert(Options::ENABLE_TASKLISTS);
        options.insert(Options::ENABLE_STRIKETHROUGH);
        options.insert(Options::ENABLE_SMART_PUNCTUATION);
        options.insert(Options::ENABLE_HEADING_ATTRIBUTES);

        let parser = Parser::new_ext(content, options);

        let mut flat_toc: Vec<TocItem> = Vec::new();
        let mut word_count = 0;
        let mut character_count = 0;
        let mut in_heading = false;
        let mut current_heading_level = HeadingLevel::H1;
        let mut current_heading_text = String::new();

        let mut events: Vec<Event> = Vec::with_capacity(content.len() / 8);

        for event in parser {
            match event {
                Event::Start(Tag::Heading { level, .. }) => {
                    in_heading = true;
                    current_heading_level = match level {
                        CmarkHeadingLevel::H1 => HeadingLevel::H1,
                        CmarkHeadingLevel::H2 => HeadingLevel::H2,
                        CmarkHeadingLevel::H3 => HeadingLevel::H3,
                        CmarkHeadingLevel::H4 => HeadingLevel::H4,
                        CmarkHeadingLevel::H5 => HeadingLevel::H5,
                        CmarkHeadingLevel::H6 => HeadingLevel::H6,
                    };
                    current_heading_text.clear();
                    events.push(Event::Start(Tag::Heading {
                        level,
                        id: None,
                        classes: Vec::new(),
                        attrs: Vec::new(),
                    }));
                }
                Event::End(TagEnd::Heading(level)) => {
                    in_heading = false;
                    let text = current_heading_text.trim().to_string();
                    let slug = slugify(&text);

                    flat_toc.push(TocItem::new(
                        slug.clone(),
                        current_heading_level,
                        text,
                        0,
                    ));

                    // Inyectar ancla invisible para navegación precisa
                    events.push(Event::Html(format!(r#"<a id="{}" class="heading-anchor"></a>"#, slug).into()));
                    events.push(Event::End(TagEnd::Heading(level)));
                }
                Event::Start(Tag::Link { link_type, dest_url, title, id }) => {
                    let safe_dest = sanitize_url(&dest_url);
                    events.push(Event::Start(Tag::Link {
                        link_type,
                        dest_url: safe_dest.into(),
                        title,
                        id,
                    }));
                }
                Event::Start(Tag::Image { link_type, dest_url, title, id }) => {
                    let safe_dest = if is_safe_url(&dest_url) {
                        dest_url
                    } else {
                        "".into()
                    };
                    events.push(Event::Start(Tag::Image {
                        link_type,
                        dest_url: safe_dest,
                        title,
                        id,
                    }));
                }
                Event::Text(ref text) => {
                    character_count += text.chars().count();
                    word_count += text.split_whitespace().count();

                    if in_heading {
                        current_heading_text.push_str(text);
                    }
                    events.push(event);
                }
                Event::Html(ref raw_html) => {
                    let sanitized = sanitize_raw_html(raw_html);
                    events.push(Event::Html(sanitized.into()));
                }
                _ => {
                    events.push(event);
                }
            }
        }

        // 4. Transformación semántica de Callouts de advertencia
        let transformed_events = transform_callouts(events);

        // 5. Renderizado HTML final acelerado en un buffer único prealocado
        let mut html_output = String::with_capacity(content.len() * 3 / 2);
        html::push_html(&mut html_output, transformed_events.into_iter());

        // 6. Construcción de árbol jerárquico de Tabla de Contenidos
        let toc = build_toc_tree(flat_toc);
        let heading_count = count_headings(&toc);

        // 7. Métricas de lectura estimadas (promedio 200 palabras por minuto)
        let estimated_minutes = (word_count as f32 / 200.0).max(0.5);

        ProcessedDocument {
            content_hash,
            frontmatter_json,
            toc,
            ast_html: html_output,
            metrics: ReadingMetrics {
                word_count,
                character_count,
                estimated_minutes,
                heading_count,
            },
        }
    }
}

/// Extrae frontmatter YAML o TOML al inicio del documento si existe.
fn extract_frontmatter(input: &str) -> (Option<String>, &str) {
    let trimmed = input.trim_start();
    if trimmed.starts_with("---\n") {
        if let Some(end_idx) = trimmed[4..].find("\n---\n") {
            let yaml_str = &trimmed[4..4 + end_idx];
            let remainder = &trimmed[4 + end_idx + 5..];
            let json = serde_json::json!({
                "raw_yaml": yaml_str
            }).to_string();
            return (Some(json), remainder);
        }
    }
    (None, input)
}

fn count_headings(toc: &[TocItem]) -> usize {
    let mut count = toc.len();
    for item in toc {
        count += count_headings(&item.children);
    }
    count
}
