import type { Env, Admin } from './types';

const ITERATIONS = 100000; // Balanced for Workers free tier CPU limits
const HASH_ALGO = 'SHA-256';

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function hashPassword(password: string, pepper?: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  
  // Optional pepper via HMAC first
  let material = encoder.encode(password);
  if (pepper) {
    const pepperKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(pepper),
      { name: 'HMAC', hash: HASH_ALGO },
      false,
      ['sign']
    );
    material = new Uint8Array(await crypto.subtle.sign('HMAC', pepperKey, material));
  }

  const key = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: HASH_ALGO },
    key,
    256
  );

  const saltB64 = toBase64Url(salt.buffer);
  const hashB64 = toBase64Url(derived);
  return `pbkdf2_sha256$${ITERATIONS}$${saltB64}$${hashB64}`;
}

export async function verifyPassword(password: string, stored: string, pepper?: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;

  const iterations = parseInt(parts[1], 10);
  const salt = fromBase64Url(parts[2]);
  const expected = fromBase64Url(parts[3]);

  const encoder = new TextEncoder();
  let material = encoder.encode(password);
  if (pepper) {
    const pepperKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(pepper),
      { name: 'HMAC', hash: HASH_ALGO },
      false,
      ['sign']
    );
    material = new Uint8Array(await crypto.subtle.sign('HMAC', pepperKey, material));
  }

  const key = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: HASH_ALGO },
    key,
    256
  );

  const actual = new Uint8Array(derived);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export async function createSession(env: Env, adminId: number, ip?: string, ua?: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  await env.DB.prepare(
    `INSERT INTO admin_sessions (id, admin_id, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)`
  ).bind(sessionId, adminId, expires, ip || null, ua || null).run();

  return sessionId;
}

export async function getSessionAdmin(env: Env, sessionId: string | undefined | null): Promise<Admin | null> {
  if (!sessionId) return null;

  const row = await env.DB.prepare(
    `SELECT a.id, a.email, a.name, a.role, a.is_active
     FROM admin_sessions s
     JOIN admins a ON a.id = s.admin_id
     WHERE s.id = ? AND s.expires_at > datetime('now') AND a.is_active = 1`
  ).bind(sessionId).first<Admin>();

  return row || null;
}

export async function destroySession(env: Env, sessionId: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM admin_sessions WHERE id = ?`).bind(sessionId).run();
}

export async function cleanupExpiredSessions(env: Env): Promise<void> {
  await env.DB.prepare(`DELETE FROM admin_sessions WHERE expires_at <= datetime('now')`).run();
}

export function generateOrderRef(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `EDS-${datePart}-${rand}`;
}

// Rate limiting helper (simple in-memory for single isolate; production can use KV)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, max = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}