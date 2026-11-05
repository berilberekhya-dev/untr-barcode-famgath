'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminState, EventSettings, Registration } from '@/lib/types';
import { api, ApiError, Brand, Connection, DemoBanner, ErrorBox, formatTime, Loading, Modal, usePoll } from './shared';
import { Astronaut, Planet } from './art';
import { Icon } from './icon';
import { RegistrationForm } from './registration-form';
import { Login } from './login';
import { DrawControl } from './draw';
import { RosterAdmin, CouponAdmin } from './roster-admin';

export function AdminApp({ doorprize = false, initialSection = 'overview' }: { doorprize?: boolean; initialSection?: 'overview' | 'participants' | 'settings' | 'roster' }) {
  const { data, error, refresh } = usePoll<AdminState>('/api/admin/state');
  const [section, setSection] = useState<'overview' | 'participants' | 'settings' | 'roster'>(initialSection);
  const [modal, setModal] = useState<'add' | Registration | null>(null);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');
  const router = useRouter();
  if (error instanceof ApiError && error.status === 401) return <Login />;
  const exportPdf = async () => {
    setExporting(true); setNotice('');
    try {
      const state = await api<AdminState>('/api/admin/export');
      const { buildReport } = await import('@/lib/report');
      const doc = await buildReport(state); doc.save(`UT-Palembang-${state.event.demo ? 'demo-' : ''}laporan-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) { setNotice((e as Error).message); }
    finally { setExporting(false); }
  };
  return <div className="admin-app">
    <aside className="sidebar"><Brand compact /><div className="sidebar-divider" /><span className="nav-label">PUSAT KENDALI</span>
      <nav aria-label="Navigasi panitia">
        <Link href="/panitia" className={!doorprize && section === 'overview' ? 'active' : ''} onClick={() => setSection('overview')}><Icon name="dashboard" />Ringkasan</Link>
        <Link href="/panitia?view=participants" className={!doorprize && section === 'participants' ? 'active' : ''} onClick={e => { if (!doorprize) { e.preventDefault(); setSection('participants'); } }}><Icon name="people" />Peserta{data && <span className="nav-count">{data.stats.employees}</span>}</Link>
        <Link href="/panitia/doorprize" className={doorprize ? 'active' : ''}><Icon name="gift" />Door prize</Link>
        <Link href="/panitia?view=settings" className={!doorprize && section === 'settings' ? 'active' : ''} onClick={e => { if (!doorprize) { e.preventDefault(); setSection('settings'); } }}><Icon name="settings" />Pengaturan</Link>
      </nav>
      <nav><Link href="/panitia?view=roster" className={section==='roster'&&!doorprize?'active':''} onClick={e=>{if(!doorprize){e.preventDefault();setSection('roster');}}}><Icon name="people"/>Daftar awal / undian</Link></nav><span className="nav-label second-label">LAYAR ACARA</span><nav aria-label="Layar publik"><Link href="/layar/registrasi" target="_blank"><Icon name="qr" />QR registrasi<Icon name="external" size={14} /></Link><Link href="/layar/doorprize" target="_blank"><Icon name="rocket" />Layar door prize<Icon name="external" size={14} /></Link></nav>
      <div className="sidebar-mission"><Planet purple /><span className="eyebrow">TERBANG MELESAT,</span><strong>Lanjakke nian</strong><p>Momen berharga dimulai<br />dari kebersamaan.</p></div>
      <div className="sidebar-bottom"><div className="operator-avatar">UT</div><div><strong>Panitia acara</strong><small>United Tractors Palembang</small></div><button aria-label="Keluar dari akun panitia" className="icon-button" onClick={async () => { try { await api('/api/admin/logout', {}); router.refresh(); } catch (e) { setNotice((e as Error).message); } }}><Icon name="logout" size={18} /></button></div>
    </aside>
    <div className="admin-content"><DemoBanner demo={data?.event.demo} /><header className="admin-topbar"><span><span className="muted">Pusat kendali</span><Icon name="chevron" size={14} />{doorprize ? 'Door prize' : section === 'roster' ? 'Daftar awal / undian' : section === 'settings' ? 'Pengaturan' : section === 'participants' ? 'Peserta' : 'Ringkasan'}</span><Connection error={error} /></header>
      <main className="admin-main">
        <div className="page-heading"><div><p className="eyebrow">FAMILY GATHERING / UT PALEMBANG</p><h1>{doorprize ? 'Saatnya berbagi kejutan.' : section === 'roster' ? 'Kelola daftar awal.' : section === 'settings' ? 'Atur perjalanan kita.' : section === 'participants' ? 'Para penjelajah kita.' : 'Selamat datang, kapten!'}</h1><p className="muted">{doorprize ? 'Siapkan hadiah, pilih jumlah pemenang, lalu mulai undian.' : section === 'settings' ? 'Siapkan informasi acara dan jumlah pemenang.' : 'Semua persiapan kebersamaan, dalam satu pusat kendali.'}</p></div><div className="page-actions"><Link href="/layar/registrasi" target="_blank" className="button button-secondary"><Icon name="qr" size={17} />QR registrasi</Link><button className="button button-secondary" onClick={exportPdf} disabled={exporting || !data}><Icon name="download" size={17} />{exporting ? 'Menyiapkan PDF…' : 'Ekspor PDF'}</button></div></div>
        {notice && <ErrorBox>{notice}</ErrorBox>}
        {!data ? error ? <ErrorBox>{error.message}</ErrorBox> : <Loading /> : doorprize ? <DrawControl data={data} refresh={refresh} /> : section === 'roster' ? <RosterAdmin data={data} refresh={refresh}/> : section === 'settings' ? <EventForm key={section} event={data.event} onComplete={async () => { await refresh(); setNotice(''); }} /> : <>
          {section === 'overview' && <>
            <div className="mission-banner"><div><span className="badge badge-yellow"><span className="tiny-square" />MISI KEBERSAMAAN</span><h2>Terbang melesat,<br /><span>Lanjakke nian</span></h2><p>{data.event.title}</p><Link href="/layar/registrasi" target="_blank" className="banner-link">Buka layar registrasi<Icon name="arrow" size={18} /></Link></div><div className="banner-art"><Planet className="banner-planet" /><Astronaut /><i className="banner-star">✦</i></div><span className={`banner-status ${data.event.registrationOpen ? '' : 'is-closed'}`}><i />Registrasi {data.event.registrationOpen ? 'dibuka' : 'ditutup'}</span></div>
            <div className="stats-grid">{[
              { label: 'Karyawan sudah check-in', value: data.stats.employees, icon: 'people', color: 'purple', detail: 'NRP unik' },
              { label: 'Total kehadiran', value: data.stats.people, icon: 'rocket', color: 'mint', detail: 'Termasuk anggota keluarga' },
              { label: 'Peserta tersisa dalam undian', value: data.stats.eligible, icon: 'gift', color: 'yellow', detail: 'Belum pernah keluar sebagai hasil undian' },
              { label: 'Pemenang', value: `${data.stats.confirmed} / ${data.event.targetWinners}`, icon: 'trophy', color: 'pink', detail: `${data.stats.received} hadiah sudah diambil` },
            ].map(stat => <div className="stat-card" key={stat.label}><div className={`stat-icon ${stat.color}`}><Icon name={stat.icon} /></div><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.detail}</small></div>)}</div>
          </>}
          <CouponAdmin data={data} refresh={refresh}/><ParticipantTable data={data} onEdit={setModal} onAdd={() => setModal('add')} />
          <div className="admin-bottom-note"><span><span className="tiny-square" />Data tersimpan otomatis</span><span>PALEMBANG · WIB (UTC+7)</span></div>
        </>}
      </main>
    </div>
    {modal && <Modal title={modal === 'add' ? 'Daftarkan penjelajah' : 'Koreksi data peserta'} onClose={() => setModal(null)}><RegistrationForm assisted initial={modal === 'add' ? undefined : modal} onComplete={async () => { setModal(null); await refresh(); }} /></Modal>}
  </div>;
}

function ParticipantTable({ data, onEdit, onAdd }: { data: AdminState; onEdit: (r: Registration) => void; onAdd: () => void }) {
  const [search, setSearch] = useState(''); const [page, setPage] = useState(0);
  const rows = data.registrations.filter(r => `${r.nrp} ${r.fullName}`.toLowerCase().includes(search.toLowerCase()));
  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / 8) - 1));
  const visible = rows.slice(safePage * 8, safePage * 8 + 8);
  const drawn = new Map(data.draws.map(d => [d.nrp, d]));
  return <section className="table-panel"><div className="table-heading"><div><h2>Daftar peserta <span className="count-badge">{data.stats.employees}</span></h2><p className="muted">Keluarga besar yang siap menjelajah bersama.</p></div><button className="button button-primary button-small" onClick={onAdd}><Icon name="plus" size={17} />Tambah peserta</button></div>
    <div className="table-toolbar"><div className="input-icon search-input"><Icon name="search" size={18} /><input aria-label="Cari nama atau NRP" placeholder="Cari nama atau NRP…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></div><span className="table-live"><i />Diperbarui otomatis</span></div>
    <div className="table-scroll"><table><thead><tr><th>NO.</th><th>NAMA PESERTA / NRP</th><th>KELUARGA / HADIR / KUPON / KURSI</th><th>MEJA</th><th>REGISTRASI</th><th>DOOR PRIZE</th><th><span className="sr-only">Tindakan</span></th></tr></thead><tbody>
      {visible.map((r, i) => { const draw = drawn.get(r.nrp); const canDraw=data.roster.some(p=>p.nrp===r.nrp&&p.source==='excel'&&p.drawEnabled); return <tr key={r.id}><td className="row-number">{String(safePage * 8 + i + 1).padStart(2, '0')}</td><td><div className="participant-name"><span className={`name-avatar avatar-${i % 4}`}>{r.fullName.split(' ').map(s => s[0]).slice(0, 2).join('')}</span><div><strong>{r.fullName}</strong><small className="mono">{r.nrp}</small></div></div></td><td><span className="party-count"><Icon name="people" size={15} />{r.plannedSize} / {r.partySize} / {r.couponCount} / {r.seatCount}</span><small className="table-subtext">{r.partySize>r.plannedSize?`Lebih ${r.partySize-r.plannedSize}`:r.partySize<r.plannedSize?`Kurang ${r.plannedSize-r.partySize}`:"Sesuai rencana"} · {r.company}</small></td><td>{r.tableNumber||"—"}</td><td className="muted">{formatTime(r.createdAt)} WIB</td><td><span className={`badge ${draw?.status === 'confirmed' ? 'badge-yellow' : draw?.status === 'forfeited' ? 'badge-red' : draw ? 'badge-purple' : canDraw ? 'badge-mint' : 'badge-purple'}`}>{draw?.status === 'confirmed' ? 'Pemenang' : draw?.status === 'forfeited' ? 'Gugur' : canDraw ? 'Siap diundi' : 'Tidak ikut undian'}</span></td><td><button className="icon-button" onClick={() => onEdit(r)} aria-label={`Edit ${r.fullName}`}><Icon name="edit" size={17} /></button></td></tr>; })}
      {!visible.length && <tr><td colSpan={7}><div className="empty-state"><Icon name="people" size={32} /><h3>{search ? 'Peserta belum ditemukan' : 'Kursi penjelajah masih kosong'}</h3><p>{search ? 'Coba nama atau NRP lainnya.' : 'Buka QR registrasi atau tambahkan peserta pertama.'}</p></div></td></tr>}
    </tbody></table></div><div className="table-pagination"><span>Menampilkan {rows.length ? safePage * 8 + 1 : 0}–{Math.min((safePage + 1) * 8, rows.length)} dari {rows.length} peserta</span><div><button className="pagination-button prev" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Halaman sebelumnya"><Icon name="chevron" size={15} /></button><span>{safePage + 1}</span><button className="pagination-button" disabled={(safePage + 1) * 8 >= rows.length} onClick={() => setPage(safePage + 1)} aria-label="Halaman berikutnya"><Icon name="chevron" size={15} /></button></div></div>
  </section>;
}

function EventForm({ event, onComplete }: { event: EventSettings; onComplete: () => Promise<void> }) {
  const [form, setForm] = useState(event); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  const change = (values: Partial<EventSettings>) => { setForm({ ...form, ...values }); setSaved(false); };
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { await api('/api/admin/event', form, 'PATCH'); await onComplete(); setSaved(true); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <section className="settings-panel pixel-panel"><div className="section-heading"><div className="stat-icon purple"><Icon name="settings" /></div><div><h2>Informasi acara</h2><p className="muted">Perubahan langsung tampil di layar peserta.</p></div></div><form onSubmit={submit}><fieldset disabled={busy}><label htmlFor="event-title">Nama acara</label><input id="event-title" required maxLength={200} value={form.title} onChange={e => change({ title: e.target.value })} /><div className="form-two-columns"><div><label htmlFor="event-date">Tanggal acara</label><input id="event-date" type="date" value={form.date} onChange={e => change({ date: e.target.value })} /></div><div><label htmlFor="target">Target pemenang</label><input id="target" type="number" min={1} max={1000} required value={Number.isNaN(form.targetWinners) ? '' : form.targetWinners} onChange={e => change({ targetWinners: e.target.valueAsNumber })} /></div></div><label htmlFor="venue">Lokasi acara</label><input id="venue" maxLength={200} value={form.venue} onChange={e => change({ venue: e.target.value })} /><label className="toggle-row" htmlFor="registration-open"><span><strong>Buka registrasi peserta</strong><small>Peserta dapat mendaftar melalui QR.</small></span><input type="checkbox" id="registration-open" checked={form.registrationOpen} onChange={e => change({ registrationOpen: e.target.checked })} /></label>{error && <ErrorBox>{error}</ErrorBox>}{saved && <p role="status" className="success-note"><Icon name="check" size={18} />Pengaturan tersimpan.</p>}<button className="button button-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan pengaturan'}<Icon name="check" size={18} /></button></fieldset></form></section>;
}
