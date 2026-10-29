import Image from "next/image";

/** A viewport into the supplied artwork; the original image is kept intact. */
export function BrandSymbol() {
  return <span className="brand-symbol" aria-hidden="true"><Image src="/brand/arquivelio-horizontal.jpeg" alt="" width={1599} height={578} sizes="192px" className="brand-symbol-image" priority /></span>;
}
