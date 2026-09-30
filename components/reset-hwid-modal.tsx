'use client';

import { useState } from 'react';
import { RotateCcw, X, Loader2, Laptop, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export interface ResetHwidTarget {
  type: 'license' | 'user';
  id: string; // licenseId or userId
  applicationId: string;
  applicationName: string;
  userIdentifier?: string | null; // username / email
  maskedLicenseKey: string;
  isBound: boolean;
  boundDeviceCount?: number;
  allowedDevices?: number;
  licenseId?: string; // when type === 'user', optional associated license id
  hasLicense?: boolean;
}

interface ResetHwidModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: ResetHwidTarget | null;
  onSuccess: () => void;
  onAssignLicense?: (target: ResetHwidTarget) => void;
}

export default function ResetHwidModal({
  isOpen,
  onClose,
  target,
  onSuccess,
  onAssignLicense
}: ResetHwidModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !target) return null;

  const hasLicense =
    target.hasLicense !== undefined
      ? target.hasLicense
      : target.type === 'license'
      ? true
      : Boolean(
          target.licenseId ||
            (target.maskedLicenseKey &&
              target.maskedLicenseKey !== 'Unassigned' &&
              target.maskedLicenseKey !== 'No License')
        );

  async function handleConfirmReset() {
    if (!target || !hasLicense || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const endpoint =
        target.type === 'license'
          ? `/api/licenses/${target.id}/reset-hwid`
          : `/api/applications/${target.applicationId}/users/${target.id}/reset-hwid`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseId: target.licenseId || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset HWID binding');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while resetting HWID');
    } finally {
      setIsSubmitting(false);
    }
  }

  const deviceCountDisplay =
    target.allowedDevices && target.allowedDevices >= 999
      ? `${target.boundDeviceCount ?? 0} / Unlimited`
      : `${target.boundDeviceCount ?? (target.isBound ? 1 : 0)} / ${target.allowedDevices ?? 1}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-[#161616] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in-0 zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <Laptop className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Reset HWID
              </h3>
              <p className="text-xs text-[#888888] mt-0.5">
                Device &amp; Hardware Binding Management
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-[#777777] hover:text-white hover:bg-[#202020] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!hasLicense ? (
          <div className="p-5 rounded-xl bg-[#1a1412] border border-[#ff5f15]/20 space-y-4">
            <div className="flex items-center gap-2.5 text-[#ff7f45]">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span className="font-semibold text-sm">No Assigned License</span>
            </div>
            <p className="text-xs text-[#999999] leading-relaxed">
              This user does not have an assigned License, so there is no HWID binding to reset.
            </p>
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] border border-[#2e2e2e] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onAssignLicense) {
                    onAssignLicense(target);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-[#ff5f15] hover:bg-[#e0500e] text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
              >
                Assign License
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Safety Check Target Card */}
            <div className="p-4 rounded-xl bg-[#111111] border border-[#242424] space-y-3">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#727275] border-b border-[#1e1e1e] pb-2">
                <span>Target Verification</span>
                <span className="text-orange-400/80">Safety Check</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <span className="text-[11px] text-[#727275] block">User:</span>
                  <span className="font-medium text-white truncate block" title={target.userIdentifier || '—'}>
                    {target.userIdentifier || '—'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-[#727275] block">Application:</span>
                  <span className="font-medium text-white truncate block" title={target.applicationName}>
                    {target.applicationName}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-[#727275] block">License:</span>
                  <span className="font-mono text-zinc-300 font-semibold select-all">
                    {target.maskedLicenseKey}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-[#727275] block">Current HWID status:</span>
                  {target.isBound ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                      Bound ({deviceCountDisplay})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                      Not Bound
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Explanation text matching user requirement */}
            <p className="text-xs text-[#888888] leading-relaxed">
              This will remove the current device/HWID binding from this license. The license itself, subscription, expiry date and other settings will remain unchanged. The next authorized device can bind again.
            </p>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] border border-[#2e2e2e] text-xs font-medium text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Resetting HWID...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset HWID</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
