import { randomInt, randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import type { StorageTransaction } from './storage';
import { getDatabase, retryBusy, type Database } from './database';
import type { AdminState, CatalogPrize, DisplayState, Draw, PrizeSession, Registration, RosterEntry } from './types';
import {formatPersonName} from './person-name';
import { slotPrize, upcomingRound } from './prizes';

export class AppError extends Error { constructor(message: string, public status = 400, public details?: Record<string, unknown>) { super(message); } }
const text = (max: number) => z.string().trim().min(1, 'Wajib diisi.').max(max).transform(v => v.replace(/\s+/g, ' '));
const nrpSchema = z.string().trim().min(1).max(64).regex(/^[0-9]+$/, 'NRP hanya boleh berisi angka');
export const registrationSchema = z.object({ nrp: nrpSchema, fullName: text(160), partySize: z.number().int().min(1).max(999), requestKey: z.string().uuid(), acknowledgedExtra: z.boolean().default(false) });
export const eventSchema = z.object({ title: text(200), date: z.union([z.literal(''), z.iso.date()]), venue: z.string().trim().max(200), targetWinners: z.number().int().min(1).max(1000), registrationOpen: z.boolean() });
const rosterSchema = z.object({ nrp: nrpSchema, fullName: text(160), company: text(200), plannedSize: z.number().int().min(1).max(999), source: z.enum(['excel','uts']), drawEnabled: z.boolean(), tableNumber:z.string().trim().min(1).max(40).optional() });
const drawSchema = z.object({ requestKey: z.string().uuid(), sessionId: z.string().uuid().optional(), count: z.number().int().min(1).max(5).default(1), prizeName: text(200).default('Door prize'), prizeImage: z.string().max(900000).default(''), catalogSlot: z.number().int().positive().optional() });
type Row = Record<string, unknown>;
const rosterRow = (r: Row): RosterEntry => ({ id:String(r.id), nrp:String(r.nrp), fullName:formatPersonName(String(r.full_name)), company:String(r.company), plannedSize:Number(r.checkin_planned_size), source:r.source as 'excel'|'uts', drawEnabled:Boolean(r.draw_enabled), attendanceNote:String(r.attendance_note), tableNumber:r.table_number==null?null:String(r.table_number) });
const sessionRow = (r: Row): PrizeSession => ({ id:String(r.id), prizeName:String(r.prize_name), prizeImage:String(r.prize_image), size:Number(r.size), baseSlot:Number(r.base_slot), createdAt:Number(r.created_at) });
const catalogRow = (row: Row): CatalogPrize => ({ slot: Number(row.slot), name: String(row.name), grand: Boolean(row.grand) });
function withCatalog(session: PrizeSession, catalog: CatalogPrize[]): PrizeSession {
  return { ...session, prizes: catalog.slice(session.baseSlot - 1, session.baseSlot - 1 + session.size) };
}
async function readSession(tx: StorageTransaction, id: string, catalog: CatalogPrize[]) {
  const row = (await tx.execute({ sql: 'SELECT * FROM prize_sessions WHERE id=?', args: [id] })).rows[0];
  if (!row) throw new AppError('Sesi tidak ditemukan.', 404);
  const session = sessionRow(row);
  const linked = (await tx.execute({ sql: 'SELECT 1 FROM prize_session_catalog WHERE session_id=?', args: [id] })).rows.length;
  return linked ? withCatalog(session, catalog) : session;
}
const drawRow = (r: Row): Draw => ({ id:String(r.id), rosterId:String(r.roster_id), sessionId:String(r.session_id), requestKey:String(r.request_key), position:Number(r.position), slot:Number(r.slot), nrp:String(r.nrp), fullName:formatPersonName(String(r.full_name)), status:r.status as Draw['status'], createdAt:Number(r.created_at), revealAt:Number(r.reveal_at), receivedAt:r.received_at == null ? null : Number(r.received_at), reelNames:(JSON.parse(String(r.reel_names)) as string[]).map(formatPersonName), reelIndex:Number(r.reel_index) });
const registrationSQL = `SELECT r.*,d.planned_size,d.company,d.acknowledged_extra,d.extra_coupons,COALESCE((SELECT table_number FROM registration_seating WHERE registration_id=r.id),(SELECT table_number FROM roster_seating WHERE nrp=r.nrp)) table_number,COALESCE((SELECT SUM(quantity) FROM coupon_transfers WHERE donor_id=r.id),0) transferred_out FROM registrations r JOIN registration_details d ON d.registration_id=r.id`;
const checkInRosterSQL = 'SELECT * FROM attendance_roster WHERE nrp=? AND nrp NOT IN (SELECT nrp FROM draw_only_roster)';
const adminRosterSQL = `SELECT a.*, s.table_number,
  CASE WHEN d.nrp IS NOT NULL THEN 0 ELSE a.planned_size END AS checkin_planned_size
  FROM attendance_roster a LEFT JOIN roster_seating s ON s.nrp=a.nrp
  LEFT JOIN draw_only_roster d ON d.nrp=a.nrp ORDER BY full_name`;
const registrationRow = (r: Row): Registration => ({ id:String(r.id), nrp:String(r.nrp), fullName:formatPersonName(String(r.full_name)), partySize:Number(r.party_size), createdAt:Number(r.created_at), plannedSize:Number(r.planned_size), company:String(r.company), acknowledgedExtra:Boolean(r.acknowledged_extra), extraCoupons:Number(r.extra_coupons), transferredOut:Number(r.transferred_out), couponCount:Math.min(Number(r.party_size),Number(r.planned_size))+Number(r.extra_coupons),seatCount:Math.min(Number(r.party_size),Number(r.planned_size)),tableNumber:r.table_number==null?null:String(r.table_number) });

function validateImage(image: string) {
  if (!image) return;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!match) throw new AppError('Gambar hadiah harus PNG, JPEG, atau WebP.');
  const b=Buffer.from(match[2],'base64');
  const valid=match[1]==='png' ? b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : match[1]==='jpeg' ? b[0]===255&&b[1]===216&&b[2]===255 : b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
  if (!valid) throw new AppError('Isi gambar hadiah tidak valid.');
}

export class GatheringService {
  constructor(private storage: Database, private now = () => Date.now()) {}
  private async write<T>(fn: (tx: StorageTransaction) => Promise<T>): Promise<T> {
    await this.storage.ready();
    return this.storage.serializeWrite(() => retryBusy(async () => {
      const tx=await this.storage.client.transaction('write');
      try { const result=await fn(tx); await tx.commit(); return result; }
      catch(e) { try { await tx.rollback(); } catch {} throw e; } finally { tx.close(); }
    }));
  }
  async importRoster(input: unknown, refreshOfficial=false) {
    const entries=z.array(rosterSchema).min(1).parse(input);
    if (new Set(entries.map(e=>e.nrp)).size!==entries.length) throw new AppError('Ada NRP ganda pada daftar awal.');
    return this.write(async tx => {
      for (const entry of entries) {
        if (entry.source==='uts'&&entry.drawEnabled) throw new AppError('UTS tidak termasuk peserta door prize.');
        const existing=(await tx.execute({sql:'SELECT * FROM attendance_roster WHERE nrp=?',args:[entry.nrp]})).rows[0];
        if (existing && refreshOfficial) {
          await tx.execute({sql:'UPDATE attendance_roster SET full_name=?,company=?,planned_size=?,source=?,draw_enabled=CASE WHEN draw_enabled=0 THEN 0 ELSE ? END WHERE nrp=?',args:[entry.fullName,entry.company,entry.plannedSize,entry.source,Number(entry.drawEnabled),entry.nrp]});
          await tx.execute({sql:'DELETE FROM draw_only_roster WHERE nrp=?',args:[entry.nrp]});
        }
        if(existing && entry.tableNumber) await tx.execute({sql:'INSERT INTO roster_seating(nrp,table_number) VALUES(?,?) ON CONFLICT(nrp) DO UPDATE SET table_number=excluded.table_number',args:[entry.nrp,entry.tableNumber]});
        if (existing) continue; // Keputusan panitia dan check-in tetap dipertahankan.
        await tx.execute({sql:'INSERT INTO attendance_roster(id,nrp,full_name,company,planned_size,source,draw_enabled) VALUES(?,?,?,?,?,?,?)',args:[randomUUID(),entry.nrp,entry.fullName,entry.company,entry.plannedSize,entry.source,Number(entry.drawEnabled)]});
        if(entry.tableNumber) await tx.execute({sql:'INSERT INTO roster_seating(nrp,table_number) VALUES(?,?)',args:[entry.nrp,entry.tableNumber]});
      }
      return { imported:entries.length };
    });
  }
  async lookup(input: unknown) {
    const {nrp}=z.object({nrp:nrpSchema}).parse(input); await this.storage.ready();
    const r=(await this.storage.client.execute({sql:checkInRosterSQL,args:[nrp]})).rows[0];
    if (!r) throw new AppError('NRP tidak terdaftar pada daftar awal. Silakan hubungi panitia.',404);
    return {fullName:formatPersonName(String(r.full_name)),company:String(r.company),doorprizeEligible:r.source==='excel'&&Boolean(r.draw_enabled)};
  }
  async register(input: unknown, assisted=false) {
    const data=registrationSchema.parse(input);
    return this.write(async tx => {
      const prior=(await tx.execute({sql:'SELECT * FROM registrations WHERE request_key=?',args:[data.requestKey]})).rows[0];
      if (prior) {
        if (prior.nrp!==data.nrp||Number(prior.party_size)!==data.partySize) throw new AppError('Permintaan ini sudah digunakan untuk data lain.',409);
        return registrationRow((await tx.execute({sql:registrationSQL+' WHERE r.id=?',args:[String(prior.id)]})).rows[0]);
      }
      const e=(await tx.execute('SELECT registration_open FROM events WHERE id=1')).rows[0];
      if (!e.registration_open&&!assisted) throw new AppError('Registrasi sedang ditutup. Silakan hubungi panitia.',403);
      const roster=(await tx.execute({sql:checkInRosterSQL,args:[data.nrp]})).rows[0];
      if (!roster) throw new AppError('NRP tidak terdaftar pada daftar awal. Silakan hubungi panitia.',404);
      if ((await tx.execute({sql:'SELECT id FROM registrations WHERE nrp=?',args:[data.nrp]})).rows.length) throw new AppError('NRP ini sudah check-in. Hubungi panitia untuk koreksi data.',409);
      const planned=Number(roster.planned_size);
      if (data.partySize>planned&&!data.acknowledgedExtra) throw new AppError('Jumlah hadir melebihi registrasi sebelumnya.',409,{code:'EXCESS_ATTENDANCE',plannedSize:planned,extra:data.partySize-planned});
      const id=randomUUID();
      await tx.execute({sql:'INSERT INTO registrations(id,nrp,full_name,party_size,created_at,request_key) VALUES(?,?,?,?,?,?)',args:[id,data.nrp,formatPersonName(String(roster.full_name)),data.partySize,this.now(),data.requestKey]});
      await tx.execute({sql:'INSERT INTO registration_details(registration_id,planned_size,company,acknowledged_extra) VALUES(?,?,?,?)',args:[id,planned,String(roster.company),Number(data.acknowledgedExtra)]});
      await tx.execute({sql:'INSERT INTO registration_seating(registration_id,table_number) SELECT ?,table_number FROM roster_seating WHERE nrp=?',args:[id,data.nrp]});
      return registrationRow((await tx.execute({sql:registrationSQL+' WHERE r.id=?',args:[id]})).rows[0]);
    });
  }
  async receipt(input:unknown) {
    const d=z.object({id:z.string().uuid(),nrp:nrpSchema}).parse(input);await this.storage.ready();
    const r=(await this.storage.client.execute({sql:registrationSQL+' WHERE r.id=? AND r.nrp=?',args:[d.id,d.nrp]})).rows[0];
    if(!r)throw new AppError('Bukti check-in tidak ditemukan.',404);
    return registrationRow(r);
  }
  async editRegistration(id:string,input:unknown) {
    const data=registrationSchema.omit({requestKey:true}).parse(input);
    return this.write(async tx => {
      const r=(await tx.execute({sql:registrationSQL+' WHERE r.id=?',args:[id]})).rows[0];
      if (!r) throw new AppError('Peserta tidak ditemukan.',404);
      if (data.nrp!==r.nrp) throw new AppError('NRP check-in tidak dapat diganti. Koreksi daftar awal melalui panitia.',409);
      if (Number(r.extra_coupons)>Math.max(0,data.partySize-Number(r.planned_size))||Number(r.transferred_out)>Math.max(0,Number(r.planned_size)-data.partySize)) throw new AppError('Jumlah baru bertentangan dengan alokasi kupon. Hubungi panitia untuk memeriksa catatan kupon.',409);
      if (data.partySize>Number(r.planned_size)&&!data.acknowledgedExtra) throw new AppError('Konfirmasi jumlah yang melebihi rencana terlebih dahulu.',409,{code:'EXCESS_ATTENDANCE',plannedSize:Number(r.planned_size),extra:data.partySize-Number(r.planned_size)});
      await tx.execute({sql:'UPDATE registrations SET full_name=?,party_size=? WHERE id=?',args:[data.fullName,data.partySize,id]});
      await tx.execute({sql:'UPDATE registration_details SET acknowledged_extra=? WHERE registration_id=?',args:[Number(data.acknowledgedExtra),id]});
    });
  }
  async editRoster(id:string,input:unknown) {
    const data=z.object({fullName:text(160),company:text(200),drawEnabled:z.boolean(),attendanceNote:z.string().trim().max(500)}).parse(input);
    return this.write(async tx=>{
      const r=(await tx.execute({sql:'SELECT * FROM attendance_roster WHERE id=?',args:[id]})).rows[0];
      if (!r) throw new AppError('Data awal tidak ditemukan.',404);
      if (r.source!=='excel'&&data.drawEnabled) throw new AppError('UTS tidak termasuk sumber door prize.');
      if ((await tx.execute({sql:'SELECT id FROM prize_draws WHERE roster_id=? AND reveal_at>?',args:[id,this.now()]})).rows.length) throw new AppError('Tunggu undian selesai sebelum mengubah data.',409);
      await tx.execute({sql:'UPDATE attendance_roster SET full_name=?,company=?,draw_enabled=?,attendance_note=? WHERE id=?',args:[data.fullName,data.company,Number(data.drawEnabled),data.attendanceNote,id]});
    });
  }
  async transferCoupons(input:unknown) {
    const d=z.object({donorId:z.string().uuid(),recipientId:z.string().uuid(),quantity:z.number().int().min(1).max(999),requestKey:z.string().uuid()}).parse(input);
    if(d.donorId===d.recipientId) throw new AppError('Pemberi dan penerima kupon harus berbeda.');
    return this.write(async tx=>{
      const prior=(await tx.execute({sql:'SELECT * FROM coupon_transfers WHERE request_key=?',args:[d.requestKey]})).rows[0];
      if(prior){if(prior.donor_id!==d.donorId||prior.recipient_id!==d.recipientId||Number(prior.quantity)!==d.quantity)throw new AppError('Kunci alokasi sudah dipakai untuk data lain.',409);return;}
      const rows=(await tx.execute(registrationSQL)).rows.map(registrationRow);
      const donor=rows.find(r=>r.id===d.donorId), recipient=rows.find(r=>r.id===d.recipientId);
      if(!donor||!recipient) throw new AppError('Kedua peserta harus sudah check-in.',404);
      if(d.quantity>Math.max(0,donor.plannedSize-donor.partySize-donor.transferredOut)) throw new AppError('Kupon sisa pemberi tidak mencukupi.',409);
      if(d.quantity>Math.max(0,recipient.partySize-recipient.plannedSize-recipient.extraCoupons)) throw new AppError('Alokasi melebihi kebutuhan tambahan penerima.',409);
      await tx.execute({sql:'INSERT INTO coupon_transfers(id,donor_id,recipient_id,quantity,created_at,request_key) VALUES(?,?,?,?,?,?)',args:[randomUUID(),d.donorId,d.recipientId,d.quantity,this.now(),d.requestKey]});
      await tx.execute({sql:'UPDATE registration_details SET extra_coupons=extra_coupons+? WHERE registration_id=?',args:[d.quantity,d.recipientId]});
    });
  }
  async updateEvent(input:unknown) {
    const d=eventSchema.parse(input);
    return this.write(async tx=>{
      const reserved=Number((await tx.execute('SELECT COALESCE(SUM(size),0) n FROM prize_sessions')).rows[0].n);
      const catalogSize = Number((await tx.execute('SELECT COUNT(*) n FROM prize_catalog')).rows[0].n);
      if (catalogSize && d.targetWinners !== catalogSize) throw new AppError('Target pemenang mengikuti jumlah hadiah di katalog.', 409);
      if(d.targetWinners<reserved) throw new AppError(`Target minimal ${reserved}, sesuai slot sesi hadiah.`,409);
      const oldTarget=Number((await tx.execute('SELECT target_winners FROM events WHERE id=1')).rows[0].target_winners);
      await tx.execute({sql:'UPDATE events SET title=?,date=?,venue=?,target_winners=?,registration_open=? WHERE id=1',args:[d.title,d.date,d.venue,d.targetWinners,Number(d.registrationOpen)]});
      if(oldTarget!==d.targetWinners) await tx.execute('UPDATE display_controls SET show_winners=0 WHERE id=1');
    });
  }
  async draw(input:unknown) {
    const d=drawSchema.parse(input); validateImage(d.prizeImage);
    const fingerprint=createHash('sha256').update(JSON.stringify(d)).digest('hex');
    return this.write(async tx=>{
      const catalog = (await tx.execute('SELECT * FROM prize_catalog ORDER BY slot')).rows.map(catalogRow);
      const prior=(await tx.execute({sql:'SELECT * FROM prize_requests WHERE request_key=?',args:[d.requestKey]})).rows[0];
      if(prior) {
        if(prior.fingerprint!==fingerprint) throw new AppError('Kunci undian sudah digunakan untuk permintaan lain.',409);
        return {session:await readSession(tx,String(prior.session_id),catalog),draws:(await tx.execute({sql:'SELECT * FROM prize_draws WHERE request_key=? ORDER BY position',args:[d.requestKey]})).rows.map(drawRow)};
      }
      if((await tx.execute({sql:'SELECT id FROM prize_draws WHERE reveal_at>?',args:[this.now()]})).rows.length) throw new AppError('Tunggu gulungan undian selesai.',409);
      let session:PrizeSession;
      let positions:number[];
      if(d.sessionId) {
        session=await readSession(tx,d.sessionId,catalog);
        const filled=(await tx.execute({sql:"SELECT position FROM prize_draws WHERE session_id=? AND status='confirmed'",args:[session.id]})).rows.map(r=>Number(r.position));
        positions=Array.from({length:session.size},(_,i)=>i+1).filter(p=>!filled.includes(p));
        if(!positions.length) throw new AppError('Sesi ini sudah lengkap.',409);
      } else {
        const reserved=Number((await tx.execute('SELECT COALESCE(SUM(size),0) n FROM prize_sessions')).rows[0].n);
        const confirmed=Number((await tx.execute("SELECT COUNT(*) n FROM prize_draws WHERE status='confirmed'")).rows[0].n);
        if(confirmed<reserved) throw new AppError('Isi slot pengganti pada sesi sebelumnya terlebih dahulu.',409);
        const target=Number((await tx.execute('SELECT target_winners FROM events WHERE id=1')).rows[0].target_winners);
        const round = upcomingRound(catalog, reserved);
        if (catalog.length && (!round || d.catalogSlot !== round.prizes[0].slot)) {
          throw new AppError('Ronde hadiah sudah berubah. Muat ulang daftar hadiah.', 409);
        }
        const size = round?.prizes.length ?? d.count;
        if(reserved+size>target) throw new AppError('Jumlah sesi melebihi sisa target pemenang.',409);
        session={id:randomUUID(),prizeName:round?.title ?? d.prizeName,prizeImage:round ? '' : d.prizeImage,size,baseSlot:reserved+1,createdAt:this.now(),prizes:round?.prizes};
        positions=Array.from({length:size},(_,i)=>i+1);
      }
      const pool=(await tx.execute("SELECT * FROM attendance_roster WHERE source='excel' AND draw_enabled=1 AND id NOT IN(SELECT roster_id FROM prize_draws) ORDER BY nrp")).rows;
      if(pool.length<positions.length) throw new AppError(`Peserta tersisa ${pool.length}; diperlukan ${positions.length} peserta untuk sesi ini.`,409);
      if(!d.sessionId) {
        await tx.execute({sql:'INSERT INTO prize_sessions(id,prize_name,prize_image,size,base_slot,created_at) VALUES(?,?,?,?,?,?)',args:[session.id,session.prizeName,session.prizeImage,session.size,session.baseSlot,session.createdAt]});
        if (session.prizes) await tx.execute({sql:'INSERT INTO prize_session_catalog(session_id) VALUES(?)',args:[session.id]});
      }
      const time=this.now();
      await tx.execute('UPDATE display_controls SET show_winners=0 WHERE id=1');
      await tx.execute({sql:'INSERT INTO prize_requests(request_key,fingerprint,session_id,created_at) VALUES(?,?,?,?)',args:[d.requestKey,fingerprint,session.id,time]});
      const names=pool.map(r=>formatPersonName(String(r.full_name)));
      const remaining=[...pool]; const results:Draw[]=[];
      for(const [revealOrder, position] of positions.entries()) {
        // Uniform sample without replacement using Node's cryptographic rejection sampling.
        const selected=remaining.splice(randomInt(remaining.length),1)[0];
        const index=pool.findIndex(r=>r.id===selected.id);
        const duration = session.prizes ? session.prizes[0].grand ? 12000 : 8000 + revealOrder * 3000 : 6000;
        const result:Draw={id:randomUUID(),rosterId:String(selected.id),sessionId:session.id,requestKey:d.requestKey,position,slot:session.baseSlot+position-1,nrp:String(selected.nrp),fullName:formatPersonName(String(selected.full_name)),status:'confirmed',createdAt:time,revealAt:time+duration,receivedAt:null,reelNames:names,reelIndex:index};
        await tx.execute({sql:'INSERT INTO prize_draws(id,roster_id,session_id,request_key,position,slot,nrp,full_name,status,created_at,reveal_at,reel_names,reel_index) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',args:[result.id,result.rosterId,session.id,d.requestKey,position,result.slot,result.nrp,result.fullName,'confirmed',time,result.revealAt,JSON.stringify(names),index]});
        results.push(result);
      }
      return {session,draws:results};
    });
  }
  async forfeit(id:string) {
    return this.write(async tx=>{
      const r=(await tx.execute({sql:'SELECT * FROM prize_draws WHERE id=?',args:[id]})).rows[0];
      if(!r) throw new AppError('Pemenang tidak ditemukan.',404);
      if(r.status==='forfeited') return;
      if(Number(r.reveal_at)>this.now()) throw new AppError('Tunggu gulungan selesai.',409);
      if(r.received_at!=null) throw new AppError('Koreksi status pengambilan hadiah terlebih dahulu.',409);
      await tx.execute({sql:"UPDATE prize_draws SET status='forfeited' WHERE id=?",args:[id]});
      await tx.execute('UPDATE display_controls SET show_winners=0 WHERE id=1');
    });
  }
  async markReceived(id:string,input:unknown) {
    const {received}=z.object({received:z.boolean()}).parse(input);
    return this.write(async tx=>{
      const r=(await tx.execute({sql:'SELECT * FROM prize_draws WHERE id=?',args:[id]})).rows[0];
      if(!r||r.status!=='confirmed'||Number(r.reveal_at)>this.now()) throw new AppError('Hadiah belum dapat dicatat.',409);
      await tx.execute({sql:'UPDATE prize_draws SET received_at=? WHERE id=?',args:[received?(Number(r.received_at)||this.now()):null,id]});
    });
  }
  async state(registrationUrl:string):Promise<AdminState> {
    await this.storage.ready(); const tx=await this.storage.client.transaction('read');
    try {
      const [ev,regs,rs,ss,ds,controls,prizes,links]=await tx.batch(['SELECT * FROM events WHERE id=1',registrationSQL+' ORDER BY r.created_at DESC,r.id',adminRosterSQL,'SELECT * FROM prize_sessions ORDER BY created_at,id','SELECT * FROM prize_draws ORDER BY created_at,session_id,position,id','SELECT show_winners FROM display_controls WHERE id=1','SELECT * FROM prize_catalog ORDER BY slot','SELECT * FROM prize_session_catalog']);
      const catalog = prizes.rows.map(catalogRow);
      const linked = new Set(links.rows.map(row => row.session_id));
      const sessions = ss.rows.map(sessionRow).map(session => linked.has(session.id) ? withCatalog(session, catalog) : session);
      const nextRound = upcomingRound(catalog, sessions.reduce((n, session) => n + session.size, 0));
      const e=ev.rows[0], registrations=regs.rows.map(registrationRow),roster=rs.rows.map(rosterRow),draws=ds.rows.map(drawRow);
      const selected=new Set(draws.map(d=>d.rosterId)); await tx.commit();
      return {serverTime:this.now(),event:{id:1,title:String(e.title),date:String(e.date),venue:String(e.venue),targetWinners:Number(e.target_winners),registrationOpen:Boolean(e.registration_open),demo:Boolean(e.demo)},registrations,roster,sessions,draws,registrationUrl,showWinners:Boolean(controls.rows[0].show_winners),catalogSize:catalog.length,nextRound,
        stats:{employees:registrations.length,people:registrations.reduce((n,r)=>n+r.partySize,0),eligible:roster.filter(r=>r.source==='excel'&&r.drawEnabled&&!selected.has(r.id)).length,confirmed:draws.filter(d=>d.status==='confirmed').length,received:draws.filter(d=>d.receivedAt!=null).length,plannedPeople:roster.reduce((n,r)=>n+r.plannedSize,0),surplus:registrations.reduce((n,r)=>n+Math.max(0,r.plannedSize-r.partySize-r.transferredOut),0),shortage:registrations.reduce((n,r)=>n+Math.max(0,r.partySize-r.couponCount),0),couponCount:registrations.reduce((n,r)=>n+r.couponCount,0)}};
    } finally {tx.close();}
  }
  async display(registrationUrl:string):Promise<DisplayState> {
    const s=await this.state(registrationUrl);
    const publicDraws=s.draws.filter(d=>d.status==='confirmed').map(({nrp:_,rosterId:__,requestKey:___,...d})=>({...d,prizeName:slotPrize(s.sessions.find(p=>p.id===d.sessionId),d.position)}));
    const last=s.draws.at(-1); const currentSession=s.sessions.find(p=>p.id===last?.sessionId)||null;
    const currentDraws=currentSession?publicDraws.filter(d=>d.sessionId===currentSession.id):[];
    return {event:s.event,registrationUrl,serverTime:s.serverTime,names:s.roster.filter(r=>r.source==='excel'&&r.drawEnabled&&!s.draws.some(d=>d.rosterId===r.id)).map(r=>r.fullName),draws:publicDraws,active:publicDraws.find(d=>d.revealAt>this.now())||null,currentDraw:currentDraws.at(-1)||null,currentSession,currentDraws,confirmedCount:s.stats.confirmed,eligibleCount:s.stats.eligible,showWinners:s.showWinners&&s.stats.confirmed>=s.event.targetWinners,nextRound:currentSession?undefined:s.nextRound};
  }
  async setWinnerDisplay(input:unknown){
    const {showWinners}=z.object({showWinners:z.boolean()}).parse(input);
    return this.write(async tx=>{
      if(showWinners){
        const target=Number((await tx.execute('SELECT target_winners FROM events WHERE id=1')).rows[0].target_winners);
        const count=Number((await tx.execute("SELECT COUNT(*) n FROM prize_draws WHERE status='confirmed'")).rows[0].n);
        const rolling=(await tx.execute({sql:'SELECT id FROM prize_draws WHERE reveal_at>?',args:[this.now()]})).rows.length;
        if(count<target||rolling)throw new AppError('Tunggu seluruh pemenang mencapai target dan gulungan selesai.',409);
      }
      await tx.execute({sql:'UPDATE display_controls SET show_winners=? WHERE id=1',args:[Number(showWinners)]});
    });
  }
  async registrationDisplay(registrationUrl:string) {
    await this.storage.ready();const e=(await this.storage.client.execute('SELECT * FROM events WHERE id=1')).rows[0];
    return {serverTime:this.now(),registrationUrl,event:{id:1,title:String(e.title),date:String(e.date),venue:String(e.venue),targetWinners:Number(e.target_winners),registrationOpen:Boolean(e.registration_open),demo:Boolean(e.demo)}};
  }
  async setDemo() {await this.storage.ready();await this.storage.client.execute('UPDATE events SET demo=1 WHERE id=1');}
}
export function getService(){return new GatheringService(getDatabase());}
