import { isAdmin } from '@/lib/auth';
import { AdminApp } from '@/components/admin';
import { Login } from '@/components/login';
export const dynamic = 'force-dynamic';
export default async function Page() { return await isAdmin() ? <AdminApp doorprize /> : <Login />; }
