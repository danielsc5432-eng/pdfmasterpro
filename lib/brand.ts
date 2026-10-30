/** Public identity. Keep account identifiers and signing keys independent of branding. */
export const BRAND_NAME = "Arquivelio";
// Keep the currently verified Google/login origin until the apex OAuth setup
// is confirmed. Only the two owned, known origins are accepted.
export const BRAND_SITE_URL = process.env.SEO_SITE_ORIGIN === "https://www.arquivelio.com.br" ? "https://www.arquivelio.com.br" : "https://arquivelio.com.br";
export const BRAND_TAGLINE = "Seus documentos, infinitas possibilidades.";
