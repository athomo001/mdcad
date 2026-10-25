//! security.rs - Sanitización defensiva y neutralización de vectores de inyección XSS y SSRF.

/// Verifica si un esquema de URI es seguro para navegación o inserción multimedia.
pub fn is_safe_url(url: &str) -> bool {
    let trimmed = url.trim();
    let lower = trimmed.to_lowercase();

    // Bloquear inmediatamente javascript:, data: no-imagen, vbscript:
    if lower.starts_with("javascript:")
        || lower.starts_with("vbscript:")
        || lower.starts_with("data:text/html")
        || lower.starts_with("data:application/")
    {
        return false;
    }

    // Permitir enlaces relativos seguros
    if trimmed.starts_with('/') || trimmed.starts_with('#') || trimmed.starts_with("./") || trimmed.starts_with("../") {
        return true;
    }

    // Protocolos explícitos permitidos
    lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("mailto:")
        || lower.starts_with("data:image/")
}

/// Neutraliza o sanitiza una URL si no es segura.
pub fn sanitize_url(url: &str) -> String {
    if is_safe_url(url) {
        url.to_string()
    } else {
        "#enlace-bloqueado-por-seguridad".to_string()
    }
}

/// Neutraliza fragmentos HTML crudos peligrosos antes de renderizarse.
pub fn sanitize_raw_html(html: &str) -> String {
    let lower = html.to_lowercase();
    if lower.contains("<script")
        || lower.contains("</script")
        || lower.contains("<iframe")
        || lower.contains("<object")
        || lower.contains("<embed")
        || lower.contains("onload=")
        || lower.contains("onerror=")
    {
        format!("<!-- Bloque HTML neutralizado por política de seguridad: {} -->", html.replace('<', "&lt;").replace('>', "&gt;"))
    } else {
        html.to_string()
    }
}
