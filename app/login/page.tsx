'use client';

import { useState, useActionState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Shield, Eye, EyeOff, Loader2, AlertCircle, KeyRound } from 'lucide-react';
import { signInAction } from './actions';

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/dashboard';
  const urlError = searchParams.get('error');

  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState(signInAction, {
    error: urlError === 'access_denied'
      ? 'Access denied. Only the authorized platform owner can access this dashboard.'
      : null
  });

  return (
    <div className="w-full max-w-md">
      {/* Brand header */}
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="h-14 w-14 rounded-2xl bg-[#1a1a1a] border border-[#222222] flex items-center justify-center text-[#ff5f15] shadow-lg mb-4">
          <Shield className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          RISHABH JH10C AUTH
        </h1>
        <p className="mt-1.5 text-sm text-[#727275]">
          Single-owner developer authentication platform
        </p>
      </div>

      {/* Card */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between border-b border-[#222222] pb-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#ff5f15]" />
            Owner Sign In
          </h2>
          <span className="text-[11px] font-mono tracking-wider px-2 py-0.5 rounded-full bg-[#1a1a1a] text-[#ff5f15] border border-[#222222]">
            JH10C AUTH
          </span>
        </div>

        {state?.error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-950/40 border border-red-900/50 flex items-start gap-3 text-red-300 text-sm animate-in fade-in duration-200">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs leading-relaxed">{state.error}</div>
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="redirect" value={redirectPath} />

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-[#727275] uppercase tracking-wider mb-2"
            >
              Owner Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="owner@domain.com"
              className="w-full bg-[#161616] border border-[#222222] focus:border-[#ff5f15] focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#444444] transition-colors"
              disabled={isPending}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-[#727275] uppercase tracking-wider mb-2"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••••••"
                className="w-full bg-[#161616] border border-[#222222] focus:border-[#ff5f15] focus:outline-none rounded-xl px-4 py-2.5 pr-11 text-sm text-white placeholder-[#444444] transition-colors"
                disabled={isPending}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#727275] hover:text-white transition-colors p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 bg-[#ff5f15] hover:bg-[#e0500e] text-white font-medium text-sm py-2.5 px-4 rounded-xl transition-all shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating on Server...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Footer info */}
      <div className="mt-8 text-center">
        <p className="text-xs text-[#727275]">
          Protected Environment &bull; Strictly Single-Owner Access
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#121212] px-4 py-12">
      <Suspense fallback={<div className="text-[#727275] text-xs">Loading login portal...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
