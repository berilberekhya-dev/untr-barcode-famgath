import type { NextRequest } from 'next/server';
import { getService } from '@/lib/service';
import { handle, registrationUrl } from '@/lib/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) { return handle(() => (request.nextUrl.searchParams.get('view')==='registration' ? getService().registrationDisplay(registrationUrl(request)) : getService().display(registrationUrl(request)))); }
