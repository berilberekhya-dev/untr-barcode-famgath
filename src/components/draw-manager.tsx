'use client';
import Link from 'next/link';
import {useState,useRef,useEffect} from 'react';
import type {AdminState,Draw,DrawResult} from '@/lib/types';
import {api,ApiError,ErrorBox,Modal,newRequestKey} from './shared';
import {NameReel,useServerClock} from './reel';
import {Celebration,notifyNextDraw} from './celebration';

async function prepareImage(file:File):Promise<string>{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10000000)throw new Error('Pilih gambar PNG/JPEG/WebP maksimal 10 MB.');
  const bitmap=await createImageBitmap(file);const scale=Math.min(1,900/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=bitmap.width*scale;canvas.height=bitmap.height*scale;canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const data=canvas.toDataURL('image/jpeg',.78);if(data.length>900000)throw new Error('Gambar terlalu besar. Gunakan gambar yang lebih sederhana.');return data;
}

export function DrawControl({data,refresh}:{data:AdminState;refresh:()=>Promise<unknown>}){
 const now=useServerClock(data.serverTime),[busy,setBusy]=useState(false),[error,setError]=useState(''),[count,setCount]=useState(1),[prizeName,setName]=useState('Door prize'),[prizeImage,setImage]=useState(''),[selected,setSelected]=useState(''),[forfeiting,setForfeiting]=useState<Draw|null>(null),[paused,setPaused]=useState<string|null>(null);
 const [dismissedFinale,setDismissedFinale]=useState('');
 const request=useRef<{fingerprint:string;requestKey:string}|null>(null);
 useEffect(()=>{try{request.current=JSON.parse(sessionStorage.getItem('ut-batch-request')||'null');}catch{}},[]);
 const session=data.sessions.find(s=>s.id===selected)||data.sessions.at(-1);
 const winners=data.draws.filter(d=>d.status==='confirmed');
 const sessionDraws=session?winners.filter(d=>d.sessionId===session.id):[];
 const missing=session?session.size-sessionDraws.length:0;
 const spinning=data.draws.some(d=>d.revealAt>now);
 const latest=data.draws.at(-1);
 const latestWinner=winners.filter(d=>d.sessionId===latest?.sessionId).at(-1)||null;
 const remaining=data.event.targetWinners-data.sessions.reduce((n,s)=>n+s.size,0);
 const complete=data.stats.confirmed>=data.event.targetWinners;
 const signature=winners.map(d=>d.id).join('|');
 const unfinished=data.sessions.some(s=>winners.filter(d=>d.sessionId===s.id).length<s.size);
 const perform=async(fn:()=>Promise<unknown>)=>{setBusy(true);setError('');try{await fn();await refresh();return true;}catch(e){setError((e as Error).message);await refresh();return false;}finally{setBusy(false);}};
 const draw=(replacement:boolean)=>perform(async()=>{
   setPaused(latestWinner?.id||null);notifyNextDraw(latestWinner?.id||null);
   const payload=replacement?{sessionId:session!.id}:{count,prizeName,prizeImage};const fingerprint=JSON.stringify(payload);
   if(!request.current||request.current.fingerprint!==fingerprint)request.current={fingerprint,requestKey:newRequestKey()};
   try{sessionStorage.setItem('ut-batch-request',JSON.stringify(request.current));}catch{}
   try{const result=await api<DrawResult>('/api/admin/draw',{...payload,requestKey:request.current.requestKey});setSelected(result.session.id);request.current=null;try{sessionStorage.removeItem('ut-batch-request');}catch{}}
   catch(e){if(e instanceof ApiError&&e.status<500){request.current=null;try{sessionStorage.removeItem('ut-batch-request');}catch{}setPaused(null);notifyNextDraw(latestWinner?.id||null,false);}throw e;}
 });
 return <><div className="draw-overview"><span>{data.stats.eligible} peserta tersisa dari Excel awal</span><span>{winners.length} / {data.event.targetWinners} pemenang</span><Link className="button button-secondary" href="/layar/doorprize" target="_blank">Buka layar proyektor</Link></div>
 {complete&&!spinning&&<div className="finale-control"><strong>Sudah {data.stats.confirmed} pemenang!</strong><button className="button button-primary" disabled={busy} onClick={()=>perform(()=>api('/api/admin/display',{showWinners:true}))}>Tampilkan semua pemenang</button>{data.showWinners&&<button className="button button-secondary" onClick={()=>{setDismissedFinale(signature);void perform(()=>api('/api/admin/display',{showWinners:false}));}}>Kembali ke layar undian</button>}</div>}
 <div className="batch-config pixel-panel"><div><h2>Siapkan sesi hadiah</h2><p className="muted">Satu sesi dapat memilih 1–5 orang sekaligus.</p></div><label>Nama hadiah<input value={prizeName} maxLength={200} onChange={e=>setName(e.target.value)}/></label><label>Jumlah pemenang<select aria-label="Jumlah pemenang sesi" value={count} onChange={e=>setCount(Number(e.target.value))}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} orang</option>)}</select></label><label>Gambar hadiah (opsional)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(file)try{setImage(await prepareImage(file));setError('');}catch(e){setError((e as Error).message);}}}/></label>{prizeImage&&<div className="prize-preview"><img src={prizeImage} alt="Pratinjau hadiah"/><button type="button" className="button button-ghost" onClick={()=>setImage('')}>Hapus gambar</button></div>}<button className="button button-primary draw-button" disabled={busy||spinning||unfinished||remaining<count||data.stats.eligible<count||!prizeName.trim()} onClick={()=>draw(false)}>{spinning?'Sedang mengundi…':`Undi ${count} orang`}</button><p className="field-hint">Pemilihan acak di server, tanpa bobot. Animasi hanya menampilkan hasil tersimpan.</p></div>
 {error&&<ErrorBox>{error}</ErrorBox>}
 {session&&<><div className="session-toolbar"><label>Lihat sesi<select aria-label="Sesi hadiah" value={session.id} onChange={e=>setSelected(e.target.value)}>{data.sessions.map(s=><option key={s.id} value={s.id}>{s.prizeName} · {s.size} orang</option>)}</select></label><div><h2>{session.prizeName}</h2><p className="muted">{sessionDraws.length} / {session.size} slot terisi</p></div>{missing>0&&<button className="button button-primary" disabled={busy||spinning||data.stats.eligible<missing} onClick={()=>draw(true)}>Undi pengganti {missing} orang</button>}</div>
 <div className={`batch-reels batch-${session.size}`}>{Array.from({length:session.size},(_,i)=>{const d=sessionDraws.find(d=>d.position===i+1);return <div className="control-reel batch-card" key={i}><div className="batch-position">Slot {i+1}</div><NameReel draw={d} now={now}/>{d&&<div className="batch-winner-actions"><small>{now>=d.revealAt?`NRP ${d.nrp}`:'Mengundi…'}</small><button className="button button-danger button-small" disabled={busy||now<d.revealAt||Boolean(d.receivedAt)} onClick={()=>setForfeiting(d)} aria-label={`Gugurkan ${d.fullName}`}>Hapus / gugurkan</button></div>}</div>;})}</div></>}
 <section className="prize-tracking batch-tracking"><h2>Kelola pemenang & hadiah</h2><p className="prize-help">Gugurkan peserta yang tidak hadir atau berdasarkan keputusan panitia. Isi slot kosong melalui sesi hadiahnya.</p><ol>{winners.map(d=><li key={d.id}><span className="winner-slot">{d.slot}</span><div><strong>{now>=d.revealAt?d.fullName:'Sedang diundi…'}</strong><small>{data.sessions.find(s=>s.id===d.sessionId)?.prizeName}</small><div className="prize-buttons"><button className={`receipt-button ${d.receivedAt?'received':''}`} disabled={busy||now<d.revealAt} onClick={()=>perform(()=>api(`/api/admin/draws/${d.id}/received`,{received:!d.receivedAt}))}>{d.receivedAt?'Sudah diambil':'Tandai sudah diambil'}</button><button className="forfeit-button" disabled={busy||now<d.revealAt||Boolean(d.receivedAt)} onClick={()=>{setSelected(d.sessionId);setForfeiting(d);}} aria-label={`Kelola gugur ${d.fullName}`}>Hapus / gugurkan</button></div></div></li>)}</ol></section>
 <div className="admin-celebration"><Celebration draw={latestWinner} now={now} paused={Boolean(latestWinner&&paused===latestWinner.id)} lite/></div>
 {complete&&!spinning&&!data.showWinners&&dismissedFinale!==signature&&<Modal title={`Sudah ${data.stats.confirmed} pemenang!`} onClose={()=>setDismissedFinale(signature)}><p>Target {data.event.targetWinners} pemenang sudah lengkap. Mau tampilkan semuanya di layar proyektor?</p><div className="excess-actions"><button className="button button-primary" disabled={busy} onClick={()=>perform(()=>api('/api/admin/display',{showWinners:true}))}>Ya, tampilkan semuanya</button><button className="button button-secondary" onClick={()=>setDismissedFinale(signature)}>Nanti dulu</button></div>{error&&<ErrorBox>{error}</ErrorBox>}</Modal>}
 {forfeiting&&<Modal title="Hapus dari daftar pemenang?" onClose={()=>setForfeiting(null)}><p className="forfeit-name">{forfeiting.fullName}</p><p>Hanya slot orang ini yang dibuka kembali. Pemenang lain dalam sesi tetap menang. Peserta gugur tidak diikutkan lagi.</p><div className="decision-buttons"><button className="button button-secondary" disabled={busy} onClick={()=>setForfeiting(null)}>Batal</button><button className="button button-danger" disabled={busy} onClick={async()=>{if(await perform(()=>api(`/api/admin/draws/${forfeiting.id}/forfeit`,{})))setForfeiting(null);}}>Gugurkan</button></div></Modal>}
 <details className="history-panel"><summary>Riwayat undian · {data.draws.length} hasil</summary><div className="table-scroll"><table><thead><tr><th>Sesi / hadiah</th><th>Slot</th><th>Nama / NRP</th><th>Status</th></tr></thead><tbody>{data.draws.map(d=><tr key={d.id}><td>{data.sessions.find(s=>s.id===d.sessionId)?.prizeName}</td><td>{d.position}</td><td>{now>=d.revealAt?`${d.fullName} / ${d.nrp}`:'Sedang mengundi'}</td><td>{d.status==='confirmed'?'Pemenang':'Gugur'}</td></tr>)}</tbody></table></div></details>
 </>;
}
