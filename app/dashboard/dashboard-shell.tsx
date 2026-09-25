'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  Layers,
  Users,
  Key,
  Webhook,
  FileText,
  BookOpen,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  UserCheck,
  ExternalLink,
  Code2
} from 'lucide-react';

interface OwnerInfo {
  email: string;
  display_name: string;
  role: string;
}

export default function DashboardClientShell({
  owner,
  children
}: {
  owner: OwnerInfo;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Sign out error:', err);
      setIsSigningOut(false);
    }
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/applications', label: 'Applications', icon: Layers },
    { href: '/dashboard/users', label: 'Users', icon: Users },
    { href: '/dashboard/integration', label: 'Integration', icon: Code2 },
    { href: '/dashboard/keys', label: 'API Keys', icon: Key },
    { href: '/dashboard/webhooks', label: 'Webhooks', icon: Webhook },
    { href: '/dashboard/logs', label: 'Logs', icon: FileText },
    { href: '/dashboard/docs', label: 'Documentation', icon: BookOpen },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings }
  ];


  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col lg:flex-row">
      {/* Mobile Top Header */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3.5 bg-[#111111] border-b border-[#222222] sticky top-0 z-50">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-[#1a1a1a] border border-[#222222] flex items-center justify-center text-[#ff5f15]">
            <Shield className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white">
            RISHABH JH10C AUTH
          </span>
        </Link>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-xl bg-[#161616] border border-[#222222] text-[#727275] hover:text-white cursor-pointer"
          aria-label="Toggle menu"
        >
          {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Backdrop for mobile drawer */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 bottom-0 left-0 w-64 bg-[#111111] border-r border-[#222222] flex flex-col justify-between z-50 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand */}
          <div className="p-5 border-b border-[#222222] flex items-center justify-between">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 group"
              onClick={() => setIsSidebarOpen(false)}
            >
              <div className="h-9 w-9 rounded-xl bg-[#1a1a1a] border border-[#222222] flex items-center justify-center text-[#ff5f15] group-hover:border-[#ff5f15]/50 transition-colors">
                <Shield className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xs tracking-wider text-white">
                  RISHABH
                </span>
                <span className="text-[11px] font-mono text-[#ff5f15] font-semibold tracking-wider">
                  JH10C AUTH
                </span>
              </div>
            </Link>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#161616] text-[#727275] border border-[#222222]">
              v1.0
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#727275]">
              Platform Navigation
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#1a1a1a] text-[#ff5f15] border border-[#222222] font-semibold'
                      : 'text-[#727275] hover:text-white hover:bg-[#161616]'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? 'text-[#ff5f15]' : 'text-[#727275]'
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Owner Profile & Logout */}
        <div className="p-4 border-t border-[#222222] bg-[#111111] space-y-3">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-[#161616] border border-[#222222]">
            <div className="h-8 w-8 rounded-lg bg-[#222222] flex items-center justify-center text-[#ff5f15]">
              <UserCheck className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {owner.display_name}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-mono text-[#ff5f15] uppercase tracking-wider">
                  {owner.role}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-[#727275] hover:text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-900/30 transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{isSigningOut ? 'Signing out...' : 'Logout'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Topbar */}
        <div className="hidden lg:flex items-center justify-between px-8 py-4 bg-[#111111]/80 backdrop-blur-md border-b border-[#222222] sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[#727275] uppercase tracking-wider">
              Console
            </span>
            <span className="text-[#222222]">/</span>
            <span className="text-xs font-medium text-white capitalize">
              {pathname === '/dashboard'
                ? 'Overview'
                : pathname.replace('/dashboard/', '').split('/')[0]}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-[#161616] border border-[#222222] text-[#ff5f15] flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AUTHENTICATED AS OWNER
            </span>
            <Link
              href="/dashboard/docs"
              className="text-xs text-[#727275] hover:text-white flex items-center gap-1 transition-colors px-2 py-1"
            >
              Docs <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
