import type { Metadata } from "next";
import { AdsenseScript } from "@/components/adsense-script";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import "./globals.css";
import { BRAND_SITE_URL } from "@/lib/brand";
import { serializeJsonLd, seoUrl } from "@/lib/seo";

const siteUrl = BRAND_SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Arquivelio — Ferramentas para PDF",
    template: "%s — Arquivelio",
  },
  description: "Converta, organize, comprima e proteja seus documentos com ferramentas práticas para PDF.",
  keywords: ["PDF", "juntar PDF", "dividir PDF", "imagens para PDF", "organizar PDF"],
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Arquivelio",
    title: "Arquivelio — Ferramentas para PDF",
    description: "Todas as ferramentas para seus documentos em um só lugar.",
    images: [{ url: "/brand/arquivelio-horizontal.jpeg", width: 1599, height: 578, alt: "Arquivelio" }],
  },
  twitter: { card: "summary_large_image", images: ["/brand/arquivelio-horizontal.jpeg"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <AdsenseScript />
        <a className="skip-link" href="#conteudo-principal">Pular para o conteúdo</a>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd([
          { "@context": "https://schema.org", "@type": "Organization", "@id": `${seoUrl("/")}#organization`, name: "Arquivelio", url: seoUrl("/"), logo: seoUrl("/brand/arquivelio-horizontal.jpeg") },
          { "@context": "https://schema.org", "@type": "WebSite", "@id": `${seoUrl("/")}#website`, name: "Arquivelio", url: seoUrl("/"), inLanguage: "pt-BR", publisher: { "@id": `${seoUrl("/")}#organization` } }
        ]) }} />
        <Header />
        <main id="conteudo-principal" tabIndex={-1}>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
