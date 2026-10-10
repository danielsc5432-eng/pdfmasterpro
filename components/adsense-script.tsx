import { ADSENSE_CLIENT_ID } from "@/lib/adsense";

export function AdsenseScript() {
  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT_ID)}`}
      crossOrigin="anonymous"
    />
  );
}
