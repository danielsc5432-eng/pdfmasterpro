import Image from "next/image";

/** Displays the supplied artwork intact, through a viewport for the dark variant. */
export function BrandArtwork() {
  return <>
    <Image className="brand-art-light" src="/brand/arquivelio-horizontal.jpeg" alt="Arquivelio — Seus documentos, infinitas possibilidades." width={1599} height={578} sizes="270px" />
    <span className="brand-art-dark" aria-hidden="true"><Image src="/brand/arquivelio-identidade.jpeg" alt="" width={1536} height={1024} sizes="450px" /></span>
  </>;
}
