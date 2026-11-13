import {beforeEach,afterEach,it,expect} from 'vitest';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createDatabase,type Database} from '../src/lib/database';
import {GatheringService} from '../src/lib/service';
import {formatPersonName} from '../src/lib/person-name';
import {verifyPassword,createSession,verifySession} from '../src/lib/auth';
import {Pool} from 'pg';
let db:Database,s:GatheringService,clock:number,url:string;
const endpoint='http://localhost/daftar';
const entry=(i:number)=>({nrp:String(i).padStart(6,'0'),fullName:`Peserta ${i}`,company:'UT',plannedSize:3,source:'excel',drawEnabled:true,tableNumber:String(i%34+1)});
const payload=(i=1,partySize=3)=>({nrp:entry(i).nrp,fullName:entry(i).fullName,partySize,requestKey:randomUUID()});
beforeEach(async()=>{
 if(process.env.UT_TEST_POSTGRES_URL){
  const base=new URL(process.env.UT_TEST_POSTGRES_URL);
  if(base.hostname!=='127.0.0.1'||base.port!=='55432')throw new Error('Tes PostgreSQL hanya boleh menggunakan cluster lokal sementara.');
  const admin=new Pool({connectionString:base.toString()});const name=`ut_test_${randomUUID().replaceAll('-','')}`;
  try{await admin.query(`CREATE DATABASE ${name}`);}finally{await admin.end();}
  base.pathname=`/${name}`;url=base.toString();
 }else url=`file:${join(mkdtempSync(join(tmpdir(),'ut-v3-')),'event.db').replaceAll('\\','/')}`;
 db=createDatabase(url);clock=Date.now();s=new GatheringService(db,()=>clock);await s.importRoster([...Array.from({length:50},(_,i)=>entry(i+1)),{...entry(99),source:'uts',drawEnabled:false,plannedSize:1,company:'UTS'}]);
});
afterEach(async()=>{await db?.client.close();});
it('katalog mengunci hadiah dan urutan reveal, termasuk pengganti dan grand prize', async () => {
  for (let slot = 1; slot <= 8; slot++) {
    await db.client.execute({
      sql: 'INSERT INTO prize_catalog(slot,name,grand) VALUES(?,?,?)',
      args: [slot, `Hadiah Uji ${slot}`, Number(slot > 5)],
    });
  }
  await s.updateEvent({ ...(await s.state(endpoint)).event, targetWinners: 8 });
  const request = { requestKey: randomUUID(), catalogSlot: 1 };
  const first = await s.draw(request);
  expect(first.draws.map(draw => draw.revealAt - draw.createdAt)).toEqual([8000, 11000, 14000, 17000, 20000]);
  expect((await s.draw(request)).session).toEqual(first.session);
  clock += 11001;
  await expect(s.draw({ requestKey: randomUUID(), catalogSlot: 6 })).rejects.toMatchObject({status:409});
  clock += 9000;
  await expect(s.draw({ requestKey: randomUUID(), catalogSlot: 1 })).rejects.toMatchObject({status:409});
  await s.forfeit(first.draws[2].id);
  const replacement = await s.draw({ requestKey: randomUUID(), sessionId: first.session.id });
  expect(replacement.draws.map(draw => draw.position)).toEqual([3]);
  expect((await s.display(endpoint)).currentDraw?.prizeName).toBe('Hadiah Uji 3');
  clock += 8001;
  const grand = await s.draw({ requestKey: randomUUID(), catalogSlot: 6 });
  expect(grand.session.prizes).toEqual([{ slot: 6, name: 'Hadiah Uji 6', grand: true }]);
  expect(grand.draws).toHaveLength(1);
  expect(grand.draws[0].revealAt - grand.draws[0].createdAt).toBe(12000);
  expect((await s.state(endpoint)).nextRound?.prizes[0].slot).toBe(7);
});
it('peserta khusus undian baru bisa check-in setelah impor daftar hadir resmi', async () => {
  const person = { ...entry(500), tableNumber: undefined };
  await s.importRoster([person]);
  await db.client.execute({ sql: 'INSERT INTO draw_only_roster(nrp) VALUES(?)', args: [person.nrp] });
  await db.client.execute({ sql: 'UPDATE attendance_roster SET draw_enabled=0 WHERE nrp<>?', args: [person.nrp] });

  const state = await s.state(endpoint);
  expect(state.stats.eligible).toBe(1);
  expect(state.roster.find(row => row.nrp === person.nrp)?.plannedSize).toBe(0);
  expect(state.stats.plannedPeople).toBe(151);
  await expect(s.lookup({ nrp: person.nrp })).rejects.toMatchObject({ status: 404 });
  await expect(s.register(payload(500))).rejects.toMatchObject({ status: 404 });
  expect((await s.draw({ requestKey: randomUUID() })).draws[0].nrp).toBe(person.nrp);

  await s.importRoster([{ ...person, tableNumber: '18' }], true);
  expect(await s.register(payload(500))).toMatchObject({ nrp: person.nrp, tableNumber: '18' });
});
it('daftar awal tidak membuat check-in; UTS tidak ikut undian',async()=>{const a=await s.state(endpoint);expect(a.roster).toHaveLength(51);expect(a.registrations).toHaveLength(0);expect(a.stats.eligible).toBe(50);expect(a.stats.people).toBe(0);});
it('lookup cocok tepat dengan NRP, angka dan nol depan',async()=>{const found=await s.lookup({nrp:'000001'});expect(found.company).toBe('UT');expect(found).not.toHaveProperty('plannedSize');await expect(s.lookup({nrp:'1'})).rejects.toMatchObject({status:404});for(const nrp of ['001a','+123','1e3','12 3'])await expect(s.register({...payload(),nrp})).rejects.toThrow();});
it('NRP tidak terdaftar ditolak untuk peserta maupun bantuan panitia',async()=>{for(const assisted of [false,true])await expect(s.register(payload(1000),assisted)).rejects.toMatchObject({status:404});});
it('nama dan perusahaan check-in berasal dari daftar resmi',async()=>{const a=await s.register({...payload(),fullName:'Nama palsu'});expect(a.fullName).toBe('Peserta 1');expect(a.company).toBe('UT');expect(a.nrp).toBe('000001');});
it('jumlah lebih memerlukan konfirmasi dan tidak otomatis mendapat tambahan kupon',async()=>{await expect(s.register(payload(1,5))).rejects.toMatchObject({status:409,details:{code:'EXCESS_ATTENDANCE',extra:2}});expect((await s.state(endpoint)).registrations).toHaveLength(0);const r=await s.register({...payload(1,5),acknowledgedExtra:true});expect(r.couponCount).toBe(3);expect((await s.state(endpoint)).stats.shortage).toBe(2);});
it('jumlah kurang dicatat dan alokasi sisa hanya dilakukan panitia, idempoten',async()=>{const donor=await s.register(payload(1,1)),recipient=await s.register({...payload(2,5),acknowledgedExtra:true});const op={donorId:donor.id,recipientId:recipient.id,quantity:2,requestKey:randomUUID()};await s.transferCoupons(op);await s.transferCoupons(op);const state=await s.state(endpoint);expect(state.stats.surplus).toBe(0);expect(state.stats.shortage).toBe(0);expect(state.registrations.find(r=>r.id===recipient.id)?.couponCount).toBe(5);await expect(s.transferCoupons({...op,quantity:1,requestKey:randomUUID()})).rejects.toMatchObject({status:409});await expect(s.editRegistration(donor.id,{...payload(1,3)})).rejects.toMatchObject({status:409});});
it('permintaan check-in ulang idempoten; duplikat NRP ditolak',async()=>{const p=payload();const a=await s.register(p);expect((await s.register(p)).id).toBe(a.id);await expect(s.register({...p,requestKey:randomUUID()})).rejects.toMatchObject({status:409});await expect(s.register({...p,partySize:1})).rejects.toMatchObject({status:409});});
it('registrasi tutup tetap mengizinkan bantuan panitia yang NRP-nya valid',async()=>{await s.updateEvent({...((await s.state(endpoint)).event),registrationOpen:false});await expect(s.register(payload())).rejects.toMatchObject({status:403});await s.register(payload(),true);});
it('30 check-in bersamaan tidak hilang',async()=>{const rs=await Promise.allSettled(Array.from({length:30},(_,i)=>s.register(payload(i+1))));expect(rs.every(r=>r.status==='fulfilled')).toBe(true);expect((await s.state(endpoint)).stats.people).toBe(90);});
it('mengundi lima sekaligus tanpa perlu check-in dan tanpa peserta UTS',async()=>{const r=await s.draw({requestKey:randomUUID(),count:5,prizeName:'Sepeda'});expect(r.draws).toHaveLength(5);expect(new Set(r.draws.map(d=>d.nrp)).size).toBe(5);expect(r.draws.every(d=>d.nrp!=='000099'&&d.status==='confirmed')).toBe(true);expect((await s.state(endpoint)).registrations).toHaveLength(0);});
it('tiga pemenang, dua gugur: redraw hanya dua slot dengan sesi hadiah sama',async()=>{const r=await s.draw({requestKey:randomUUID(),count:3,prizeName:'Televisi'});clock+=6001;await s.forfeit(r.draws[0].id);await s.forfeit(r.draws[2].id);const op={requestKey:randomUUID(),sessionId:r.session.id};const redo=await s.draw(op);expect(redo.draws.map(d=>d.position)).toEqual([1,3]);expect(redo.session.prizeName).toBe('Televisi');expect(redo.draws.every(d=>!r.draws.some(old=>old.rosterId===d.rosterId))).toBe(true);expect((await s.draw(op)).draws.map(d=>d.id)).toEqual(redo.draws.map(d=>d.id));expect((await s.state(endpoint)).stats.confirmed).toBe(3);});
it('dua operator bersamaan dan klik ulang tidak menciptakan sesi tambahan',async()=>{const otherDB=createDatabase(url);const other=new GatheringService(otherDB,()=>clock);await otherDB.ready();const p={requestKey:randomUUID(),count:3};try{const rs=await Promise.allSettled([s.draw(p),other.draw(p),other.draw({requestKey:randomUUID(),count:3})]);expect(rs.some(r=>r.status==='fulfilled')).toBe(true);expect((await s.state(endpoint)).sessions).toHaveLength(1);expect((await s.state(endpoint)).draws).toHaveLength(3);}finally{await otherDB.client.close();}});
it('idempotensi tidak menerima perubahan jumlah atau hadiah',async()=>{const p={requestKey:randomUUID(),count:3};await s.draw(p);await expect(s.draw({...p,count:5})).rejects.toMatchObject({status:409});});
it('target 20 pemenang tidak berulang dan tidak terlewati',async()=>{const ids=new Set();for(let i=0;i<4;i++){const r=await s.draw({requestKey:randomUUID(),count:5});r.draws.forEach(d=>ids.add(d.rosterId));clock+=6001;}expect(ids.size).toBe(20);await expect(s.draw({requestKey:randomUUID()})).rejects.toMatchObject({status:409});});
it('edit/hapus daftar undian tetap melindungi UTS serta riwayat identitas',async()=>{let a=await s.state(endpoint);const r=a.roster.find(r=>r.source==='excel')!;await s.editRoster(r.id,{...r,drawEnabled:false,attendanceNote:'Tidak hadir tanpa keterangan'});expect((await s.state(endpoint)).stats.eligible).toBe(49);const uts=a.roster.find(r=>r.source==='uts')!;await expect(s.editRoster(uts.id,{...uts,drawEnabled:true})).rejects.toThrow();const d=(await s.draw({requestKey:randomUUID()})).draws[0];clock+=6001;a=await s.state(endpoint);const selected=a.roster.find(r=>r.id===d.rosterId)!;await s.editRoster(selected.id,{...selected,fullName:'Koreksi nama'});expect((await s.state(endpoint)).draws[0].fullName).toBe(d.fullName);});
it('hadiah sudah diambil mencegah gugur dan dapat dikoreksi',async()=>{const d=(await s.draw({requestKey:randomUUID()})).draws[0];await expect(s.forfeit(d.id)).rejects.toMatchObject({status:409});clock+=6001;await s.markReceived(d.id,{received:true});await expect(s.forfeit(d.id)).rejects.toMatchObject({status:409});await s.markReceived(d.id,{received:false});await s.forfeit(d.id);await s.forfeit(d.id);expect((await s.display(endpoint)).draws).toHaveLength(0);});
it('pool tidak cukup menolak batch secara utuh',async()=>{const state=await s.state(endpoint);for(const r of state.roster.filter(r=>r.source==='excel').slice(2))await s.editRoster(r.id,{...r,drawEnabled:false});await expect(s.draw({requestKey:randomUUID(),count:3})).rejects.toMatchObject({status:409});expect((await s.state(endpoint)).sessions).toHaveLength(0);});
it('reel memakai pool asli, indeks sesuai pilihan; publik tidak memuat NRP atau ID internal',async()=>{const r=await s.draw({requestKey:randomUUID(),count:3});for(const d of r.draws){expect(d.reelNames).toHaveLength(50);expect(d.reelNames[d.reelIndex]).toBe(d.fullName);}const p=JSON.stringify(await s.display(endpoint));for(const field of ['"nrp"','rosterId','requestKey','company','plannedSize'])expect(p).not.toContain(field);});
it('hasil bertahan setelah restart termasuk batch, sesi, dan waktu reveal',async()=>{const r=await s.draw({requestKey:randomUUID(),count:3});const other=createDatabase(url);try{const a=await new GatheringService(other,()=>clock).state(endpoint);expect(a.draws.map(d=>d.id)).toEqual(r.draws.map(d=>d.id));expect(a.sessions[0].id).toBe(r.session.id);}finally{await other.client.close();}});
it('import ulang tidak menimpa keputusan panitia',async()=>{const r=(await s.state(endpoint)).roster[0];await s.editRoster(r.id,{...r,drawEnabled:false,attendanceNote:'Izin'});await s.importRoster([entry(Number(r.nrp))]);expect((await s.state(endpoint)).roster.find(e=>e.id===r.id)?.drawEnabled).toBe(false);});
it('gambar SVG/isi palsu ditolak dan sesi tidak dibuat',async()=>{await expect(s.draw({requestKey:randomUUID(),prizeImage:'data:image/svg+xml;base64,AAAA'})).rejects.toThrow();expect((await s.state(endpoint)).sessions).toHaveLength(0);});
it('sesi panitia tetap memverifikasi tanda tangan',()=>{process.env.ADMIN_PASSWORD='unit-test-admin-pass';process.env.SESSION_SECRET='test-session-secret-at-least-thirty-two-characters';expect(verifyPassword('unit-test-admin-pass')).toBe(true);const t=createSession();expect(verifySession(t)).toBe(true);expect(verifySession(t+'a')).toBe(false);});

it('rekap akhir harus dibuka panitia setelah 20 selesai, bertahan setelah restart, dan tersembunyi saat gugur',async()=>{
 await expect(s.setWinnerDisplay({showWinners:true})).rejects.toMatchObject({status:409});
 let last;
 for(let i=0;i<4;i++){last=await s.draw({requestKey:randomUUID(),count:5});if(i<3)clock+=6001;}
 await expect(s.setWinnerDisplay({showWinners:true})).rejects.toMatchObject({status:409});clock+=6001;
 expect((await s.display(endpoint)).showWinners).toBe(false);
 await s.setWinnerDisplay({showWinners:true});expect((await s.display(endpoint)).showWinners).toBe(true);
 const other=createDatabase(url);try{expect((await new GatheringService(other,()=>clock).display(endpoint)).showWinners).toBe(true);}finally{await other.client.close();}
 await s.forfeit(last!.draws[0].id);expect((await s.display(endpoint)).showWinners).toBe(false);
 await expect(s.setWinnerDisplay({showWinners:true})).rejects.toMatchObject({status:409});
 await s.draw({requestKey:randomUUID(),sessionId:last!.session.id});clock+=6001;
 expect((await s.display(endpoint)).showWinners).toBe(false);await s.setWinnerDisplay({showWinners:true});expect((await s.display(endpoint)).showWinners).toBe(true);
});

it('nama seragam dalam word case sambil menjaga inisial dan penulisan khusus',()=>{
 expect(formatPersonName('PENJELAJAH UTAMA')).toBe('Penjelajah Utama');
 expect(formatPersonName('awak kapal bintang')).toBe('Awak Kapal Bintang');
 expect(formatPersonName('A. ORION')).toBe('A. Orion');
 expect(formatPersonName('KRU ORBIT SATU')).toBe('Kru Orbit Satu');
 expect(formatPersonName('Penjelajah ORION')).toBe('Penjelajah ORION');
 expect(formatPersonName('john McDonald')).toBe('John McDonald');
});

it('tiket 7 hadir dengan 5 terdaftar memberi 5 kupon, 5 kursi dan meja tetap',async()=>{
 await s.importRoster([{...entry(500),plannedSize:5,tableNumber:'18'}]);
 const r=await s.register({...payload(500,7),acknowledgedExtra:true});
 expect(r).toMatchObject({partySize:7,plannedSize:5,couponCount:5,seatCount:5,tableNumber:'18'});
 await s.importRoster([{...entry(500),plannedSize:5,tableNumber:'19'}],true);
 expect((await s.receipt({id:r.id,nrp:r.nrp})).tableNumber).toBe('18');
 await expect(s.receipt({id:r.id,nrp:'000001'})).rejects.toMatchObject({status:404});
});
it('tiket lama memperoleh meja baru tanpa mendaftar lagi, impor mempertahankan keputusan panitia',async()=>{
 await s.importRoster([{...entry(700),tableNumber:undefined}]);
 const r=await s.register(payload(700));expect(r.tableNumber).toBeNull();
 const old=(await s.state(endpoint)).roster.find(r=>r.nrp==='000700')!;
 await s.editRoster(old.id,{...old,drawEnabled:false,attendanceNote:'Izin panitia'});
 await s.importRoster([{...entry(700),tableNumber:'7'}],true);
 expect((await s.receipt({id:r.id,nrp:r.nrp})).tableNumber).toBe('7');
 const updated=(await s.state(endpoint)).roster.find(r=>r.id===old.id)!;
 expect(updated.drawEnabled).toBe(false);expect(updated.attendanceNote).toBe('Izin panitia');
 expect((await s.state(endpoint)).registrations).toHaveLength(1);
});
