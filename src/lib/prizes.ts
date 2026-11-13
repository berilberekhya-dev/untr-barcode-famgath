import type { CatalogPrize, PrizeRound, PrizeSession } from './types';

export function upcomingRound(catalog: CatalogPrize[], reserved: number): PrizeRound | undefined {
  const next = catalog[reserved];
  if (!next) return;
  return {
    prizes: catalog.slice(reserved, reserved + (next.grand ? 1 : 5)),
    title: next.grand ? 'Grand Prize' : `Door Prize · Ronde ${Math.floor(reserved / 5) + 1}`,
  };
}

export function slotPrize(session: PrizeSession | undefined | null, position: number) {
  return session?.prizes?.[position - 1]?.name ?? session?.prizeName ?? 'Door prize';
}
