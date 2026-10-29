import test from "node:test";
import assert from "node:assert/strict";
import { registerLocal, verifyLocal, verificationHash } from "../../lib/auth/local-accounts";
import { sendAccountEmail } from "../../lib/auth/mail";
import type { query } from "../../lib/db";

test("existing identity does not overwrite a password or generate a code", async () => {
  let calls = 0;
  const db = (async () => { calls++; return [{ open_id: "google:existing" }]; }) as typeof query;
  const result = await registerLocal("Test User", "test@example.com", "Password!123", async () => { assert.fail("must not generate a code"); }, db);
  assert.equal(result, "existing");
  assert.equal(calls, 1);
});

test("new registration sends a six-digit code and stores only its hash", async () => {
  const old = process.env.AUTH_SESSION_SECRET;
  process.env.AUTH_SESSION_SECRET = "isolated-auth-test";
  let stored: unknown[] = [], delivered = "";
  const db = (async (sql: string, params: unknown[]) => {
    if (sql.startsWith("SELECT")) return [];
    if (sql.startsWith("INSERT INTO local_accounts")) { stored = params; return [{ email: "test@example.com" }]; }
    return [];
  }) as typeof query;
  try {
    assert.equal(await registerLocal("Test User", "test@example.com", "Password!123", async (_, code) => { delivered = code; }, db), "sent");
    assert.match(delivered, /^\d{6}$/);
    assert.equal(stored[4], verificationHash("test@example.com", delivered));
    assert.ok(!stored.includes(delivered));
    await assert.rejects(registerLocal("Test User", "test@example.com", "Password!123", async () => { throw new Error("MAIL_FAILED"); }, db), /MAIL_FAILED/);
  } finally { if (old === undefined) delete process.env.AUTH_SESSION_SECRET; else process.env.AUTH_SESSION_SECRET = old; }
});

test("expired or exhausted verification never creates an account", async () => {
  let calls = 0;
  const db = (async () => { calls++; return []; }) as typeof query;
  assert.equal(await verifyLocal("test@example.com", "123456", db), null);
  assert.equal(calls, 1);
});

test("wrong code returns no session; valid database claim returns its account", async () => {
  const old = process.env.AUTH_SESSION_SECRET;
  process.env.AUTH_SESSION_SECRET = "isolated-auth-test";
  try {
    for (const valid of [false, true]) {
      const db = (async (sql: string) => sql.startsWith("UPDATE") ? [{ email: "test@example.com" }] : valid ? [{ open_id: "local:test", email: "test@example.com", display_name: "Test User" }] : []) as typeof query;
      const user = await verifyLocal("test@example.com", "123456", db);
      assert.equal(user?.openId ?? null, valid ? "local:test" : null);
    }
  } finally { if (old === undefined) delete process.env.AUTH_SESSION_SECRET; else process.env.AUTH_SESSION_SECRET = old; }
});

test("mail acceptance requires a successful provider response with an ID", async () => {
  const oldKey = process.env.RESEND_API_KEY, oldSender = process.env.SUPPORT_FROM_EMAIL;
  process.env.RESEND_API_KEY = "synthetic-test-key"; process.env.SUPPORT_FROM_EMAIL = "sender@example.com";
  try {
    for (const response of [new Response("{}", { status: 429 }), new Response("{}", { status: 200 })]) {
      await assert.rejects(sendAccountEmail("test@example.com", "test", "test", (async () => response) as typeof fetch), /MAIL_FAILED/);
    }
    await sendAccountEmail("test@example.com", "test", "test", (async () => new Response('{"id":"synthetic-message"}', { status: 200 })) as typeof fetch);
  } finally {
    if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey;
    if (oldSender === undefined) delete process.env.SUPPORT_FROM_EMAIL; else process.env.SUPPORT_FROM_EMAIL = oldSender;
  }
});
