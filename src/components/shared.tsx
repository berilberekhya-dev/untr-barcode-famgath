'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icon';

export class ApiError extends Error { constructor(message: string, public status: number, public details?: Record<string, unknown>) { super(message); } }
export function newRequestKey() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // getRandomValues also works on the HTTP LAN origin used during phone testing.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function api<T>(url: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(url, body === undefined ? { cache: 'no-store' } : {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok) throw new ApiError(result.error || 'Permintaan belum berhasil.', response.status, result);
  return result;
}
export function usePoll<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const mounted = useRef(true);
  const latest = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++latest.current;
    try {
      const value = await api<T>(url);
      if (mounted.current && sequence === latest.current) { setData(value); setError(null); }
      return value;
    } catch (e) { if (mounted.current && sequence === latest.current) setError(e as Error); return null; }
  }, [url]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 2000);
    const focus = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', focus);
    return () => { mounted.current = false; clearInterval(timer); document.removeEventListener('visibilitychange', focus); };
  }, [refresh]);
  return { data, error, refresh };
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/daftar" className={`brand ${compact ? 'compact' : ''}`} aria-label="United Tractors Palembang, halaman registrasi">
    <span className="brand-logo"><img src="/brand/united-tractors-white.png" width={250} height={50} alt="United Tractors — member of ASTRA" /></span>
    <span className="brand-location">PALEMBANG / FAMILY GATHERING</span>
  </Link>;
}
export function Connection({ error }: { error: Error | null }) {
  return <span className={`connection ${error ? 'offline' : ''}`} role="status"><i />{error ? 'Menghubungkan ulang…' : 'Terhubung'}</span>;
}
export function DemoBanner({ demo }: { demo?: boolean }) { return demo ? <div className="demo-banner">MODE DEMO · Data contoh, terpisah dari data acara</div> : null; }
export function Loading() { return <div className="loading-state" role="status"><span className="loader" /><p>Menghubungkan ke pusat kendali…</p></div>; }
export function ErrorBox({ children }: { children: ReactNode }) { return <div className="error-box" role="alert"><Icon name="info" size={18} /><span>{children}</span></div>; }
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="modal" onClose={onClose} aria-label={title}>
    <div className="modal-heading"><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Tutup dialog"><Icon name="close" /></button></div>
    {children}
  </dialog>;
}
export function FullscreenButton() {
  const [error, setError] = useState('');
  return <><button className="button button-ghost button-small" onClick={async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setError('Gunakan F11 untuk layar penuh.'); }
  }}><Icon name="expand" size={16} />Layar penuh</button>{error && <span className="muted">{error}</span>}</>;
}
export function formatTime(value: number) { return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(value); }
export function formatDate(value: string) {
  if (!value) return 'Tanggal segera diumumkan';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(`${value}T12:00:00+07:00`));
}
