'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  User,
  Shield,
  KeyRound,
  LogOut,
  Check,
  AlertCircle,
  Loader2,
  Server,
  Lock
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Account update state
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
  const [accountMsg, setAccountMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password update state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function fetchOwner() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setEmail(user.email || '');
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          if (profile) {
            setDisplayName(profile.display_name || '');
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingProfile(false);
      }
    }
    fetchOwner();
  }, []);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setAccountMsg(null);
    setIsUpdatingAccount(true);

    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      setAccountMsg({ type: 'success', text: 'Display name updated successfully.' });
    } catch (err: any) {
      setAccountMsg({ type: 'error', text: err.message });
    } finally {
      setIsUpdatingAccount(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw new Error(error.message);

      setPasswordMsg({ type: 'success', text: 'Password changed successfully.' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message });
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  async function handleSignOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="border-b border-[#222222] pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          Platform Settings
        </h1>
        <p className="mt-1 text-sm text-[#727275]">
          Manage owner credentials, security parameters, and platform branding.
        </p>
      </div>

      {/* Account Section */}
      <section className="bg-[#111111] border border-[#222222] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-[#222222] pb-4">
          <div className="h-9 w-9 rounded-xl bg-[#161616] border border-[#222222] flex items-center justify-center text-[#ff5f15]">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Owner Account</h2>
            <p className="text-xs text-[#727275]">Primary administrator profile details</p>
          </div>
        </div>

        {accountMsg && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
              accountMsg.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-900/50 text-emerald-300'
                : 'bg-red-950/40 border-red-900/50 text-red-300'
            }`}
          >
            {accountMsg.type === 'success' ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400" />
            )}
            <span>{accountMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-[#727275] uppercase tracking-wider mb-2">
              Email Address (Owner)
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full bg-[#161616] border border-[#222222] rounded-xl px-4 py-2.5 text-xs text-[#888888] cursor-not-allowed font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#727275] uppercase tracking-wider mb-2">
              Display Name
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Rishabh"
              className="w-full bg-[#161616] border border-[#222222] focus:border-[#ff5f15] focus:outline-none rounded-xl px-4 py-2.5 text-xs text-white transition-colors"
              disabled={isUpdatingAccount || isLoadingProfile}
            />
          </div>

          <button
            type="submit"
            disabled={isUpdatingAccount || isLoadingProfile}
            className="bg-[#ff5f15] hover:bg-[#e0500e] text-white px-5 py-2.5 rounded-xl text-xs font-medium transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
          >
            {isUpdatingAccount ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save Account
          </button>
        </form>
      </section>

      {/* Security Section */}
      <section className="bg-[#111111] border border-[#222222] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-[#222222] pb-4">
          <div className="h-9 w-9 rounded-xl bg-[#161616] border border-[#222222] flex items-center justify-center text-[#ff5f15]">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Security & Password</h2>
            <p className="text-xs text-[#727275]">Update owner authentication credentials</p>
          </div>
        </div>

        {passwordMsg && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
              passwordMsg.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-900/50 text-emerald-300'
                : 'bg-red-950/40 border-red-900/50 text-red-300'
            }`}
          >
            {passwordMsg.type === 'success' ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400" />
            )}
            <span>{passwordMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-[#727275] uppercase tracking-wider mb-2">
              New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#161616] border border-[#222222] focus:border-[#ff5f15] focus:outline-none rounded-xl px-4 py-2.5 text-xs text-white transition-colors"
              disabled={isUpdatingPassword}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#727275] uppercase tracking-wider mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#161616] border border-[#222222] focus:border-[#ff5f15] focus:outline-none rounded-xl px-4 py-2.5 text-xs text-white transition-colors"
              disabled={isUpdatingPassword}
            />
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="bg-[#1f1f1f] hover:bg-[#282828] text-white border border-[#2e2e2e] px-5 py-2.5 rounded-xl text-xs font-medium transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              {isUpdatingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Update Password
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-red-950/20 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          </div>
        </form>
      </section>

      {/* Platform Branding Section */}
      <section className="bg-[#111111] border border-[#222222] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-[#222222] pb-4">
          <div className="h-9 w-9 rounded-xl bg-[#161616] border border-[#222222] flex items-center justify-center text-[#ff5f15]">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Platform Information</h2>
            <p className="text-xs text-[#727275]">System architecture specifications</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#161616] border border-[#222222] space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#727275]">Brand Identity</span>
            <p className="font-bold text-white text-sm">RISHABH JH10C AUTH</p>
            <p className="text-[11px] text-[#727275]">Compact Logo: JH10C AUTH</p>
          </div>

          <div className="p-4 rounded-xl bg-[#161616] border border-[#222222] space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#727275]">Authorization Model</span>
            <p className="font-bold text-white text-sm">Strictly Single Owner</p>
            <p className="text-[11px] text-[#727275]">Enforced by DB Triggers &amp; RLS</p>
          </div>

          <div className="p-4 rounded-xl bg-[#161616] border border-[#222222] space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#727275]">Database &amp; Engine</span>
            <p className="font-mono text-white text-xs">Supabase PostgreSQL</p>
            <p className="text-[11px] text-[#727275]">Row Level Security active on all entities</p>
          </div>

          <div className="p-4 rounded-xl bg-[#161616] border border-[#222222] space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#727275]">Deployment Engine</span>
            <p className="font-mono text-white text-xs">Next.js App Router &amp; Vercel</p>
            <p className="text-[11px] text-[#727275]">Serverless-native Supabase SSR architecture</p>
          </div>
        </div>
      </section>
    </div>
  );
}
