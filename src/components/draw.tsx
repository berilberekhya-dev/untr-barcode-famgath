'use client';
import { useState } from 'react';
import { slotPrize } from '@/lib/prizes';
import { DrawAudio } from './draw-audio';
import type {DisplayState,PublicDraw} from '@/lib/types';
import {Brand,Connection,DemoBanner,ErrorBox,FullscreenButton,Loading,usePoll} from './shared';
import {SpaceBackdrop} from './art';
import {Celebration} from './celebration';
import {NameReel,useServerClock} from './reel';
import {Icon} from './icon';
export {DrawControl} from './draw-manager';
export {NameReel} from './reel';

function WinnerFinale({draws,target}:{draws:PublicDraw[];target:number}){
 const [page,setPage]=useState(0);
 const pageSize=target>20?16:20;
 const winners=draws.filter(d=>d.status==='confirmed').sort((a,b)=>a.slot-b.slot);
 return <main className="finale-main"><p className="eyebrow">MISI BERBAGI KEBAHAGIAAN SELESAI</p><h1>Para pemenang</h1><p className="finale-subtitle">Selamat kepada {target} penjelajah beruntung!</p><ol className="finale-grid">{winners.slice(page*pageSize,(page+1)*pageSize).map(d=><li key={d.id}><Icon name="trophy" size={23}/><div><strong>{d.fullName}</strong><small>{d.prizeName||'Door prize'}</small></div></li>)}</ol>{winners.length>pageSize && <nav className="finale-pages" aria-label="Halaman pemenang">
  <button className="button button-secondary" disabled={!page} onClick={()=>setPage(page-1)}>Sebelumnya</button>
  <span>{page+1} / {Math.ceil(winners.length/pageSize)}</span>
  <button className="button button-secondary" disabled={(page+1)*pageSize>=winners.length} onClick={()=>setPage(page+1)}>Berikutnya</button>
 </nav>}<p className="finale-tagline">Terbang Melesat, Lanjakke Nian</p></main>;
}
export function DrawScreen(){
 const {data,error}=usePoll<DisplayState>('/api/display',true),now=useServerClock(data?.serverTime);
 const session = data?.currentSession;
 const roundPrizes = session?.prizes ?? data?.nextRound?.prizes;
 const size = session?.size ?? roundPrizes?.length ?? 1;
 const grand = roundPrizes?.[0]?.grand;
 const title = session?.prizeName ?? data?.nextRound?.title ?? 'Door prize';
 const draws = data?.currentDraws ?? [];
 const latestReveal = draws.filter(draw => draw.revealAt <= now).sort((a, b) => b.revealAt - a.revealAt)[0];
 return <div className="public-page stage-page spatial-stage">
   <SpaceBackdrop/><DemoBanner demo={data?.event.demo}/>
   <header className="public-header stage-header">
     <Brand/><div><Connection error={error}/><FullscreenButton/></div>
   </header>
   <DrawAudio draws={data?.currentDraws} now={now} muted={data?.audioMuted ?? false}/>
   {!data ? <main>{error ? <ErrorBox>{error.message}</ErrorBox> : <Loading/>}</main>
     : data.showWinners ? <WinnerFinale draws={data.draws} target={data.event.targetWinners}/>
     : <main className="draw-floor">
       <p className="eyebrow floor-caption">FAMILY GATHERING · UNITED TRACTORS PALEMBANG</p>
       <section className={`spatial-grid stage-slots-${size}${roundPrizes ? ' stage-catalog' : ''}`} aria-label="Sesi undian bersama">
         <div className="prize-centre">
           {roundPrizes ? grand
             ? <><p className="grand-label">GRAND PRIZE</p><h1>{roundPrizes[0].name}</h1></>
             : <><h1>{title}</h1><ol className="stage-prize-list">
               {roundPrizes.map(prize => <li key={prize.slot}>{prize.name}</li>)}
             </ol></>
             : <><div className="prize-media">{session?.prizeImage ? <img src={session.prizeImage} alt={session.prizeName}/> : <Icon name="gift" size={100}/>}</div>
               <h1>{title}</h1><p>{session ? `${size} pemenang` : `${data.eligibleCount} peserta dalam undian`}</p></>}
         </div>
         {Array.from({ length: size }, (_, i) => {
           const draw = draws.find(result => result.position === i + 1);
           return <article className={`spatial-slot slot-${i+1}${draw && now >= draw.revealAt ? ' slot-revealed' : ''}`} key={i}>
             {roundPrizes && <span className="slot-number" aria-label={`Slot ${i+1}`}>{i+1}</span>}
             <NameReel draw={draw} now={now}/>
             {roundPrizes && <p className="slot-prize">{session ? slotPrize(session,i+1) : roundPrizes[i].name}</p>}
           </article>;
         })}
       </section>
       <p className="floor-tagline">Terbang Melesat, Lanjakke Nian</p>
     </main>}
   <Celebration draw={latestReveal} now={now} paused={Boolean(data?.showWinners)}/>
   <footer className="stage-footer"><span>SATU NRP, SATU KESEMPATAN · PEMILIHAN ACAK</span><span>UNITED TRACTORS PALEMBANG</span></footer>
 </div>;
}
