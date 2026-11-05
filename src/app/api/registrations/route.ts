import type { NextRequest } from 'next/server';
import { getService } from '@/lib/service';
import { handle, checkOrigin } from '@/lib/http';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  return handle(async () => { checkOrigin(request); return getService().register(await request.json()); });
}
