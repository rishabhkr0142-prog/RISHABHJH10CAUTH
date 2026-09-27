'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { copyToClipboardSafe } from '@/lib/clipboard';
import CreateUserModal from '@/components/create-user-modal';
import UserDetailsModal from '@/components/user-details-modal';
import ResetHwidModal from '@/components/reset-hwid-modal';
import { formatDateReliable, type EnrichedUser } from '@/lib/user-service';
import { AVAILABLE_SUBSCRIPTIONS } from '@/lib/subscriptions';
import {
  Users,
  Search,
  Plus,
  Filter,
  RefreshCw,
  KeyRound,
  Shield,
  Layers,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Laptop,
  Activity,
  Calendar,
  Sparkles,
  RotateCcw
} from 'lucide-react';

interface Application {
  id: string;
  name: string;
  client_id: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppId, setSelectedAppId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedLicenseStatus, setSelectedLicenseStatus] = useState('all');
  const [selectedSubscription, setSelectedSubscription] = useState('all');
  const [selectedExpiry, setSelectedExpiry] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeUser, setActiveUser] = useState<EnrichedUser | null>(null);
  const [activeResetHwidUser, setActiveResetHwidUser] = useState<EnrichedUser | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reset password form state
  const [resetPassword, setResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Status toggle state
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);

  // Copy feedback
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  async function fetchUsers(page: number = currentPage) {
    setIsLoading(true);
    setError(null);
    setTableMissing(false);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      if (selectedAppId !== 'all') params.set('application_id', selectedAppId);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      if (selectedLicenseStatus !== 'all') params.set('license_status', selectedLicenseStatus);
      if (selectedSubscription !== 'all') params.set('subscription', selectedSubscription);
      if (selectedExpiry !== 'all') params.set('expiry', selectedExpiry);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/users?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'TABLE_MISSING') {
          setTableMissing(true);
        }
        throw new Error(data.error || 'Unable to load application users. Please try again.');
      }
      setUsers(data.users || []);
      setTotalCount(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(data.page || 1);
      setApplications(data.applications || []);
    } catch (err: any) {
      setError(err.message || 'Error fetching users');
    } finally {
      setIsLoading(false);
    }
  }

  // Reload when filters change
  useEffect(() => {
    setCurrentPage(1);
    fetchUsers(1);
  }, [selectedAppId, selectedStatus, selectedLicenseStatus, selectedSubscription, selectedExpiry, pageSize]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers(1);
  }

  function handleResetFilters() {
    setSearchQuery('');
    setSelectedAppId('all');
    setSelectedStatus('all');
    setSelectedLicenseStatus('all');
    setSelectedSubscription('all');
    setSelectedExpiry('all');
  }

  const isFiltered = useMemo(() => {
    return (
      searchQuery.trim() !== '' ||
      selectedAppId !== 'all' ||
      selectedStatus !== 'all' ||
      selectedLicenseStatus !== 'all' ||
      selectedSubscription !== 'all' ||
      selectedExpiry !== 'all'
    );
  }, [searchQuery, selectedAppId, selectedStatus, selectedLicenseStatus, selectedSubscription, selectedExpiry]);

  async function handleToggleStatus(user: EnrichedUser) {
    setTogglingUserId(user.id);
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    try {
      const res = await fetch(`/api/applications/${user.application_id}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update user status');
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
      );

      if (activeUser && activeUser.id === user.id) {
        setActiveUser({ ...activeUser, status: newStatus });
      }
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    } finally {
      setTogglingUserId(null);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!activeUser) return;
    if (!resetPassword || resetPassword.length < 1 || resetPassword.length > 100) {
      setResetError('Password must be between 1 and 100 characters');
      return;
    }

    setIsResetting(true);
    setResetError(null);
    try {
      const res = await fetch(
        `/api/applications/${activeUser.application_id}/users/${activeUser.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: resetPassword })
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setResetSuccess(true);
      setTimeout(() => {
        setIsResetPasswordModalOpen(false);
        setResetSuccess(false);
        setResetPassword('');
        setActiveUser(null);
      }, 1500);
    } catch (err: any) {
      setResetError(err.message || 'Error resetting password');
    } finally {
      setIsResetting(false);
    }
  }

  async function handleDeleteUser() {
    if (!activeUser) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/applications/${activeUser.application_id}/users/${activeUser.id}`,
        {
          method: 'DELETE'
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete user');
      }

      setUsers((prev) => prev.filter((u) => u.id !== activeUser.id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      setIsDeleteModalOpen(false);
      setActiveUser(null);
      if (isViewModalOpen) setIsViewModalOpen(false);
    } catch (err: any) {
      setDeleteError(err.message || 'Error deleting user');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleCopy(text: string, id: string) {
    const ok = await copyToClipboardSafe(text);
    if (ok) {
      setCopiedKeyId(id);
      setTimeout(() => setCopiedKeyId(null), 2000);
    }
  }

  // Metrics summary
  const activeAccountsCount = users.filter((u) => u.status === 'active').length;
  const expiringSoonCount = users.filter((u) => u.license?.is_expiring_soon).length;
  const activeLicensesCount = users.filter((u) => u.license?.status === 'active' || u.license?.status === 'used').length;
  const totalDevicesUsed = users.reduce((acc, u) => acc + (u.license?.used_devices || 0), 0);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#1c1c1c] border border-emerald-800/60 text-white shadow-2xl animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#ff5f15]/20 to-black/40 border border-[#ff5f15]/30 flex items-center justify-center text-[#ff5f15]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Application Users
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#222222] text-[#aaaaaa] border border-[#2d2d2d]">
                  {totalCount} Total
                </span>
              </h1>
            </div>
          </div>
          <p className="text-sm text-[#727275] mt-1">
            End-user identity pool, subscription tiers, masked license keys, device usage, and real-time authentication logs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchUsers(currentPage)}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-[#1a1a1a] border border-[#262626] text-[#727275] hover:text-white hover:border-[#333333] transition-colors cursor-pointer"
            title="Refresh Users"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-[#ff5f15]' : ''}`} />
          </button>
          <button
            onClick={() => {
              setIsCreateModalOpen(true);
            }}
            disabled={applications.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff5f15] hover:bg-[#e04f0f] text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(255,95,21,0.25)] hover:shadow-[0_0_25px_rgba(255,95,21,0.35)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            Create User
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-[#161616] border border-[#222222]">
          <div className="flex items-center justify-between text-[#727275]">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Users</span>
            <Users className="h-4 w-4 text-[#ff5f15]" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{totalCount}</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#161616] border border-[#222222]">
          <div className="flex items-center justify-between text-[#727275]">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Accounts</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{activeAccountsCount}</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#161616] border border-[#222222]">
          <div className="flex items-center justify-between text-[#727275]">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Licenses</span>
            <KeyRound className="h-4 w-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{activeLicensesCount}</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#161616] border border-[#222222]">
          <div className="flex items-center justify-between text-[#727275]">
            <span className="text-xs font-semibold uppercase tracking-wider">Expiring Soon (≤7d)</span>
            <AlertTriangle className={`h-4 w-4 ${expiringSoonCount > 0 ? 'text-amber-400 animate-pulse' : 'text-[#727275]'}`} />
          </div>
          <p className={`text-2xl font-bold mt-2 ${expiringSoonCount > 0 ? 'text-amber-400' : 'text-white'}`}>
            {expiringSoonCount}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#161616] border border-[#222222] col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[#727275]">
            <span className="text-xs font-semibold uppercase tracking-wider">Devices In Use</span>
            <Laptop className="h-4 w-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{totalDevicesUsed}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-[#161616] border border-[#222222] space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search box */}
          <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555555]" />
            <input
              type="text"
              placeholder="Search email, username, or license key..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#111111] border border-[#262626] text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
            />
          </form>

          {/* Quick Clear Filters Button */}
          {isFiltered && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#222222] hover:bg-[#282828] text-xs font-semibold text-[#aaaaaa] hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filters
            </button>
          )}
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-2 border-t border-[#222222]">
          {/* 1. Application Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[#727275] uppercase tracking-wider block">
              Application
            </label>
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl bg-[#111111] border border-[#262626] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
            >
              <option value="all">All Applications</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Account Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[#727275] uppercase tracking-wider block">
              Account Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl bg-[#111111] border border-[#262626] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
            >
              <option value="all">All Account Statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {/* 3. License Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[#727275] uppercase tracking-wider block">
              License Status
            </label>
            <select
              value={selectedLicenseStatus}
              onChange={(e) => setSelectedLicenseStatus(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl bg-[#111111] border border-[#262626] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
            >
              <option value="all">All License Statuses</option>
              <option value="active">Active</option>
              <option value="used">Used</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
              <option value="no_license">No License</option>
            </select>
          </div>

          {/* 4. Subscription Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[#727275] uppercase tracking-wider block">
              Subscription
            </label>
            <select
              value={selectedSubscription}
              onChange={(e) => setSelectedSubscription(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl bg-[#111111] border border-[#262626] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
            >
              <option value="all">All Subscriptions</option>
              {AVAILABLE_SUBSCRIPTIONS.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Expiry Filter */}
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="text-[10px] font-semibold text-[#727275] uppercase tracking-wider block">
              Expiry Horizon
            </label>
            <select
              value={selectedExpiry}
              onChange={(e) => setSelectedExpiry(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl bg-[#111111] border border-[#262626] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
            >
              <option value="all">All Expiry</option>
              <option value="active">Active (Valid)</option>
              <option value="expiring_soon">Expiring Soon (≤ 7d)</option>
              <option value="expired">Expired (0 days)</option>
              <option value="no_expiry">No Expiry (Lifetime)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Missing Banner */}
      {tableMissing && (
        <div className="p-6 rounded-2xl bg-[#161616] border border-amber-500/20 text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h4 className="text-base font-bold text-white">Database Table Missing</h4>
            <p className="text-xs text-[#888888] leading-relaxed">
              The <code className="px-1.5 py-0.5 rounded bg-[#202020] text-amber-400 font-mono text-[11px]">public.application_users</code> table has not been created yet in your Supabase database.
            </p>
          </div>
          <button
            onClick={() => fetchUsers(currentPage)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#202020] text-xs font-semibold text-white hover:bg-[#282828] cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      )}

      {/* Error Banner */}
      {!tableMissing && error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchUsers(currentPage)}
            className="px-3 py-1 rounded-lg bg-[#202020] hover:bg-[#282828] text-xs text-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* USERS TABLE */}
      <div className="rounded-2xl bg-[#161616] border border-[#222222] overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <RefreshCw className="h-7 w-7 text-[#ff5f15] animate-spin mb-3" />
            <p className="text-sm text-[#727275]">Loading application users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4">
            <div className="h-12 w-12 rounded-2xl bg-[#1f1f1f] border border-[#2a2a2a] flex items-center justify-center text-[#ff5f15] mb-3">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-white">No users found</h3>
            <p className="text-sm text-[#727275] max-w-sm mt-1">
              {isFiltered
                ? 'No users match your active filter settings. Try resetting your filters.'
                : 'Get started by creating the first end user for your application.'}
            </p>
            {isFiltered ? (
              <button
                onClick={handleResetFilters}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Filters
              </button>
            ) : applications.length > 0 ? (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ff5f15] text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Create User
              </button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#111111] text-[#727275] text-[11px] uppercase font-semibold tracking-wider border-b border-[#222222]">
                <tr>
                  <th className="py-3.5 px-4 min-w-[200px]">User</th>
                  <th className="py-3.5 px-4 min-w-[160px]">Application</th>
                  <th className="py-3.5 px-4 min-w-[200px]">License / Subscription</th>
                  <th className="py-3.5 px-4 min-w-[150px]">Expiry</th>
                  <th className="py-3.5 px-4 min-w-[140px]">Devices</th>
                  <th className="py-3.5 px-4 min-w-[150px]">Activity</th>
                  <th className="py-3.5 px-4 min-w-[100px]">Status</th>
                  <th className="py-3.5 px-4 text-right min-w-[130px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222222]">
                {users.map((user) => {
                  const { license, activity } = user;
                  const hasLic = Boolean(license);
                  const allowedDev = license?.allowed_devices ?? null;
                  const usedDev = license?.used_devices ?? 0;
                  const isUnlim = license?.is_unlimited_devices ?? false;
                  const remainDev = isUnlim ? null : (license?.remaining_devices ?? null);
                  const devPercent =
                    isUnlim || !allowedDev || allowedDev === 0
                      ? 0
                      : Math.min(100, Math.round((usedDev / allowedDev) * 100));

                  return (
                    <tr key={user.id} className="hover:bg-[#1a1a1a]/60 transition-colors">
                      {/* USER COLUMN */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#222222] to-[#181818] border border-[#2d2d2d] flex items-center justify-center font-bold text-xs text-[#ff5f15] shrink-0">
                            {user.email[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-white flex items-center gap-1.5 truncate">
                              <span className="truncate">{user.email}</span>
                              <button
                                onClick={() => handleCopy(user.email, `email_${user.id}`)}
                                className="text-[#555555] hover:text-white transition-colors cursor-pointer shrink-0"
                                title="Copy Email"
                              >
                                {copiedKeyId === `email_${user.id}` ? (
                                  <Check className="h-3 w-3 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                            <div className="text-xs text-[#727275] truncate">
                              {user.username ? `@${user.username}` : <span className="text-[#555555]">No username</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* APPLICATION COLUMN */}
                      <td className="py-3.5 px-4">
                        {user.application ? (
                          <Link
                            href={`/dashboard/applications/${user.application_id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1a1a] border border-[#282828] text-xs font-mono text-[#dcdcdc] hover:border-[#ff5f15]/50 transition-colors max-w-[160px] truncate"
                            title={user.application.name}
                          >
                            <Layers className="h-3 w-3 text-[#ff5f15] shrink-0" />
                            <span className="truncate">{user.application.name}</span>
                          </Link>
                        ) : (
                          <span className="text-xs font-mono text-[#555555]">
                            {user.application_id.slice(0, 8)}...
                          </span>
                        )}
                      </td>

                      {/* LICENSE / SUBSCRIPTION COLUMN */}
                      <td className="py-3.5 px-4">
                        {hasLic && license ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs text-[#e0e0e0] font-medium">
                                {license.license_key_masked}
                              </span>
                              <button
                                onClick={() => handleCopy(license.license_key_masked, `lic_${user.id}`)}
                                className="text-[#555555] hover:text-white transition-colors cursor-pointer shrink-0"
                                title="Copy Key"
                              >
                                {copiedKeyId === `lic_${user.id}` ? (
                                  <Check className="h-3 w-3 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${license.subscription_badge_color}`}
                              >
                                {license.subscription_name}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  license.status === 'active'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : license.status === 'used'
                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                    : license.status === 'expired'
                                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                }`}
                              >
                                <span
                                  className={`h-1 w-1 rounded-full ${
                                    license.status === 'active'
                                      ? 'bg-emerald-400'
                                      : license.status === 'used'
                                      ? 'bg-blue-400'
                                      : license.status === 'expired'
                                      ? 'bg-red-400'
                                      : 'bg-zinc-400'
                                  }`}
                                />
                                {license.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-[#727275]">No License</span>
                            <span className="block text-[10px] text-[#555555]">Standard Access</span>
                          </div>
                        )}
                      </td>

                      {/* EXPIRY COLUMN */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {hasLic && license ? (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-[#cccccc] flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-[#ff5f15]" />
                              <span>{license.formatted_expiry}</span>
                            </div>
                            <div>
                              {license.is_expired ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                                  <AlertCircle className="h-3 w-3" />
                                  Expired (0d left)
                                </span>
                              ) : license.is_expiring_soon ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                                  <AlertTriangle className="h-3 w-3" />
                                  {license.days_remaining_text}
                                </span>
                              ) : license.expires_at ? (
                                <span className="text-[11px] text-[#888888] font-mono">
                                  {license.days_remaining_text}
                                </span>
                              ) : (
                                <span className="text-[11px] text-[#727275] font-medium">
                                  Never expires
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-xs text-[#727275]">No Expiry</span>
                            <span className="block text-[10px] text-[#555555]">Never expires</span>
                          </div>
                        )}
                      </td>

                      {/* DEVICES COLUMN */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {hasLic && license ? (
                          <div className="space-y-1.5 min-w-[120px]">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-white">
                                {isUnlim ? 'Unlimited' : `${usedDev} / ${allowedDev}`}
                              </span>
                              <span className="text-[11px] text-[#727275]">
                                {isUnlim
                                  ? 'No limit'
                                  : `${remainDev} left`}
                              </span>
                            </div>
                            {!isUnlim && (
                              <div className="w-full bg-[#111111] rounded-full h-1.5 overflow-hidden border border-[#242424]">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    devPercent >= 100
                                      ? 'bg-red-500'
                                      : devPercent >= 75
                                      ? 'bg-amber-500'
                                      : 'bg-[#ff5f15]'
                                  }`}
                                  style={{ width: `${Math.max(8, devPercent)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-[#555555]">Not tracked</span>
                        )}
                      </td>

                      {/* ACTIVITY COLUMN */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="text-xs text-[#dcdcdc] flex items-center gap-1">
                            <span className="text-[#666666]">Login:</span>
                            <span className="truncate max-w-[130px]" title={activity.formatted_last_login}>
                              {user.last_login_at ? formatDateReliable(user.last_login_at) : 'Never'}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#727275]">
                            Logins: {activity.login_count !== null ? activity.login_count : (user.last_login_at ? 1 : 0)}
                          </div>
                        </div>
                      </td>

                      {/* STATUS COLUMN */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            user.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : user.status === 'disabled'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              user.status === 'active'
                                ? 'bg-emerald-400'
                                : user.status === 'disabled'
                                ? 'bg-amber-400'
                                : 'bg-red-400'
                            }`}
                          />
                          {user.status.toUpperCase()}
                        </span>
                      </td>

                      {/* ACTIONS COLUMN */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setActiveUser(user);
                              setIsViewModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-[#202020] hover:bg-[#282828] text-[#888888] hover:text-white transition-colors cursor-pointer"
                            title="👁 View User Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(user)}
                            disabled={togglingUserId === user.id}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              user.status === 'active'
                                ? 'bg-[#202020] hover:bg-amber-500/20 text-[#888888] hover:text-amber-400'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                            }`}
                            title={user.status === 'active' ? '⊘ Disable Account' : '✓ Enable Account'}
                          >
                            {user.status === 'active' ? (
                              <XCircle className="h-3.5 w-3.5" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {hasLic && (
                            <button
                              onClick={() => setActiveResetHwidUser(user)}
                              className="p-1.5 rounded-lg bg-[#202020] hover:bg-orange-500/20 text-[#888888] hover:text-orange-400 border border-transparent hover:border-orange-500/30 transition-colors cursor-pointer"
                              title="Reset HWID / Device Binding"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setActiveUser(user);
                              setResetPassword('');
                              setResetError(null);
                              setResetSuccess(false);
                              setIsResetPasswordModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-[#202020] hover:bg-[#282828] text-[#888888] hover:text-[#ff5f15] transition-colors cursor-pointer"
                            title="🔒 Reset Password"
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setActiveUser(user);
                              setDeleteError(null);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-[#202020] hover:bg-red-500/20 text-[#888888] hover:text-red-400 transition-colors cursor-pointer"
                            title="🗑 Delete User"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!isLoading && users.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-[#111111] border-t border-[#222222] text-xs text-[#727275]">
            <div className="flex items-center gap-3">
              <span>
                Showing <strong className="text-white">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
                <strong className="text-white">
                  {Math.min(currentPage * pageSize, totalCount)}
                </strong>{' '}
                of <strong className="text-white">{totalCount}</strong> users
              </span>
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 rounded-lg bg-[#181818] border border-[#282828] text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchUsers(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1 || isLoading}
                className="p-1.5 rounded-lg bg-[#181818] border border-[#282828] text-[#888888] hover:text-white hover:border-[#383838] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="px-3 py-1 text-white font-mono">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => fetchUsers(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages || isLoading}
                className="p-1.5 rounded-lg bg-[#181818] border border-[#282828] text-[#888888] hover:text-white hover:border-[#383838] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE USER MODAL */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        selectedApplicationId={selectedAppId !== 'all' ? selectedAppId : (applications[0]?.id || '')}
        applications={applications.map((a) => ({ id: a.id, name: a.name, client_id: a.client_id }))}
        onUserCreated={() => {
          fetchUsers(1);
        }}
      />

      {/* STRUCTURED USER DETAILS MODAL */}
      <UserDetailsModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setActiveUser(null);
        }}
        user={activeUser}
        onToggleStatus={(u) => handleToggleStatus(u)}
        onOpenResetPassword={(u) => {
          setIsViewModalOpen(false);
          setResetPassword('');
          setResetError(null);
          setResetSuccess(false);
          setIsResetPasswordModalOpen(true);
        }}
        onOpenDelete={(u) => {
          setIsViewModalOpen(false);
          setDeleteError(null);
          setIsDeleteModalOpen(true);
        }}
        onResetHwidClick={(u) => {
          setActiveResetHwidUser(u);
        }}
      />

      {/* RESET PASSWORD MODAL */}
      {isResetPasswordModalOpen && activeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#161616] border border-[#2a2a2a] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#1f1f1f] border border-[#2d2d2d] flex items-center justify-center text-[#ff5f15]">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Reset Password</h3>
                  <p className="text-xs text-[#727275]">For: {activeUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setIsResetPasswordModalOpen(false)}
                className="text-[#727275] hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {resetSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0" />
                <span>Password updated and re-hashed successfully!</span>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {resetError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="Password"
                      required
                      minLength={1}
                      maxLength={100}
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#111111] border border-[#282828] text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#727275] hover:text-white"
                    >
                      {showResetPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
                  <button
                    type="button"
                    onClick={() => setIsResetPasswordModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] text-xs font-semibold text-[#888888] hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isResetting}
                    className="px-4 py-2.5 rounded-xl bg-[#ff5f15] hover:bg-[#e04f0f] text-xs font-semibold text-white transition-all shadow-[0_0_15px_rgba(255,95,21,0.2)] cursor-pointer disabled:opacity-50"
                  >
                    {isResetting ? 'Hashing & Saving...' : 'Save New Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* DELETE USER MODAL */}
      {isDeleteModalOpen && activeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#161616] border border-[#2a2a2a] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Delete User Account</h3>
                <p className="text-xs text-[#727275]">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-[#aaaaaa]">
              Are you sure you want to permanently delete{' '}
              <strong className="text-white">{activeUser.email}</strong> from{' '}
              <strong className="text-white">{activeUser.application?.name || 'this application'}</strong>?
            </p>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] text-xs font-semibold text-[#888888] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET HWID MODAL */}
      <ResetHwidModal
        isOpen={Boolean(activeResetHwidUser)}
        onClose={() => setActiveResetHwidUser(null)}
        onSuccess={() => {
          fetchUsers(currentPage);
          showToast('HWID binding was successfully reset for this user.');
          if (activeUser && activeResetHwidUser && activeUser.id === activeResetHwidUser.id) {
            setActiveUser((prev) =>
              prev
                ? {
                    ...prev,
                    license: prev.license
                      ? {
                          ...prev.license,
                          device_hwids: [],
                          used_devices: 0,
                          remaining_devices: prev.license.is_unlimited_devices
                            ? null
                            : prev.license.allowed_devices
                        }
                      : null
                  }
                : null
            );
          }
        }}
        target={
          activeResetHwidUser
            ? {
                type: 'user',
                id: activeResetHwidUser.id,
                applicationId: activeResetHwidUser.application_id,
                applicationName: activeResetHwidUser.application?.name || 'Application',
                userIdentifier: activeResetHwidUser.email || activeResetHwidUser.username || 'User',
                maskedLicenseKey: activeResetHwidUser.license?.license_key_masked || 'No License',
                isBound: Boolean(
                  (activeResetHwidUser.license?.device_hwids &&
                    activeResetHwidUser.license.device_hwids.length > 0) ||
                    (activeResetHwidUser.license?.used_devices &&
                      activeResetHwidUser.license.used_devices > 0)
                ),
                boundDeviceCount:
                  activeResetHwidUser.license?.used_devices ||
                  activeResetHwidUser.license?.device_hwids?.length ||
                  0,
                allowedDevices: activeResetHwidUser.license?.allowed_devices || 1,
                licenseId: activeResetHwidUser.license?.id || undefined
              }
            : null
        }
      />
    </div>
  );
}
