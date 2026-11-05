'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Astronaut, SpaceBackdrop } from './art';
import { api, Brand, ErrorBox } from './shared';
import { Icon } from './icon';
export function Login() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('/api/admin/session', { password }); router.refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="public-page login-page"><SpaceBackdrop /><header className="public-header"><Brand /></header>
    <main className="login-layout"><Astronaut className="login-astronaut" /><div className="pixel-panel login-panel">
      <span className="eyebrow">AKSES PANITIA</span><h1>Mission control.</h1><p className="muted">Masuk untuk mengelola kehadiran dan undian keluarga besar United Tractors Palembang.</p>
      <form onSubmit={submit}><label htmlFor="password">Password panitia</label><div className="input-icon"><Icon name="lock" size={18} /><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Masukkan password" /></div>{error && <ErrorBox>{error}</ErrorBox>}<button className="button button-primary w-full" disabled={busy}>{busy ? 'Menghubungkan…' : 'Masuk ke pusat kendali'}<Icon name="arrow" /></button></form>
    </div></main><footer className="login-footer">FAMILY GATHERING <span>✦</span> PALEMBANG</footer>
  </div>;
}
