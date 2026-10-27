//! Lectura y escritura de archivos de texto plano en distintas codificaciones.
//!
//! Al abrir se detecta la codificación (BOM, UTF-8 estricto y, si no, estimación estadística con
//! `chardetng`), y al guardar se respeta la que tenga el documento. Los identificadores de
//! codificación son los nombres canónicos de `encoding_rs`, más [`UTF8_BOM`] para UTF-8 con BOM.

use encoding_rs::{Encoding, UTF_16BE, UTF_16LE, UTF_8};
use serde::Serialize;

/// Identificador de UTF-8 con marca de orden de bytes (BOM).
pub const UTF8_BOM: &str = "UTF-8 BOM";

/// Bytes revisados para decidir si un archivo es binario.
const SNIFF_LEN: usize = 8192;
const BOM_UTF8: [u8; 3] = [0xEF, 0xBB, 0xBF];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TextError {
    /// El archivo contiene bytes nulos y no tiene BOM de UTF-16: no es texto plano.
    Binary,
    UnknownEncoding(String),
    /// El texto tiene un carácter que no existe en la codificación de destino.
    Unrepresentable { encoding: String, character: char },
}

impl std::fmt::Display for TextError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Binary => write!(f, "no es un archivo de texto"),
            Self::UnknownEncoding(e) => write!(f, "codificación desconocida: {}", e),
            Self::Unrepresentable { encoding, character } => write!(
                f,
                "el carácter '{}' no existe en {}; guarda el documento en UTF-8",
                character, encoding
            ),
        }
    }
}

impl std::error::Error for TextError {}

/// Texto decodificado junto con la codificación con la que se leyó.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DecodedText {
    pub text: String,
    pub encoding: String,
}

/// Decodifica bytes de un archivo. Sin `encoding` se detecta; con ella se fuerza (útil para
/// "reabrir con codificación" cuando la detección se equivoca).
pub fn decode(bytes: &[u8], encoding: Option<&str>) -> Result<DecodedText, TextError> {
    match encoding {
        Some(label) => decode_as(bytes, label),
        None => detect_and_decode(bytes),
    }
}

/// Codifica el texto para guardarlo en disco con la codificación indicada.
pub fn encode(text: &str, encoding: &str) -> Result<Vec<u8>, TextError> {
    let (enc, with_bom) = resolve(encoding)?;

    if enc == UTF_8 {
        let mut out = Vec::with_capacity(text.len() + 3);
        if with_bom {
            out.extend_from_slice(&BOM_UTF8);
        }
        out.extend_from_slice(text.as_bytes());
        return Ok(out);
    }

    // encoding_rs solo decodifica UTF-16 (su codificador emite UTF-8), así que se arma a mano con BOM
    if enc == UTF_16LE || enc == UTF_16BE {
        let little = enc == UTF_16LE;
        let mut out = Vec::with_capacity(2 + text.len() * 2);
        out.extend_from_slice(if little { &[0xFF, 0xFE] } else { &[0xFE, 0xFF] });
        for unit in text.encode_utf16() {
            out.extend_from_slice(&if little { unit.to_le_bytes() } else { unit.to_be_bytes() });
        }
        return Ok(out);
    }

    // En codificaciones heredadas encoding_rs reemplaza lo no representable por entidades HTML
    // (`&#128512;`), lo que corrompería el archivo en silencio: se rechaza en su lugar
    let (bytes, _, had_errors) = enc.encode(text);
    if had_errors {
        let mut buf = [0u8; 4];
        let character = text
            .chars()
            .find(|c| enc.encode(c.encode_utf8(&mut buf)).2)
            .unwrap_or(char::REPLACEMENT_CHARACTER);
        return Err(TextError::Unrepresentable { encoding: enc.name().to_string(), character });
    }
    Ok(bytes.into_owned())
}

fn detect_and_decode(bytes: &[u8]) -> Result<DecodedText, TextError> {
    if let Some((enc, bom_len)) = Encoding::for_bom(bytes) {
        let (text, _) = enc.decode_without_bom_handling(&bytes[bom_len..]);
        let encoding = if enc == UTF_8 { UTF8_BOM.to_string() } else { enc.name().to_string() };
        return Ok(DecodedText { text: text.into_owned(), encoding });
    }

    if bytes[..bytes.len().min(SNIFF_LEN)].contains(&0) {
        return Err(TextError::Binary);
    }

    if let Ok(text) = std::str::from_utf8(bytes) {
        return Ok(DecodedText { text: text.to_string(), encoding: UTF_8.name().to_string() });
    }

    // No es UTF-8 válido: típicamente Windows-1252 en archivos antiguos de Windows en español
    let mut detector = chardetng::EncodingDetector::new();
    detector.feed(bytes, true);
    let enc = detector.guess(None, true);
    let (text, _) = enc.decode_without_bom_handling(bytes);
    Ok(DecodedText { text: text.into_owned(), encoding: enc.name().to_string() })
}

fn decode_as(bytes: &[u8], label: &str) -> Result<DecodedText, TextError> {
    let (enc, with_bom) = resolve(label)?;
    // Si el archivo trae la BOM de la codificación elegida, no forma parte del texto
    let body = match Encoding::for_bom(bytes) {
        Some((bom_enc, len)) if bom_enc == enc => &bytes[len..],
        _ => bytes,
    };
    let (text, _) = enc.decode_without_bom_handling(body);
    let encoding = if with_bom { UTF8_BOM.to_string() } else { enc.name().to_string() };
    Ok(DecodedText { text: text.into_owned(), encoding })
}

fn resolve(label: &str) -> Result<(&'static Encoding, bool), TextError> {
    if label == UTF8_BOM {
        return Ok((UTF_8, true));
    }
    Encoding::for_label(label.as_bytes())
        .map(|enc| (enc, false))
        .ok_or_else(|| TextError::UnknownEncoding(label.to_string()))
}
