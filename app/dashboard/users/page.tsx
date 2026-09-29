'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { copyToClipboardSafe } from '@/lib/clipboard';
import CreateUserModal from '@/components/create-user-modal';
import EditUserModal from '@/components/edit-user-modal';
import ExtendTimeModal from '@/components/extend-time-modal';
import SubtractTimeModal from '@/components/subtract-time-modal';
import ResetHwidModal, { type ResetHwidTarget } from '@/components/reset-hwid-modal';
import ImportExportModal from '@/components/import-export-modal';
import { formatTableDateTime, type EnrichedUser } from '@/lib/user-service';
import {
  Users,
  Search,
  Plus,
  Filter,
  ChevronDown,
  Layers,
  ArrowUpDown,
  MoreHorizontal,
  Edit3,
  SquareX,
  Ban,
  PauseCircle,
  PlayCircle,
  Clock,
  MinusCircle,
  RotateCcw,
  Copy,
  Trash2,
  SlidersHorizontal,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Laptop,
  Check
} from 'lucide-react';

interface Application {
  id: string;
  name: string;
  client_id: string;
}

/**
 * Smart floating positioning calculator:
 * Determines whether to open ABOVE or BELOW the 3-dot button based on available viewport space.
 * Clamps coordinates so the menu remains completely visible within the viewport without clipping.
 */
function calculateMenuPosition(
  anchorEl: HTMLElement,
  menuEl: HTMLElement | null
): { top: number; left: number; openAbove: boolean } {
  const rect = anchorEl.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Menu dimensions (w-48 is 192px, 9 items + divider + padding is ~344px)
  const menuWidth = menuEl?.offsetWidth || 192;
  const menuHeight = menuEl?.offsetHeight || 344;

  const gap = 6;
  const edgePadding = 12;

  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;
  const neededSpace = menuHeight + gap + edgePadding;

  // Decide vertical direction:
  // If not enough space below AND there is enough space above (or more space above than below), open ABOVE.
  let openAbove = false;
  if (spaceBelow < neededSpace && (spaceAbove >= neededSpace || spaceAbove > spaceBelow)) {
    openAbove = true;
  } else {
    openAbove = false;
  }

  let top: number;
  if (openAbove) {
    top = rect.top - menuHeight - gap;
  } else {
    top = rect.bottom + gap;
  }

  // Ensure within vertical viewport bounds
  if (top + menuHeight > viewportHeight - edgePadding) {
    top = viewportHeight - menuHeight - edgePadding;
  }
  if (top < edgePadding) {
    top = edgePadding;
  }

  // Horizontal position: align right edge of menu with right edge of button
  let left = rect.right - menuWidth;

  // Ensure within horizontal viewport bounds
  if (left + menuWidth > viewportWidth - edgePadding) {
    left = viewportWidth - menuWidth - edgePadding;
  }
  if (left < edgePadding) {
    left = edgePadding;
  }

  return {
    top: Math.round(top),
    left: Math.round(left),
    openAbove
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppId, setSelectedAppId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedLicenseStatus, setSelectedLicenseStatus] = useState('all');
  const [selectedExpiry, setSelectedExpiry] = useState('all');

  // Pagination & Rows
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // UI Dropdowns & Popovers
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isRowsDropdownOpen, setIsRowsDropdownOpen] = useState(false);
  const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  // Selection
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExtendTimeOpen, setIsExtendTimeOpen] = useState(false);
  const [isSubtractTimeOpen, setIsSubtractTimeOpen] = useState(false);
  const [isResetHwidOpen, setIsResetHwidOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  // Active target for modals
  const [activeUser, setActiveUser] = useState<EnrichedUser | null>(null);
  const [activeResetHwidTarget, setActiveResetHwidTarget] = useState<ResetHwidTarget | null>(null);

  // Loading states
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Optional visible columns customization
  const [visibleColumns, setVisibleColumns] = useState({
    user: true,
    subscription: true,
    created: true,
    expiry: true,
    status: true,
    actions: true
  });

  const filterRef = useRef<HTMLDivElement>(null);
  const rowsDropdownRef = useRef<HTMLDivElement>(null);
  const bulkActionsRef = useRef<HTMLDivElement>(null);

  // Floating Action Menu Portal State
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const [actionMenuUser, setActionMenuUser] = useState<EnrichedUser | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number; openAbove: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const closeActionMenu = useCallback(() => {
    setOpenActionMenuId(null);
    setActionMenuUser(null);
    setActionMenuAnchor(null);
    setMenuCoords(null);
  }, []);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  // Keyboard shortcut: Pressing 'f' or 'F' opens New User modal when not typing in an input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        (e.key === 'f' || e.key === 'F') &&
        !isCreateModalOpen &&
        !isEditModalOpen &&
        !isExtendTimeOpen &&
        !isSubtractTimeOpen
      ) {
        const activeEl = document.activeElement;
        const isInput =
          activeEl &&
          (activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.tagName === 'SELECT' ||
            (activeEl as HTMLElement).isContentEditable);
        if (!isInput) {
          e.preventDefault();
          setIsCreateModalOpen(true);
        }
      } else if (e.key === 'Escape') {
        setIsFilterOpen(false);
        setIsRowsDropdownOpen(false);
        setIsBulkActionsOpen(false);
        closeActionMenu();
        setIsCustomizeOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateModalOpen, isEditModalOpen, isExtendTimeOpen, isSubtractTimeOpen, closeActionMenu]);

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (filterRef.current && !filterRef.current.contains(target)) {
        setIsFilterOpen(false);
      }
      if (rowsDropdownRef.current && !rowsDropdownRef.current.contains(target)) {
        setIsRowsDropdownOpen(false);
      }
      if (bulkActionsRef.current && !bulkActionsRef.current.contains(target)) {
        setIsBulkActionsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reposition floating action menu or safely close on scroll and resize
  useEffect(() => {
    if (!actionMenuAnchor || !actionMenuUser) return;

    const handleUpdate = () => {
      if (!actionMenuAnchor) return;
      const rect = actionMenuAnchor.getBoundingClientRect();
      // If button scrolled completely off viewport, close safely
      if (
        rect.bottom < 0 ||
        rect.top > window.innerHeight ||
        rect.right < 0 ||
        rect.left > window.innerWidth
      ) {
        closeActionMenu();
        return;
      }
      setMenuCoords(calculateMenuPosition(actionMenuAnchor, menuRef.current));
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [actionMenuAnchor, actionMenuUser, closeActionMenu]);

  // Close floating action menu on outside click or Escape
  useEffect(() => {
    if (!actionMenuAnchor || !actionMenuUser) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current && menuRef.current.contains(target)) {
        return;
      }
      if (actionMenuAnchor && actionMenuAnchor.contains(target)) {
        return;
      }
      closeActionMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeActionMenu();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [actionMenuAnchor, actionMenuUser, closeActionMenu]);

  async function fetchUsers(page: number = currentPage) {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      if (selectedAppId !== 'all') params.set('application_id', selectedAppId);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      if (selectedLicenseStatus !== 'all') params.set('license_status', selectedLicenseStatus);
      if (selectedExpiry !== 'all') params.set('expiry', selectedExpiry);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/users?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to load users. Please try again.');
      }
      setUsers(data.users || []);
      setTotalCount(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(data.page || 1);
      if (data.applications) {
        setApplications(data.applications);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching users');
    } finally {
      setIsLoading(false);
    }
  }

  // Refetch when filters or pagination changes
  useEffect(() => {
    setCurrentPage(1);
    fetchUsers(1);
  }, [selectedAppId, selectedStatus, selectedLicenseStatus, selectedExpiry, pageSize]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchUsers(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Current selected application name for breadcrumbs & subtitle
  const currentAppName = useMemo(() => {
    if (selectedAppId !== 'all') {
      const found = applications.find((a) => a.id === selectedAppId);
      if (found) return found.name;
    }
    return applications[0]?.name || 'CyberShield App';
  }, [applications, selectedAppId]);

  // Row selection helpers
  const isAllPageSelected = users.length > 0 && users.every((u) => selectedUserIds.includes(u.id));

  function toggleSelectAll() {
    if (isAllPageSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !users.some((u) => u.id === id)));
    } else {
      const pageIds = users.map((u) => u.id);
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  }

  function toggleSelectUser(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  // Copy Info
  async function handleCopyInfo(user: EnrichedUser) {
    closeActionMenu();
    const createdDt = formatTableDateTime(user.created_at);
    const expiryDt = user.license?.expires_at ? formatTableDateTime(user.license.expires_at) : null;

    const statusLabel =
      user.status === 'suspended'
        ? 'Banned'
        : user.status === 'disabled'
        ? 'Paused'
        : 'Active';

    const infoLines = [
      `Username: ${user.username || 'N/A'}`,
      `Email: ${user.email}`,
      `Application: ${user.application?.name || currentAppName}`,
      `Status: ${statusLabel}`,
      `Subscription: ${user.license?.subscription || 'No License'}`,
      `Expiry: ${expiryDt ? `${expiryDt.date} ${expiryDt.time}` : 'No Expiry'}`,
      `Created: ${createdDt ? `${createdDt.date} ${createdDt.time}` : 'N/A'}`
    ];

    await copyToClipboardSafe(infoLines.join('\n'));
    showToast('Copied user info to clipboard');
  }

  // Ban User
  async function handleConfirmBan() {
    if (!activeUser) return;
    setIsSubmittingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/users/${activeUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suspended' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to ban user');

      showToast(`User ${activeUser.username || activeUser.email} has been banned.`);
      setIsBanModalOpen(false);
      setActiveUser(null);
      fetchUsers(currentPage);
    } catch (err: any) {
      setActionError(err.message || 'Error banning user');
    } finally {
      setIsSubmittingAction(false);
    }
  }

  // Pause / Resume User
  async function handleConfirmPause() {
    if (!activeUser) return;
    setIsSubmittingAction(true);
    setActionError(null);
    const targetStatus = activeUser.status === 'active' ? 'disabled' : 'active';

    try {
      const res = await fetch(`/api/users/${activeUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user status');

      showToast(
        targetStatus === 'disabled'
          ? `User ${activeUser.username || activeUser.email} paused.`
          : `User ${activeUser.username || activeUser.email} resumed.`
      );
      setIsPauseModalOpen(false);
      setActiveUser(null);
      fetchUsers(currentPage);
    } catch (err: any) {
      setActionError(err.message || 'Error updating user status');
    } finally {
      setIsSubmittingAction(false);
    }
  }

  // Delete User (Single)
  async function handleConfirmDelete() {
    if (!activeUser) return;
    setIsSubmittingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/users/${activeUser.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');

      showToast(`User ${activeUser.username || activeUser.email} deleted successfully.`);
      setIsDeleteModalOpen(false);
      setActiveUser(null);
      setSelectedUserIds((prev) => prev.filter((id) => id !== activeUser.id));
      fetchUsers(currentPage);
    } catch (err: any) {
      setActionError(err.message || 'Error deleting user');
    } finally {
      setIsSubmittingAction(false);
    }
  }

  // Bulk Delete
  async function handleConfirmBulkDelete() {
    if (selectedUserIds.length === 0) return;
    setIsSubmittingAction(true);
    setActionError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedUserIds })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete selected users');

      const count = data.deletedCount || selectedUserIds.length;
      showToast(`Successfully deleted ${count} selected user${count > 1 ? 's' : ''}.`);
      setIsBulkDeleteOpen(false);
      setSelectedUserIds([]);
      fetchUsers(currentPage);
    } catch (err: any) {
      setActionError(err.message || 'Error deleting users');
    } finally {
      setIsSubmittingAction(false);
    }
  }

  function openResetHwidModal(user: EnrichedUser) {
    closeActionMenu();
    setActiveResetHwidTarget({
      type: 'user',
      id: user.id,
      applicationId: user.application_id,
      applicationName: user.application?.name || currentAppName,
      userIdentifier: user.username || user.email,
      maskedLicenseKey: user.license?.license_key_masked || 'Unassigned',
      isBound: Boolean(user.license?.device_hwids && user.license.device_hwids.length > 0),
      boundDeviceCount: user.license?.used_devices ?? (user.license?.device_hwids?.length || 0),
      allowedDevices: user.license?.allowed_devices ?? 1,
      licenseId: user.license?.id || undefined
    });
    setIsResetHwidOpen(true);
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-[#181818] border border-[#2a2a2a] rounded-xl shadow-2xl text-xs font-medium text-white animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb Nav matching reference screenshot */}
      <div className="flex items-center gap-2 text-xs text-[#777777]">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#161616] border border-[#262626] text-white/90">
          <div className="h-2 w-2 rounded-xs bg-[#ff5f15]" />
          <span className="font-semibold">{currentAppName}</span>
        </div>
        <span>/</span>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#161616] border border-[#262626] text-[#aaaaaa]">
          <span>Tester</span>
          <span className="text-[10px] px-1 py-0.2 bg-[#252525] rounded text-emerald-400 font-semibold uppercase">
            Free
          </span>
        </div>
        <span>/</span>
        <span className="text-white font-medium">Users Manager</span>
      </div>

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Users</h1>
          <p className="text-xs sm:text-sm text-[#777777] mt-1">
            Manage users for{' '}
            <span className="text-[#ff5f15] font-medium hover:underline cursor-pointer">
              {currentAppName}
            </span>
          </p>
        </div>

        {/* User Count Badge on the right */}
        <div className="flex items-center self-start sm:self-auto">
          <div className="px-3.5 py-1.5 rounded-lg bg-[#141414] border border-[#262626] text-xs font-medium text-white/90 shadow-sm flex items-center gap-2">
            <span className="font-bold text-white">{totalCount}</span>
            <span className="text-[#888888]">Users</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#121212] border border-[#222222] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
          />
        </div>

        {/* Rows per page dropdown */}
        <div className="relative" ref={rowsDropdownRef}>
          <button
            type="button"
            onClick={() => setIsRowsDropdownOpen(!isRowsDropdownOpen)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#121212] hover:bg-[#181818] border border-[#222222] text-xs font-medium text-white transition-colors cursor-pointer"
          >
            <span>{pageSize} rows</span>
            <ChevronDown className="h-3.5 w-3.5 text-[#777777]" />
          </button>

          {isRowsDropdownOpen && (
            <div className="absolute right-0 mt-2 w-32 bg-[#161616] border border-[#2a2a2a] rounded-xl shadow-2xl py-1.5 z-30">
              {[10, 25, 50, 100].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setPageSize(size);
                    setIsRowsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-1.5 text-xs transition-colors cursor-pointer flex items-center justify-between ${
                    pageSize === size ? 'bg-[#ff5f15]/10 text-[#ff5f15] font-semibold' : 'text-[#cccccc] hover:bg-[#202020]'
                  }`}
                >
                  <span>{size} rows</span>
                  {pageSize === size && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter button */}
        <div className="relative" ref={filterRef}>
          <button
            type="button"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
              selectedAppId !== 'all' || selectedStatus !== 'all' || selectedLicenseStatus !== 'all' || selectedExpiry !== 'all'
                ? 'bg-[#ff5f15]/10 border-[#ff5f15]/40 text-[#ff5f15]'
                : 'bg-[#121212] hover:bg-[#181818] border-[#222222] text-white'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Filter</span>
            <ChevronDown className="h-3.5 w-3.5 text-[#777777]" />
          </button>

          {isFilterOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-[#161616] border border-[#2a2a2a] rounded-xl shadow-2xl p-4 z-30 space-y-3.5 animate-in fade-in-0 zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-[#242424]">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Filters</span>
                {(selectedAppId !== 'all' || selectedStatus !== 'all' || selectedLicenseStatus !== 'all' || selectedExpiry !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAppId('all');
                      setSelectedStatus('all');
                      setSelectedLicenseStatus('all');
                      setSelectedExpiry('all');
                    }}
                    className="text-[11px] text-[#ff5f15] hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-[11px] font-semibold text-[#888888] mb-1">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#0e0e0e] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15] cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                  <option value="banned">Banned</option>
                  <option value="paused">Paused</option>
                </select>
              </div>

              {/* License Status */}
              <div>
                <label className="block text-[11px] font-semibold text-[#888888] mb-1">License</label>
                <select
                  value={selectedLicenseStatus}
                  onChange={(e) => setSelectedLicenseStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#0e0e0e] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15] cursor-pointer"
                >
                  <option value="all">All Users</option>
                  <option value="has_license">Has License</option>
                  <option value="no_license">No License</option>
                </select>
              </div>

              {/* Application Filter */}
              <div>
                <label className="block text-[11px] font-semibold text-[#888888] mb-1">Application</label>
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#0e0e0e] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15] cursor-pointer"
                >
                  <option value="all">All Applications</option>
                  {applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Expiry Filter */}
              <div>
                <label className="block text-[11px] font-semibold text-[#888888] mb-1">Expiry</label>
                <select
                  value={selectedExpiry}
                  onChange={(e) => setSelectedExpiry(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#0e0e0e] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15] cursor-pointer"
                >
                  <option value="all">All Expiries</option>
                  <option value="active">Active (Not Expired)</option>
                  <option value="expiring_soon">Expiring Soon (≤ 7 days)</option>
                  <option value="expired">Expired</option>
                  <option value="no_expiry">No Expiry</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Import / Export button */}
        <button
          type="button"
          onClick={() => setIsImportExportOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#121212] hover:bg-[#181818] border border-[#222222] text-xs font-medium text-white transition-colors cursor-pointer"
        >
          <ArrowUpDown className="h-3.5 w-3.5 text-[#aaaaaa]" />
          <span>Import / Export</span>
        </button>

        {/* Bulk Actions button */}
        <div className="relative" ref={bulkActionsRef}>
          <button
            type="button"
            onClick={() => setIsBulkActionsOpen(!isBulkActionsOpen)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
              selectedUserIds.length > 0
                ? 'bg-[#181818] border-[#333333] text-white'
                : 'bg-[#121212] hover:bg-[#181818] border-[#222222] text-[#888888]'
            }`}
          >
            <Layers className="h-3.5 w-3.5 text-[#aaaaaa]" />
            <span>Bulk Actions</span>
            {selectedUserIds.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#ff5f15] text-[10px] text-white font-bold">
                {selectedUserIds.length}
              </span>
            )}
          </button>

          {isBulkActionsOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-[#161616] border border-[#2a2a2a] rounded-xl shadow-2xl py-1.5 z-30">
              <button
                type="button"
                onClick={() => {
                  toggleSelectAll();
                  setIsBulkActionsOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 text-xs text-[#cccccc] hover:bg-[#202020] transition-colors cursor-pointer flex items-center gap-2"
              >
                <span>{isAllPageSelected ? 'Deselect All Visible' : 'Select All Visible'}</span>
              </button>

              {selectedUserIds.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserIds([]);
                      setIsBulkActionsOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-[#cccccc] hover:bg-[#202020] transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <span>Deselect All ({selectedUserIds.length})</span>
                  </button>
                  <div className="my-1 border-t border-[#242424]" />
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkDeleteOpen(true);
                      setIsBulkActionsOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Selected ({selectedUserIds.length})</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* New User Button with [F] badge */}
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff5f15] hover:bg-[#e0500e] text-xs font-semibold text-white shadow-md transition-all cursor-pointer ml-auto"
        >
          <Plus className="h-4 w-4" />
          <span>New User</span>
          <span className="px-1.5 py-0.5 text-[10px] font-mono bg-black/30 rounded border border-white/20 text-white/90">
            F
          </span>
        </button>
      </div>

      {/* Main Users Table */}
      <div className="rounded-2xl border border-[#202020] bg-[#101010] shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#202020] bg-[#141414]/90 text-[11px] font-semibold text-[#777777] uppercase tracking-wider">
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={isAllPageSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-[#333333] bg-[#1c1c1c] text-[#ff5f15] focus:ring-0 cursor-pointer"
                  />
                </th>
                {visibleColumns.user && <th className="py-3.5 px-4">USER</th>}
                {visibleColumns.subscription && <th className="py-3.5 px-4">SUBSCRIPTION</th>}
                {visibleColumns.created && <th className="py-3.5 px-4">CREATED</th>}
                {visibleColumns.expiry && <th className="py-3.5 px-4">EXPIRY</th>}
                {visibleColumns.status && <th className="py-3.5 px-4">STATUS</th>}
                {visibleColumns.actions && <th className="py-3.5 px-4 text-right">ACTIONS</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a] text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-[#666666]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 border-2 border-[#ff5f15] border-t-transparent rounded-full animate-spin" />
                      <span>Loading users...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-[#666666]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="h-8 w-8 text-[#444444]" />
                      <span className="font-medium text-sm text-[#888888]">No users found</span>
                      <p className="text-xs text-[#555555]">
                        {searchQuery
                          ? 'Try adjusting your search criteria.'
                          : 'Create your first application user using the button above.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user, idx) => {
                  const isSelected = selectedUserIds.includes(user.id);

                  const createdDt = formatTableDateTime(user.created_at);
                  const expiryDt = user.license?.expires_at
                    ? formatTableDateTime(user.license.expires_at)
                    : null;

                  // Status mapping
                  let statusBadge = (
                    <span className="text-emerald-400 font-medium">Active</span>
                  );
                  if (user.status === 'suspended') {
                    statusBadge = <span className="text-rose-400 font-medium">Banned</span>;
                  } else if (user.status === 'disabled') {
                    statusBadge = <span className="text-amber-400 font-medium">Paused</span>;
                  }

                  const avatarInitials = (user.username || user.email || 'U').charAt(0).toUpperCase();

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-[#161616]/70 transition-colors ${
                        isSelected ? 'bg-[#ff5f15]/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-4 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectUser(user.id)}
                          className="rounded border-[#333333] bg-[#1c1c1c] text-[#ff5f15] focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* USER */}
                      {visibleColumns.user && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-xs font-bold text-white shadow-xs">
                              {avatarInitials}
                            </div>
                            <div>
                              <div className="font-semibold text-white text-sm">
                                {user.username || user.email.split('@')[0]}
                              </div>
                              <div className="text-[11px] text-[#666666]">{user.email}</div>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* SUBSCRIPTION */}
                      {visibleColumns.subscription && (
                        <td className="py-4 px-4 font-medium text-white/90">
                          {user.license ? (
                            <span>{user.license.subscription}</span>
                          ) : (
                            <span className="text-[#666666]">No License</span>
                          )}
                        </td>
                      )}

                      {/* CREATED */}
                      {visibleColumns.created && (
                        <td className="py-4 px-4">
                          {createdDt ? (
                            <div>
                              <div className="font-medium text-white/90">{createdDt.date}</div>
                              <div className="text-[11px] text-[#777777]">{createdDt.time}</div>
                            </div>
                          ) : (
                            <span className="text-[#666666]">N/A</span>
                          )}
                        </td>
                      )}

                      {/* EXPIRY */}
                      {visibleColumns.expiry && (
                        <td className="py-4 px-4">
                          {user.license ? (
                            expiryDt ? (
                              <div>
                                <div className="font-medium text-white/90">{expiryDt.date}</div>
                                <div className="text-[11px] text-[#777777]">{expiryDt.time}</div>
                              </div>
                            ) : (
                              <span className="font-medium text-white/90">Never expires</span>
                            )
                          ) : (
                            <span className="text-[#666666]">No Expiry</span>
                          )}
                        </td>
                      )}

                      {/* STATUS */}
                      {visibleColumns.status && <td className="py-4 px-4">{statusBadge}</td>}

                      {/* ACTIONS */}
                      {visibleColumns.actions && (
                        <td className="py-4 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openActionMenuId === user.id) {
                                closeActionMenu();
                              } else {
                                const button = e.currentTarget;
                                const initialPos = calculateMenuPosition(button, null);
                                setOpenActionMenuId(user.id);
                                setActionMenuUser(user);
                                setActionMenuAnchor(button);
                                setMenuCoords(initialPos);
                              }
                            }}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              openActionMenuId === user.id
                                ? 'text-white bg-[#202020]'
                                : 'text-[#777777] hover:text-white hover:bg-[#202020]'
                            }`}
                            title="Actions"
                            aria-expanded={openActionMenuId === user.id}
                            aria-haspopup="true"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Bar: Customize Button (bottom right matching reference screenshot) & Pagination */}
        <div className="p-4 border-t border-[#202020] bg-[#121212]/90 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#777777]">
          {/* Pagination summary */}
          <div>
            Showing <span className="text-white font-medium">{users.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{' '}
            <span className="text-white font-medium">{Math.min(currentPage * pageSize, totalCount)}</span> of{' '}
            <span className="text-white font-medium">{totalCount}</span> users
          </div>

          <div className="flex items-center gap-3">
            {/* Customize button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCustomizeOpen(!isCustomizeOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181818] hover:bg-[#202020] border border-[#2a2a2a] text-xs font-medium text-[#cccccc] hover:text-white transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Customize</span>
              </button>

              {isCustomizeOpen && (
                <div className="absolute right-0 bottom-10 w-44 bg-[#161616] border border-[#2a2a2a] rounded-xl shadow-2xl p-3 z-30 space-y-2">
                  <div className="text-[11px] font-bold text-white uppercase tracking-wider mb-2">
                    Visible Columns
                  </div>
                  {Object.keys(visibleColumns).map((col) => (
                    <label key={col} className="flex items-center gap-2 text-xs text-[#cccccc] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleColumns[col as keyof typeof visibleColumns]}
                        onChange={(e) =>
                          setVisibleColumns((prev) => ({
                            ...prev,
                            [col]: e.target.checked
                          }))
                        }
                        className="rounded border-[#333333] bg-[#1c1c1c] text-[#ff5f15] focus:ring-0"
                      />
                      <span className="capitalize">{col}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (currentPage > 1) {
                    setCurrentPage((p) => p - 1);
                    fetchUsers(currentPage - 1);
                  }
                }}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg bg-[#181818] hover:bg-[#222222] disabled:opacity-40 border border-[#2a2a2a] text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="px-2 font-medium text-white">
                {currentPage} / {totalPages || 1}
              </span>

              <button
                type="button"
                onClick={() => {
                  if (currentPage < totalPages) {
                    setCurrentPage((p) => p + 1);
                    fetchUsers(currentPage + 1);
                  }
                }}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg bg-[#181818] hover:bg-[#222222] disabled:opacity-40 border border-[#2a2a2a] text-white transition-colors cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. New User Modal (Preserved all original fields intact) */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        selectedApplicationId={selectedAppId !== 'all' ? selectedAppId : applications[0]?.id}
        applications={applications}
        onUserCreated={() => {
          showToast('User created successfully');
          fetchUsers(currentPage);
        }}
      />

      {/* 2. Edit User Modal */}
      <EditUserModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setActiveUser(null);
        }}
        user={activeUser}
        applications={applications}
        onUserUpdated={() => {
          showToast('User updated successfully');
          fetchUsers(currentPage);
        }}
      />

      {/* 3. Extend Time Modal */}
      <ExtendTimeModal
        isOpen={isExtendTimeOpen}
        onClose={() => {
          setIsExtendTimeOpen(false);
          setActiveUser(null);
        }}
        user={activeUser}
        onSuccess={() => {
          showToast('License expiry extended successfully');
          fetchUsers(currentPage);
        }}
      />

      {/* 4. Subtract Time Modal */}
      <SubtractTimeModal
        isOpen={isSubtractTimeOpen}
        onClose={() => {
          setIsSubtractTimeOpen(false);
          setActiveUser(null);
        }}
        user={activeUser}
        onSuccess={() => {
          showToast('License expiry updated successfully');
          fetchUsers(currentPage);
        }}
      />

      {/* 5. Reset HWID Modal */}
      <ResetHwidModal
        isOpen={isResetHwidOpen}
        onClose={() => {
          setIsResetHwidOpen(false);
          setActiveResetHwidTarget(null);
        }}
        target={activeResetHwidTarget}
        onSuccess={() => {
          showToast('HWID binding reset successfully');
          fetchUsers(currentPage);
        }}
      />

      {/* 6. Import / Export Modal */}
      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        users={users}
        currentApplicationId={selectedAppId !== 'all' ? selectedAppId : applications[0]?.id}
        onImportSuccess={() => {
          showToast('Users imported successfully');
          fetchUsers(currentPage);
        }}
      />

      {/* 7. Ban User Confirmation Modal */}
      {isBanModalOpen && activeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="h-10 w-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Ban className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {activeUser.status === 'suspended' ? 'Unban User?' : 'Ban User?'}
                </h3>
                <p className="text-xs text-[#888888]">Account status modification</p>
              </div>
            </div>

            <p className="text-xs text-[#999999] leading-relaxed">
              {activeUser.status === 'suspended'
                ? `Reactivate account access for ${activeUser.username || activeUser.email}?`
                : `Are you sure you want to ban user ${activeUser.username || activeUser.email}? This will prevent the user from logging in. Unrelated licenses will remain safe.`}
            </p>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-xs text-red-300">
                {actionError}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsBanModalOpen(false);
                  setActiveUser(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBan}
                disabled={isSubmittingAction}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
              >
                {isSubmittingAction ? 'Processing...' : activeUser.status === 'suspended' ? 'Unban User' : 'Ban User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Pause User Confirmation Modal */}
      {isPauseModalOpen && activeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="h-10 w-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <PauseCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {activeUser.status === 'disabled' ? 'Resume User Account?' : 'Pause User Account?'}
                </h3>
                <p className="text-xs text-[#888888]">Temporary access pause</p>
              </div>
            </div>

            <p className="text-xs text-[#999999] leading-relaxed">
              {activeUser.status === 'disabled'
                ? `Resume activity for user ${activeUser.username || activeUser.email}?`
                : `Are you sure you want to pause user ${activeUser.username || activeUser.email}? The user's status will be set to Paused.`}
            </p>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-xs text-red-300">
                {actionError}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsPauseModalOpen(false);
                  setActiveUser(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPause}
                disabled={isSubmittingAction}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
              >
                {isSubmittingAction ? 'Processing...' : activeUser.status === 'disabled' ? 'Resume User' : 'Pause User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Delete User Confirmation Modal */}
      {isDeleteModalOpen && activeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="h-10 w-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete User?</h3>
                <p className="text-xs text-[#888888]">Irreversible action</p>
              </div>
            </div>

            <p className="text-xs text-[#999999] leading-relaxed">
              Are you sure you want to delete user <span className="text-white font-medium">{activeUser.username || activeUser.email}</span>?
              This action cannot be undone. Unrelated licenses will remain safe in the database.
            </p>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-xs text-red-300">
                {actionError}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setActiveUser(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmittingAction}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
              >
                {isSubmittingAction ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Bulk Delete Confirmation Modal */}
      {isBulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="h-10 w-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete {selectedUserIds.length} Users?</h3>
                <p className="text-xs text-[#888888]">Bulk deletion confirmation</p>
              </div>
            </div>

            <p className="text-xs text-[#999999] leading-relaxed">
              Are you sure you want to permanently delete the <span className="text-white font-medium">{selectedUserIds.length}</span> selected users?
              This action cannot be undone. Associated licenses will remain safe in the database.
            </p>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-xs text-red-300">
                {actionError}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBulkDeleteOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                disabled={isSubmittingAction}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
              >
                {isSubmittingAction ? 'Deleting...' : `Delete ${selectedUserIds.length} Users`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Menu (Rendered outside table via Portal to avoid clipping) */}
      {isMounted && actionMenuUser && menuCoords && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={(node) => {
              menuRef.current = node;
              if (node && actionMenuAnchor) {
                const refined = calculateMenuPosition(actionMenuAnchor, node);
                setMenuCoords((prev) => {
                  if (
                    !prev ||
                    prev.top !== refined.top ||
                    prev.left !== refined.left ||
                    prev.openAbove !== refined.openAbove
                  ) {
                    return refined;
                  }
                  return prev;
                });
              }
            }}
            style={{
              position: 'fixed',
              top: `${menuCoords.top}px`,
              left: `${menuCoords.left}px`,
            }}
            className={`w-48 bg-[#141414] border border-[#282828] rounded-xl shadow-2xl py-1.5 z-[60] text-left animate-in fade-in-0 zoom-in-95 ${
              menuCoords.openAbove ? 'origin-bottom-right' : 'origin-top-right'
            }`}
          >
            {/* Edit User */}
            <button
              type="button"
              onClick={() => {
                const target = actionMenuUser;
                closeActionMenu();
                setActiveUser(target);
                setIsEditModalOpen(true);
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-[#dddddd] hover:text-white hover:bg-[#202020] transition-colors cursor-pointer flex items-center gap-2.5"
            >
              <Edit3 className="h-3.5 w-3.5 text-[#888888]" />
              <span>Edit User</span>
            </button>

            {/* Deselect */}
            <button
              type="button"
              onClick={() => {
                const target = actionMenuUser;
                closeActionMenu();
                setSelectedUserIds((prev) => prev.filter((id) => id !== target.id));
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-[#dddddd] hover:text-white hover:bg-[#202020] transition-colors cursor-pointer flex items-center gap-2.5"
            >
              <SquareX className="h-3.5 w-3.5 text-[#888888]" />
              <span>Deselect</span>
            </button>

            {/* Ban User */}
            <button
              type="button"
              onClick={() => {
                const target = actionMenuUser;
                closeActionMenu();
                setActiveUser(target);
                setIsBanModalOpen(true);
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-[#dddddd] hover:text-white hover:bg-[#202020] transition-colors cursor-pointer flex items-center gap-2.5"
            >
              <Ban className="h-3.5 w-3.5 text-[#888888]" />
              <span>{actionMenuUser.status === 'suspended' ? 'Unban User' : 'Ban User'}</span>
            </button>

            {/* Pause / Resume */}
            <button
              type="button"
              onClick={() => {
                const target = actionMenuUser;
                closeActionMenu();
                setActiveUser(target);
                setIsPauseModalOpen(true);
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-[#dddddd] hover:text-white hover:bg-[#202020] transition-colors cursor-pointer flex items-center gap-2.5"
            >
              {actionMenuUser.status === 'disabled' ? (
                <>
                  <PlayCircle className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <PauseCircle className="h-3.5 w-3.5 text-[#888888]" />
                  <span>Pause</span>
                </>
              )}
            </button>

            {/* Extend Time */}
            <button
              type="button"
              onClick={() => {
                const target = actionMenuUser;
                closeActionMenu();
                setActiveUser(target);
                setIsExtendTimeOpen(true);
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-[#dddddd] hover:text-white hover:bg-[#202020] transition-colors cursor-pointer flex items-center gap-2.5"
            >
              <Clock className="h-3.5 w-3.5 text-[#888888]" />
              <span>Extend Time</span>
            </button>

            {/* Subtract Time */}
            <button
              type="button"
              onClick={() => {
                const target = actionMenuUser;
                closeActionMenu();
                setActiveUser(target);
                setIsSubtractTimeOpen(true);
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-[#dddddd] hover:text-white hover:bg-[#202020] transition-colors cursor-pointer flex items-center gap-2.5"
            >
              <MinusCircle className="h-3.5 w-3.5 text-[#888888]" />
              <span>Subtract Time</span>
            </button>

            {/* Reset HWID */}
            <button
              type="button"
              onClick={() => {
                const target = actionMenuUser;
                closeActionMenu();
                openResetHwidModal(target);
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-[#dddddd] hover:text-white hover:bg-[#202020] transition-colors cursor-pointer flex items-center gap-2.5"
            >
              <Laptop className="h-3.5 w-3.5 text-[#888888]" />
              <span>Reset HWID</span>
            </button>

            {/* Copy Info */}
            <button
              type="button"
              onClick={() => {
                const target = actionMenuUser;
                closeActionMenu();
                handleCopyInfo(target);
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-[#dddddd] hover:text-white hover:bg-[#202020] transition-colors cursor-pointer flex items-center gap-2.5"
            >
              <Copy className="h-3.5 w-3.5 text-[#888888]" />
              <span>Copy Info</span>
            </button>

            <div className="my-1 border-t border-[#222222]" />

            {/* Delete */}
            <button
              type="button"
              onClick={() => {
                const target = actionMenuUser;
                closeActionMenu();
                setActiveUser(target);
                setIsDeleteModalOpen(true);
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 transition-colors cursor-pointer flex items-center gap-2.5"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              <span>Delete</span>
            </button>
          </div>,
          document.body
        )
      }
    </div>
  );
}
