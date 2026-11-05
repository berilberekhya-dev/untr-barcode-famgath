'use client';
import type {DisplayState,PublicDraw} from '@/lib/types';
import {Brand,Connection,DemoBanner,ErrorBox,FullscreenButton,Loading,usePoll} from './shared';
import {SpaceBackdrop} from './art';
import {Celebration} from './celebration';
import {NameReel,useServerClock} from './reel';
import {Icon} from './icon';
export {DrawControl} from './draw-manager';
export {NameReel} from './reel';

function WinnerFinale({draws,target}:{draws:PublicDraw[];target:number}){
 const winners=draws.filter(d=>d.status==='confirmed').sort((a,b)=>a.slot-b.slot);
 return <main className="finale-main"><p className="eyebrow">MISI BERBAGI KEBAHAGIAAN SELESAI</p><h1>Para pemenang</h1><p className="finale-subtitle">Selamat kepada {target} penjelajah beruntung!</p><ol className="finale-grid">{winners.map(d=><li key={d.id}><Icon name="trophy" size={23}/><div><strong>{d.fullName}</strong><small>{d.prizeName||'Door prize'}</small></div></li>)}</ol><p className="finale-tagline">Terbang Melesat, Lanjakke Nian</p></main>;
}
export function DrawScreen(){
 const {data,error}=usePoll<DisplayState>('/api/display'),now=useServerClock(data?.serverTime);
 const session=data?.currentSession,size=session?.size||1;
 return <div className="public-page stage-page spatial-stage"><SpaceBackdrop/><DemoBanner demo={data?.event.demo}/><header className="public-header stage-header"><Brand/><div><Connection error={error}/><FullscreenButton/></div></header>{!data?<main>{error?<ErrorBox>{error.message}</ErrorBox>:<Loading/>}</main>:data.showWinners?<WinnerFinale draws={data.draws} target={data.event.targetWinners}/>:<main className="draw-floor"><p className="eyebrow floor-caption">FAMILY GATHERING · UNITED TRACTORS PALEMBANG</p><section className={`spatial-grid stage-slots-${size}`} aria-label="Sesi undian bersama"><div className="prize-centre"><div className="prize-media">{session?.prizeImage?<img src={session.prizeImage} alt={session.prizeName}/>:<Icon name="gift" size={100}/>}</div><h1>{session?.prizeName||'Door prize'}</h1><p>{session?`${size} pemenang · ${size>1?'diundi bersamaan':'satu kesempatan'}`:`${data.eligibleCount} peserta dalam undian`}</p></div>{Array.from({length:size},(_,i)=><article className={`spatial-slot slot-${i+1}`} key={i}><NameReel draw={data.currentDraws.find(d=>d.position===i+1)} now={now}/></article>)}</section><p className="floor-tagline">Terbang Melesat, Lanjakke Nian</p></main>}<Celebration draw={data?.currentDraw} now={now}/><footer className="stage-footer"><span>SATU NRP, SATU KESEMPATAN · PEMILIHAN ACAK</span><span>UNITED TRACTORS PALEMBANG</span></footer></div>;
}
