//! toc.rs - Extracción jerárquica y generación de Tabla de Contenidos.

use serde::{Deserialize, Serialize};

/// Nivel de encabezado jerárquico (h1 a h6).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum HeadingLevel {
    H1 = 1,
    H2 = 2,
    H3 = 3,
    H4 = 4,
    H5 = 5,
    H6 = 6,
}

impl HeadingLevel {
    pub fn from_u32(level: u32) -> Self {
        match level {
            1 => HeadingLevel::H1,
            2 => HeadingLevel::H2,
            3 => HeadingLevel::H3,
            4 => HeadingLevel::H4,
            5 => HeadingLevel::H5,
            _ => HeadingLevel::H6,
        }
    }
}

/// Nodo individual en la jerarquía de la Tabla de Contenidos.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TocItem {
    pub id: String,
    pub level: HeadingLevel,
    pub text: String,
    pub line_number: usize,
    pub children: Vec<TocItem>,
}

impl TocItem {
    pub fn new(id: String, level: HeadingLevel, text: String, line_number: usize) -> Self {
        Self {
            id,
            level,
            text,
            line_number,
            children: Vec::new(),
        }
    }
}

/// Normaliza un texto de encabezado en un slug apto para identificadores URL y anclajes HTML.
pub fn slugify(text: &str) -> String {
    let mut slug = String::with_capacity(text.len());
    let mut prev_dash = false;

    for c in text.chars() {
        if c.is_alphanumeric() {
            for lower in c.to_lowercase() {
                slug.push(lower);
            }
            prev_dash = false;
        } else if (c.is_whitespace() || c == '-' || c == '_') && !prev_dash && !slug.is_empty() {
            slug.push('-');
            prev_dash = true;
        }
    }

    if slug.ends_with('-') {
        slug.pop();
    }

    if slug.is_empty() {
        "seccion".to_string()
    } else {
        slug
    }
}

/// Convierte una lista plana de encabezados en un árbol anidado jerárquico.
pub fn build_toc_tree(flat_items: Vec<TocItem>) -> Vec<TocItem> {
    let mut root_items: Vec<TocItem> = Vec::new();

    for item in flat_items {
        insert_into_tree(&mut root_items, item);
    }

    root_items
}

fn insert_into_tree(tree: &mut Vec<TocItem>, item: TocItem) {
    if let Some(last) = tree.last_mut() {
        if item.level > last.level {
            insert_into_tree(&mut last.children, item);
            return;
        }
    }
    tree.push(item);
}
