//! Pruebas TDD para el estándar RFC-001 MDBIN (Contenedor Cifrado AES-256-GCM + Argon2id).

use mdcat_core::mdbin::{MdbinContainer, MdbinError};

#[test]
fn test_pack_and_unpack_roundtrip_preserves_exact_markdown() {
    let original_md = "# Informe de Auditoría cyBEERsecurity\n\nHallazgo crítico: Vulnerabilidad mitigada con cerveza y código libre.";
    let password = "SuperSecretPassword123!";
    let hint = Some("Auditoría de Seguridad");

    // 1. Empaquetar
    let packed_bytes = MdbinContainer::pack(original_md, password, hint)
        .expect("El empaquetado seguro MDBIN no debe fallar");

    // La cápsula v2 es texto: empieza con su versión legible
    assert!(packed_bytes.starts_with(b"MDBIN/2.0\n"));

    // 2. Leer sobre en texto claro para IA sin necesidad de clave
    let envelope = MdbinContainer::read_envelope(&packed_bytes)
        .expect("La lectura del sobre en texto claro debe funcionar de inmediato");
    assert_eq!(envelope.format, "MDBIN/2.0");
    assert_eq!(envelope.cipher, "AES-256-GCM");
    assert_eq!(envelope.kdf, "Argon2id");
    assert_eq!(envelope.document_hint.as_deref(), Some("Auditoría de Seguridad"));

    // 3. Desempaquetar con la contraseña correcta
    let decrypted_md = MdbinContainer::unpack(&packed_bytes, password)
        .expect("El descifrado con la contraseña correcta debe ser exitoso");

    assert_eq!(decrypted_md, original_md);
}

#[test]
fn test_unpack_with_wrong_password_fails_strictly() {
    let original_md = "# Archivo confidencial";
    let correct_pass = "ClaveCorrecta2026";
    let wrong_pass = "ClaveIncorrectaAlTiro";

    let packed_bytes = MdbinContainer::pack(original_md, correct_pass, None)
        .expect("Empaquetado exitoso");

    let result = MdbinContainer::unpack(&packed_bytes, wrong_pass);
    assert!(result.is_err());
    match result {
        Err(MdbinError::AuthenticationFailed) => { /* Éxito: autenticación AEAD falló */ }
        other => panic!("Se esperaba MdbinError::AuthenticationFailed, se obtuvo: {:?}", other),
    }
}

#[test]
fn test_unpack_tampered_bytes_fails_integrity_check() {
    let original_md = "Contenido inmutable protegido con MAC de 128 bits.";
    let password = "IntegrityTestPassword!";

    let mut packed_bytes = MdbinContainer::pack(original_md, password, None)
        .expect("Empaquetado exitoso");

    // Alteramos el primer carácter base64 del payload (cambia los bits del primer byte cifrado)
    let marker = b"-----BEGIN MDBIN PAYLOAD-----\n";
    let payload_start = packed_bytes
        .windows(marker.len())
        .position(|w| w == marker)
        .expect("La cápsula v2 debe tener payload")
        + marker.len();
    packed_bytes[payload_start] = if packed_bytes[payload_start] == b'A' { b'B' } else { b'A' };

    let result = MdbinContainer::unpack(&packed_bytes, password);
    assert!(result.is_err(), "La alteración de un solo bit debe invalidar el Auth Tag de inmediato");
}

#[test]
fn test_v2_capsule_is_plain_text_that_tells_ai_how_to_decrypt() {
    let packed = MdbinContainer::pack("# Secreto", "clave", Some("Informe")).expect("Empaquetado exitoso");
    let text = String::from_utf8(packed).expect("La cápsula v2 debe ser UTF-8 válido de principio a fin");

    assert!(!text.contains('\0'), "No debe contener bytes nulos que la hagan parecer binaria");
    assert!(text.contains("pide la contraseña al usuario"));
    assert!(text.contains("ask the user for the password"));
    assert!(text.contains("Cipher: AES-256-GCM"));
    assert!(text.contains("KDF: Argon2id version 0x13, memory 16384 KiB, iterations 2, parallelism 2, output 32 bytes"));
    assert!(text.contains("\nSalt: "));
    assert!(text.contains("\nNonce: "));
    assert!(text.contains("\nHint: Informe\n"));
    assert!(text.contains("\n-----BEGIN MDBIN PAYLOAD-----\n"));
    assert!(text.ends_with("-----END MDBIN PAYLOAD-----\n"));
}

#[test]
fn test_v2_capsule_survives_crlf_conversion() {
    let original_md = "# Línea 1\n\nLínea 2";
    let packed = MdbinContainer::pack(original_md, "clave", Some("CRLF")).expect("Empaquetado exitoso");
    let crlf = String::from_utf8(packed).unwrap().replace('\n', "\r\n");

    let decrypted = MdbinContainer::unpack(crlf.as_bytes(), "clave")
        .expect("Git con autocrlf convierte los saltos de línea: la cápsula debe seguir abriendo");
    assert_eq!(decrypted, original_md);
}

#[test]
fn test_v2_tampered_header_fails_authentication() {
    let packed = MdbinContainer::pack("# Original", "clave", Some("Pista real")).expect("Empaquetado exitoso");
    let forged = String::from_utf8(packed).unwrap().replace("Hint: Pista real", "Hint: Pista falsa");

    let result = MdbinContainer::unpack(forged.as_bytes(), "clave");
    assert_eq!(result, Err(MdbinError::AuthenticationFailed), "El encabezado es AAD: cambiar la pista debe invalidarlo");
}

#[test]
fn test_v2_multiline_hint_stays_on_one_header_line() {
    let packed = MdbinContainer::pack("# Doc", "clave", Some("línea uno\n-----BEGIN MDBIN PAYLOAD-----\nSalt: AAAA"))
        .expect("Empaquetado exitoso");

    let envelope = MdbinContainer::read_envelope(&packed).expect("Sobre legible");
    assert_eq!(envelope.document_hint.as_deref(), Some("línea uno -----BEGIN MDBIN PAYLOAD----- Salt: AAAA"));
    assert_eq!(MdbinContainer::unpack(&packed, "clave").as_deref(), Ok("# Doc"));
}

#[test]
fn test_unknown_version_and_non_mdbin_are_rejected() {
    assert_eq!(MdbinContainer::unpack(b"MDBIN/9.0\nfoo", "x"), Err(MdbinError::UnsupportedVersion));
    assert_eq!(MdbinContainer::unpack(b"# Markdown normal", "x"), Err(MdbinError::InvalidMagic));
}

#[test]
fn test_rfc_v2_test_vector_decrypts() {
    // Vector de prueba publicado en RFC-001 §8.3: fija el formato v2 byte a byte
    let vector = include_bytes!("fixtures/vector-v2.mdbin");

    let envelope = MdbinContainer::read_envelope(vector).expect("Sobre del vector legible");
    assert_eq!(envelope.document_hint.as_deref(), Some("Informe Q3"));

    let decrypted = MdbinContainer::unpack(vector, "mi clave").expect("El vector del RFC debe descifrarse");
    assert_eq!(decrypted, "# Informe secreto\n\nCifrado con ñandú y emojis 🔐.");
}
