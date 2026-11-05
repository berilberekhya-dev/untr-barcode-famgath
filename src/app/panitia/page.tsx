import { isAdmin } from '@/lib/auth';
import { AdminApp } from '@/components/admin';
import { Login } from '@/components/login';
export const dynamic = 'force-dynamic';
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return await isAdmin() ? <AdminApp initialSection={view === 'participants' || view === 'settings' || view === 'roster' ? view : 'overview'} /> : <Login />;
}
