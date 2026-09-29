'use client';

import { useState, useEffect } from 'react';
import { UserCog, AlertCircle, Eye, EyeOff, X } from 'lucide-react';
import type { EnrichedUser } from '@/lib/user-service';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: EnrichedUser | null;
  onUserUpdated?: (user: any) => void;
}

export default function EditUserModal({
  isOpen,
  onClose,
  user,
  onUserUpdated
}: EditUserModalProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'active' | 'disabled' | 'suspended'>('active');

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
      setStatus(user.status || 'active');
      setPassword('');
      setErrorMessage(null);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setErrorMessage(null);

    if (password && (password.length < 1 || password.length > 100)) {
      setErrorMessage('Password must be between 1 and 100 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        username: username.trim() || null,
        email: email.trim().toLowerCase(),
        status
      };
      if (password) {
        payload.password = password;
      }

      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      if (onUserUpdated) {
        onUserUpdated({
          ...user,
          username: payload.username,
          email: payload.email,
          status: payload.status
        });
      }

      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md my-8 bg-[#161616] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#242424] bg-[#121212]/80">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-[#ff5f15]">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Edit User</h2>
              <p className="text-xs text-[#888888]">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#777777] hover:text-white hover:bg-[#202020] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center gap-2.5 text-red-300 text-xs">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Application (Read-only) */}
          <div>
            <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
              Application
            </label>
            <div className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-[#888888]">
              {user.application?.name || 'Application'}
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. john_doe"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
            />
          </div>

          {/* New Password (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
              New Password (Leave blank to keep current)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep unchanged"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
              Account Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#242424] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#1c1c1c] hover:bg-[#242424] border border-[#2c2c2c] text-xs font-medium text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#ff5f15] hover:bg-[#e0500e] disabled:opacity-50 text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
