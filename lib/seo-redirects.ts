/** Kept separate from authenticated/API routing. Enabled only after the apex
 * domain-level redirect is removed to prevent a www/apex redirect loop. */
export function seoRedirects(env: Record<string, string | undefined> = process.env) {
 if (env.SEO_CANONICAL_REDIRECTS !== "1") return [];
 const origin = env.SEO_SITE_ORIGIN === "https://www.arquivelio.com.br" ? "https://www.arquivelio.com.br" : "https://arquivelio.com.br";
 return ["www.arquivelio.com.br", "www.pdfmasterpro.com.br", "pdfmasterpro.com.br"].filter(host => host !== new URL(origin).host).map(host => ({
  source: "/:path((?!api(?:/|$)|_next(?:/|$)).*)",
  has: [{ type: "host" as const, value: host }],
  destination: `${origin}/:path`,
  permanent: true,
 }));
}
