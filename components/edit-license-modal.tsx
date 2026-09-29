'use client';

import { useState, useEffect } from 'react';
import { Sliders, AlertCircle, X, Calendar, Clock, Laptop } from 'lucide-react';
import { AVAILABLE_SUBSCRIPTIONS } from '@/lib/subscriptions';
import type { LicenseDetailData } from '@/components/license-details-modal';

interface EditLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  license: LicenseDetailData | null;
  onLicenseUpdated?: (updatedLicense: LicenseDetailData) => void;
}

export default function EditLicenseModal({
  isOpen,
  onClose,
  license,
  onLicenseUpdated
}: EditLicenseModalProps) {
  const [subscription, setSubscription] = useState('default');
  const [allowedDevices, setAllowedDevices] = useState('1');
  const [expiresAt, setExpiresAt] = useState('');
  const [status, setStatus] = useState<'active' | 'used' | 'expired' | 'revoked'>('active');
  const [note, setNote] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (license && isOpen) {
      setSubscription(license.subscription || 'default');
      setAllowedDevices(String(license.allowed_devices || 1));
      setStatus(license.status || 'active');
      setNote(license.note || '');

      if (license.expires_at) {
        try {
          const d = new Date(license.expires_at);
          // Format as YYYY-MM-DDTHH:mm for datetime-local input
          const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setExpiresAt(localIso);
        } catch {
          setExpiresAt('');
        }
      } else {
        setExpiresAt('');
      }
      setErrorMessage(null);
    }
  }, [license, isOpen]);

  if (!isOpen || !license) return null;

  function handleExtend(days: number) {
    const base = expiresAt ? new Date(expiresAt) : new Date();
    const newDate = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    const localIso = new Date(newDate.getTime() - newDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setExpiresAt(localIso);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!license) return;
    setErrorMessage(null);

    const devices = parseInt(allowedDevices, 10);
    if (isNaN(devices) || devices < 1 || devices > 1000) {
      setErrorMessage('Allowed devices must be between 1 and 1000');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        action: 'edit',
        subscription,
        allowed_devices: devices,
        status,
        note: note.trim() || null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null
      };

      const res = await fetch(`/api/licenses/${license.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update license');
      }

      if (onLicenseUpdated) {
        onLicenseUpdated({
          ...license,
          subscription,
          allowed_devices: devices,
          status,
          note: payload.note,
          expires_at: payload.expires_at
        });
      }

      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update license');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg my-8 bg-[#161616] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#242424] bg-[#121212]/80">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-[#ff5f15]">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Edit License</h2>
              <p className="text-xs text-[#888888] font-mono">{license.license_key}</p>
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

          {/* Readonly info */}
          <div className="p-3 rounded-xl bg-[#111111] border border-[#262626] flex items-center justify-between text-xs">
            <div>
              <span className="text-[#727275] block text-[10px] uppercase font-semibold">Application</span>
              <span className="text-white font-medium">{license.application?.name || 'Application'}</span>
            </div>
            <div className="text-right">
              <span className="text-[#727275] block text-[10px] uppercase font-semibold">Assigned User</span>
              <span className="text-zinc-300 font-medium">
                {license.assigned_user?.email || license.note || 'Unassigned'}
              </span>
            </div>
          </div>

          {/* Subscription */}
          <div>
            <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
              Subscription Tier *
            </label>
            <select
              value={subscription}
              onChange={(e) => setSubscription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
            >
              {AVAILABLE_SUBSCRIPTIONS.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name} — {tier.description}
                </option>
              ))}
            </select>
          </div>

          {/* Expiry Date */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider">
                Expiry Date & Time
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleExtend(1)}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1c1c1c] border border-[#282828] text-[#888888] hover:text-white"
                >
                  +1D
                </button>
                <button
                  type="button"
                  onClick={() => handleExtend(7)}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1c1c1c] border border-[#282828] text-[#888888] hover:text-white"
                >
                  +7D
                </button>
                <button
                  type="button"
                  onClick={() => handleExtend(30)}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1c1c1c] border border-[#282828] text-[#888888] hover:text-white"
                >
                  +1MO
                </button>
                <button
                  type="button"
                  onClick={() => handleExtend(365)}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1c1c1c] border border-[#282828] text-[#888888] hover:text-white"
                >
                  +1Y
                </button>
                <button
                  type="button"
                  onClick={() => setExpiresAt('')}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1c1c1c] border border-[#282828] text-amber-400 hover:text-amber-300"
                >
                  Lifetime
                </button>
              </div>
            </div>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
            />
            <p className="mt-1 text-[11px] text-[#666666]">
              {expiresAt ? 'Specific date and time when the license expires.' : 'Lifetime / No Expiry'}
            </p>
          </div>

          {/* Allowed Devices */}
          <div>
            <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
              Allowed Devices (Multi-HWID) *
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              value={allowedDevices}
              onChange={(e) => setAllowedDevices(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
              Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
            >
              <option value="active">Active</option>
              <option value="used">Used</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
              Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. user email or custom note"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
            />
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
