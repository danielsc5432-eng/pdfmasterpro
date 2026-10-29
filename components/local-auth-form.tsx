"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import "./local-auth-form.css";
import { hasSpecialCharacter, PASSWORD_SPECIAL_MESSAGE, hasUppercaseLetter, PASSWORD_UPPERCASE_MESSAGE } from "@/lib/auth/password-policy";

export function LocalAuthForm({ mode }: { mode: "signup" | "signin" }) {
  const [email, setEmail] = useState(""); const [name, setName] = useState("");
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const confirmationInput = useRef<HTMLInputElement>(null);
  const passwordsDiffer = mode === "signup" && confirmation.length > 0 && password !== confirmation;
  useEffect(() => {
    confirmationInput.current?.setCustomValidity(passwordsDiffer ? "As senhas não são iguais. Digite a mesma senha nos dois campos." : "");
  }, [passwordsDiffer, password, confirmation]);
  const [code, setCode] = useState(""); const [terms, setTerms] = useState(false);
  const [pending, setPending] = useState(false); const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setError("");
    if (mode === "signup" && !pending && !hasSpecialCharacter(password)) { setError(PASSWORD_SPECIAL_MESSAGE); return; }
    if (mode === "signup" && !pending && password !== confirmation) { setError("As senhas não são iguais."); return; }
    if (mode === "signup" && !pending && !hasUppercaseLetter(password)) { setError(PASSWORD_UPPERCASE_MESSAGE); return; }
    setBusy(true);
    try {
      const action = pending ? "verify" : mode === "signup" ? "register" : "login";
      const body = pending ? { email, code } : mode === "signup" ? { name, email, password, terms } : { email, password };
      const response = await fetch(`/api/auth/local/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível continuar.");
      if (data.authenticated) { window.location.assign("/painel"); return; }
      if (data.pending) { setPending(true); setPassword(""); setConfirmation(""); setVisible(false); setNotice(data.message); }
    } catch (reason) { setError(reason instanceof Error && reason.name !== "TimeoutError" ? reason.message : "A solicitação não foi confirmada. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="local-auth-form">
    {pending ? <><h2>Confirme seu e-mail</h2><p>Digite o código de seis dígitos enviado para <strong>{email}</strong>.</p><label htmlFor="local-code">Código de confirmação</label><input disabled={busy} id="local-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} required autoFocus /><button type="button" className="text-link" disabled={busy} onClick={() => { setPending(false); setCode(""); setError(""); setNotice(""); }}>Corrigir e-mail ou solicitar outro código</button></> : <>
      {mode === "signup" && <><label htmlFor="local-name"><UserRound size={15} /> Nome completo</label><input disabled={busy} id="local-name" name="name" autoComplete="name" minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} required /></>}
      <label htmlFor="local-email"><Mail size={15} /> E-mail</label><input disabled={busy} id="local-email" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value.trim())} required />
      <label htmlFor="local-password"><LockKeyhole size={15} /> Senha</label><div className="local-password-field"><input disabled={busy} id="local-password" name="password" type={visible ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={9} maxLength={128} value={password} title={mode === "signup" ? "Use no mínimo 9 caracteres, pelo menos 1 letra maiúscula e 1 caractere especial, como !, @ ou #." : undefined} onInvalid={event => { if (mode === "signup") event.currentTarget.setCustomValidity("Use no mínimo 9 caracteres, pelo menos 1 letra maiúscula e 1 caractere especial, como !, @ ou #."); }} onChange={event => { event.target.setCustomValidity(""); setPassword(event.target.value); }} required aria-describedby="local-password-help" /><button type="button" disabled={busy} onClick={() => setVisible(!visible)} aria-label={visible ? "Ocultar senha" : "Mostrar senha"}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
      <small id="local-password-help">{mode === "signup" ? "Use de 9 a 128 caracteres com pelo menos 1 letra maiúscula e 1 caractere especial, como !, @, # ou $." : "Digite a senha cadastrada na sua conta."}</small>
      {mode === "signup" && <><label htmlFor="local-confirm">Confirme a senha</label><input disabled={busy} ref={confirmationInput} id="local-confirm" name="confirmPassword" aria-invalid={passwordsDiffer || undefined} aria-describedby={passwordsDiffer ? "local-confirm-error" : undefined} type={visible ? "text" : "password"} autoComplete="new-password" minLength={9} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} required />{passwordsDiffer && <p id="local-confirm-error" className="local-auth-error" role="alert">As senhas não são iguais. Digite a mesma senha nos dois campos.</p>}<label className="local-auth-terms"><input disabled={busy} type="checkbox" checked={terms} onChange={event => setTerms(event.target.checked)} required /> <span>Li e aceito os <Link href="/termos" target="_blank">Termos de uso</Link> e a <Link href="/privacidade" target="_blank">Política de privacidade</Link>.</span></label></>}
    </>}
    {notice && <p className="local-auth-notice" role="status">{notice}</p>}{error && <p className="local-auth-error" role="alert">{error}</p>}
    <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Aguarde…" : pending ? "Confirmar e acessar minha conta" : mode === "signup" ? "Criar minha conta" : "Entrar com e-mail e senha"}</button>
    <div className="local-auth-divider"><span>ou continue com</span></div>
  </form>;
}
