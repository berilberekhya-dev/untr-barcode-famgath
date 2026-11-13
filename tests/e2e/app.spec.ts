import {test,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import jsQR from 'jsqr';
test('proyektor menampilkan hadiah per slot, reveal berurutan, dan suara sekali per reveal',async({page})=>{
  await page.setViewportSize({width:1920,height:1080});
  await page.addInitScript(()=>{
    const probe=window as typeof window & { drawSounds:string[] };
    probe.drawSounds=[];
    const start=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){
      probe.drawSounds.push(this.loop ? 'snare' : 'brass');
      return start.apply(this,args);
    };
  });
  const sounds=()=>page.evaluate(()=>(window as typeof window & {drawSounds:string[]}).drawSounds);
  const started=Date.now()+1000;
  const prizes=Array.from({length:5},(_,i)=>({slot:i+1,name:`Hadiah Uji Model ${i+1} dengan nama dan ukuran yang panjang`,grand:false}));
  const draws=prizes.map((_,i)=>({id:`catalog-test-${i}`,status:'confirmed',position:i+1,
    fullName:`Peserta Pengujian ${i+1}`,createdAt:started,revealAt:started+3000+i*2000,
    reelNames:['Peserta Pengujian 1','Peserta Pengujian 2','Peserta Pengujian 3','Peserta Pengujian 4','Peserta Pengujian 5'],reelIndex:i}));
  await page.route('**/api/display',route=>route.fulfill({json:{
    event:{demo:false},serverTime:Date.now(),showWinners:false,currentDraws:draws,
    currentSession:{id:'catalog-test',size:5,prizeName:'Door Prize · Ronde 1',prizes},
  }}));
  await page.goto('/layar/doorprize');
  const snareLoaded=page.waitForResponse('**/audio/snare-roll.mp3');
  const brassLoaded=page.waitForResponse('**/audio/brass-reveal.mp3');
  await page.getByRole('button',{name:'Aktifkan suara'}).click();
  expect((await snareLoaded).ok()).toBe(true);
  expect((await brassLoaded).ok()).toBe(true);
  await expect(page.getByRole('button',{name:'Bisukan suara'})).toBeEnabled();
  await expect(page.locator('.stage-prize-list li')).toHaveCount(5);
  await expect(page.locator('.spatial-slot .slot-prize')).toHaveText(prizes.map(p=>p.name));
  await expect(page.locator('.slot-1')).toHaveClass(/slot-revealed/,{timeout:7000});
  await expect(page.locator('.slot-2 .reel-machine')).toHaveClass(/is-spinning/);
  await expect.poll(async()=> (await sounds()).slice(0,2)).toEqual(['snare','brass']);
  await expect(page.locator('.slot-5')).toHaveClass(/slot-revealed/,{timeout:12000});
  await expect.poll(sounds).toEqual(['snare','brass','snare','brass','snare','brass','snare','brass','snare','brass']);
  expect(await page.locator('.slot-4 .slot-prize').evaluate(node=>node.getBoundingClientRect().bottom)).toBeLessThan(1080);
  await page.reload();
  await expect(page.locator('.slot-revealed')).toHaveCount(5);
  await page.getByRole('button',{name:'Aktifkan suara'}).click();
  await expect(page.getByRole('button',{name:'Bisukan suara'})).toBeEnabled();
  expect(await sounds()).toEqual([]);
});
async function login(page:Page){await page.goto('/panitia');await page.getByLabel('Password panitia').fill('e2e-space-password');await page.getByRole('button',{name:'Masuk ke pusat kendali'}).click();await expect(page.getByRole('heading',{name:'Selamat datang, kapten!'})).toBeVisible();}
test('akses API, whitelist NRP, sumber UTS dan privasi publik',async({request})=>{
 expect((await request.get('/api/admin/state')).status()).toBe(401);
 expect((await request.post('/api/registrations/lookup',{data:{nrp:'999999'}})).status()).toBe(404);
 expect((await request.post('/api/registrations',{data:{nrp:'999999',fullName:'X',partySize:1,requestKey:randomUUID()}})).status()).toBe(404);
 const uts=await(await request.post('/api/registrations/lookup',{data:{nrp:'99000001'}})).json();expect(uts).toMatchObject({doorprizeEligible:false,company:'UTS'});
 expect(uts).not.toHaveProperty('plannedSize');
 const data=await(await request.get('/api/display')).json();expect(data.eligibleCount).toBe(60);expect(data.names).not.toContain('Peserta UTS Uji');expect(JSON.stringify(data)).not.toContain('99000001');
});
test('form HP memvalidasi nama dan konfirmasi jumlah lebih, batal lalu lanjut',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/daftar');
 await expect(page.getByLabel('Nama lengkap')).toHaveCount(0);await page.getByLabel('NRP',{exact:false}).fill('000001');
 await expect(page.getByLabel('Nama lengkap')).toHaveValue('Penjelajah Uji 1');await expect(page.getByLabel('Nama lengkap')).toHaveAttribute('readonly','');await expect(page.getByLabel('Perusahaan',{exact:true})).toHaveValue('UT');await expect(page.getByLabel('Perusahaan',{exact:true})).toHaveAttribute('readonly','');await expect(page.getByText('Rencana hadir:',{exact:false})).toHaveCount(0);await expect(page.getByRole('button',{name:'Periksa NRP'})).toHaveCount(0);
 await page.getByRole('button',{name:'5',exact:true}).click();await page.getByRole('button',{name:'Daftar sekarang'}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toContainText('2 orang');await dialog.getByRole('button',{name:'Tunggu, hubungi panitia dulu'}).click();
 expect((await(await page.request.get('/api/display')).json()).confirmedCount).toBe(0);
 await page.getByRole('button',{name:'Daftar sekarang'}).click();await dialog.getByRole('button',{name:'Oke, gapapa'}).click();
 await expect(page.getByRole('heading',{name:'Anda siap berangkat!'})).toBeVisible();await expect(page.getByText('Kupon Makanan: 3',{exact:true})).toBeVisible();await expect(page.getByText('Kursi tersedia hanya untuk 3 orang',{exact:true})).toBeVisible();await expect(page.getByText('(2 Orang tidak terdaftar)',{exact:true})).toBeVisible();await expect(page.getByText('JUMLAH KELUARGA',{exact:true})).toBeVisible();await expect(page.getByText('NOMOR MEJA',{exact:true})).toBeVisible();await expect(page.locator('.ticket-table')).toHaveText('1');await expect(page.locator('.ticket-extra')).toHaveCSS('color','rgb(255, 88, 107)');await expect(page.getByText('Mohon screenshot tiket ini sebagai bukti check-in.',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText('5 Orang',{exact:false}).first()).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/checkin-mobile.png',fullPage:true});
});
test('catatan kurang, alokasi kupon oleh panitia dan kontrol daftar awal',async({page})=>{
 await page.request.post('/api/registrations',{data:{nrp:'000002',fullName:'X',partySize:1,requestKey:randomUUID()}});
 await page.request.post('/api/registrations',{data:{nrp:'99000001',fullName:'X',partySize:1,requestKey:randomUUID()}});
 await login(page);let state=await(await page.request.get('/api/admin/state')).json();
 expect(state.stats).toMatchObject({employees:3,people:7,surplus:2,shortage:2,eligible:60});
 await expect(page.locator('tbody tr').filter({hasText:'99000001'})).toContainText('Tidak ikut undian');
 await page.getByLabel('Kupon sisa dari').selectOption(state.registrations.find((r:any)=>r.nrp==='000002').id);
 await page.getByLabel('Alokasikan untuk').selectOption(state.registrations.find((r:any)=>r.nrp==='000001').id);
 await page.getByLabel('Jumlah kupon').fill('2');await page.getByRole('button',{name:'Alokasikan kupon'}).click();
 await expect.poll(async()=>((await(await page.request.get('/api/admin/state')).json()).stats.shortage)).toBe(0);
 await page.getByRole('link',{name:'Daftar awal / undian'}).click();await page.getByLabel('Cari daftar awal').fill('000060');
 await page.getByRole('button',{name:'Atur Penjelajah Uji 60',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Ikut undian door prize').uncheck();await dialog.getByLabel('Catatan kehadiran').fill('Tidak hadir tanpa keterangan');await dialog.getByRole('button',{name:'Simpan peserta'}).click();
 await expect(dialog).toHaveCount(0);state=await(await page.request.get('/api/admin/state')).json();expect(state.stats.eligible).toBe(59);
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/roster-admin.png',fullPage:true});
});
test('batch tiga, dua gugur, redraw dua slot saja, hadiah dan PDF',async({page,context})=>{
 test.setTimeout(60000);await login(page);await page.getByRole('link',{name:'Door prize',exact:true}).click();
 await page.getByLabel('Nama hadiah').fill('Voucher belanja');await page.getByLabel('Jumlah pemenang sesi').selectOption('3');
 const gift=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=360;c.height=200;const x=c.getContext('2d')!;x.fillStyle='#14204A';x.fillRect(0,0,360,200);x.fillStyle='#FFC928';x.fillRect(100,55,160,110);x.fillStyle='#9E8CFF';x.fillRect(165,55,30,110);x.fillRect(95,75,170,25);return c.toDataURL('image/png').split(',')[1];});
 await page.locator('input[type=file]').setInputFiles({name:'hadiah.png',mimeType:'image/png',buffer:Buffer.from(gift,'base64')});
 await expect(page.locator('.prize-preview img')).toBeVisible();
 const stage=await context.newPage();await stage.setViewportSize({width:1920,height:1080});await stage.goto('/layar/doorprize');
 await page.getByRole('button',{name:'Undi 3 orang',exact:true}).click();await expect(page.locator('.batch-reels .batch-card')).toHaveCount(3);let state=await(await page.request.get('/api/admin/state')).json();const original=state.draws;
 expect(original).toHaveLength(3);expect(new Set(original.map((d:any)=>d.nrp)).size).toBe(3);
 await page.reload();await expect(page.locator('.batch-reels .batch-card')).toHaveCount(3);
 await expect(page.locator('.batch-winner-actions button').first()).toBeEnabled({timeout:10000});
 await expect(stage.locator('.spatial-slot .reel-machine.has-result')).toHaveCount(3,{timeout:4000});
 await expect(stage.getByRole('heading',{name:'Para pemenang',exact:true})).toHaveCount(0);
 const trio=await stage.locator('.spatial-slot').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));expect(Math.max(...trio)-Math.min(...trio)).toBeLessThan(2);
 const sequence=await stage.locator('.reel-track').first().locator('.reel-item span').allTextContents();for(let i=0;i<sequence.length;i++)expect(sequence[i]).toBe(original[0].reelNames[i%original[0].reelNames.length]);
 await stage.screenshot({path:'test-results/batch-three-stage.png',fullPage:true});
 for(const d of [original[0],original[2]]){await page.getByRole('button',{name:`Gugurkan ${d.fullName}`,exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Gugurkan',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
 await page.getByRole('button',{name:'Undi pengganti 2 orang'}).click();await expect(stage.getByTestId('winner-celebration')).toHaveCount(0,{timeout:1500});
 await expect(page.locator('.batch-winner-actions button')).toHaveCount(3);await expect(page.locator('.batch-winner-actions button').first()).toBeEnabled({timeout:10000});
 state=await(await page.request.get('/api/admin/state')).json();expect(state.draws).toHaveLength(5);expect(state.draws.slice(3).map((d:any)=>d.position)).toEqual([1,3]);expect(state.draws.find((d:any)=>d.id===original[1].id).status).toBe('confirmed');
 await expect(stage.locator('.spatial-slot .reel-machine.has-result')).toHaveCount(3,{timeout:4000});await expect(stage.getByTestId('winner-celebration')).toBeVisible();
 await page.locator('.batch-tracking li').filter({hasText:original[1].fullName}).getByRole('button',{name:'Tandai sudah diambil'}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Ekspor PDF'}).click();await(await download).saveAs('test-results/laporan-revisi.pdf');
 await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:'test-results/batch-control.png',fullPage:true});await stage.close();
});
test('sesi lima tampil sekaligus pada proyektor dan tidak mengulang pemenang',async({page,context})=>{
 await login(page);await page.getByRole('link',{name:'Door prize',exact:true}).click();await page.getByLabel('Nama hadiah').fill('Paket hadiah keluarga');await page.getByLabel('Jumlah pemenang sesi').selectOption('5');const image=(await(await page.request.get('/api/admin/state')).json()).sessions[0].prizeImage;await page.locator('input[type=file]').setInputFiles({name:'hadiah.jpeg',mimeType:'image/jpeg',buffer:Buffer.from(image.split(',')[1],'base64')});await expect(page.locator('.prize-preview img')).toBeVisible();await page.getByRole('button',{name:'Undi 5 orang',exact:true}).click();await expect(page.locator('.batch-reels .batch-card')).toHaveCount(5);
 const state=await(await page.request.get('/api/admin/state')).json();expect(new Set(state.draws.map((d:any)=>d.nrp)).size).toBe(10);
 const stage=await context.newPage();await stage.setViewportSize({width:1920,height:1080});await stage.goto('/layar/doorprize');await expect(stage.locator('.spatial-slot .reel-machine.has-result')).toHaveCount(5,{timeout:10000});
 const layout=await stage.locator('.spatial-slot').evaluateAll(es=>es.map(e=>({top:e.getBoundingClientRect().top,left:e.getBoundingClientRect().left})));expect(Math.abs(layout[0].top-layout[4].top)).toBeLessThan(2);expect(Math.abs(layout[1].top-layout[2].top)).toBeLessThan(2);expect(Math.abs(layout[2].top-layout[3].top)).toBeLessThan(2);expect(layout[1].top).toBeGreaterThan(layout[0].top);expect(await stage.locator('.floor-tagline').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight)).toBe(true);expect(await stage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await stage.screenshot({path:'test-results/batch-five-stage.png',fullPage:true});await stage.close();
});
test('rekap 20 hanya tampil setelah persetujuan panitia dan mengikuti perubahan pemenang',async({page,context})=>{
 test.setTimeout(60000);await login(page);const stage=await context.newPage();await stage.setViewportSize({width:1920,height:1080});await stage.goto('/layar/doorprize');
 for(const count of [5,5,2]){const response=await page.request.post('/api/admin/draw',{data:{requestKey:randomUUID(),count,prizeName:'Hadiah penutup'}});expect(response.ok()).toBe(true);const r=await response.json();await expect.poll(()=>Date.now(),{timeout:10000}).toBeGreaterThan(r.draws[0].revealAt);}
 await page.getByRole('link',{name:'Door prize',exact:true}).click();await expect(page.getByRole('dialog',{name:'Sudah 20 pemenang!'})).toBeVisible({timeout:6000});await expect(stage.getByRole('heading',{name:'Para pemenang',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Nanti dulu',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(stage.locator('.finale-grid')).toHaveCount(0);
 await page.getByRole('button',{name:'Tampilkan semua pemenang',exact:true}).click();await expect(stage.locator('.finale-grid li')).toHaveCount(20,{timeout:5000});await expect(stage.getByRole('heading',{name:'Para pemenang',exact:true})).toBeVisible();
 expect(await stage.locator('.finale-tagline').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight)).toBe(true);await stage.screenshot({path:'test-results/finale-20.png',fullPage:true});await stage.reload();await expect(stage.locator('.finale-grid li')).toHaveCount(20);
 const state=await(await page.request.get('/api/admin/state')).json();const d=state.draws.find((d:any)=>d.status==='confirmed'&&!d.receivedAt);await page.request.post(`/api/admin/draws/${d.id}/forfeit`,{data:{}});await expect(stage.locator('.finale-grid')).toHaveCount(0,{timeout:5000});await stage.close();
});
test('dua peserta memakai urutan asli dan jendela tidak menduplikasi nama',async({page})=>{
 const state=await(await page.request.get('/api/display')).json(),base=state.draws[0];const now=Date.now();const draw={...base,id:'two-pool',position:1,status:'confirmed',fullName:'Nama B',reelNames:['Nama A','Nama B'],reelIndex:1,createdAt:now,revealAt:now+6000};
 const session={...state.currentSession,size:1,prizeName:'Uji dua peserta'};await page.route('**/api/display',r=>r.fulfill({json:{...state,showWinners:false,currentSession:session,currentDraw:draw,currentDraws:[draw],serverTime:Date.now()}}));await page.goto('/layar/doorprize');await expect(page.locator('.reel-track')).toBeVisible();
 const rows=await page.locator('.reel-item span').allTextContents();for(let i=0;i<rows.length;i++)expect(rows[i]).toBe(i%2?'Nama B':'Nama A');
 expect(await page.locator('.reel-window').evaluate(e=>Math.abs(e.clientHeight-e.querySelector('.reel-item')!.getBoundingClientRect().height)<2)).toBe(true);
 await expect(page.locator('.reel-machine.has-result')).toBeVisible({timeout:10000});await page.screenshot({path:'test-results/two-pool.png',fullPage:true});
});
test('QR bisa dipindai, identitas acara, form mobile dan reduced motion',async({page})=>{
 await page.goto('/layar/registrasi');await expect(page.getByRole('heading',{name:'Terbang Melesat, Lanjakke Nian'})).toBeVisible();await expect(page.locator('.qr-white img')).toBeVisible();
 const pixels=await page.locator('.qr-white img').evaluate((img:HTMLImageElement)=>{const c=document.createElement('canvas');c.width=300;c.height=300;const x=c.getContext('2d')!;x.drawImage(img,0,0,300,300);return Array.from(x.getImageData(0,0,300,300).data);});expect(jsQR(new Uint8ClampedArray(pixels),300,300)?.data).toBe('http://127.0.0.1:3100/daftar');
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});await page.goto('/daftar');await expect(page.getByLabel('NRP',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Periksa NRP'})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/form-revisi-mobile.png',fullPage:true});
});

test('lookup otomatis tidak memakai jawaban lama setelah NRP diganti',async({page})=>{
 await page.route('**/api/registrations/lookup',async route=>{if(route.request().postDataJSON().nrp==='000007')await new Promise(resolve=>setTimeout(resolve,900));await route.continue();});
 await page.goto('/daftar');const firstSent=page.waitForRequest(r=>r.url().endsWith('/api/registrations/lookup')&&r.postDataJSON().nrp==='000007');const firstResponse=page.waitForResponse(r=>r.url().endsWith('/api/registrations/lookup')&&r.request().postDataJSON().nrp==='000007');
 await page.getByLabel('NRP',{exact:false}).fill('000007');await firstSent;await page.getByLabel('NRP',{exact:false}).fill('000008');await expect(page.getByLabel('Nama lengkap')).toHaveValue('Penjelajah Uji 8');await firstResponse;await expect(page.getByLabel('Nama lengkap')).toHaveValue('Penjelajah Uji 8');await expect(page.getByLabel('Perusahaan',{exact:true})).toHaveValue('UT');await expect(page.getByText('Rencana hadir:',{exact:false})).toHaveCount(0);
 await page.screenshot({path:'test-results/auto-nrp-fields.png',fullPage:true});
});

test('tiket lama di browser diperbarui dengan meja tanpa check-in ulang',async({page})=>{
 await login(page);const state=await(await page.request.get('/api/admin/state')).json();const r=state.registrations.find((r:any)=>r.nrp==='000001');const old={...r};delete old.tableNumber;delete old.seatCount;
 await page.evaluate(receipt=>localStorage.setItem('ut-attendance-receipt-v3',JSON.stringify(receipt)),old);await page.goto('/daftar');await expect(page.locator('.ticket-table')).toHaveText('1');
 const after=await(await page.request.get('/api/admin/state')).json();expect(after.registrations.length).toBe(state.registrations.length);
});
