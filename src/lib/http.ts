import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from './service';

export function registrationUrl(request: NextRequest) {
  const base = process.env.APP_BASE_URL || new URL(request.url).origin;
  return `${base.replace(/\/$/, '')}/daftar`;
}
export function checkOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) throw new AppError('Permintaan berasal dari halaman yang berbeda.', 403);
  if (!request.headers.get('content-type')?.includes('application/json')) throw new AppError('Gunakan data JSON.', 415);
}
export async function handle(fn: () => Promise<unknown>) {
  try { return NextResponse.json(await fn(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Periksa kembali data Anda.' }, { status: 400 });
    if (error instanceof AppError) return NextResponse.json({ error: error.message, ...error.details }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Data permintaan tidak valid.' }, { status: 400 });
    console.error('Request failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Permintaan belum berhasil. Coba lagi; data yang sudah tersimpan tetap aman.' }, { status: 500 });
  }
}
