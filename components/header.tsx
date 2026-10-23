"use client";

import { Menu, Moon, Search, Sun, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("pdfmaster-theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("pdfmaster-theme", next ? "dark" : "light");
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(query.trim() ? `/ferramentas?busca=${encodeURIComponent(query.trim())}` : "/ferramentas");
    setOpen(false);
  }

  const links = [
    { href: "/ferramentas", label: "Ferramentas" },
    { href: "/precos", label: "Preços" },
  ];

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/" aria-label="PDF Master Pro, início">
          <Image className="brand-mark" src="/brand/logo.png" alt="" width={40} height={34} priority />
          <span className="brand-name">PDF Master Pro</span>
        </Link>
        <nav className="desktop-nav" aria-label="Navegação principal">
          {links.map((link) => <Link key={link.href} className={`nav-link ${pathname === link.href ? "active" : ""}`} href={link.href}>{link.label}</Link>)}
        </nav>
        <div className="header-actions">
          <form className="search-form" onSubmit={submitSearch} role="search">
            <Search size={15} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar ferramenta" aria-label="Buscar ferramenta" />
          </form>
          <button className="icon-button" onClick={toggleTheme} aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
          <Link className="nav-link" href="/entrar">Entrar</Link>
          <Link className="button button-primary" href="/criar-conta">Criar conta</Link>
        </div>
        <button className="icon-button mobile-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Fechar menu" : "Abrir menu"}>{open ? <X size={18} /> : <Menu size={18} />}</button>
      </div>
      <div className={`mobile-nav ${open ? "open" : ""}`}>
        <form className="search-form" onSubmit={submitSearch} role="search"><Search size={15} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar ferramenta" aria-label="Buscar ferramenta" /></form>
        {links.map((link) => <Link key={link.href} className="nav-link" href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}
        <div style={{ display: "flex", gap: 9 }}><Link className="button button-ghost" href="/entrar" onClick={() => setOpen(false)}>Entrar</Link><Link className="button button-primary" href="/criar-conta" onClick={() => setOpen(false)}>Criar conta</Link><button className="icon-button" onClick={toggleTheme} aria-label="Alternar tema">{dark ? <Sun size={17} /> : <Moon size={17} />}</button></div>
      </div>
    </header>
  );
}
