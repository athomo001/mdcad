//! Pruebas de lectura y escritura de texto plano en distintas codificaciones.

use mdcat_core::text::{decode, encode, TextError, UTF8_BOM};

const SPANISH: &str = "La canción del ñandú: él comió piñas en el año pasado y después durmió en la montaña.";

#[test]
fn test_plain_utf8_is_detected_and_round_trips() {
    let decoded = decode(SPANISH.as_bytes(), None).expect("UTF-8 válido");
    assert_eq!(decoded.encoding, "UTF-8");
    assert_eq!(decoded.text, SPANISH);
    assert_eq!(encode(&decoded.text, &decoded.encoding).unwrap(), SPANISH.as_bytes());
}

#[test]
fn test_utf8_bom_is_stripped_on_read_and_restored_on_save() {
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice(SPANISH.as_bytes());

    let decoded = decode(&bytes, None).unwrap();
    assert_eq!(decoded.encoding, UTF8_BOM);
    assert_eq!(decoded.text, SPANISH, "La BOM no debe aparecer como carácter en el texto");
    assert_eq!(encode(&decoded.text, &decoded.encoding).unwrap(), bytes);
}

#[test]
fn test_utf16le_with_bom_round_trips() {
    let bytes = encode(SPANISH, "UTF-16LE").unwrap();
    assert_eq!(&bytes[..2], &[0xFF, 0xFE]);

    let decoded = decode(&bytes, None).expect("UTF-16 con BOM no es binario aunque tenga bytes nulos");
    assert_eq!(decoded.encoding, "UTF-16LE");
    assert_eq!(decoded.text, SPANISH);
}

#[test]
fn test_windows_1252_file_is_detected_instead_of_failing() {
    let bytes = encode(SPANISH, "windows-1252").unwrap();
    assert!(std::str::from_utf8(&bytes).is_err(), "Precondición: el archivo no es UTF-8");

    let decoded = decode(&bytes, None).expect("Un .txt de Windows en español debe abrir");
    assert_eq!(decoded.encoding, "windows-1252");
    assert_eq!(decoded.text, SPANISH);
}

#[test]
fn test_forced_encoding_reinterprets_the_bytes() {
    let bytes = SPANISH.as_bytes();
    let as_latin = decode(bytes, Some("windows-1252")).unwrap();
    assert_eq!(as_latin.encoding, "windows-1252");
    assert!(as_latin.text.contains("Ã±"), "UTF-8 leído como Windows-1252 produce mojibake");

    let back = decode(bytes, Some("UTF-8")).unwrap();
    assert_eq!(back.text, SPANISH);
}

#[test]
fn test_binary_files_are_rejected() {
    let png_like = [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D];
    assert_eq!(decode(&png_like, None), Err(TextError::Binary));
}

#[test]
fn test_unrepresentable_character_is_an_error_not_an_html_entity() {
    let result = encode("Hola 😀", "windows-1252");
    assert_eq!(
        result,
        Err(TextError::Unrepresentable { encoding: "windows-1252".to_string(), character: '😀' })
    );
}

#[test]
fn test_unknown_encoding_label_is_rejected() {
    assert!(matches!(decode(b"x", Some("klingon-8")), Err(TextError::UnknownEncoding(_))));
    assert!(matches!(encode("x", "klingon-8"), Err(TextError::UnknownEncoding(_))));
}
