import type { MetadataRoute } from "next";
import { publicPaths } from "@/lib/seo";
import { BRAND_SITE_URL } from "@/lib/brand";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = BRAND_SITE_URL;
  return publicPaths().map((path) => ({ url: `${base}${path}` }));
}
