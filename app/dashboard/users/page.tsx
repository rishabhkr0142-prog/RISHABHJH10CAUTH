'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { copyToClipboardSafe } from '@/lib/clipboard';
import CreateUserModal from '@/components/create-user-modal';
import {
  Users,
  Search,
  Plus,
  Filter,
  RefreshCw,
  Key,
  Shield,
  Layers,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Clock,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface Application {
  id: string;
  name: string;
  client_id: string;
}

interface UserRecord {
  id: string;
  application_id: string;
  username: string | null;
  email: string;
  status: 'active' | 'disabled' | 'suspended';
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  application?: Application | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppId, setSelectedAppId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeUser, setActiveUser] = useState<UserRecord | null>(null);

  // Create form state
  const [createAppId, setCreateAppId] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createStatus, setCreateStatus] = useState<'active' | 'disabled'>('active');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  async function fetchUsers() {
    setIsLoading(true);
    setError(null);
    setTableMissing(false);
    try {
      const params = new URLSearchParams();
      if (selectedAppId !== 'all') params.set('application_id', selectedAppId);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
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
      setApplications(data.applications || []);
      if (data.applications?.length > 0 && !createAppId) {
        setCreateAppId(data.applications[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching users');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, [selectedAppId, selectedStatus]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchUsers();
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!createAppId) {
      setCreateError('Please select an application');
      return;
    }
    if (!createEmail || !createEmail.includes('@')) {
      setCreateError('Please enter a valid email address');
      return;
    }
    if (!createPassword || createPassword.length < 1 || createPassword.length > 100) {
      setCreateError('Password must be between 1 and 100 characters');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: createAppId,
          email: createEmail,
          username: createUsername || undefined,
          password: createPassword,
          status: createStatus
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setIsCreateModalOpen(false);
      setCreateEmail('');
      setCreateUsername('');
      setCreatePassword('');
      fetchUsers();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggleStatus(user: UserRecord) {
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
      setIsDeleteModalOpen(false);
      setActiveUser(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Error deleting user');
    } finally {
      setIsDeleting(false);
    }
  }

  const activeCount = users.filter((u) => u.status === 'active').length;
  const disabledCount = users.filter((u) => u.status === 'disabled').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Users className="h-6 w-6 text-[#ff5f15]" />
            Application Users
          </h1>
          <p className="text-sm text-[#727275] mt-1">
            End-user identity pool across your developer applications. Passwords are encrypted with bcrypt.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchUsers()}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-[#1a1a1a] border border-[#262626] text-[#727275] hover:text-white hover:border-[#333333] transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-[#ff5f15]' : ''}`} />
          </button>
          <button
            onClick={() => {
              setCreateError(null);
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#161616] border border-[#222222]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#727275] uppercase tracking-wider">
              Total End Users
            </span>
            <Users className="h-4 w-4 text-[#ff5f15]" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{users.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-[#161616] border border-[#222222]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#727275] uppercase tracking-wider">
              Active Accounts
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{activeCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-[#161616] border border-[#222222]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#727275] uppercase tracking-wider">
              Disabled Accounts
            </span>
            <XCircle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{disabledCount}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-[#161616] border border-[#222222] flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearch} className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555555]" />
          <input
            type="text"
            placeholder="Search email or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#111111] border border-[#262626] text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Application Selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Layers className="h-4 w-4 text-[#727275]" />
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#111111] border border-[#262626] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors w-full sm:w-auto cursor-pointer"
            >
              <option value="all">All Applications</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-[#727275]" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#111111] border border-[#262626] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors w-full sm:w-auto cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="suspended">Suspended</option>
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
            <p className="text-xs text-[#727275]">
              Open your <strong>Supabase Dashboard &gt; SQL Editor</strong> and execute the safe migration located at:
            </p>
            <div className="p-2.5 rounded-xl bg-[#0e0e0e] border border-[#222222] text-xs font-mono text-white flex items-center justify-between gap-2">
              <span className="truncate text-left text-[#aaaaaa]">supabase/migrations/20260925130000_create_application_users.sql</span>
              <button
                onClick={async () => {
                  await copyToClipboardSafe(`-- 1. Create or replace the updated_at trigger function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. Create application_users table if it does not already exist
CREATE TABLE IF NOT EXISTS public.application_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  username TEXT,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  CONSTRAINT app_users_email_unique UNIQUE (application_id, email)
);

-- 3. Indexes for fast application-scoped lookups
CREATE INDEX IF NOT EXISTS idx_app_users_application_id ON public.application_users(application_id);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON public.application_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_status ON public.application_users(status);
CREATE INDEX IF NOT EXISTS idx_app_users_created_at ON public.application_users(created_at DESC);

-- 4. Trigger for automatic updated_at updates
DROP TRIGGER IF EXISTS set_app_users_updated_at ON public.application_users;
CREATE TRIGGER set_app_users_updated_at
  BEFORE UPDATE ON public.application_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enable Row Level Security
ALTER TABLE public.application_users ENABLE ROW LEVEL SECURITY;

-- 6. Helper function to verify platform owner identity
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND upper(role) = 'OWNER'
  );
$$;

-- 7. Owner-scoped RLS policy for application_users
DROP POLICY IF EXISTS "Owner can manage application_users" ON public.application_users;
CREATE POLICY "Owner can manage application_users" ON public.application_users
  FOR ALL TO authenticated
  USING (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = application_users.application_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = application_users.application_id AND owner_id = auth.uid()
    )
  );

-- 8. Notify PostgREST to reload the schema cache immediately
NOTIFY pgrst, 'reload schema';`);
                }}
                className="px-2.5 py-1 rounded bg-[#1f1f1f] hover:bg-[#282828] text-xs text-[#ff5f15] hover:text-white transition-colors flex-shrink-0"
              >
                Copy SQL
              </button>
            </div>
          </div>
          <button
            onClick={() => fetchUsers()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#202020] text-xs font-semibold text-white hover:bg-[#282828] cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh after applying SQL
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
            onClick={() => fetchUsers()}
            className="px-3 py-1 rounded-lg bg-[#202020] hover:bg-[#282828] text-xs text-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-2xl bg-[#161616] border border-[#222222] overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <RefreshCw className="h-7 w-7 text-[#ff5f15] animate-spin mb-3" />
            <p className="text-sm text-[#727275]">Loading user accounts...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4">
            <div className="h-12 w-12 rounded-2xl bg-[#1f1f1f] border border-[#2a2a2a] flex items-center justify-center text-[#ff5f15] mb-3">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-white">No users found</h3>
            <p className="text-sm text-[#727275] max-w-sm mt-1">
              {searchQuery || selectedAppId !== 'all' || selectedStatus !== 'all'
                ? 'No user accounts match your current filter parameters.'
                : 'Get started by creating the first end user for your application.'}
            </p>
            {applications.length > 0 && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ff5f15] text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Create User
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#111111] text-[#727275] text-xs uppercase font-medium tracking-wider border-b border-[#222222]">
                <tr>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Application</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Created</th>
                  <th className="py-3.5 px-4">Last Login</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222222]">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[#1a1a1a]/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-[#222222] border border-[#2d2d2d] flex items-center justify-center font-bold text-xs text-[#ff5f15]">
                          {user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-white flex items-center gap-1.5">
                            {user.email}
                          </div>
                          {user.username && (
                            <span className="text-xs text-[#727275]">@{user.username}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {user.application ? (
                        <Link
                          href={`/dashboard/applications/${user.application_id}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1a1a] border border-[#282828] text-xs font-mono text-[#dcdcdc] hover:border-[#ff5f15]/50 transition-colors"
                        >
                          <Layers className="h-3 w-3 text-[#ff5f15]" />
                          {user.application.name}
                        </Link>
                      ) : (
                        <span className="text-xs font-mono text-[#555555]">
                          {user.application_id.slice(0, 8)}...
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
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
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#727275] whitespace-nowrap">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#727275] whitespace-nowrap">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleString()
                        : 'Never logged in'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setActiveUser(user);
                            setIsViewModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-[#202020] hover:bg-[#282828] text-[#888888] hover:text-white transition-colors cursor-pointer"
                          title="View Details"
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
                          title={user.status === 'active' ? 'Disable Account' : 'Enable Account'}
                        >
                          {user.status === 'active' ? (
                            <XCircle className="h-3.5 w-3.5" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setActiveUser(user);
                            setResetPassword('');
                            setResetError(null);
                            setResetSuccess(false);
                            setIsResetPasswordModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-[#202020] hover:bg-[#282828] text-[#888888] hover:text-[#ff5f15] transition-colors cursor-pointer"
                          title="Reset Password"
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
                          title="Delete User"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          fetchUsers();
        }}
      />

      {/* VIEW USER DETAILS MODAL */}
      {isViewModalOpen && activeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#161616] border border-[#2a2a2a] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#1f1f1f] border border-[#2d2d2d] flex items-center justify-center text-[#ff5f15]">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">User Information</h3>
                  <p className="text-xs text-[#727275]">Application end-user identity</p>
                </div>
              </div>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="text-[#727275] hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 bg-[#111111] p-4 rounded-xl border border-[#242424] text-xs">
              <div>
                <span className="text-[#666666] uppercase tracking-wider block font-semibold mb-0.5">
                  User ID
                </span>
                <span className="font-mono text-white select-all">{activeUser.id}</span>
              </div>
              <div>
                <span className="text-[#666666] uppercase tracking-wider block font-semibold mb-0.5">
                  Email
                </span>
                <span className="font-medium text-white">{activeUser.email}</span>
              </div>
              <div>
                <span className="text-[#666666] uppercase tracking-wider block font-semibold mb-0.5">
                  Username
                </span>
                <span className="text-white">{activeUser.username || '—'}</span>
              </div>
              <div>
                <span className="text-[#666666] uppercase tracking-wider block font-semibold mb-0.5">
                  Application
                </span>
                <span className="text-white font-medium">
                  {activeUser.application?.name || activeUser.application_id}
                </span>
              </div>
              <div>
                <span className="text-[#666666] uppercase tracking-wider block font-semibold mb-0.5">
                  Status
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                    activeUser.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {activeUser.status.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-[#666666] uppercase tracking-wider block font-semibold mb-0.5">
                  Account Created
                </span>
                <span className="text-[#aaaaaa]">
                  {new Date(activeUser.created_at).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[#666666] uppercase tracking-wider block font-semibold mb-0.5">
                  Last Login
                </span>
                <span className="text-[#aaaaaa]">
                  {activeUser.last_login_at
                    ? new Date(activeUser.last_login_at).toLocaleString()
                    : 'No recorded logins'}
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#202020] hover:bg-[#282828] text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
