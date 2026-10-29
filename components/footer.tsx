import { BrandArtwork } from "@/components/brand-artwork";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand"><Link className="footer-logo" href="/" aria-label="Arquivelio, início"><BrandArtwork /></Link><p>Compare documentos com evidências e encontre as ferramentas para seus outros fluxos de PDF.</p></div>
        <div><h3>Ferramentas</h3><Link href="/ferramentas/detector-divergencias">Detector de Divergências</Link><Link href="/ferramentas/juntar-pdf">Juntar PDF</Link><Link href="/ferramentas/dividir-pdf">Dividir PDF</Link><Link href="/ferramentas/pdf-para-word">PDF para Word</Link></div>
        <div><h3>Empresa</h3><Link href="/precos">Preços</Link><Link href="/contato">Contato</Link><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos de uso</Link></div>
        <div><h3>Ajuda</h3><Link href="/ferramentas">Catálogo completo</Link><Link href="/entrar">Entrar</Link><Link href="/criar-conta">Criar conta</Link><Link href="/contato">Central de ajuda</Link></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Arquivelio</span><span>Arquivos temporários são tratados conforme a política de retenção.</span></div>
    </footer>
  );
}
