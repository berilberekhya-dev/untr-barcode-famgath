'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Registration } from '@/lib/types';
import { api, ApiError, ErrorBox, Modal, newRequestKey } from './shared';
import { Icon } from './icon';

export function RegistrationForm({ initial, assisted = false, disabled = false, onComplete }: {
  initial?: Registration; assisted?: boolean; disabled?: boolean; onComplete: (data?: Registration) => void;
}) {
  const [nrp, setNrp] = useState(initial?.nrp || '');
  const [fullName, setFullName] = useState(initial?.fullName || '');
  const [partySize, setPartySize] = useState(initial?.partySize || 1);
  const [other, setOther] = useState((initial?.partySize || 1) > 7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nrpError, setNrpError] = useState('');
  const [verified, setVerified] = useState<{nrp:string;fullName:string;company:string}|null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const lookupSequence = useRef(0);
  const [excess, setExcess] = useState<number|null>(null);
  useEffect(() => {
    const sequence = ++lookupSequence.current;
    setLookupError('');
    if (initial || disabled || !/^[0-9]+$/.test(nrp)) { setLookingUp(false); return; }
    setLookingUp(true);
    const timer = setTimeout(async () => {
      try {
        const result = await api<{fullName:string;company:string}>(assisted ? '/api/admin/registrations/lookup' : '/api/registrations/lookup', {nrp});
        if (sequence !== lookupSequence.current) return;
        setVerified({...result,nrp}); setFullName(result.fullName);
      } catch(e) {
        if (sequence === lookupSequence.current) { setVerified(null); setFullName(''); setLookupError((e as Error).message); }
      } finally { if (sequence === lookupSequence.current) setLookingUp(false); }
    }, 400);
    return () => { clearTimeout(timer); ++lookupSequence.current; };
  }, [nrp, initial, disabled, assisted]);
  const request = useRef<{ fingerprint: string; requestKey: string } | null>(null);
  useEffect(() => {
    if (assisted || initial) return;
    try {
      const pending = JSON.parse(sessionStorage.getItem('ut-pending-registration-v3') || 'null');
      if (pending && typeof pending.nrp === 'string' && typeof pending.fullName === 'string' && Number.isInteger(pending.partySize)) {
        setNrp(pending.nrp); setFullName(pending.fullName); setPartySize(pending.partySize); setOther(pending.partySize > 7);
        request.current = { fingerprint: pending.fingerprint, requestKey: pending.requestKey };
      }
    } catch { /* Storage is optional; the server remains authoritative. */ }
  }, [assisted, initial]);
  async function submit(event?: FormEvent, acknowledgedExtra=false) {
    event?.preventDefault();
    if (!/^[0-9]+$/.test(nrp.trim())) { setNrpError('NRP hanya boleh berisi angka'); return; }
    setBusy(true); setError(''); setNrpError('');
    const official = initial ? {fullName} : verified?.nrp===nrp.trim() ? verified : null;
    if(!official) {setError('Tunggu hingga NRP dikenali sebelum mendaftar.');setBusy(false);return;}
    const payload = { nrp: nrp.trim(), fullName: initial ? fullName.trim() : official.fullName, partySize, acknowledgedExtra };
    const fingerprint = JSON.stringify(payload);
    if (!request.current || request.current.fingerprint !== fingerprint) request.current = { fingerprint, requestKey: newRequestKey() };
    try {
      if (!assisted && !initial) try { sessionStorage.setItem('ut-pending-registration-v3', JSON.stringify({ ...payload, ...request.current })); } catch {}
      if (initial) {
        await api(`/api/admin/registrations/${initial.id}`, payload, 'PATCH'); onComplete();
      } else {
        const result = await api<Registration>(assisted ? '/api/admin/registrations' : '/api/registrations', { ...payload, requestKey: request.current.requestKey });
        if (!assisted) try { sessionStorage.removeItem('ut-pending-registration-v3'); localStorage.setItem('ut-attendance-receipt-v3', JSON.stringify(result)); } catch {}
        onComplete(result);
      }
    } catch (e) { if(e instanceof ApiError && e.details?.code==='EXCESS_ATTENDANCE') setExcess(Number(e.details.plannedSize)); else setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="registration-form">
    <fieldset disabled={busy || disabled}>
      <label htmlFor="nrp">NRP <span className="required">*</span></label>
      <div className="input-icon"><Icon name="lock" size={18} /><input id="nrp" name="nrp" type="text" inputMode="numeric" pattern="[0-9]+" value={nrp} onChange={e => {
        if (/^[0-9]*$/.test(e.target.value)) { ++lookupSequence.current; setNrp(e.target.value); setVerified(null); if(!initial) setFullName(''); setNrpError(''); setError(''); setLookupError(''); }
        else setNrpError('NRP hanya boleh berisi angka');
      }} onPaste={e => {
        if (!/^[0-9]*$/.test(e.clipboardData.getData('text'))) { e.preventDefault(); setNrpError('NRP hanya boleh berisi angka'); }
      }} aria-invalid={Boolean(nrpError)} aria-describedby={nrpError ? 'nrp-error' : undefined} placeholder="Masukkan NRP Anda" required maxLength={64} autoComplete="off" spellCheck={false} /></div>
      {nrpError && <p id="nrp-error" className="input-error" role="alert">{nrpError}</p>}
      {lookingUp && <p className="field-hint" role="status">Memeriksa NRP…</p>}
      {lookupError && <ErrorBox>{lookupError}</ErrorBox>}
      {(verified || initial) && <>
        <label htmlFor="fullName">Nama lengkap</label>
        <div className="input-icon"><Icon name="people" size={18} /><input id="fullName" name="fullName" readOnly={!initial} value={fullName} onChange={e => setFullName(e.target.value)} maxLength={160} autoComplete="off" /></div>
        <label htmlFor="company">Perusahaan</label>
        <input id="company" name="company" readOnly value={initial?.company || verified?.company || ''} />
      </>}
      <label htmlFor={other ? 'partySize' : undefined}>Jumlah yang hadir <span className="required">*</span></label>
      <div className="party-options" role="group" aria-label="Jumlah yang hadir">
        {[1, 2, 3, 4, 5, 6, 7].map(n => <button type="button" key={n} className={!other && partySize === n ? 'selected' : ''} aria-pressed={!other && partySize === n} onClick={() => { setPartySize(n); setOther(false); }}>{n}</button>)}
        <button type="button" className={other ? 'selected other' : 'other'} aria-pressed={other} onClick={() => { setOther(true); if (partySize < 8) setPartySize(8); }}>Lainnya</button>
      </div>
      {other && <input id="partySize" name="partySize" aria-label="Jumlah orang termasuk diri sendiri" type="number" min={1} max={999} required value={Number.isNaN(partySize) ? '' : partySize} onChange={e => setPartySize(e.target.valueAsNumber)} />}
      <p className="field-hint"><Icon name="info" size={14} />Termasuk diri sendiri. Anda + pasangan + 1 anak = 3 orang.</p>
      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="submit" className="button button-primary submit-button" disabled={busy || disabled || lookingUp || (!initial && !verified)}>{busy ? 'Menyimpan…' : initial ? 'Simpan perubahan' : assisted ? 'Daftarkan peserta' : 'Daftar sekarang'}<Icon name={initial ? 'check' : 'arrow'} /></button>
    </fieldset>
    {!initial && <p className="form-footnote"><Icon name="lock" size={15} />NRP dan nama dicocokkan dengan daftar awal.</p>}
    {excess!==null && <Modal title="Jumlah hadir melebihi rencana" onClose={()=>setExcess(null)}><p>Jumlah peserta yang Anda bawa lebih banyak <strong>{partySize-excess} orang</strong> dari registrasi sebelumnya. Jika ingin melanjutkan, hanya <strong>{excess} orang yang terdaftar</strong> yang mendapat kupon makanan dan kursi. Untuk informasi lebih lanjut, hubungi panitia yang sedang standby.</p><div className="excess-actions"><button type="button" className="button button-primary" disabled={busy} onClick={()=>{setExcess(null);void submit(undefined,true);}}>Oke, gapapa</button><button type="button" className="button button-secondary" onClick={()=>setExcess(null)}>Tunggu, hubungi panitia dulu</button></div></Modal>}
  </form>;
}
