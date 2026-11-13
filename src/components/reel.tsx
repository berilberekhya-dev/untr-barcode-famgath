'use client';
import { useEffect,useRef,useState,useMemo,memo } from 'react';
import type { PublicDraw } from '@/lib/types';
export function useServerClock(serverTime?:number, timelineOffset?:number){
  const offset=useRef((serverTime??Date.now())-Date.now());
  const [now,setNow]=useState(serverTime??Date.now());
  useEffect(()=>{
    if(serverTime!==undefined) offset.current=serverTime-Date.now();
    const tick=()=>setNow(timelineOffset===undefined ? Date.now()+offset.current : performance.now()+timelineOffset);
    tick();
    const timer=setInterval(tick,60);
    return()=>clearInterval(timer);
  },[serverTime,timelineOffset]);
  return now;
}

export const NameReel=memo(function NameReel({draw,now,timelineOffset}:{draw?:PublicDraw|null;now:number;timelineOffset?:number}) {
  const ref=useRef<HTMLDivElement>(null),clockOffset=useRef(now-Date.now());clockOffset.current=now-Date.now();
  // The same complete pool repeats naturally; the selected name is never appended or moved.
  const rows=useMemo(()=>{
    if(!draw)return [];
    const cycles=draw.reelNames.length<10?12:3;
    const target=cycles*draw.reelNames.length+draw.reelIndex;
    return Array.from({length:target+draw.reelNames.length+1},(_,i)=>draw.reelNames[i%draw.reelNames.length]);
  },[draw?.id]);
  useEffect(()=>{
    if(!draw||!ref.current)return;let animation:Animation|undefined;
    const render=()=>{
      if(!ref.current)return;animation?.cancel();
      const h=ref.current.children[0]?.getBoundingClientRect().height||130;
      const cycles=draw.reelNames.length<10?12:3,target=(cycles*draw.reelNames.length+draw.reelIndex)*h;
      ref.current.style.transform=`translateY(-${target}px)`;
      const serverNow=timelineOffset===undefined ? Date.now()+clockOffset.current : performance.now()+timelineOffset;
      if(serverNow<draw.revealAt&&draw.reelNames.length>1&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
        const overshoot=draw.reelNames.length>1?h*.25:0;
        animation=ref.current.animate([
          {transform:'translateY(0)',offset:0},
          {transform:`translateY(-${target*.78}px)`,offset:.68,easing:'cubic-bezier(.2,.65,.3,1)'},
          {transform:`translateY(-${target+overshoot}px)`,offset:.97,easing:'ease-out'},
          {transform:`translateY(-${target}px)`,offset:1},
        ],{duration:draw.revealAt-draw.createdAt,fill:'forwards'});
        if(timelineOffset===undefined) animation.currentTime=Math.max(0,serverNow-draw.createdAt);
        else animation.startTime=draw.createdAt-timelineOffset;
      }
    };render();window.addEventListener('resize',render);return()=>{animation?.cancel();window.removeEventListener('resize',render);};
  },[draw?.id,timelineOffset]);
  const spinning=Boolean(draw&&now<draw.revealAt);
  return <div className={`reel-machine ${spinning?'is-spinning':draw?'has-result':''} ${draw&&draw.reelNames.length<=3?'small-pool':''}`}><div className="reel-label">{spinning?'MENGUNDI…':draw?'SELAMAT, PEMENANG!':'SIAPA YANG BERUNTUNG?'}</div><div className="reel-window"><div className="reel-selection"><i/><i/><i/><i/></div>{draw?<div className="reel-track" ref={ref} aria-hidden={spinning}>{rows.map((name,i)=><div className="reel-item" key={i}><span style={{fontSize:`${name.length>90?.42:name.length>55?.56:name.length>35?.72:1}em`}}>{name}</span></div>)}</div>:<div className="reel-idle"><strong>Siap untuk kejutan?</strong><span>Semua peserta punya peluang setara.</span></div>}<div className="reel-mask top"/><div className="reel-mask bottom"/></div><div className="reel-under">{spinning?'Gulungan sedang berjalan':draw?`Selamat, ${draw.fullName}!`:'Menunggu undian dimulai'}</div><span className="sr-only" aria-live="polite">{draw&&!spinning?`Pemenang: ${draw.fullName}`:''}</span></div>;
},(a,b)=>a.draw?.id===b.draw?.id&&a.timelineOffset===b.timelineOffset&&Boolean(a.draw&&a.now<a.draw.revealAt)===Boolean(b.draw&&b.now<b.draw.revealAt));
