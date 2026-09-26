'use client';

import { useState } from 'react';
import { AlertTriangle, Ban, X, Loader2 } from 'lucide-react';
import type { LicenseDetailData } from './license-details-modal';

interface RevokeLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  license: LicenseDetailData | null;
  onRevoked: (revokedLicense: any) => void;
}

export default function RevokeLicenseModal({
  isOpen,
  onClose,
  license,
  onRevoked
}: RevokeLicenseModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !license) return null;

  async function handleConfirmRevoke() {
    if (!license) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/licenses/${license.id}/revoke`, {
        method: 'POST'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to revoke license');
      }

      onRevoked(data.license || { ...license, status: 'revoked' });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error occurred while revoking license');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-[#161616] border border-red-900/40 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-950/60 border border-red-900/60 flex items-center justify-center text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Revoke License?
              </h3>
              <p className="text-xs text-[#888888] mt-0.5">
                This license will no longer be usable.
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
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* License summary */}
        <div className="p-3.5 rounded-xl bg-[#111111] border border-[#262626] space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-[#777777]">
            <span>Target License</span>
            <span className="font-mono text-zinc-400 uppercase">{license.subscription}</span>
          </div>
          <p className="font-mono text-xs text-white font-semibold tracking-wider select-all break-all">
            {license.license_key}
          </p>
          {license.note && (
            <p className="text-[11px] text-[#888888] italic">Note: {license.note}</p>
          )}
        </div>

        <p className="text-xs text-[#888888] leading-relaxed">
          The license will be permanently deactivated. Any client applications or hardware bound to this key will be denied access. Audit history is retained.
        </p>

        {/* Modal Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] border border-[#2e2e2e] text-xs font-medium text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmRevoke}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Revoking...</span>
              </>
            ) : (
              <>
                <Ban className="h-3.5 w-3.5" />
                <span>Revoke</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
