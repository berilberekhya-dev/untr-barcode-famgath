export function Astronaut({ className = '' }: { className?: string }) {
  return <svg className={`astronaut ${className}`} viewBox="0 0 160 180" fill="none" role="img" aria-label="Astronot pixel melayang di angkasa" shapeRendering="crispEdges">
    <path d="M116 81h16v12h10v28h-10v17h-17v-8h11v-12h8V98h-8v-9h-10" fill="#8B84B7" />
    <path d="M48 77H32v12H22v32h17V99h13M108 77h16v12h10v24h-17V96h-12" fill="#8B9DBB" />
    <path d="M51 74H37v15H27v22h13V95h17M106 76h14v16h9v16h-12V97h-15" fill="#EAF1FA" />
    <path d="M27 107h13v14H27M117 104h13v15h-13" fill="#FFC928" />
    <path d="M48 37h8V23h15v-7h27v7h15v14h8v35h-8v12H56V72h-8" fill="#7487A6" />
    <path d="M48 34h8V22h16v-7h23v7h15v12h8v33h-8v13H56V67h-8" fill="#EEF3FF" />
    <path d="M57 38h8V28h34v10h10v26H99v9H65v-9h-8" fill="#122346" />
    <path d="M65 36h32v7H72v17h-7" fill="#70E0CF" /><path d="M77 36h16v6H77" fill="#C9FFF0" />
    <path d="M55 79h52v44H55M60 117h19v31H60v10H45v-15h8v-22M83 117h21v24h8v15H96v-9H83" fill="#869AB7" />
    <path d="M51 78h52v42H51M57 114h19v29H57v10H42v-12h8v-22M80 114h19v25h9v13H93v-9H80" fill="#EEF3FF" />
    <path d="M58 91h23v17H58" fill="#14204A" /><path d="M63 96h5v7h-5m8-7h5v7h-5" fill="#FFC928" />
    <path d="M90 90h7v7h-7M90 101h7v7h-7" fill="#70E0CF" />
    <path d="M42 149h19v9H42M92 148h19v9H92" fill="#FFC928" />
    <path d="M59 79h40v5H59M51 114h52v7H51" fill="#B8C6DF" />
    <rect x="36" y="39" width="5" height="5" fill="#FFC928" /><rect x="126" y="55" width="4" height="4" fill="#9E8CFF" />
  </svg>;
}

export function Planet({ className = '', purple = false }: { className?: string; purple?: boolean }) {
  const base = purple ? '#9E8CFF' : '#FFC928';
  const shadow = purple ? '#6152B8' : '#C89125';
  return <svg className={`pixel-planet ${className}`} viewBox="0 0 160 125" aria-hidden="true" shapeRendering="crispEdges">
    <path d="M56 13h47v9h17v13h11v46h-11v14h-17v9H56v-9H39V81H28V35h11V22h17" fill={base} />
    <path d="M103 22h17v13h11v46h-11v14h-17v9H65v-8h29V85h13V72h10V40h-14" fill={shadow} />
    <path d="M43 36h30v7H43M78 49h30v7H78M49 65h39v8H49M67 83h24v6H67" fill={purple ? '#BEB2FF' : '#FFE49A'} />
    <path d="M22 70H9v12h13v7h26v-7h24v-7h28v-7h25v-7h20V46h-16v7h-23v7H79v7H49v7H22" fill={purple ? '#70E0CF' : '#9E8CFF'} />
    <path d="M22 83h26v-7h24v-7h28v-7h25v-7h20v7h-20v7h-25v7H72v7H48v7H22" fill={purple ? '#389DA8' : '#6152B8'} />
  </svg>;
}

export function SpaceBackdrop() {
  return <div className="space-backdrop" aria-hidden="true">
    {Array.from({ length: 90 }, (_, i) => <i key={i} className={`star star-${i % 4}`} style={{ left: `${(i * 37 + 7) % 100}%`, top: `${(i * 23 + 11) % 100}%`, animationDelay: `${i % 7}s` }} />)}
    <div className="space-haze haze-one" /><div className="space-haze haze-two" />
    <div className="constellation constellation-one"><PixelSpark /><PixelSpark /><PixelSpark /><PixelSpark /></div>
    <div className="constellation constellation-two"><PixelSpark /><PixelSpark /><PixelSpark /></div>
    <Satellite className="backdrop-satellite" /><Rocket className="backdrop-rocket" /><Moon className="backdrop-moon" />
    <Planet className="backdrop-planet" purple />
    <div className="orbit-line" />
  </div>;
}

export function Satellite({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 100 70" fill="none" shapeRendering="crispEdges" aria-hidden="true"><path d="M5 25h25v25H5m65-25h25v25H70" fill="#7766BD" /><path d="M10 29h15v17H10m65-17h15v17H75" fill="#9E8CFF" /><path d="M15 25v25m65-25v25M5 37h25m40 0h25" stroke="#14204A" strokeWidth="3" /><path d="M30 34h40v8H30" fill="#B8C6DF" /><path d="M38 20h24v35H38" fill="#EEF3FF" /><path d="M42 24h16v18H42" fill="#FFC928" /><path d="M50 20V7m-7 0h14" stroke="#70E0CF" strokeWidth="4" /><path d="M42 48h5m6 0h5" stroke="#7487A6" strokeWidth="4" /></svg>;
}

export function Rocket({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 150 90" fill="none" shapeRendering="crispEdges" aria-hidden="true"><path d="M9 39h39v13H9m15-20h30v7H24m-9 14h32v7H15" fill="#FFC928" /><path d="M0 42h28v7H0m15-11h19v3H15" fill="#70E0CF" /><path d="M47 31h54V19h14v10h12v9h14v17h-14v9h-12v9h-14V61H47" fill="#EEF3FF" /><path d="M52 31V16h23v15m-23 30v15h23V61" fill="#9E8CFF" /><path d="M82 34h19v24H82" fill="#14204A" /><path d="M87 38h10v10H87" fill="#70E0CF" /><path d="M47 33h9v26h-9" fill="#FFC928" /></svg>;
}

export function Moon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 100 100" shapeRendering="crispEdges" aria-hidden="true"><path d="M30 5h40v10h15v15h10v40H85v15H70v10H30V85H15V70H5V30h10V15h15" fill="#869AB7" /><path d="M30 5h30v10h15v15h10v35H75v15H60v10H30V80H15V65H5V30h10V15h15" fill="#B8C6DF" /><path d="M25 25h20v20H25m35 10h15v15H60M30 65h15v15H30" fill="#7487A6" /><path d="M25 25h15v5H25m35 25h10v5H60" fill="#EEF3FF" /></svg>;
}

export function PixelSpark({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" shapeRendering="crispEdges"><path d="M10 0h4v6h4v4h6v4h-6v4h-4v6h-4v-6H6v-4H0v-4h6V6h4" fill="currentColor" /></svg>;
}
