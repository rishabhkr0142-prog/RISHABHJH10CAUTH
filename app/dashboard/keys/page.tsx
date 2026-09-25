'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Key,
  Shield,
  ArrowRight,
  Ban,
  Loader2,
  AlertCircle,
  ExternalLink,
  Trash2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface KeyItem {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
  application_id: string;
  application_name: string;
}

export default function KeysPage() {
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal & Action states
  const [keyActionModal, setKeyActionModal] = useState<{
    appId: string;
    keyId: string;
    keyName: string;
    action: 'revoke' | 'delete';
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  async function loadKeys() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/applications');
      if (!res.ok) throw new Error('Failed to load applications');
      const data = await res.json();
      const apps = data.applications || [];

      // For each app, fetch its keys
      const allKeys: KeyItem[] = [];
      for (const app of apps) {
        const kRes = await fetch(`/api/applications/${app.id}/keys`);
        if (kRes.ok) {
          const kData = await kRes.json();
          const appKeys = (kData.keys || []).map((k: any) => ({
            ...k,
            application_name: app.name
          }));
          allKeys.push(...appKeys);
        }
      }

      setKeys(allKeys);
    } catch (err: any) {
      setError(err.message || 'Error loading keys');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadKeys();
  }, []);

  async function executeKeyAction() {
    if (!keyActionModal) return;
    setIsProcessing(true);
    setModalError(null);

    try {
      const res = await fetch(
        `/api/applications/${keyActionModal.appId}/keys/${keyActionModal.keyId}?action=${keyActionModal.action}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${keyActionModal.action} API key`);
      }

      setToastMessage(data.message || `API key "${keyActionModal.keyName}" was successfully ${keyActionModal.action === 'delete' ? 'deleted' : 'revoked'}.`);
      
      if (keyActionModal.action === 'delete') {
        setKeys((prev) => prev.filter((k) => k.id !== keyActionModal.keyId));
      } else {
        setKeys((prev) =>
          prev.map((k) =>
            k.id === keyActionModal.keyId
              ? { ...k, revoked_at: new Date().toISOString() }
              : k
          )
        );
      }

      setKeyActionModal(null);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setModalError(err.message || `Error during key ${keyActionModal.action}`);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            API Keys
          </h1>
          <p className="mt-1 text-sm text-[#727275]">
            Manage application API keys and bearer authentication tokens across your personal platform.
          </p>
        </div>
        <Link
          href="/dashboard/applications"
          className="inline-flex items-center gap-2 bg-[#ff5f15] hover:bg-[#e0500e] text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-md shrink-0"
        >
          <span>Select App to Generate Key</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Success Toast */}
      {toastMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-900/60 text-emerald-300 text-xs font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-white/60 hover:text-white text-xs font-semibold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center gap-3 text-red-300 text-sm">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-[#727275] gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#ff5f15]" />
            <p className="text-xs">Loading active and revoked API keys...</p>
          </div>
        ) : keys.length === 0 ? (
          <div className="py-16 text-center text-[#727275]">
            <Key className="h-10 w-10 mx-auto mb-3 opacity-30 text-[#ff5f15]" />
            <h3 className="text-sm font-semibold text-white">No API keys found</h3>
            <p className="text-xs text-[#727275] mt-1 max-w-sm mx-auto">
              You haven&apos;t generated any API keys yet. Select an application to create one.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1f1f1f]">
            {keys.map((k) => (
              <div
                key={k.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-sans font-semibold text-white text-sm">
                      {k.name}
                    </span>
                    <span className="text-[11px] font-mono text-[#727275]">
                      ({k.application_name})
                    </span>
                    {k.revoked_at ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950/40 text-red-400 border border-red-900/50">
                        Revoked
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-900/50">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#727275] mt-1.5">
                    <span>
                      Prefix: <span className="text-white font-mono">{k.key_prefix}</span>
                    </span>
                    <span>Created: {new Date(k.created_at).toLocaleDateString()}</span>
                    <span>
                      Last Used:{' '}
                      {k.last_used_at
                        ? new Date(k.last_used_at).toLocaleDateString()
                        : 'Never'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/dashboard/applications/${k.application_id}`}
                    className="text-[#727275] hover:text-white flex items-center gap-1 text-[11px] font-sans px-2.5 py-1.5 rounded-lg border border-[#222222] hover:bg-[#1a1a1a] transition-colors"
                  >
                    View App <ExternalLink className="h-3 w-3" />
                  </Link>

                  {!k.revoked_at ? (
                    <button
                      onClick={() => {
                        setModalError(null);
                        setKeyActionModal({
                          appId: k.application_id,
                          keyId: k.id,
                          keyName: k.name,
                          action: 'revoke'
                        });
                      }}
                      className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded-lg border border-amber-950/60 bg-amber-950/20 hover:bg-amber-950/40 transition-colors cursor-pointer"
                      title="Revoke API key"
                    >
                      <Ban className="h-3.5 w-3.5" /> Revoke
                    </button>
                  ) : null}

                  <button
                    onClick={() => {
                      setModalError(null);
                      setKeyActionModal({
                        appId: k.application_id,
                        keyId: k.id,
                        keyName: k.name,
                        action: 'delete'
                      });
                    }}
                    className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-950/60 bg-red-950/20 hover:bg-red-950/40 transition-colors cursor-pointer"
                    title="Permanently delete API key"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KEY ACTION MODAL (REVOKE OR DELETE) */}
      {keyActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#161616] border border-[#2a2a2a] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  keyActionModal.action === 'delete'
                    ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                    : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                }`}
              >
                {keyActionModal.action === 'delete' ? (
                  <Trash2 className="h-5 w-5" />
                ) : (
                  <Ban className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  {keyActionModal.action === 'delete' ? 'Delete API Key?' : 'Revoke API Key?'}
                </h3>
                <p className="text-xs text-[#727275]">
                  {keyActionModal.action === 'delete' ? 'Permanent deletion from database' : 'Immediate access revocation'}
                </p>
              </div>
            </div>

            <p className="text-sm text-[#aaaaaa] leading-relaxed">
              Are you sure you want to {keyActionModal.action === 'delete' ? 'permanently delete' : 'revoke'}{' '}
              <strong className="text-white">{keyActionModal.keyName}</strong>?
              {keyActionModal.action === 'revoke' && (
                <span className="block mt-2 text-xs text-[#727275]">
                  Applications and clients currently authenticating with this key will immediately be rejected.
                </span>
              )}
            </p>

            {modalError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {modalError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
              <button
                type="button"
                onClick={() => setKeyActionModal(null)}
                className="px-4 py-2.5 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] text-xs font-semibold text-[#888888] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeKeyAction}
                disabled={isProcessing}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-2 ${
                  keyActionModal.action === 'delete'
                    ? 'bg-red-600 hover:bg-red-700 shadow-[0_0_15px_rgba(220,38,38,0.2)]'
                    : 'bg-amber-600 hover:bg-amber-700 shadow-[0_0_15px_rgba(217,119,6,0.2)]'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Processing...
                  </>
                ) : keyActionModal.action === 'delete' ? (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Key
                  </>
                ) : (
                  <>
                    <Ban className="h-3.5 w-3.5" />
                    Revoke Key
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
