//! mdcat-core: Motor de procesamiento y análisis sintáctico de Markdown de alto rendimiento.
//! Diseñado para MDCAT Extended bajo principios de arquitectura zero-copy y seguridad en memoria.

use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, ZeroizeOnDrop};

pub mod callouts;
pub mod mdbin;
pub mod parser;
pub mod security;
pub mod text;
pub mod toc;

pub use mdbin::{MdbinContainer, MdbinEnvelope, MdbinError};
pub use parser::MarkdownEngine;
pub use toc::{HeadingLevel, TocItem};

/// Métricas analíticas de lectura calculadas en tiempo de parseo.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReadingMetrics {
    pub word_count: usize,
    pub character_count: usize,
    pub estimated_minutes: f32,
    pub heading_count: usize,
}

/// Documento completamente procesado listo para ser renderizado por el visor UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessedDocument {
    pub content_hash: String,
    pub frontmatter_json: Option<String>,
    pub toc: Vec<TocItem>,
    pub ast_html: String,
    pub metrics: ReadingMetrics,
}

/// Contenedor de clave criptográfica con borrado seguro automático de RAM al destruirse.
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct SecurePassphrase {
    key_bytes: Vec<u8>,
}

impl SecurePassphrase {
    pub fn new(passphrase: &str) -> Self {
        Self {
            key_bytes: passphrase.as_bytes().to_vec(),
        }
    }

    pub fn as_bytes(&self) -> &[u8] {
        &self.key_bytes
    }
}
