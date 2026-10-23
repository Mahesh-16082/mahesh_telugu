import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";
import {
  Archive,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  Filter,
  ImageOff,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Smartphone,
  Star,
  Trash2,
  Upload,
  UserRound,
  X,
  Zap,
} from "lucide-react";

import {
  bulkActionPosts,
  duplicatePost,
  exportPostsCsv,
  getApiErrorMessage,
  getPosts,
  getPostStatusCounts,
  getPostStatusLabel,
  getUserDisplayName,
  movePostToTrash,
  permanentlyDeletePost,
  publishPost,
  restorePost,
  unpublishPost,
} from "../services/posts";
import type {
  AuthorSummary,
  Post,
  PostBulkAction,
  PostListParams,
  PostStatus,
  PostStatusCounts,
} from "../services/posts";
import { getCategories } from "../services/categories";
import type { Category } from "../services/categories";
import PostEditor from "./PostEditor";
import PostPreview from "./PostPreview";

type PostsProps = {
  mode?: "all" | "drafts" | "published";
  onNavigate?: (page: string) => void;
};

interface ConfirmationDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  isDestructive?: boolean;
  onConfirm: () => void;
}

function toLocalDateTimeInput(date: Date): string {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function getLast24HoursStart(): string {
  const date = new Date();
  date.setHours(date.getHours() - 24);
  return toLocalDateTimeInput(date);
}

function getCurrentDateTime(): string {
  return toLocalDateTimeInput(new Date());
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getInitials(name?: string | null): string {
  if (!name) return "TF";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function UserCell({ user }: { user?: AuthorSummary | null }) {
  if (!user) {
    return <span className="text-xs text-slate-400">Not recorded</span>;
  }
  const displayName = getUserDisplayName(user);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#10243D] text-[10px] font-bold text-white shadow-sm">
        {getInitials(displayName)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-800">
          {displayName}
        </p>
        <p className="truncate text-[10px] text-slate-400">Author</p>
      </div>
    </div>
  );
}

const EMPTY_COUNTS: PostStatusCounts = {
  all: 0,
  published: 0,
  draft: 0,
  scheduled: 0,
  trash: 0,
  archived: 0,
};

export default function Posts({ mode = "all", onNavigate: _onNavigate }: PostsProps) {
  // Navigation / View modes
  const [view, setView] = useState<"list" | "editor" | "preview">("list");
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

  // Posts listing state
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [counts, setCounts] = useState<PostStatusCounts>(EMPTY_COUNTS);
  const [categories, setCategories] = useState<Category[]>([]);

  // Search & Filter state
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>(
    mode === "drafts" ? "DRAFT" : mode === "published" ? "PUBLISHED" : "",
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // UI state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterLoading, setFilterLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showFilterAccordion, setShowFilterAccordion] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showBulkMenu, setShowBulkMenu] = useState<boolean>(false);
  const [openRowMenu, setOpenRowMenu] = useState<number | null>(null);

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [confirmationDialog, setConfirmationDialog] =
    useState<ConfirmationDialogState | null>(null);

  const exportMenuRef = useRef<HTMLDivElement>(null);
  const bulkMenuRef = useRef<HTMLDivElement>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback(
    (type: "success" | "error", message: string) => {
      setToast({ type, message });
      window.setTimeout(() => setToast(null), 3500);
    },
    [],
  );

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setShowExportMenu(false);
      }
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(target)) {
        setShowBulkMenu(false);
      }
      if (rowMenuRef.current && !rowMenuRef.current.contains(target)) {
        setOpenRowMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load Categories
  useEffect(() => {
    let cancelled = false;
    async function loadCats() {
      try {
        const res = await getCategories({ page: 1, page_size: 100 });
        if (!cancelled) {
          setCategories(res.items.filter((c) => !c.is_deleted));
        }
      } catch {
        // Fallback
      }
    }
    void loadCats();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync mode with statusFilter
  useEffect(() => {
    if (mode === "drafts") {
      setStatusFilter("DRAFT");
    } else if (mode === "published") {
      setStatusFilter("PUBLISHED");
    } else {
      setStatusFilter("");
    }
    setPage(1);
  }, [mode]);

  // Load Posts & Status Counts
  const loadPosts = useCallback(
    async (isInitial = false) => {
      if (isInitial) {
        setLoading(true);
      } else {
        setFilterLoading(true);
      }

      try {
        const isTrashTab = statusFilter === "TRASHED";
        const queryStatus =
          isTrashTab || !statusFilter
            ? undefined
            : (statusFilter as PostStatus);

        const params: PostListParams = {
          page,
          page_size: pageSize,
          search: search.trim() || undefined,
          status: queryStatus,
          category_id: categoryFilter ? Number(categoryFilter) : undefined,
          trash: isTrashTab,
          created_from: dateFrom || undefined,
          created_to: dateTo || undefined,
          sort_by: statusFilter === "PUBLISHED" ? "published_at" : "updated_at",
          sort_order: "desc",
        };

        const [postsRes, countsRes] = await Promise.all([
          getPosts(params),
          getPostStatusCounts(),
        ]);

        setPosts(postsRes.items);
        setTotal(postsRes.total);
        setTotalPages(postsRes.total_pages);
        setCounts(countsRes);
        setSelectedIds([]);
      } catch (err) {
        showToast(
          "error",
          getApiErrorMessage(err, "Unable to load newsroom posts."),
        );
      } finally {
        setLoading(false);
        setFilterLoading(false);
      }
    },
    [
      categoryFilter,
      dateFrom,
      dateTo,
      page,
      pageSize,
      search,
      showToast,
      statusFilter,
    ],
  );

  useEffect(() => {
    void loadPosts(true);
  }, [loadPosts]);

  // Filter Actions
  function handleApplyFilters(event?: FormEvent) {
    event?.preventDefault();
    setPage(1);
    void loadPosts(false);
  }

  function handleResetFilters() {
    setSearch("");
    setStatusFilter("");
    setCategoryFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    void loadPosts(false);
  }

  function handleSetLast24Hours() {
    setDateFrom(getLast24HoursStart());
    setDateTo(getCurrentDateTime());
    setPage(1);
    void loadPosts(false);
  }

  function handleShowAllPosts() {
    setDateFrom("");
    setDateTo("");
    setPage(1);
    void loadPosts(false);
  }

  // Active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (categoryFilter) count++;
    if (dateFrom || dateTo) count++;
    if (search.trim()) count++;
    return count;
  }, [categoryFilter, dateFrom, dateTo, search]);

  // Status Tab Card Click
  function handleStatusCardClick(targetStatus: string) {
    setStatusFilter(targetStatus);
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  // Selection
  const allCurrentPageSelected =
    posts.length > 0 && posts.every((p) => selectedIds.includes(p.id));

  function toggleSelectAll() {
    if (allCurrentPageSelected) {
      const pageIds = new Set(posts.map((p) => p.id));
      setSelectedIds((curr) => curr.filter((id) => !pageIds.has(id)));
    } else {
      setSelectedIds((curr) =>
        Array.from(new Set([...curr, ...posts.map((p) => p.id)])),
      );
    }
  }

  function togglePostSelection(id: number) {
    setSelectedIds((curr) =>
      curr.includes(id) ? curr.filter((i) => i !== id) : [...curr, id],
    );
  }

  // Bulk Actions
  async function executeBulkAction(
    action: PostBulkAction,
    confirmed = false,
  ) {
    if (selectedIds.length === 0) {
      showToast("error", "Please select at least one post.");
      return;
    }

    if ((action === "trash" || action === "permanent_delete") && !confirmed) {
      const isPermanent = action === "permanent_delete";
      setConfirmationDialog({
        title: isPermanent
          ? "Delete selected posts permanently?"
          : "Move selected posts to trash?",
        message: isPermanent
          ? `Are you sure you want to permanently delete ${selectedIds.length} posts? This action cannot be undone.`
          : `Are you sure you want to move ${selectedIds.length} posts to Trash?`,
        confirmLabel: isPermanent ? "Delete Permanently" : "Move to Trash",
        isDestructive: true,
        onConfirm: () => {
          setConfirmationDialog(null);
          void executeBulkAction(action, true);
        },
      });
      return;
    }

    setActionLoading(`bulk-${action}`);
    try {
      const res = await bulkActionPosts({ action, post_ids: selectedIds });
      showToast("success", res.message);
      setSelectedIds([]);
      setShowBulkMenu(false);
      await loadPosts();
    } catch (err) {
      showToast("error", getApiErrorMessage(err, "Bulk action failed."));
    } finally {
      setActionLoading(null);
    }
  }

  // Row Trash / Restore
  async function handleTrashOrRestore(post: Post, confirmed = false) {
    const isTrashed = Boolean(post.deleted_at || post.is_deleted) || statusFilter === "TRASHED";

    if (!confirmed) {
      setConfirmationDialog({
        title: isTrashed ? "Restore news post?" : "Move post to trash?",
        message: isTrashed
          ? `Are you sure you want to restore "${post.title}" back to active drafts?`
          : `Are you sure you want to move "${post.title}" to trash?`,
        confirmLabel: isTrashed ? "Restore Post" : "Move to Trash",
        isDestructive: !isTrashed,
        onConfirm: () => {
          setConfirmationDialog(null);
          void handleTrashOrRestore(post, true);
        },
      });
      return;
    }

    setActionLoading(`post-${post.id}`);
    try {
      if (isTrashed) {
        await restorePost(post.id);
        showToast("success", `Restored "${post.title}".`);
      } else {
        await movePostToTrash(post.id);
        showToast("success", `Moved "${post.title}" to trash.`);
      }
      setOpenRowMenu(null);
      await loadPosts();
    } catch (err) {
      showToast("error", getApiErrorMessage(err, "Unable to update post."));
    } finally {
      setActionLoading(null);
    }
  }

  // Row Permanent Delete
  async function handlePermanentDelete(post: Post, confirmed = false) {
    if (!confirmed) {
      setConfirmationDialog({
        title: "Permanently delete post?",
        message: `Are you sure you want to permanently remove "${post.title}"? This cannot be undone.`,
        confirmLabel: "Delete Permanently",
        isDestructive: true,
        onConfirm: () => {
          setConfirmationDialog(null);
          void handlePermanentDelete(post, true);
        },
      });
      return;
    }

    setActionLoading(`post-${post.id}`);
    try {
      await permanentlyDeletePost(post.id);
      showToast("success", `Permanently removed "${post.title}".`);
      setOpenRowMenu(null);
      await loadPosts();
    } catch (err) {
      showToast("error", getApiErrorMessage(err, "Permanent deletion failed."));
    } finally {
      setActionLoading(null);
    }
  }

  // Row Duplicate
  async function handleDuplicate(post: Post) {
    setActionLoading(`dup-${post.id}`);
    try {
      await duplicatePost(post.id);
      showToast("success", `Duplicated "${post.title}" as draft.`);
      setOpenRowMenu(null);
      await loadPosts();
    } catch (err) {
      showToast("error", getApiErrorMessage(err, "Failed to duplicate post."));
    } finally {
      setActionLoading(null);
    }
  }

  // Row Toggle Publish
  async function handleTogglePublish(post: Post) {
    setActionLoading(`pub-${post.id}`);
    try {
      if (post.status === "PUBLISHED") {
        await unpublishPost(post.id);
        showToast("success", `Unpublished "${post.title}".`);
      } else {
        await publishPost(post.id);
        showToast("success", `Published "${post.title}".`);
      }
      await loadPosts();
    } catch (err) {
      showToast("error", getApiErrorMessage(err, "Action failed."));
    } finally {
      setActionLoading(null);
    }
  }

  // Export CSV
  async function handleExport(_selectedOnly = false) {
    setActionLoading("export");
    try {
      showToast("success", "Generating CSV export...");
      await exportPostsCsv({
        search: search.trim() || undefined,
        status: statusFilter && statusFilter !== "TRASHED" ? (statusFilter as PostStatus) : undefined,
        category_id: categoryFilter ? Number(categoryFilter) : undefined,
        trash: statusFilter === "TRASHED",
        created_from: dateFrom || undefined,
        created_to: dateTo || undefined,
      });
      setShowExportMenu(false);
    } catch (err) {
      showToast("error", getApiErrorMessage(err, "Export failed."));
    } finally {
      setActionLoading(null);
    }
  }

  // Dynamic Header Title
  const pageTitle = useMemo(() => {
    switch (statusFilter) {
      case "PUBLISHED":
        return "Published Posts";
      case "DRAFT":
        return "Draft Posts";
      case "SCHEDULED":
        return "Scheduled Posts";
      case "TRASHED":
        return "Posts Trash";
      default:
        return "All Posts";
    }
  }, [statusFilter]);

  // Status Cards Config
  const statusCards = [
    {
      label: "All Posts",
      value: counts.all,
      status: "",
      accent: "border-[#10243D] bg-[#10243D] text-white",
    },
    {
      label: "Published",
      value: counts.published,
      status: "PUBLISHED",
      accent: "border-emerald-200 bg-emerald-50 text-emerald-800",
    },
    {
      label: "Drafts",
      value: counts.draft,
      status: "DRAFT",
      accent: "border-amber-200 bg-amber-50 text-amber-800",
    },
    {
      label: "Scheduled",
      value: counts.scheduled,
      status: "SCHEDULED",
      accent: "border-sky-200 bg-sky-50 text-sky-800",
    },
    {
      label: "Trash",
      value: counts.trash,
      status: "TRASHED",
      accent: "border-rose-200 bg-rose-50 text-rose-800",
    },
  ];

  // SUB-VIEW: Post Editor View
  if (view === "editor") {
    return (
      <PostEditor
        postId={selectedPostId}
        onBack={() => {
          setView("list");
          setSelectedPostId(null);
          void loadPosts();
        }}
        onPreview={(p) => {
          setSelectedPostId(p.id);
          setView("preview");
        }}
        onSaved={() => void loadPosts()}
      />
    );
  }

  // SUB-VIEW: Post Mobile Preview View
  if (view === "preview" && selectedPostId) {
    return (
      <PostPreview
        postId={selectedPostId}
        onBack={() => {
          setView("list");
          setSelectedPostId(null);
        }}
        onEdit={(id) => {
          setSelectedPostId(id);
          setView("editor");
        }}
      />
    );
  }

  // MAIN VIEW: Posts Newsroom Listing
  return (
    <div className="space-y-5 pb-10">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed right-5 top-5 z-[100] flex max-w-md items-center gap-2.5 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50/95 text-emerald-800"
              : "border-rose-200 bg-rose-50/95 text-rose-800"
          }`}
        >
          <span className="text-xs font-semibold">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-auto rounded-lg p-0.5 hover:bg-black/5"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmationDialog && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmationDialog(null);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-[#10243D]">
                {confirmationDialog.title}
              </h2>
              <div
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                  confirmationDialog.isDestructive
                    ? "bg-rose-100 text-rose-600"
                    : "bg-emerald-100 text-emerald-600"
                }`}
              >
                {confirmationDialog.title.toLowerCase().includes("restore") ? (
                  <RotateCcw size={20} strokeWidth={2.2} />
                ) : (
                  <Trash2 size={20} strokeWidth={2.2} />
                )}
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              {confirmationDialog.message}
            </p>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmationDialog(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmationDialog.onConfirm}
                className={`rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm ${
                  confirmationDialog.isDestructive
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {confirmationDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
       * NEWSROOM DARK BANNER & METRICS
       * ======================================================= */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {/* Dark Banner */}
        <div className="relative overflow-hidden bg-[#10243D] px-5 py-6 text-white sm:px-6 lg:px-7">
          {/* Red Glow Accent */}
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#D9273B]/15 blur-2xl" />
          <div className="absolute bottom-0 right-12 h-16 w-16 rounded-full bg-white/5" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#D9273B] text-white shadow-lg shadow-red-950/20">
                  <Upload size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-200">
                    Content Newsroom
                  </p>
                  <h1 className="text-2xl font-bold sm:text-3xl">
                    {pageTitle}
                  </h1>
                </div>
              </div>
              <p className="mt-3 max-w-2xl text-xs leading-5 text-slate-300">
                Manage published stories, drafts, scheduled content, author revisions, exports, and mobile readers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void loadPosts(false)}
                disabled={filterLoading}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={filterLoading ? "animate-spin" : ""}
                />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedPostId(null);
                  setView("editor");
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#D9273B] px-5 text-xs font-bold text-white shadow-lg shadow-red-950/20 transition hover:bg-[#b81f30]"
              >
                <Plus size={16} />
                <span>Create Post</span>
              </button>
            </div>
          </div>
        </div>

        {/* 5 Status Cards */}
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5 lg:p-6">
          {statusCards.map((card) => {
            const isActive = statusFilter === card.status;
            return (
              <button
                key={card.label}
                type="button"
                onClick={() => handleStatusCardClick(card.status)}
                className={`rounded-xl border p-4 text-left transition ${
                  isActive
                    ? `${card.accent} shadow-sm`
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <p
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isActive ? "opacity-90" : "text-slate-400"
                  }`}
                >
                  {card.label}
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {card.value.toLocaleString("en-IN")}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* =======================================================
       * SEARCH AND FILTER BAR
       * ======================================================= */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <form onSubmit={handleApplyFilters} className="p-4 lg:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search headline, summary, slug or author..."
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/60 pl-11 pr-4 text-xs font-medium text-[#10243D] outline-none transition placeholder:text-slate-400 focus:border-[#D9273B] focus:bg-white focus:ring-4 focus:ring-red-50"
              />
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* <button
                type="button"
                onClick={() => setShowFilterAccordion((curr) => !curr)}
                className={`inline-flex h-11 items-center gap-1.5 rounded-2xl border px-3.5 text-xs font-bold transition ${
                  showFilterAccordion || activeFilterCount > 0
                    ? "border-red-200 bg-red-50 text-[#D9273B]"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Filter size={15} />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-[#D9273B] px-1.5 py-0.2 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDown
                  size={14}
                  className={`transition-transform ${
                    showFilterAccordion ? "rotate-180" : ""
                  }`}
                />
              </button>

              <button
                type="submit"
                disabled={filterLoading}
                className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-[#10243D] px-4 text-xs font-bold text-white transition hover:bg-[#1b3455] disabled:opacity-50"
              >
                {filterLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Search size={15} />
                )}
                <span>Apply</span>
              </button>

              <button
                type="button"
                onClick={handleSetLast24Hours}
                className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <CalendarClock size={15} />
                <span>Last 24 Hours</span>
              </button> */}

              <button
                type="button"
                onClick={handleShowAllPosts}
                className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Archive size={15} />
                <span>Show All</span>
              </button>

              {/* <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <RotateCcw size={15} />
                <span>Reset</span>
              </button> */}
            </div>
          </div>

          {/* Collapsible Filters Accordion */}
          {showFilterAccordion && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 lg:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#10243D]">
                    Advanced Post Filters
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Filter newsroom content by category or publication timeframe.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilterAccordion(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* Category Filter */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Category
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-[#D9273B]"
                  >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Start Date & Time */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-[#D9273B]"
                  />
                </div>

                {/* End Date & Time */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    End Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-[#D9273B]"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-[11px] text-slate-500">
                <div>
                  Active range:{" "}
                  <span className="font-semibold text-slate-700">
                    {dateFrom ? new Date(dateFrom).toLocaleDateString("en-IN") : "All time"}
                    {" → "}
                    {dateTo ? new Date(dateTo).toLocaleDateString("en-IN") : "Present"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSetLast24Hours}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 font-semibold text-[#D9273B] hover:bg-red-100"
                  >
                    Last 24 Hours
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-[#10243D] px-4 py-1 font-bold text-white hover:bg-[#1b3455]"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </section>

      {/* =======================================================
       * POSTS TABLE & TOOLBAR
       * ======================================================= */}
      <section className="overflow-visible rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {/* Table Top Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-[#10243D]">
              Newsroom Articles
            </h2>
            <p className="text-xs text-slate-500">
              {total.toLocaleString("en-IN")} matching post(s)
              {selectedIds.length > 0 && ` · ${selectedIds.length} selected`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Bulk Action Menu */}
            {selectedIds.length > 0 && (
              <div ref={bulkMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowBulkMenu((curr) => !curr)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <Archive size={14} />
                  <span>Bulk Actions ({selectedIds.length})</span>
                  <ChevronDown size={13} />
                </button>

                {showBulkMenu && (
                  <div className="absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <button
                      type="button"
                      disabled={actionLoading !== null}
                      onClick={() => void executeBulkAction("publish")}
                      className="flex w-full items-center rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Publish selected
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading !== null}
                      onClick={() => void executeBulkAction("unpublish")}
                      className="flex w-full items-center rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Move to drafts
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading !== null}
                      onClick={() => void executeBulkAction("trash")}
                      className="flex w-full items-center rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Move to trash
                    </button>
                    {statusFilter === "TRASHED" && (
                      <>
                        <button
                          type="button"
                          disabled={actionLoading !== null}
                          onClick={() => void executeBulkAction("restore")}
                          className="flex w-full items-center rounded-xl px-3 py-2 text-left text-xs font-semibold text-emerald-600 hover:bg-emerald-50"
                        >
                          Restore selected
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading !== null}
                          onClick={() => void executeBulkAction("permanent_delete")}
                          className="flex w-full items-center rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          Delete permanently
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Export Menu */}
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu((curr) => !curr)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download size={14} />
                <span>Export</span>
                <ChevronDown size={13} />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 top-11 z-40 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  <button
                    type="button"
                    onClick={() => void handleExport(false)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <FileDown size={16} className="text-sky-600" />
                    <div>
                      <p className="font-bold">Export Filtered CSV</p>
                      <p className="text-[10px] text-slate-400">All matching records</p>
                    </div>
                  </button>
                  {selectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleExport(true)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#D9273B] hover:bg-red-50"
                    >
                      <FileSpreadsheet size={16} />
                      <div>
                        <p className="font-bold">Export Selected CSV</p>
                        <p className="text-[10px] text-slate-400">({selectedIds.length} articles)</p>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Posts Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-xs">
            <thead className="border-b border-slate-100 bg-[#F8FAFD] text-slate-600">
              <tr>
                <th className="w-12 px-5 py-4">
                  <input
                    type="checkbox"
                    checked={allCurrentPageSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-[#D9273B] focus:ring-[#D9273B]"
                  />
                </th>
                <th className="px-4 py-4 font-bold uppercase tracking-wide text-slate-500">
                  Article
                </th>
                <th className="px-4 py-4 font-bold uppercase tracking-wide text-slate-500">
                  Category
                </th>
                <th className="px-4 py-4 font-bold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-4 py-4 font-bold uppercase tracking-wide text-slate-500">
                  Author
                </th>
                <th className="px-4 py-4 font-bold uppercase tracking-wide text-slate-500">
                  Created
                </th>
                <th className="px-4 py-4 font-bold uppercase tracking-wide text-slate-500">
                  Updated
                </th>
                <th className="px-4 py-4 text-right font-bold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#D9273B]" />
                    <p className="mt-3 font-semibold text-slate-600">
                      Loading newsroom posts…
                    </p>
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                      <Search size={26} />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-[#10243D]">
                      No news articles found
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Try adjusting your filters or create a new story.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPostId(null);
                        setView("editor");
                      }}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#D9273B] px-4 py-2 text-xs font-bold text-white hover:bg-[#b81f30]"
                    >
                      <Plus size={15} />
                      <span>Create Post</span>
                    </button>
                  </td>
                </tr>
              ) : (
                posts.map((post) => {
                  const isChecked = selectedIds.includes(post.id);
                  const isOperating = actionLoading === `post-${post.id}`;
                  const imageSrc = post.featured_image || post.featured_image_url;

                  return (
                    <tr
                      key={post.id}
                      className={`group transition-colors hover:bg-slate-50/70 ${
                        isChecked ? "bg-red-50/20" : "bg-white"
                      }`}
                    >
                      <td className="px-5 py-4 align-middle">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePostSelection(post.id)}
                          className="h-4 w-4 rounded border-slate-300 text-[#D9273B] focus:ring-[#D9273B]"
                        />
                      </td>

                      {/* Post Thumbnail & Headline */}
                      <td className="max-w-[380px] px-4 py-4 align-middle">
                        <div className="flex items-start gap-3">
                          <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                            {imageSrc ? (
                              <img
                                src={imageSrc}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <ImageOff size={18} className="text-slate-400" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h3
                              onClick={() => {
                                setSelectedPostId(post.id);
                                setView("preview");
                              }}
                              className="line-clamp-2 cursor-pointer text-xs font-bold leading-5 text-[#10243D] transition hover:text-[#D9273B] hover:underline"
                              title={post.title}
                            >
                              {post.title || "Untitled draft"}
                            </h3>

                            <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                              {post.summary || post.short_description || "No excerpt added."}
                            </p>

                            {/* Tags: Featured, Breaking News */}
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {post.is_breaking_news && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-2 py-0.2 text-[9px] font-bold text-rose-700">
                                  <Zap size={10} className="fill-rose-700" />
                                  Breaking
                                </span>
                              )}
                              {post.is_featured && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.2 text-[9px] font-bold text-amber-700">
                                  <Star size={10} className="fill-amber-700" />
                                  Featured
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="whitespace-nowrap px-4 py-4 align-middle font-medium text-slate-700">
                        {post.category ? (
                          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                            {post.category.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">Uncategorized</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap px-4 py-4 align-middle">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                            post.status === "PUBLISHED"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : post.status === "DRAFT"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : post.status === "SCHEDULED"
                                  ? "border-sky-200 bg-sky-50 text-sky-700"
                                  : "border-slate-200 bg-slate-50 text-slate-700"
                          }`}
                        >
                          {getPostStatusLabel(post.status)}
                        </span>
                        {post.scheduled_at && (
                          <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                            <CalendarClock size={11} />
                            <span>{formatDate(post.scheduled_at)}</span>
                          </p>
                        )}
                      </td>

                      {/* Author */}
                      <td className="whitespace-nowrap px-4 py-4 align-middle">
                        <UserCell user={post.author} />
                      </td>

                      {/* Created */}
                      <td className="whitespace-nowrap px-4 py-4 align-middle text-slate-500">
                        {formatDate(post.created_at)}
                      </td>

                      {/* Updated */}
                      <td className="whitespace-nowrap px-4 py-4 align-middle text-slate-500">
                        {formatDate(post.updated_at)}
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap px-4 py-4 text-right align-middle">
                        <div className="flex items-center justify-end gap-1">
                          {/* View details */}
                          <button
                            type="button"
                            title="View / Details"
                            onClick={() => {
                              setSelectedPostId(post.id);
                              setView("preview");
                            }}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#10243D]"
                          >
                            <Eye size={16} />
                          </button>

                          {/* Edit Post */}
                          <button
                            type="button"
                            title="Edit Post"
                            onClick={() => {
                              setSelectedPostId(post.id);
                              setView("editor");
                            }}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-sky-50 hover:text-sky-700"
                          >
                            <Pencil size={16} />
                          </button>

                          {/* Quick Publish / Unpublish */}
                          {!post.is_deleted && !post.deleted_at && statusFilter !== "TRASHED" && (
                            <button
                              type="button"
                              onClick={() => void handleTogglePublish(post)}
                              disabled={actionLoading === `pub-${post.id}`}
                              className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                                post.status === "PUBLISHED"
                                  ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {actionLoading === `pub-${post.id}`
                                ? "…"
                                : post.status === "PUBLISHED"
                                  ? "Unpublish"
                                  : "Publish"}
                            </button>
                          )}

                          {/* Row Actions More Menu */}
                          <div
                            ref={openRowMenu === post.id ? rowMenuRef : undefined}
                            className="relative"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setOpenRowMenu((curr) =>
                                  curr === post.id ? null : post.id,
                                )
                              }
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <MoreHorizontal size={17} />
                            </button>

                            {openRowMenu === post.id && (
                              <div className="absolute right-0 top-9 z-50 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPostId(post.id);
                                    setView("editor");
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  <Pencil size={14} />
                                  <span>Edit story</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDuplicate(post)}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  <Copy size={14} />
                                  <span>Duplicate draft</span>
                                </button>

                                <div className="my-1 border-t border-slate-100" />

                                {statusFilter === "TRASHED" ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={isOperating}
                                      onClick={() => void handleTrashOrRestore(post)}
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-emerald-600 hover:bg-emerald-50"
                                    >
                                      <RotateCcw size={14} />
                                      <span>Restore post</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isOperating}
                                      onClick={() => void handlePermanentDelete(post)}
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"
                                    >
                                      <Trash2 size={14} />
                                      <span>Delete permanently</span>
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isOperating}
                                    onClick={() => void handleTrashOrRestore(post)}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"
                                  >
                                    <Trash2 size={14} />
                                    <span>Move to trash</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col gap-4 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-500">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#D9273B]"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">
              Page <span className="font-bold text-slate-800">{page}</span> of{" "}
              <span className="font-bold text-slate-800">{totalPages || 1}</span>
            </p>

            <button
              type="button"
              disabled={page <= 1 || filterLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              type="button"
              disabled={page >= totalPages || filterLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* =======================================================
       * FOOTER INFORMATION CARDS (TUPAKI 3-COLUMN FOOTER)
       * ======================================================= */}
      <section className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm md:grid-cols-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#D9273B]">
            <UserRound size={19} />
          </div>
          <div>
            <p className="text-xs font-bold text-[#10243D]">Creator tracking</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Every published post and autosaved draft captures the authenticated creator and author ID.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <Smartphone size={19} />
          </div>
          <div>
            <p className="text-xs font-bold text-[#10243D]">Mobile preview</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Preview each post as an InShorts-style mobile card before broadcasting to audience feeds.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <FileSpreadsheet size={19} />
          </div>
          <div>
            <p className="text-xs font-bold text-[#10243D]">Filter-aware exports</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Export news articles to CSV with category and date filters preserved for archiving.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
