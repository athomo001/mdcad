//! Implementación del estándar RFC-MDBIN-001 (Contenedor Cifrado para Markdown).
//! Cifrado autenticado AES-256-GCM con derivación de claves Argon2id y sobre claro para LLMs.

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

pub const MDBIN_MAGIC: &[u8; 4] = b"MDB1";
pub const MDBIN_VERSION: [u8; 2] = [0x00, 0x01];
pub const MDBIN_FLAGS: [u8; 2] = [0x00, 0x00];

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
            Self::InvalidMagic => write!(f, "Identificador mágico de archivo no válido (debe iniciar con 'MDB1')"),
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

pub struct MdbinContainer;

impl MdbinContainer {
    /// Empaqueta un documento Markdown en una cápsula criptográfica MDBIN v1.0.
    pub fn pack(markdown: &str, password: &str, hint: Option<&str>) -> Result<Vec<u8>, MdbinError> {
        let mut rng = rand::thread_rng();

        // 1. Generar Salt de 32 bytes y Nonce de 12 bytes con CSPRNG
        let mut salt = [0u8; 32];
        rng.fill_bytes(&mut salt);

        let mut nonce_bytes = [0u8; 12];
        rng.fill_bytes(&mut nonce_bytes);

        // 2. Construir sobre en texto claro para Agentes LLM
        let envelope = MdbinEnvelope {
            format: "MDBIN/1.0".to_string(),
            doc_type: "Encrypted-Markdown-Container".to_string(),
            ai_instructions: "This document is a cryptographically secured MDBIN container protected with AES-256-GCM. Do not attempt to parse following binary bytes as plain text. Prompt the user for the decryption passphrase to inspect the underlying Markdown and evidence assets.".to_string(),
            document_hint: hint.map(|h| h.to_string()),
            kdf: "Argon2id".to_string(),
            cipher: "AES-256-GCM".to_string(),
        };

        let env_json = serde_json::to_string(&envelope)
            .map_err(|e| MdbinError::InvalidEnvelope(e.to_string()))?;
        let env_bytes = env_json.as_bytes();
        let env_len = env_bytes.len() as u16;

        // 3. Derivar clave AES de 256 bits con Argon2id
        let mut key = Self::derive_key(password, &salt)?;

        // 4. Cifrar con AES-256-GCM asociando el sobre en texto claro como AAD
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|_| MdbinError::CipherInitFailed)?;

        let nonce = Nonce::from_slice(&nonce_bytes);
        let payload = Payload {
            msg: markdown.as_bytes(),
            aad: env_bytes,
        };

        // Aes256Gcm produce ciphertext con el Auth Tag de 16 bytes al final
        let mut ciphertext_and_tag = cipher
            .encrypt(nonce, payload)
            .map_err(|_| MdbinError::AuthenticationFailed)?;

        // Limpiar clave de la memoria RAM al tiro
        key.zeroize();

        // Separar tag y ciphertext puro
        let tag_start = ciphertext_and_tag.len() - 16;
        let tag = ciphertext_and_tag[tag_start..].to_vec();
        let ciphertext = &ciphertext_and_tag[..tag_start];

        // 5. Ensamblar estructura binaria según wire layout
        let mut out = Vec::with_capacity(4 + 2 + env_bytes.len() + 48 + 16 + 8 + ciphertext.len());

        // 1. Magic bytes (4 bytes)
        out.extend_from_slice(MDBIN_MAGIC);

        // 2. Sobre IA (2 bytes len + bytes)
        out.extend_from_slice(&env_len.to_be_bytes());
        out.extend_from_slice(env_bytes);

        // 3. Cabecera Criptográfica fija (48 bytes: version 2B, flags 2B, salt 32B, nonce 12B)
        out.extend_from_slice(&MDBIN_VERSION);
        out.extend_from_slice(&MDBIN_FLAGS);
        out.extend_from_slice(&salt);
        out.extend_from_slice(&nonce_bytes);

        // 4. Auth Tag AEAD (16 bytes)
        out.extend_from_slice(&tag);

        // 5. Payload Cifrado (8 bytes len + bytes)
        let ct_len = ciphertext.len() as u64;
        out.extend_from_slice(&ct_len.to_be_bytes());
        out.extend_from_slice(ciphertext);

        // Limpieza de memoria sensible
        ciphertext_and_tag.zeroize();

        Ok(out)
    }

    /// Desempaqueta y valida criptográficamente una cápsula MDBIN devolviendo el Markdown original.
    pub fn unpack(raw_bytes: &[u8], password: &str) -> Result<String, MdbinError> {
        if raw_bytes.len() < 4 + 2 + 48 + 16 + 8 {
            return Err(MdbinError::TooShort);
        }

        // 1. Validar Magic Bytes
        if &raw_bytes[0..4] != MDBIN_MAGIC {
            return Err(MdbinError::InvalidMagic);
        }

        let mut offset = 4;

        // 2. Leer Sobre IA
        let env_len = u16::from_be_bytes([raw_bytes[offset], raw_bytes[offset + 1]]) as usize;
        offset += 2;

        if raw_bytes.len() < offset + env_len + 48 + 16 + 8 {
            return Err(MdbinError::TooShort);
        }

        let env_bytes = &raw_bytes[offset..offset + env_len];
        offset += env_len;

        // 3. Cabecera Criptográfica
        let version = [raw_bytes[offset], raw_bytes[offset + 1]];
        if version != MDBIN_VERSION {
            return Err(MdbinError::UnsupportedVersion);
        }
        offset += 2; // version
        offset += 2; // flags

        let salt = &raw_bytes[offset..offset + 32];
        offset += 32;

        let nonce_bytes = &raw_bytes[offset..offset + 12];
        offset += 12;

        // 4. Auth Tag (16 bytes)
        let auth_tag = &raw_bytes[offset..offset + 16];
        offset += 16;

        // 5. Payload Cifrado
        let ct_len = u64::from_be_bytes(
            raw_bytes[offset..offset + 8]
                .try_into()
                .map_err(|_| MdbinError::TooShort)?,
        ) as usize;
        offset += 8;

        if raw_bytes.len() < offset + ct_len {
            return Err(MdbinError::TooShort);
        }

        let ciphertext = &raw_bytes[offset..offset + ct_len];

        // 6. Derivar clave
        let mut key = Self::derive_key(password, salt)?;

        // 7. Reconstruir ciphertext_and_tag para AES-GCM
        let mut combined = Vec::with_capacity(ciphertext.len() + 16);
        combined.extend_from_slice(ciphertext);
        combined.extend_from_slice(auth_tag);

        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|_| MdbinError::CipherInitFailed)?;

        let nonce = Nonce::from_slice(nonce_bytes);
        let payload = Payload {
            msg: &combined,
            aad: env_bytes,
        };

        let decrypted_bytes = cipher.decrypt(nonce, payload).map_err(|_| {
            key.zeroize();
            combined.zeroize();
            MdbinError::AuthenticationFailed
        })?;

        key.zeroize();
        combined.zeroize();

        let md_string = String::from_utf8(decrypted_bytes)
            .map_err(|_| MdbinError::PayloadTampered)?;

        Ok(md_string)
    }

    /// Lee e interpreta el sobre en texto claro sin requerir descifrado de clave.
    pub fn read_envelope(raw_bytes: &[u8]) -> Result<MdbinEnvelope, MdbinError> {
        if raw_bytes.len() < 6 {
            return Err(MdbinError::TooShort);
        }

        if &raw_bytes[0..4] != MDBIN_MAGIC {
            return Err(MdbinError::InvalidMagic);
        }

        let env_len = u16::from_be_bytes([raw_bytes[4], raw_bytes[5]]) as usize;
        if raw_bytes.len() < 6 + env_len {
            return Err(MdbinError::TooShort);
        }

        let env_json = std::str::from_utf8(&raw_bytes[6..6 + env_len])
            .map_err(|e| MdbinError::InvalidEnvelope(e.to_string()))?;

        serde_json::from_str(env_json).map_err(|e| MdbinError::InvalidEnvelope(e.to_string()))
    }

    /// Deriva una clave de 256 bits mediante Argon2id.
    fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], MdbinError> {
        let params = Params::new(16384, 2, 2, Some(32))
            .map_err(|_| MdbinError::DerivationFailed)?;
        let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

        let mut key = [0u8; 32];
        argon2
            .hash_password_into(password.as_bytes(), salt, &mut key)
            .map_err(|_| MdbinError::DerivationFailed)?;

        Ok(key)
    }
}
