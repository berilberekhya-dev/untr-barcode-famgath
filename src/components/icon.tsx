import type { ReactNode } from 'react';
export function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  const icons: Record<string, ReactNode> = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    external: <><path d="M14 3h7v7m0-7L10 14" /><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" /></>,
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M15 3.1a4 4 0 0 1 0 7.8" /><circle cx="9" cy="7" r="4" /></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
    gift: <><rect x="3" y="8" width="18" height="4" /><path d="M5 12v9h14v-9M12 8v13" /><path d="M12 8H7.5a2.5 2.5 0 1 1 2.4-3.2L12 8Zm0 0h4.5a2.5 2.5 0 1 0-2.4-3.2L12 8Z" /></>,
    rocket: <><path d="M12 16 8 12c1-7 7-10 13-10 0 6-3 12-10 13M8 12H3l3-5h5m1 9v5l5-3v-5M6 16l-3 5 5-3" /><circle cx="16" cy="7" r="2" /></>,
    qr: <><path d="M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zM15 15h3v3h3v3h-6zm6-3v3m-9 6v-6h3m-3-3h-2" /></>,
    settings: <><path d="m9 3-1 3-3 1-2 3 2 3-1 3 3 2 3-1 2 4 3-2 1-3 3-1 2-3-2-3 1-3-3-2-3 1-2-3Z" /><circle cx="12" cy="12" r="3" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5" /></>,
    search: <><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5 5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    edit: <><path d="m16 3 5 5-12 12H4v-5ZM13 6l5 5" /></>,
    check: <path d="m4 12 5 5L20 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    logout: <><path d="M9 3H3v18h6m7-14 5 5-5 5M9 12h12" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="1" /><path d="M3 10h18M7 3v4m10-4v4" /></>,
    pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="1" /><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2" /></>,
    expand: <path d="M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v1" /></>,
    trophy: <><path d="M7 3h10v7a5 5 0 0 1-10 0Zm0 2H3v3a4 4 0 0 0 5 4m9-7h4v3a4 4 0 0 1-5 4M12 15v6m-5 0h10" /></>,
    link: <><path d="m10 13 4-4m-7 6-1 1a4 4 0 0 0 6 6l4-4a4 4 0 0 0-1-6M9 12a4 4 0 0 1-1-6l4-4a4 4 0 0 1 6 6l-1 1" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" className={className}>{icons[name] || icons.rocket}</svg>;
}
