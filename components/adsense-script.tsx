import Script from "next/script";
import { ADSENSE_CLIENT_ID } from "@/lib/adsense";
export function AdsenseScript() { return <Script async strategy="afterInteractive" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT_ID)}`} crossOrigin="anonymous" />; }
