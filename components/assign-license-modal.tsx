'use client';

import { useState, useEffect } from 'react';
import { UserCheck, AlertCircle, X, Search, CheckCircle2, KeyRound, Shield } from 'lucide-react';
import type { LicenseDetailData } from '@/components/license-details-modal';
import type { EnrichedUser } from '@/lib/user-service';

interface AssignLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  license?: LicenseDetailData | null;
  user?: EnrichedUser | null;
  onLicenseAssigned?: (updatedLicense?: any) => void;
}

interface AppUser {
  id: string;
  email: string;
  username: string | null;
  status: string;
}

interface AppLicense {
  id: string;
  license_key: string;
  subscription: string;
  status: string;
  expires_at: string | null;
  allowed_devices: number | null;
  used_devices: number | null;
  note: string | null;
}

export default function AssignLicenseModal({
  isOpen,
  onClose,
  license,
  user,
  onLicenseAssigned
}: AssignLicenseModalProps) {
  // Mode: if user is provided, we assign a license to this user
  // If license is provided, we assign a user to this license
  const isUserMode = Boolean(user && !license);

  // States for License -> User mode
  const [users, setUsers] = useState<AppUser[]>([]);
  const [activeAssignedEmails, setActiveAssignedEmails] = useState<Set<string>>(new Set());
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // States for User -> License mode
  const [availableLicenses, setAvailableLicenses] = useState<AppLicense[]>([]);
  const [selectedLicenseId, setSelectedLicenseId] = useState<string>('');

  const [searchFilter, setSearchFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setSearchFilter('');
    setErrorMessage(null);
    setSelectedUserId('');
    setSelectedLicenseId('');

    if (isUserMode && user) {
      // User -> License mode: Load licenses for this application
      setIsLoading(true);
      fetch(`/api/licenses?application_id=${user.application_id}&limit=100`)
        .then((r) => r.json())
        .then((licData) => {
          const allLics = (licData.licenses || []) as AppLicense[];
          // Filter out revoked licenses
          const validLics = allLics.filter((l) => l.status !== 'revoked');
          setAvailableLicenses(validLics);
        })
        .catch((err) => {
          setErrorMessage('Failed to load application licenses: ' + err.message);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (license) {
      // License -> User mode: Load users and existing assigned licenses
      setIsLoading(true);
      Promise.all([
        fetch(`/api/applications/${license.application_id}/users`).then((r) => r.json()),
        fetch(`/api/licenses?application_id=${license.application_id}&limit=100`).then((r) => r.json())
      ])
        .then(([userData, licData]) => {
          const loadedUsers = (userData.users || []) as AppUser[];
          setUsers(loadedUsers);

          const assigned = new Set<string>();
          const allLics = (licData.licenses || []) as any[];
          const now = new Date();

          allLics.forEach((l) => {
            if (l.id === license.id) return;
            if (l.status === 'revoked') return;
            if (l.expires_at && new Date(l.expires_at) < now) return;
            if (l.note) {
              const noteClean = l.note.toLowerCase().trim();
              assigned.add(noteClean);
            }
          });

          setActiveAssignedEmails(assigned);
        })
        .catch((err) => {
          setErrorMessage('Failed to load application users: ' + err.message);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, isUserMode, user, license]);

  if (!isOpen) return null;
  if (!isUserMode && !license) return null;
  if (isUserMode && !user) return null;

  // Filter users for License -> User mode
  const filteredUsers = users.filter((u) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase().trim();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.username && u.username.toLowerCase().includes(q))
    );
  });

  // Filter licenses for User -> License mode
  const filteredLicenses = availableLicenses.filter((lic) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase().trim();
    return (
      lic.license_key.toLowerCase().includes(q) ||
      lic.subscription.toLowerCase().includes(q) ||
      (lic.note && lic.note.toLowerCase().includes(q))
    );
  });

  async function handleAssignUserToLicense(e: React.FormEvent) {
    e.preventDefault();
    if (!license) return;
    setErrorMessage(null);

    if (!selectedUserId) {
      setErrorMessage('Please select a user to assign this license to.');
      return;
    }

    const targetUser = users.find((u) => u.id === selectedUserId);
    if (!targetUser) {
      setErrorMessage('Selected user not found.');
      return;
    }

    if (activeAssignedEmails.has(targetUser.email.toLowerCase().trim())) {
      setErrorMessage(
        `User ${targetUser.email} already has an active license in this application. Only one active license per user is permitted.`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/licenses/${license.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign_user',
          userId: targetUser.id,
          userEmail: targetUser.email
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to assign license');
      }

      if (onLicenseAssigned) {
        onLicenseAssigned({
          ...license,
          note: targetUser.email,
          assigned_user: {
            id: targetUser.id,
            email: targetUser.email,
            username: targetUser.username
          }
        });
      }

      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to assign license');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssignLicenseToUser(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setErrorMessage(null);

    if (!selectedLicenseId) {
      setErrorMessage('Please select an existing license to assign.');
      return;
    }

    const targetLicense = availableLicenses.find((l) => l.id === selectedLicenseId);
    if (!targetLicense) {
      setErrorMessage('Selected license not found.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/licenses/${targetLicense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign_user',
          userId: user.id,
          userEmail: user.email
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to assign license');
      }

      if (onLicenseAssigned) {
        onLicenseAssigned(data.license);
      }

      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to assign license');
    } finally {
      setIsSubmitting(false);
    }
  }

  function formatExpiryDisplay(exp: string | null) {
    if (!exp) return 'Never (Lifetime)';
    try {
      const d = new Date(exp);
      if (isNaN(d.getTime())) return 'No Expiry';
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    } catch {
      return 'No Expiry';
    }
  }

  function maskKey(key: string) {
    if (!key) return '••••';
    const clean = key.trim();
    if (clean.length <= 4) return clean;
    const lastFour = clean.slice(-4);
    const leading = clean.slice(0, -4).replace(/[a-zA-Z0-9]/g, '•');
    return `${leading}${lastFour}`;
  }

  // -------------------------------------------------------------
  // RENDER: USER -> LICENSE MODE (From Users Page)
  // -------------------------------------------------------------
  if (isUserMode && user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
        <div className="relative w-full max-w-lg my-8 bg-[#161616] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#242424] bg-[#121212]/80">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-[#ff5f15]">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white tracking-tight">Assign License</h2>
                <p className="text-xs text-[#888888]">
                  Select an existing license for <span className="text-white font-medium">{user.username || user.email}</span>
                </p>
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
          <form onSubmit={handleAssignLicenseToUser} className="p-6 space-y-4 overflow-y-auto">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center gap-2.5 text-red-300 text-xs">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Target User Info Box */}
            <div className="p-3.5 rounded-xl bg-[#111111] border border-[#262626] flex items-center justify-between text-xs">
              <div>
                <span className="text-[#727275] block text-[10px] uppercase font-semibold">User Account</span>
                <span className="text-white font-medium">{user.email}</span>
                {user.username && (
                  <span className="text-[11px] text-[#727275] block">(@{user.username})</span>
                )}
              </div>
              <div className="text-right">
                <span className="text-[#727275] block text-[10px] uppercase font-semibold">Application</span>
                <span className="text-[#ff5f15] font-semibold">{user.application?.name || 'Application'}</span>
              </div>
            </div>

            {/* License Selection Box */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider">
                  Select Existing License *
                </label>
                <span className="text-[11px] text-[#666666]">
                  {availableLicenses.length} license{availableLicenses.length === 1 ? '' : 's'} in application
                </span>
              </div>

              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#555555]" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search licenses by key, tier..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
                />
              </div>

              {/* Licenses List */}
              <div className="max-h-56 overflow-y-auto rounded-xl border border-[#282828] bg-[#111111] divide-y divide-[#1e1e1e]">
                {isLoading ? (
                  <div className="p-6 text-center text-xs text-[#727275]">
                    Loading application licenses...
                  </div>
                ) : filteredLicenses.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#727275] space-y-1">
                    <p className="font-medium text-white/80">No licenses found.</p>
                    <p className="text-[11px]">
                      {searchFilter
                        ? 'Try adjusting your search criteria.'
                        : 'No available licenses exist in this application. Create a license in the Licenses manager first.'}
                    </p>
                  </div>
                ) : (
                  filteredLicenses.map((lic) => {
                    const isSelected = selectedLicenseId === lic.id;
                    const isUnassigned = !lic.note;

                    return (
                      <div
                        key={lic.id}
                        onClick={() => setSelectedLicenseId(lic.id)}
                        className={`p-3 flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#ff5f15]/10 border-l-2 border-[#ff5f15]'
                            : 'hover:bg-[#181818]'
                        }`}
                      >
                        <div className="min-w-0 pr-3 space-y-0.5">
                          <div className="text-xs font-mono font-semibold text-white flex items-center gap-2">
                            <span>{maskKey(lic.license_key)}</span>
                            <span className="text-[10px] font-sans font-semibold uppercase px-1.5 py-0.2 rounded bg-[#ff5f15]/10 text-[#ff5f15] border border-[#ff5f15]/20">
                              {lic.subscription}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#777777] flex items-center gap-2">
                            <span>Expiry: {formatExpiryDisplay(lic.expires_at)}</span>
                            <span>•</span>
                            <span>
                              {lic.allowed_devices && lic.allowed_devices >= 999
                                ? 'Unlimited devices'
                                : `${lic.allowed_devices || 1} device${(lic.allowed_devices || 1) > 1 ? 's' : ''}`}
                            </span>
                          </div>
                          {!isUnassigned && (
                            <div className="text-[10px] text-amber-400/80">
                              Currently assigned: <span className="font-mono">{lic.note}</span>
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 text-right">
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#ff5f15]">
                              <CheckCircle2 className="h-4 w-4" />
                              Selected
                            </span>
                          ) : isUnassigned ? (
                            <span className="text-[10px] font-medium text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/30 border border-emerald-800/30">
                              Available
                            </span>
                          ) : (
                            <span className="text-xs text-[#727275]">Select</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
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
                disabled={isSubmitting || !selectedLicenseId}
                className="px-5 py-2 rounded-xl bg-[#ff5f15] hover:bg-[#e0500e] disabled:opacity-50 text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
              >
                {isSubmitting ? 'Assigning...' : 'Assign License'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: LICENSE -> USER MODE (From Licenses Page)
  // -------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg my-8 bg-[#161616] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#242424] bg-[#121212]/80">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-[#ff5f15]">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Assign License</h2>
              <p className="text-xs text-[#888888] font-mono">{license?.license_key}</p>
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
        <form onSubmit={handleAssignUserToLicense} className="p-6 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center gap-2.5 text-red-300 text-xs">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* License Info Box */}
          <div className="p-3 rounded-xl bg-[#111111] border border-[#262626] flex items-center justify-between text-xs">
            <div>
              <span className="text-[#727275] block text-[10px] uppercase font-semibold">Application</span>
              <span className="text-white font-medium">{license?.application?.name || 'Application'}</span>
            </div>
            <div className="text-right">
              <span className="text-[#727275] block text-[10px] uppercase font-semibold">Tier</span>
              <span className="text-[#ff5f15] font-mono font-semibold uppercase">{license?.subscription}</span>
            </div>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
              Select User to Assign *
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#555555]" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search by email or username..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
              />
            </div>

            {/* Users list */}
            <div className="max-h-52 overflow-y-auto rounded-xl border border-[#282828] bg-[#111111] divide-y divide-[#1e1e1e]">
              {isLoading ? (
                <div className="p-6 text-center text-xs text-[#727275]">
                  Loading application users...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#727275]">
                  {searchFilter ? 'No users match search.' : 'No users found in this application.'}
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const alreadyHasLic = activeAssignedEmails.has(u.email.toLowerCase().trim());
                  const isSelected = selectedUserId === u.id;

                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        if (!alreadyHasLic) {
                          setSelectedUserId(u.id);
                        }
                      }}
                      className={`p-3 flex items-center justify-between transition-colors ${
                        alreadyHasLic
                          ? 'opacity-50 cursor-not-allowed bg-[#141414]'
                          : isSelected
                          ? 'bg-[#ff5f15]/10 border-l-2 border-[#ff5f15] cursor-pointer'
                          : 'hover:bg-[#181818] cursor-pointer'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                          <span>{u.email}</span>
                          {u.username && (
                            <span className="text-[11px] text-[#727275] font-normal">(@{u.username})</span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#555555]">
                          Status: <span className="uppercase">{u.status}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {alreadyHasLic ? (
                          <span className="text-[10px] font-semibold text-amber-400/80 px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/40">
                            Has Active License
                          </span>
                        ) : isSelected ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#ff5f15]">
                            <CheckCircle2 className="h-4 w-4" />
                            Selected
                          </span>
                        ) : (
                          <span className="text-xs text-[#727275]">Select</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
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
              disabled={isSubmitting || !selectedUserId}
              className="px-5 py-2 rounded-xl bg-[#ff5f15] hover:bg-[#e0500e] disabled:opacity-50 text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Assigning...' : 'Assign User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
