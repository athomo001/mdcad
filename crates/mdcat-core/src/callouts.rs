//! callouts.rs - Reconocimiento y transformación semántica de callouts de GitHub / Markdown extendido.

use pulldown_cmark::{Event, Tag, TagEnd};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CalloutType {
    Note,
    Tip,
    Important,
    Warning,
    Caution,
}

impl CalloutType {
    pub fn parse(text: &str) -> Option<(Self, &str)> {
        let trimmed = text.trim_start();
        if !trimmed.starts_with("[!") {
            return None;
        }

        let end_idx = trimmed.find(']')?;
        let tag = &trimmed[2..end_idx];
        let remainder = trimmed[end_idx + 1..].trim_start();

        let callout = match tag.to_ascii_uppercase().as_str() {
            "NOTE" => CalloutType::Note,
            "TIP" => CalloutType::Tip,
            "IMPORTANT" => CalloutType::Important,
            "WARNING" => CalloutType::Warning,
            "CAUTION" => CalloutType::Caution,
            _ => return None,
        };

        Some((callout, remainder))
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            CalloutType::Note => "note",
            CalloutType::Tip => "tip",
            CalloutType::Important => "important",
            CalloutType::Warning => "warning",
            CalloutType::Caution => "caution",
        }
    }

    pub fn title_es(&self) -> &'static str {
        match self {
            CalloutType::Note => "Nota",
            CalloutType::Tip => "Consejo",
            CalloutType::Important => "Importante",
            CalloutType::Warning => "Advertencia",
            CalloutType::Caution => "Precaución",
        }
    }

    pub fn icon_svg(&self) -> &'static str {
        match self {
            CalloutType::Note => r#"<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>"#,
            CalloutType::Tip => r#"<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="M2 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M12 18v4"/><path d="m19.07 19.07-2.83-2.83"/><path d="M20 12h-4"/><path d="m19.07 4.93-2.83 2.83"/><circle cx="12" cy="12" r="4"/></svg>"#,
            CalloutType::Important => r#"<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20"/><path d="m17 5-5-3-5 3v6c0 5.25 3.5 10 5 11 1.5-1 5-5.75 5-11V5z"/></svg>"#,
            CalloutType::Warning => r#"<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>"#,
            CalloutType::Caution => r#"<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>"#,
        }
    }
}

/// Detecta si una secuencia de eventos inicial de un blockquote corresponde a un callout.
pub fn detect_callout<'a>(events: &[Event<'a>]) -> Option<(CalloutType, usize)> {
    if events.is_empty() {
        return None;
    }

    let mut idx = 0;
    let has_para = matches!(&events[0], Event::Start(Tag::Paragraph));
    if has_para {
        idx += 1;
    }

    let mut accumulated = String::new();
    let mut consumed = 0;

    while idx < events.len() {
        match &events[idx] {
            Event::Text(t) => {
                accumulated.push_str(t);
                consumed += 1;
                idx += 1;
                if accumulated.contains(']') {
                    break;
                }
            }
            _ => break,
        }
    }

    let (callout_type, _remainder) = CalloutType::parse(&accumulated)?;

    // Consumir también salto de línea posterior inmediato
    if idx < events.len() && matches!(&events[idx], Event::SoftBreak | Event::HardBreak) {
        consumed += 1;
    }

    Some((callout_type, if has_para { consumed + 1 } else { consumed }))
}

/// Transforma el flujo de eventos sustituyendo blockquotes de advertencia por contenedores enriquecidos.
pub fn transform_callouts<'a>(events: Vec<Event<'a>>) -> Vec<Event<'a>> {
    let mut result = Vec::with_capacity(events.len());
    let mut i = 0;
    let mut callout_depth = 0;

    while i < events.len() {
        if let Event::Start(Tag::BlockQuote(_)) = &events[i] {
            if let Some((callout, advance)) = detect_callout(&events[i + 1..]) {
                callout_depth += 1;
                let header_html = format!(
                    r#"<div class="mdcat-callout" data-callout="{}"><div class="mdcat-callout-header"><span class="mdcat-callout-icon">{}</span><span class="mdcat-callout-title">{}</span></div><div class="mdcat-callout-body"><p>"#,
                    callout.as_str(),
                    callout.icon_svg(),
                    callout.title_es()
                );
                result.push(Event::Html(header_html.into()));
                i += 1 + advance;
                continue;
            }
        } else if let Event::End(TagEnd::BlockQuote(_)) = &events[i] {
            if callout_depth > 0 {
                callout_depth -= 1;
                result.push(Event::Html("</div></div>".into()));
                i += 1;
                continue;
            }
        }
        result.push(events[i].clone());
        i += 1;
    }

    result
}
