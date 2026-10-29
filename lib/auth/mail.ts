export async function sendAccountEmail(email: string, subject: string, text: string, transport: typeof fetch = fetch) {
  if (!process.env.RESEND_API_KEY || !process.env.SUPPORT_FROM_EMAIL) throw new Error("MAIL_UNCONFIGURED");
  const response = await transport("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.SUPPORT_FROM_EMAIL, to: [email], subject, text }),
  });
  if (!response.ok || !(await response.json()).id) throw new Error("MAIL_FAILED");
}
