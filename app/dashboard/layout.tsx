import { redirect } from 'next/navigation';
import { getOwnerUser } from '@/lib/supabase/auth';
import DashboardClientShell from './dashboard-shell';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const auth = await getOwnerUser();

  // If not authenticated or not the platform OWNER, redirect to login
  if (!auth || !auth.user || !auth.profile || auth.profile.role.toUpperCase() !== 'OWNER') {
    redirect('/login?error=access_denied');
  }

  const ownerInfo = {
    email: auth.profile.email,
    display_name: auth.profile.display_name || auth.profile.email.split('@')[0],
    role: auth.profile.role.toUpperCase()
  };

  return (
    <DashboardClientShell owner={ownerInfo}>
      {children}
    </DashboardClientShell>
  );
}
