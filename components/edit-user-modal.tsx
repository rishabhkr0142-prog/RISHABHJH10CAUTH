'use client';

import { useState, useEffect } from 'react';
import { User, Eye, EyeOff, X, AlertCircle } from 'lucide-react';
import type { EnrichedUser } from '@/lib/user-service';

export interface ApplicationOption {
  id: string;
  name: string;
  client_id?: string;
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: EnrichedUser | null;
  applications?: ApplicationOption[];
  onUserUpdated?: (user: any) => void;
}

export default function EditUserModal({
  isOpen,
  onClose,
  user,
  applications = [],
  onUserUpdated
}: EditUserModalProps) {
  const [targetAppId, setTargetAppId] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string>('active');

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setTargetAppId(user.application_id || (user.application?.id ?? ''));
      setUsername(user.username || '');
      setEmail(user.email || '');
      if (user.status === 'suspended') {
        setStatus('banned');
      } else if (user.status === 'disabled') {
        setStatus('disabled');
      } else {
        setStatus('active');
      }
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
        application_id: targetAppId || user.application_id,
        target_application_id: targetAppId || user.application_id,
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
          application_id: payload.application_id,
          username: payload.username,
          email: payload.email,
          status: status === 'banned' ? 'suspended' : status === 'paused' ? 'disabled' : status
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
      <div className="relative w-full max-w-md my-8 bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-[#222222]">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-full bg-[#201815] border border-[#ff5f15]/30 flex items-center justify-center text-[#ff5f15]">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Edit User</h2>
              <p className="text-xs text-[#888888]">Update user details for this application</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#777777] hover:text-white hover:bg-[#202020] transition-colors cursor-pointer"
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

          {/* Target Application */}
          <div>
            <label className="block text-[11px] font-bold text-[#888888] uppercase tracking-wider mb-1.5">
              Target Application *
            </label>
            <select
              value={targetAppId}
              onChange={(e) => setTargetAppId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0e0e0e] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#ff5f15] transition-colors cursor-pointer"
            >
              {applications.length > 0 ? (
                applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))
              ) : (
                <option value={user.application_id}>{user.application?.name || 'Current Application'}</option>
              )}
            </select>
          </div>

          {/* Username */}
          <div>
            <label className="block text-[11px] font-bold text-[#888888] uppercase tracking-wider mb-1.5">
              Username *
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. john_doe"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0e0e0e] border border-[#2a2a2a] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15] transition-colors"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[11px] font-bold text-[#888888] uppercase tracking-wider mb-1.5">
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep unchanged"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#0e0e0e] border border-[#2a2a2a] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15] transition-colors"
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

          {/* Email */}
          <div>
            <label className="block text-[11px] font-bold text-[#888888] uppercase tracking-wider mb-1.5">
              Email (Optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. user@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0e0e0e] border border-[#2a2a2a] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15] transition-colors"
            />
            <p className="mt-1 text-[11px] text-[#666666]">If left blank, an internal user handle email is assigned.</p>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-bold text-[#888888] uppercase tracking-wider mb-1.5">
              Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0e0e0e] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#ff5f15] transition-colors cursor-pointer"
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="banned">Banned</option>
              <option value="paused">Paused</option>
            </select>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#222222] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-[#2a2a2a] text-xs font-medium text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 rounded-xl bg-[#ff5f15] hover:bg-[#e0500e] disabled:opacity-50 text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
