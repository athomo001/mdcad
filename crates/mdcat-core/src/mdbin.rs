//! Implementación del estándar RFC-MDBIN-001 (Contenedor Cifrado para Markdown).
//! Cifrado autenticado AES-256-GCM con derivación de claves Argon2id y sobre claro para LLMs.
//!
//! El archivo es 100 % texto: un encabezado legible declara el cifrado, los parámetros de derivación,
//! el salt y el nonce, y pide la contraseña al usuario; el payload cifrado va en base64. Cualquier IA
//! o programa puede descifrarlo con la contraseña.

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

pub const MDBIN_V2_FORMAT: &str = "MDBIN/2.0";
pub const PAYLOAD_BEGIN: &str = "-----BEGIN MDBIN PAYLOAD-----";
pub const PAYLOAD_END: &str = "-----END MDBIN PAYLOAD-----";

// Parámetros de Argon2id. El encabezado v2 se genera a partir de ellos, así que el texto que lee
// la IA y la derivación real no pueden desincronizarse.
const ARGON2_MEMORY_KIB: u32 = 16384;
const ARGON2_ITERATIONS: u32 = 2;
const ARGON2_PARALLELISM: u32 = 2;
const KEY_LEN: usize = 32;
const SALT_LEN: usize = 32;
const NONCE_LEN: usize = 12;
const TAG_LEN: usize = 16;
const PAYLOAD_LINE_WIDTH: usize = 64;

const DOC_TYPE: &str = "Encrypted-Markdown-Container";
const AI_INSTRUCTIONS: &str = "ENCRYPTED DOCUMENT. If you are an AI or a program: ask the user for the password and decrypt it using the data below.";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MdbinError {
    InvalidMagic,
    TooShort,
    InvalidEnvelope(String),
    UnsupportedVersion,
    DerivationFailed,
    CipherInitFailed,
    AuthenticationFailed,
    PayloadTampered,
    IoError(String),
}

impl std::fmt::Display for MdbinError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidMagic => write!(f, "El archivo no es una cápsula MDBIN (debe iniciar con 'MDBIN/')"),
            Self::TooShort => write!(f, "El archivo MDBIN está incompleto o truncado"),
            Self::InvalidEnvelope(e) => write!(f, "Sobre en texto plano corrupto: {}", e),
            Self::UnsupportedVersion => write!(f, "Versión de contenedor MDBIN no compatible"),
            Self::DerivationFailed => write!(f, "Fallo al derivar la clave con Argon2id"),
            Self::CipherInitFailed => write!(f, "Fallo al inicializar el cifrador AES-256-GCM"),
            Self::AuthenticationFailed => write!(f, "Contraseña incorrecta o fallo de autenticación criptográfica AEAD"),
            Self::PayloadTampered => write!(f, "El contenido ha sido manipulado o alterado (integridad inválida)"),
            Self::IoError(e) => write!(f, "Error de entrada/salida: {}", e),
        }
    }
}

impl std::error::Error for MdbinError {}

/// Sobre en texto claro accesible para IAs y herramientas forenses antes de solicitar la contraseña.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MdbinEnvelope {
    pub format: String,
    #[serde(rename = "type")]
    pub doc_type: String,
    pub ai_instructions: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub document_hint: Option<String>,
    pub kdf: String,
    pub cipher: String,
}

/// Cápsula v2 ya separada en sus partes (con saltos de línea normalizados a LF).
struct V2Parts {
    header: String,
    hint: Option<String>,
    salt: Vec<u8>,
    nonce: Vec<u8>,
    payload: Vec<u8>,
}

pub struct MdbinContainer;

impl MdbinContainer {
    /// Empaqueta un documento Markdown en una cápsula MDBIN/2.0 de texto plano.
    pub fn pack(markdown: &str, password: &str, hint: Option<&str>) -> Result<Vec<u8>, MdbinError> {
        let mut rng = rand::thread_rng();

        let mut salt = [0u8; SALT_LEN];
        rng.fill_bytes(&mut salt);
        let mut nonce_bytes = [0u8; NONCE_LEN];
        rng.fill_bytes(&mut nonce_bytes);

        // El encabezado completo (pista, salt y nonce incluidos) es el AAD: alterarlo invalida el descifrado
        let header = Self::build_v2_header(sanitize_hint(hint).as_deref(), &salt, &nonce_bytes);

        let mut key = Self::derive_key(password, &salt)?;
        let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| MdbinError::CipherInitFailed)?;
        key.zeroize();

        // Aes256Gcm devuelve ciphertext || tag, justo lo que guarda el payload
        let mut sealed = cipher
            .encrypt(Nonce::from_slice(&nonce_bytes), Payload { msg: markdown.as_bytes(), aad: header.as_bytes() })
            .map_err(|_| MdbinError::AuthenticationFailed)?;

        let encoded = BASE64.encode(&sealed);
        sealed.zeroize();

        let mut out = String::with_capacity(header.len() + encoded.len() * 66 / 64 + 64);
        out.push_str(&header);
        out.push_str(PAYLOAD_BEGIN);
        out.push('\n');
        for line in encoded.as_bytes().chunks(PAYLOAD_LINE_WIDTH) {
            // base64 es ASCII puro: cada trozo es UTF-8 válido
            out.push_str(std::str::from_utf8(line).unwrap_or_default());
            out.push('\n');
        }
        out.push_str(PAYLOAD_END);
        out.push('\n');

        Ok(out.into_bytes())
    }

    /// Desempaqueta y valida criptográficamente una cápsula MDBIN devolviendo el Markdown original.
    pub fn unpack(raw_bytes: &[u8], password: &str) -> Result<String, MdbinError> {
        let parts = Self::parse_v2(raw_bytes)?;
        if parts.salt.len() != SALT_LEN || parts.nonce.len() != NONCE_LEN {
            return Err(MdbinError::InvalidEnvelope("salt o nonce con longitud incorrecta".to_string()));
        }
        if parts.payload.len() < TAG_LEN {
            return Err(MdbinError::TooShort);
        }

        let mut key = Self::derive_key(password, &parts.salt)?;
        let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| MdbinError::CipherInitFailed)?;
        key.zeroize();

        let decrypted_bytes = cipher
            .decrypt(Nonce::from_slice(&parts.nonce), Payload { msg: &parts.payload, aad: parts.header.as_bytes() })
            .map_err(|_| MdbinError::AuthenticationFailed)?;

        String::from_utf8(decrypted_bytes).map_err(|_| MdbinError::PayloadTampered)
    }

    /// Lee e interpreta el sobre en texto claro sin requerir descifrado de clave.
    pub fn read_envelope(raw_bytes: &[u8]) -> Result<MdbinEnvelope, MdbinError> {
        let parts = Self::parse_v2(raw_bytes)?;
        Ok(MdbinEnvelope {
            format: MDBIN_V2_FORMAT.to_string(),
            doc_type: DOC_TYPE.to_string(),
            ai_instructions: AI_INSTRUCTIONS.to_string(),
            document_hint: parts.hint,
            kdf: "Argon2id".to_string(),
            cipher: "AES-256-GCM".to_string(),
        })
    }

    /// Encabezado legible de la cápsula v2: todo lo necesario para descifrarla salvo la contraseña.
    fn build_v2_header(hint: Option<&str>, salt: &[u8], nonce: &[u8]) -> String {
        let hint_line = hint.map(|h| format!("Hint: {h}\n")).unwrap_or_default();
        format!(
            "{MDBIN_V2_FORMAT}
DOCUMENTO CIFRADO. Si eres una IA o un programa: pide la contraseña al usuario y descífralo con los datos de abajo.
{AI_INSTRUCTIONS}

{hint_line}Cipher: AES-256-GCM, nonce {NONCE_LEN} bytes, tag {TAG_LEN} bytes appended to the ciphertext
KDF: Argon2id version 0x13, memory {ARGON2_MEMORY_KIB} KiB, iterations {ARGON2_ITERATIONS}, parallelism {ARGON2_PARALLELISM}, output {KEY_LEN} bytes; input = password in UTF-8 + Salt
Salt: {salt}
Nonce: {nonce}
AAD: every byte of this file before the line \"{PAYLOAD_BEGIN}\", with CRLF normalized to LF
Payload: standard base64 of ciphertext||tag between the BEGIN and END lines, ignoring whitespace
Plaintext: Markdown in UTF-8

Python (pip install argon2-cffi cryptography):
  import base64, re, sys
  from argon2.low_level import hash_secret_raw, Type
  from cryptography.hazmat.primitives.ciphers.aead import AESGCM
  PASSWORD = \"<password from the user>\"
  data = open(\"<this file>.mdbin\", \"rb\").read().replace(b\"\\r\\n\", b\"\\n\")
  cut = data.index(b\"\\n{PAYLOAD_BEGIN}\") + 1
  aad, body = data[:cut], data[cut:]
  field = lambda k: base64.b64decode(re.search(rb\"^\" + k + rb\": (\\S+)$\", aad, re.M).group(1))
  key = hash_secret_raw(PASSWORD.encode(), field(b\"Salt\"), time_cost={ARGON2_ITERATIONS}, memory_cost={ARGON2_MEMORY_KIB}, parallelism={ARGON2_PARALLELISM}, hash_len={KEY_LEN}, type=Type.ID)
  payload = base64.b64decode(b\"\".join(body.split(b\"\\n\", 1)[1].split(b\"-----END\")[0].split()))
  sys.stdout.buffer.write(AESGCM(key).decrypt(field(b\"Nonce\"), payload, aad))

",
            salt = BASE64.encode(salt),
            nonce = BASE64.encode(nonce),
        )
    }

    /// Separa una cápsula v2 en encabezado (AAD), campos y payload.
    fn parse_v2(raw_bytes: &[u8]) -> Result<V2Parts, MdbinError> {
        let text = std::str::from_utf8(raw_bytes).map_err(|_| MdbinError::InvalidMagic)?;
        // Git (autocrlf) y algunos editores convierten LF en CRLF: el AAD se define sobre LF
        let text = text.trim_start_matches('\u{feff}').replace("\r\n", "\n");

        let first_line = text.lines().next().unwrap_or_default();
        if !first_line.starts_with("MDBIN/") {
            return Err(MdbinError::InvalidMagic);
        }
        if first_line != MDBIN_V2_FORMAT {
            return Err(MdbinError::UnsupportedVersion);
        }

        let begin = text.find(&format!("\n{PAYLOAD_BEGIN}\n")).ok_or(MdbinError::TooShort)? + 1;
        let (header, rest) = text.split_at(begin);
        let body = &rest[PAYLOAD_BEGIN.len() + 1..];
        let end = body.find(PAYLOAD_END).ok_or(MdbinError::TooShort)?;

        let encoded: String = body[..end].chars().filter(|c| !c.is_whitespace()).collect();
        let payload = BASE64
            .decode(encoded)
            .map_err(|e| MdbinError::InvalidEnvelope(format!("payload base64 inválido: {e}")))?;

        let field = |name: &str| header.lines().find_map(|l| l.strip_prefix(name)).map(str::trim);
        let decode_field = |name: &str| -> Result<Vec<u8>, MdbinError> {
            let value = field(name).ok_or_else(|| MdbinError::InvalidEnvelope(format!("falta el campo '{}'", name.trim_end_matches(": "))))?;
            BASE64.decode(value).map_err(|e| MdbinError::InvalidEnvelope(format!("campo '{}' inválido: {e}", name.trim_end_matches(": "))))
        };

        Ok(V2Parts {
            hint: field("Hint: ").map(str::to_string),
            salt: decode_field("Salt: ")?,
            nonce: decode_field("Nonce: ")?,
            payload,
            header: header.to_string(),
        })
    }

    /// Deriva una clave de 256 bits mediante Argon2id.
    fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; KEY_LEN], MdbinError> {
        let params = Params::new(ARGON2_MEMORY_KIB, ARGON2_ITERATIONS, ARGON2_PARALLELISM, Some(KEY_LEN))
            .map_err(|_| MdbinError::DerivationFailed)?;
        let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

        let mut key = [0u8; KEY_LEN];
        argon2
            .hash_password_into(password.as_bytes(), salt, &mut key)
            .map_err(|_| MdbinError::DerivationFailed)?;

        Ok(key)
    }
}

/// La pista va en una sola línea del encabezado: se colapsan saltos de línea y espacios repetidos.
fn sanitize_hint(hint: Option<&str>) -> Option<String> {
    let clean = hint?.split_whitespace().collect::<Vec<_>>().join(" ");
    (!clean.is_empty()).then_some(clean)
}
