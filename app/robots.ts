import type { MetadataRoute } from "next";
import { BRAND_SITE_URL } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  const base = BRAND_SITE_URL;
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/painel", "/perfil", "/historico", "/configuracoes"] }, sitemap: base ? `${base.replace(/\/$/, "")}/sitemap.xml` : undefined };
}
