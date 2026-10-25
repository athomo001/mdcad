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

    // Verificar que comience con los magic bytes "MDB1"
    assert_eq!(&packed_bytes[0..4], b"MDB1");

    // 2. Leer sobre en texto claro para IA sin necesidad de clave
    let envelope = MdbinContainer::read_envelope(&packed_bytes)
        .expect("La lectura del sobre en texto claro debe funcionar de inmediato");
    assert_eq!(envelope.format, "MDBIN/1.0");
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

    // Alteramos un solo bit en la sección del payload
    let last_idx = packed_bytes.len() - 1;
    packed_bytes[last_idx] ^= 0x01;

    let result = MdbinContainer::unpack(&packed_bytes, password);
    assert!(result.is_err(), "La alteración de un solo bit debe invalidar el Auth Tag de inmediato");
}
