'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { RegistrationDisplay, Registration } from '@/lib/types';
import { Astronaut, Planet, PixelSpark, SpaceBackdrop } from './art';
import { api, ApiError, Brand, DemoBanner, formatDate, usePoll, ErrorBox } from './shared';
import { RegistrationForm } from './registration-form';
import { Icon } from './icon';

export function RegistrationPage() {
  const { data, error } = usePoll<RegistrationDisplay>('/api/display?view=registration');
  const [receipt, setReceipt] = useState<Registration | null>(null);
  const [receiptError,setReceiptError]=useState('');
  useEffect(() => {
    let mounted=true;
    try {
      const saved=JSON.parse(localStorage.getItem('ut-attendance-receipt-v3')||'null');
      if(saved&&typeof saved.id==='string'&&typeof saved.nrp==='string'&&saved.partySize>0){
        setReceipt(saved);
        void api<Registration>('/api/registrations/receipt',{id:saved.id,nrp:saved.nrp}).then(r=>{if(mounted){setReceipt(r);try{localStorage.setItem('ut-attendance-receipt-v3',JSON.stringify(r));}catch{}}}).catch(e=>{
          if(!mounted)return;
          if(e instanceof ApiError&&e.status===404){setReceipt(null);try{localStorage.removeItem('ut-attendance-receipt-v3');}catch{}}
          else setReceiptError('Tiket tersimpan ditampilkan. Sambungkan kembali untuk memperbarui nomor meja.');
        });
      }
    }catch{}
    return()=>{mounted=false;};
  }, []);
  return <div className="public-page registration-page">
    <SpaceBackdrop /><DemoBanner demo={data?.event.demo} />
    <header className="public-header"><Brand /><Link className="admin-link" href="/panitia">Area panitia<Icon name="external" size={16} /></Link></header>
    <main className="register-layout">
      <section className="register-story">
        <div className="eyebrow"><span className="tiny-square" />FAMILY GATHERING · PALEMBANG</div>
        <h1>Terbang melesat,<br /><span>Lanjakke nian</span><PixelSpark className="title-spark" /></h1>
        <p className="intro">Petualangan seru dimulai bersama orang terdekat.<br className="desktop-break" /> Daftarkan kehadiran Anda dan keluarga di sini.</p>
        <p className="event-custom-title">{data?.event.title || 'Family Gathering United Tractors Palembang'}</p>
        <div className="event-meta"><span><Icon name="calendar" size={17} />{formatDate(data?.event.date || '')}</span><span><Icon name="pin" size={17} />{data?.event.venue || 'Palembang'}</span></div>
        <div className="hero-scene"><div className="scene-orbit" /><Planet className="hero-planet" /><Astronaut className="hero-astronaut" /><Planet className="far-planet" purple /><PixelSpark className="scene-spark" /><div className="scene-caption"><span className="signal-bars"><i /><i /><i /></span>MISSION: MAKING MEMORIES</div><span className="scene-coordinates">02°59′ S &nbsp; 104°45′ E</span></div>
      </section>
      <section className="register-panel-wrap">
        {receipt ? <div className="boarding-pass pixel-panel">
          <div className="pass-heading"><span className="badge badge-mint"><Icon name="check" size={14} />Terdaftar</span><Icon name="rocket" size={24} /></div>
          <p className="eyebrow">BOARDING PASS / FAMILY GATHERING</p><h2>Anda siap<br /><span>berangkat!</span></h2>
          <p className="ticket-screenshot"><Icon name="info" size={17}/>Mohon screenshot tiket ini sebagai bukti check-in.</p>
          {receiptError&&<ErrorBox>{receiptError}</ErrorBox>}
          <div className="pass-divider" /><dl><dt>NAMA PENJELAJAH</dt><dd>{receipt.fullName}</dd><dt>NRP</dt><dd className="ticket-identity"><span className="mono">{receipt.nrp}</span><span className="ticket-company">{receipt.company}</span></dd><dt>JUMLAH KELUARGA</dt><dd>{receipt.plannedSize} Orang</dd><dt>JUMLAH HADIR</dt><dd className="ticket-attendance">{receipt.partySize} Orang{receipt.partySize>receipt.plannedSize&&<> <span className="ticket-extra">({receipt.partySize-receipt.plannedSize} Orang tidak terdaftar)</span></>}</dd><dt>NOMOR MEJA</dt><dd className="ticket-table">{receipt.tableNumber||'Hubungi panitia'}</dd></dl>
          <div className="pass-status ticket-entitlements"><Icon name="check"/><div><strong>Check-in berhasil.</strong><span>Kupon Makanan: {Math.min(receipt.partySize,receipt.plannedSize)}</span><span>Kursi tersedia hanya untuk {Math.min(receipt.partySize,receipt.plannedSize)} orang</span></div></div>
          <p className="pass-help">Kupon makanan dan kursi hanya untuk anggota yang terdaftar. Peserta tambahan tidak mendapat keduanya.</p>
          {receipt.extraCoupons>0&&<p className="pass-help">Alokasi kupon tambahan oleh panitia: {receipt.extraCoupons}. Alokasi ini tidak menambah jatah kursi.</p>}
          <p className="pass-help">Perlu koreksi data? Silakan hubungi panitia di lokasi.</p>
        </div> : <div className="pixel-panel registration-panel">
          <div className="panel-topline"><span className="eyebrow">REGISTRASI PESERTA</span><span className={`live-label ${data && !data.event.registrationOpen ? 'closed' : ''}`}><i />{!data ? 'Menghubungkan' : data.event.registrationOpen ? 'Dibuka' : 'Ditutup'}</span></div>
          <h2>Halo, penjelajah! <span className="pixel-wave">✦</span></h2><p className="panel-description">Isi data di bawah, lalu bersiap untuk momen seru bersama keluarga.</p>
          {error && <ErrorBox>{data ? 'Koneksi terputus. Mencoba terhubung kembali.' : 'Belum terhubung ke server. Periksa koneksi Anda.'}</ErrorBox>}
          {data && !data.event.registrationOpen && <ErrorBox>{data.registrationNotice || 'Registrasi sedang ditutup. Silakan hubungi panitia.'}</ErrorBox>}
          <RegistrationForm disabled={!data || !data.event.registrationOpen} onComplete={r => r && setReceipt(r)} />
        </div>}
        <p className="under-panel"><Icon name="lock" size={13} />Data digunakan untuk kehadiran dan undian acara.</p>
      </section>
    </main>
    <footer className="public-footer"><span>UNITED TRACTORS <b>✦</b> PALEMBANG</span><span>Terbang melesat, Lanjakke nian</span><span>FAMILY GATHERING</span></footer>
  </div>;
}
