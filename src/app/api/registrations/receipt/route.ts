import {NextRequest} from 'next/server';
import {handle,checkOrigin} from '@/lib/http';
import {getService} from '@/lib/service';
export const runtime='nodejs';
export async function POST(request:NextRequest){return handle(async()=>{checkOrigin(request);return getService().receipt(await request.json());});}
