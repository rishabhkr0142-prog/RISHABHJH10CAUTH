'use client';

import { useState, useMemo } from 'react';
import { Clock, X, AlertCircle, Calendar, ArrowRight, ShieldAlert } from 'lucide-react';
import type { EnrichedUser } from '@/lib/user-service';

interface ExtendTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: EnrichedUser | null;
  onSuccess: () => void;
  onOpenAssignLicense?: (user: EnrichedUser) => void;
}

type DurationType = '1h' | '1d' | '7d' | '30d' | 'custom';

export default function ExtendTimeModal({
  isOpen,
  onClose,
  user,
  onSuccess,
  onOpenAssignLicense
}: ExtendTimeModalProps) {
  const [selectedDuration, setSelectedDuration] = useState<DurationType>('7d');
  const [customAmount, setCustomAmount] = useState<number>(14);
  const [customUnit, setCustomUnit] = useState<'hours' | 'days' | 'months'>('days');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasLicense = Boolean(user?.license && user.license.id);

  // Calculate new expiry date dynamically
  // If active: existingLicense.expiry + duration
  // If already expired: now + duration
  const calculatedExpiry = useMemo(() => {
    if (!hasLicense || !user?.license) return null;

    const now = Date.now();
    let baseTime = now;
    if (user.license.expires_at) {
      const expTime = new Date(user.license.expires_at).getTime();
      if (!isNaN(expTime) && expTime > now) {
        baseTime = expTime;
      }
    }

    let addMs = 0;
    switch (selectedDuration) {
      case '1h':
        addMs = 1 * 60 * 60 * 1000;
        break;
      case '1d':
        addMs = 24 * 60 * 60 * 1000;
        break;
      case '7d':
        addMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        addMs = 30 * 24 * 60 * 60 * 1000;
        break;
      case 'custom': {
        const val = Math.max(1, Number(customAmount) || 1);
        if (customUnit === 'hours') addMs = val * 60 * 60 * 1000;
        else if (customUnit === 'days') addMs = val * 24 * 60 * 60 * 1000;
        else if (customUnit === 'months') addMs = val * 30 * 24 * 60 * 60 * 1000;
        break;
      }
    }

    const newDate = new Date(baseTime + addMs);
    return newDate;
  }, [hasLicense, user, selectedDuration, customAmount, customUnit]);

  if (!isOpen || !user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasLicense || !user?.license?.id || !calculatedExpiry) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/licenses/${user.license.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expires_at: calculatedExpiry.toISOString()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to extend license time');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating expiry');
    } finally {
      setIsSubmitting(false);
    }
  }

  function formatDateTimePreview(d: Date | null) {
    if (!d) return 'N/A';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();

    let hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(d.getMinutes()).padStart(2, '0');

    return `${month} ${day}, ${year} • ${hoursStr}:${minutesStr} ${ampm}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in-0 zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-full bg-[#201815] border border-[#ff5f15]/30 flex items-center justify-center text-[#ff5f15]">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Extend Time</h3>
              <p className="text-xs text-[#888888] mt-0.5">
                Extend subscription duration for <span className="text-white font-medium">{user.username || user.email}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#777777] hover:text-white hover:bg-[#202020] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center gap-2.5 text-red-300 text-xs">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {!hasLicense ? (
          <div className="p-5 rounded-xl bg-[#1a1412] border border-[#ff5f15]/20 space-y-4">
            <div className="flex items-center gap-2.5 text-[#ff7f45]">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <span className="font-semibold text-sm">No Assigned License</span>
            </div>
            <p className="text-xs text-[#999999] leading-relaxed">
              This user does not have an assigned License subscription. Assign a License to this user before extending the expiry.
            </p>
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#202020] hover:bg-[#282828] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenAssignLicense && user) {
                    onOpenAssignLicense(user);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-[#ff5f15] hover:bg-[#e0500e] text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
              >
                Assign License
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Status Display */}
            <div className="p-3.5 rounded-xl bg-[#0e0e0e] border border-[#242424] space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#777777]">Current Subscription</span>
                <span className="text-[#ff5f15] font-semibold uppercase">
                  {user.license?.subscription_name || user.license?.subscription || 'Standard'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#777777]">Current Expiry</span>
                <span className="text-white font-medium">
                  {user.license?.expires_at ? formatDateTimePreview(new Date(user.license.expires_at)) : 'No Expiry (Lifetime)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#777777]">Remaining time</span>
                <span className="text-white font-medium">
                  {user.license?.days_remaining_text || (user.license?.expires_at ? 'Active' : 'Never expires')}
                </span>
              </div>
            </div>

            {/* Quick Duration Buttons */}
            <div>
              <label className="block text-[11px] font-bold text-[#888888] uppercase tracking-wider mb-2">
                Quick duration
              </label>
              <div className="grid grid-cols-5 gap-2">
                {(['1h', '1d', '7d', '30d', 'custom'] as const).map((key) => {
                  const label =
                    key === '1h'
                      ? '1H'
                      : key === '1d'
                      ? '1D'
                      : key === '7d'
                      ? '7D'
                      : key === '30d'
                      ? '30D'
                      : 'Custom';
                  const active = selectedDuration === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDuration(key)}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#ff5f15] text-white border-[#ff5f15] shadow-sm'
                          : 'bg-[#121212] text-[#aaaaaa] border-[#262626] hover:text-white hover:border-[#383838]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input */}
            {selectedDuration === 'custom' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="px-3.5 py-2.5 rounded-xl bg-[#0e0e0e] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#ff5f15] transition-colors"
                />
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value as any)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#0e0e0e] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#ff5f15] transition-colors cursor-pointer"
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="months">Months (30d)</option>
                </select>
              </div>
            )}

            {/* Preview of New Expiry */}
            <div className="p-3.5 rounded-xl bg-[#111111] border border-[#222222] space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5 text-[#ff5f15]" />
                <span>New Expiry Preview</span>
              </div>
              <p className="text-sm font-semibold text-[#ff7f45]">
                {formatDateTimePreview(calculatedExpiry)}
              </p>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-[#222222] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-[#2a2a2a] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-[#ff5f15] hover:bg-[#e0500e] disabled:opacity-50 text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
              >
                {isSubmitting ? 'Extending...' : 'Extend Time'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
