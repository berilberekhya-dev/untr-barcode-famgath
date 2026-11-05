import { createHmac, createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { AppError } from './service';

export const SESSION_COOKIE = 'ut-space-session';
const lifetime = 60 * 60 * 12;
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new AppError('Atur SESSION_SECRET minimal 32 karakter pada konfigurasi server.', 503);
  return value;
}
function equal(a: string, b: string) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
export function verifyPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new AppError('Atur ADMIN_PASSWORD pada konfigurasi server.', 503);
  return equal(password, expected);
}
export function createSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + lifetime * 1000, nonce: randomUUID() })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret()).update(payload).digest('base64url')}`;
}
export function verifySession(value?: string) {
  if (!value) return false;
  try {
    const [payload, signature, extra] = value.split('.');
    if (!payload || !signature || extra) return false;
    const expected = createHmac('sha256', secret()).update(payload).digest('base64url');
    return equal(signature, expected) && Number(JSON.parse(Buffer.from(payload, 'base64url').toString()).exp) > Date.now();
  } catch { return false; }
}
export async function isAdmin() { return verifySession((await cookies()).get(SESSION_COOKIE)?.value); }
export async function requireAdmin() { if (!await isAdmin()) throw new AppError('Silakan masuk sebagai panitia.', 401); }
export const sessionOptions = { httpOnly: true, sameSite: 'lax' as const, secure: Boolean(process.env.VERCEL), path: '/', maxAge: lifetime };
