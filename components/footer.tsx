import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand"><Link className="brand" href="/"><Image className="brand-mark" src="/brand/logo.png" alt="" width={34} height={29} /><span className="brand-name">PDF Master Pro</span></Link><p>Todas as ferramentas para seus documentos em um só lugar — com clareza, velocidade e privacidade.</p></div>
        <div><h3>Ferramentas</h3><Link href="/ferramentas/juntar-pdf">Juntar PDF</Link><Link href="/ferramentas/dividir-pdf">Dividir PDF</Link><Link href="/ferramentas/imagens-para-pdf">Imagens para PDF</Link><Link href="/ferramentas/organizar-pdf">Organizar PDF</Link></div>
        <div><h3>Empresa</h3><Link href="/precos">Preços</Link><Link href="/contato">Contato</Link><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos de uso</Link></div>
        <div><h3>Ajuda</h3><Link href="/ferramentas">Catálogo completo</Link><Link href="/entrar">Entrar</Link><Link href="/criar-conta">Criar conta</Link><a href="mailto:suporte@pdfmasterpro.app">suporte@pdfmasterpro.app</a></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} PDF Master Pro</span><span>Arquivos temporários são tratados conforme a política de retenção.</span></div>
    </footer>
  );
}
