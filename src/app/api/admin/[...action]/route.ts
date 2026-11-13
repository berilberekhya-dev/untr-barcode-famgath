import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError, getService } from '@/lib/service';
import { handle, checkOrigin, registrationUrl } from '@/lib/http';
import { createSession, isAdmin, requireAdmin, SESSION_COOKIE, sessionOptions, verifyPassword } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ action: string[] }> };
export async function GET(request: NextRequest, context: Context) {
  return handle(async () => {
    const { action } = await context.params;
    if (action.join('/') === 'session') return { authenticated: await isAdmin() };
    await requireAdmin();
    if (action.join('/') === 'state' || action.join('/') === 'export') return getService().state(registrationUrl(request));
    throw new AppError('Halaman API tidak ditemukan.', 404);
  });
}
export async function POST(request: NextRequest, context: Context) {
  const { action } = await context.params;
  if (action.join('/') === 'session') {
    let token: string | undefined;
    const response = await handle(async () => {
      checkOrigin(request);
      const { password } = z.object({ password: z.string().min(1).max(1000) }).parse(await request.json());
      if (!verifyPassword(password)) throw new AppError('Password panitia belum sesuai.', 401);
      token = createSession();
      return { ok: true };
    });
    if (token) response.cookies.set(SESSION_COOKIE, token, sessionOptions);
    return response;
  }
  if (action.join('/') === 'logout') {
    const response = await handle(async () => { checkOrigin(request); await requireAdmin(); return { ok: true }; });
    if (response.ok) response.cookies.set(SESSION_COOKIE, '', { ...sessionOptions, maxAge: 0 });
    return response;
  }
  return handle(async () => {
    checkOrigin(request); await requireAdmin();
    const body = await request.json();
    const service = getService();
    if (action.join('/') === 'registrations') return service.register(body, true);
    if (action.join('/') === 'registrations/lookup') return service.lookup(body, true);
    if (action.join('/') === 'draw') return service.draw(body);
    if (action.join('/') === 'display') { await service.setWinnerDisplay(body); return {ok:true}; }
    if (action.join('/') === 'display/audio') { await service.setProjectorAudio(body); return {ok:true}; }
    if (action.join('/') === 'coupons/transfer') { await service.transferCoupons(body); return {ok:true}; }
    if (action.length === 3 && action[0] === 'draws' && action[2] === 'forfeit') { await service.forfeit(action[1]); return { ok: true }; }
    if (action.length === 3 && action[0] === 'draws' && action[2] === 'received') { await service.markReceived(action[1], body); return { ok: true }; }
    throw new AppError('Halaman API tidak ditemukan.', 404);
  });
}
export async function PATCH(request: NextRequest, context: Context) {
  return handle(async () => {
    checkOrigin(request); await requireAdmin();
    const { action } = await context.params;
    const body = await request.json();
    if (action.join('/') === 'event') { await getService().updateEvent(body); return { ok: true }; }
    if (action.length === 2 && action[0] === 'registrations') { await getService().editRegistration(action[1], body); return { ok: true }; }
    if (action.length === 2 && action[0] === 'roster') { await getService().editRoster(action[1], body); return { ok: true }; }
    throw new AppError('Halaman API tidak ditemukan.', 404);
  });
}
