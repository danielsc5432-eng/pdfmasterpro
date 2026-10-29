import type { Metadata } from "next";
import { AdsenseScript } from "@/components/adsense-script";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import "./globals.css";
import { BRAND_SITE_URL } from "@/lib/brand";

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
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
