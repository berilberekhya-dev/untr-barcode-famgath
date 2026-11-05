import type { AdminState } from './types';
const time = (value: number) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' }).format(value);
export async function buildReport(state: AdminState) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let logo: Uint8Array | undefined;
  try {
    const response = await fetch('/brand/united-tractors-white.png');
    if (response.ok) logo = new Uint8Array(await response.arrayBuffer());
  } catch { /* The report remains available if the static asset cannot be reached. */ }
  doc.setProperties({ title: state.event.title, subject: 'Rekap registrasi dan door prize', author: 'United Tractors Palembang' });
  const generated = time(Date.now());
  const header = () => {
    doc.setFillColor(20, 32, 74); doc.rect(0, 0, 297, 24, 'F');
    doc.setTextColor(255, 201, 40); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(doc.splitTextToSize(state.event.title, logo ? 196 : 220)[0], 12, 11);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(238, 243, 255);
    const eventDate = state.event.date ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(`${state.event.date}T12:00:00+07:00`)) : 'Tanggal belum diisi';
    doc.text(`${eventDate} | Terbang melesat, Lanjakke nian${state.event.demo ? ' | DATA DEMO' : ''}`, 12, 17);
    doc.setFontSize(6.5); doc.text(`Dibuat ${generated} WIB`, 12, 21);
    if (logo) {
      doc.addImage(logo, 'PNG', 223, 6, 59, 59 * 50 / 250);
    }
  };
  header();
  doc.setTextColor(30, 40, 60); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(`REGISTRASI  |  ${state.stats.employees} karyawan  |  ${state.stats.people} orang hadir  |  ${state.stats.confirmed} pemenang  |  ${state.stats.received} hadiah diambil`, 12, 34);
  autoTable(doc, {
    startY: 40, margin: { top: 31, bottom: 15, left: 12, right: 12 },
    head: [['NRP', 'Nama lengkap', 'Perusahaan', 'Rencana', 'Hadir', 'Selisih', 'Kupon', 'Kursi', 'Meja', 'Waktu (WIB)']],
    body: state.registrations.length ? [...state.registrations].reverse().map(r => [r.nrp, r.fullName, r.company, r.plannedSize, r.partySize, r.partySize-r.plannedSize, r.couponCount, r.seatCount, r.tableNumber||'-', time(r.createdAt)]) : [['-', 'Belum ada check-in', '-', '-', '-', '-', '-', '-']],
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [20, 32, 74] }, alternateRowStyles: { fillColor: [244, 247, 252] },

    didDrawPage: header,
  });
  doc.addPage(); header(); doc.setTextColor(30, 40, 60); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('DOOR PRIZE & RIWAYAT KEPUTUSAN PANITIA', 12, 34);
  const labels = { confirmed: 'Pemenang', forfeited: 'Gugur' };
  autoTable(doc, {
    startY: 40, margin: { top: 31, bottom: 15, left: 12, right: 12 },
    head: [['Slot', 'NRP', 'Nama terpilih', 'Status', 'Nama hadiah', 'Pengambilan', 'Dipilih (WIB)']],
    body: state.draws.length ? state.draws.map(d => [d.slot, d.nrp, d.fullName, labels[d.status], state.sessions.find(s=>s.id===d.sessionId)?.prizeName||'-', d.status === 'confirmed' ? d.receivedAt ? `Diambil ${time(d.receivedAt)}` : 'Belum diambil' : '-', time(d.createdAt)]) : [['-', '-', 'Belum ada undian', '-', '-', '-', '-']],
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [20, 32, 74] }, alternateRowStyles: { fillColor: [244, 247, 252] },

    didDrawPage: header,
  });
  doc.addPage(); header(); doc.setTextColor(30,40,60);doc.setFontSize(11);doc.setFont('helvetica','bold');
  doc.text(`DAFTAR AWAL | ${state.roster.length} NRP | ${state.stats.plannedPeople} rencana hadir | ${state.stats.surplus} kupon sisa | ${state.stats.shortage} kekurangan`,12,34);
  autoTable(doc,{startY:40,margin:{top:31,bottom:15,left:12,right:12},head:[['NRP','Nama','Perusahaan','Keluarga','Meja','Check-in','Undian','Catatan']],body:state.roster.map(r=>[r.nrp,r.fullName,r.company,r.plannedSize,r.tableNumber||'-',state.registrations.some(c=>c.nrp===r.nrp)?'Sudah':'Belum',r.source==='uts'?'UTS - tidak ikut':state.draws.some(d=>d.rosterId===r.id)?'Sudah terpilih':r.drawEnabled?'Ikut':'Dikeluarkan',r.attendanceNote||'-']),styles:{fontSize:8,cellPadding:3,overflow:'linebreak'},headStyles:{fillColor:[20,32,74]},didDrawPage:header});
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) { doc.setPage(i); doc.setTextColor(100); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(`Halaman ${i} / ${total}  |  Jumlah hadir termasuk karyawan itu sendiri.`, 12, 203); }
  return doc;
}
