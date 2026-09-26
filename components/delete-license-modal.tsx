'use client';

import { useState } from 'react';
import { Trash2, X, Loader2 } from 'lucide-react';
import type { LicenseDetailData } from './license-details-modal';

interface DeleteLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  license: LicenseDetailData | null;
  onDeleted: (deletedLicenseId: string) => void;
}

export default function DeleteLicenseModal({
  isOpen,
  onClose,
  license,
  onDeleted
}: DeleteLicenseModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !license) return null;

  async function handleConfirmDelete() {
    if (!license) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/licenses/${license.id}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete license');
      }

      onDeleted(license.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error occurred while deleting license');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md bg-[#161616] border border-red-900/40 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-950/60 border border-red-900/60 flex items-center justify-center text-red-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Delete License?
              </h3>
              <p className="text-xs text-red-400/90 mt-0.5">
                Permanent deletion from database
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

        <p className="text-sm text-[#aaaaaa] leading-relaxed">
          This license will be permanently deleted. This action cannot be undone.
        </p>

        {/* License summary */}
        <div className="p-3.5 rounded-xl bg-[#111111] border border-[#262626] space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-[#777777]">
            <span>Target License</span>
            <span className="font-mono text-zinc-400 uppercase">{license.subscription}</span>
          </div>
          <p className="font-mono text-xs text-white font-semibold tracking-wider select-all break-all">
            {license.license_key}
          </p>
          {license.application?.name && (
            <p className="text-[11px] text-[#777777]">
              Application: <strong className="text-zinc-300">{license.application.name}</strong>
            </p>
          )}
          {license.note && (
            <p className="text-[11px] text-[#888888] italic">Note: {license.note}</p>
          )}
        </div>

        <p className="text-xs text-[#727275] leading-relaxed">
          The license will be permanently removed from the system. Any hardware profiles or activated sessions linked to this license will immediately become invalid.
        </p>

        {/* Modal Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#222222]">
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
            onClick={handleConfirmDelete}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-[0_0_15px_rgba(220,38,38,0.3)] transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
