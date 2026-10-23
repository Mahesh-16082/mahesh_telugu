import {
  useCallback,
  useEffect,
  useState,
  useRef,
} from "react";
import type { FormEvent } from "react";
import {
  Check,
  Copy,
  Download,
  FileText,
  ImageOff,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";

import {
  bulkActionPosts,
  createDraft,
  createPost,
  duplicatePost,
  exportPostsCsv,
  getPosts,
  movePostToTrash,
  publishPost,
  toggleBreaking,
  toggleFeatured,
  unpublishPost,
  updatePost,
  uploadPostImage,
} from "../services/posts";
import type {
  Post,
  PostCreate,
  PostStatus,
} from "../services/posts";
import { getCategories } from "../services/categories";
import type { Category } from "../services/categories";

type PostsProps = {
  mode?: "all" | "drafts" | "published";
  onNavigate?: (page: string) => void;
};

type PostForm = {
  title: string;
  slug: string;
  category_id: string;
  summary: string;
  content: string;
  featured_image: string;
  is_featured: boolean;
  is_breaking_news: boolean;
  status: PostStatus;
  seo_title: string;
  seo_description: string;
  scheduled_at: string;
};

const EMPTY_FORM: PostForm = {
  title: "",
  slug: "",
  category_id: "",
  summary: "",
  content: "",
  featured_image: "",
  is_featured: false,
  is_breaking_news: false,
  status: "DRAFT",
  seo_title: "",
  seo_description: "",
  scheduled_at: "",
};

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

export default function Posts({ mode = "all", onNavigate: _onNavigate }: PostsProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>(
    mode === "drafts" ? "DRAFT" : mode === "published" ? "PUBLISHED" : "ALL",
  );

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [form, setForm] = useState<PostForm>(EMPTY_FORM);
  const [confirmPost, setConfirmPost] = useState<{
    type: "trash" | "bulk_trash" | "publish" | "unpublish";
    post?: Post;
  } | null>(null);

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback(
    (type: "success" | "error", message: string) => {
      setToast({ type, message });
      window.setTimeout(() => setToast(null), 4000);
    },
    [],
  );

  // Load categories for dropdown filter and editor
  useEffect(() => {
    let cancelled = false;
    async function loadCats() {
      try {
        const res = await getCategories({ page: 1, page_size: 100 });
        if (!cancelled) {
          setCategories(res.items.filter((c) => !c.is_deleted));
        }
      } catch {
        // Categories load error handled silently
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
      setStatusFilter("ALL");
    }
    setPage(1);
  }, [mode]);

  // Load posts
  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const activeStatus =
        mode === "drafts"
          ? "DRAFT"
          : mode === "published"
            ? "PUBLISHED"
            : statusFilter !== "ALL"
              ? statusFilter
              : undefined;

      const activeCat =
        categoryFilter !== "ALL" ? Number(categoryFilter) : undefined;

      const res = await getPosts({
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        status: activeStatus,
        category_id: activeCat,
        trash: false,
        sort_by: mode === "published" ? "published_at" : "created_at",
        sort_order: "desc",
      });

      setPosts(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to load posts.",
      );
    } finally {
      setLoading(false);
    }
  }, [mode, page, pageSize, search, statusFilter, categoryFilter, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPosts();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [loadPosts]);

  // Open modal for Create
  function handleOpenCreate() {
    setEditingPost(null);
    setForm({
      ...EMPTY_FORM,
      status: mode === "published" ? "PUBLISHED" : "DRAFT",
    });
    setModalOpen(true);
  }

  // Open modal for Edit
  function handleOpenEdit(post: Post) {
    setEditingPost(post);
    setForm({
      title: post.title,
      slug: post.slug,
      category_id: post.category_id ? String(post.category_id) : "",
      summary: post.summary || post.short_description || "",
      content: post.content || "",
      featured_image: post.featured_image || post.featured_image_url || "",
      is_featured: post.is_featured,
      is_breaking_news: post.is_breaking_news,
      status: post.status,
      seo_title: post.seo_title || "",
      seo_description: post.seo_description || "",
      scheduled_at: post.scheduled_at
        ? new Date(post.scheduled_at).toISOString().slice(0, 16)
        : "",
    });
    setModalOpen(true);
  }

  // Handle Image Upload
  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const res = await uploadPostImage(file);
      setForm((prev) => ({ ...prev, featured_image: res.image_url }));
      showToast("success", "Image uploaded successfully.");
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Image upload failed.",
      );
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Handle Form Submission
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast("error", "Article title is required.");
      return;
    }

    setSaving(true);
    try {
      const payload: PostCreate = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        summary: form.summary.trim() || undefined,
        content: form.content,
        featured_image: form.featured_image.trim() || undefined,
        category_id: form.category_id ? Number(form.category_id) : null,
        status: form.status,
        is_featured: form.is_featured,
        is_breaking_news: form.is_breaking_news,
        seo_title: form.seo_title.trim() || undefined,
        seo_description: form.seo_description.trim() || undefined,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : undefined,
      };

      if (editingPost) {
        await updatePost(editingPost.id, payload);
        showToast("success", "Post updated successfully.");
      } else {
        if (form.status === "DRAFT") {
          await createDraft(payload);
        } else {
          await createPost(payload);
        }
        showToast("success", "Post created successfully.");
      }

      setModalOpen(false);
      void loadPosts();
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to save post.",
      );
    } finally {
      setSaving(false);
    }
  }

  // Quick Publish / Unpublish
  async function handleTogglePublish(post: Post) {
    setActionId(post.id);
    try {
      if (post.status === "PUBLISHED") {
        await unpublishPost(post.id);
        showToast("success", `Unpublished "${post.title}".`);
      } else {
        await publishPost(post.id);
        showToast("success", `Published "${post.title}".`);
      }
      void loadPosts();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionId(null);
    }
  }

  // Duplicate Post
  async function handleDuplicate(post: Post) {
    setActionId(post.id);
    try {
      await duplicatePost(post.id);
      showToast("success", `Duplicated "${post.title}".`);
      void loadPosts();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Duplicate failed.");
    } finally {
      setActionId(null);
    }
  }

  // Toggle Featured
  async function handleToggleFeatured(post: Post) {
    try {
      const res = await toggleFeatured(post.id);
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, is_featured: res.is_featured } : p)),
      );
      showToast(
        "success",
        res.is_featured ? "Marked as featured." : "Removed from featured.",
      );
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to toggle.");
    }
  }

  // Toggle Breaking
  async function handleToggleBreaking(post: Post) {
    try {
      const res = await toggleBreaking(post.id);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, is_breaking_news: res.is_breaking_news } : p,
        ),
      );
      showToast(
        "success",
        res.is_breaking_news ? "Marked as Breaking News." : "Removed from Breaking News.",
      );
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to toggle.");
    }
  }

  // Move to Trash
  async function handleConfirmTrash() {
    if (!confirmPost) return;
    setSaving(true);
    try {
      if (confirmPost.type === "trash" && confirmPost.post) {
        await movePostToTrash(confirmPost.post.id);
        showToast("success", `Moved "${confirmPost.post.title}" to Trash.`);
      } else if (confirmPost.type === "bulk_trash" && selectedIds.length > 0) {
        await bulkActionPosts({ action: "trash", post_ids: selectedIds });
        showToast("success", `Moved ${selectedIds.length} posts to Trash.`);
        setSelectedIds([]);
      }
      setConfirmPost(null);
      void loadPosts();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Action failed.");
    } finally {
      setSaving(false);
    }
  }

  // Bulk actions
  async function handleBulkAction(
    action: "publish" | "unpublish" | "trash",
  ) {
    if (selectedIds.length === 0) return;
    if (action === "trash") {
      setConfirmPost({ type: "bulk_trash" });
      return;
    }
    setSaving(true);
    try {
      const res = await bulkActionPosts({ action, post_ids: selectedIds });
      showToast("success", res.message);
      setSelectedIds([]);
      void loadPosts();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Bulk action failed.");
    } finally {
      setSaving(false);
    }
  }

  // Export CSV
  async function handleExport() {
    try {
      showToast("success", "Preparing CSV download...");
      await exportPostsCsv({
        search: search.trim() || undefined,
        status:
          mode === "drafts"
            ? "DRAFT"
            : mode === "published"
              ? "PUBLISHED"
              : statusFilter !== "ALL"
                ? statusFilter
                : undefined,
        category_id: categoryFilter !== "ALL" ? Number(categoryFilter) : undefined,
      });
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Export failed.");
    }
  }

  // Selection
  const allSelected =
    posts.length > 0 && posts.every((p) => selectedIds.includes(p.id));

  function toggleSelect(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(posts.map((p) => p.id));
    }
  }

  const pageTitle =
    mode === "drafts"
      ? "Draft Posts"
      : mode === "published"
        ? "Published Posts"
        : "All Posts";

  const pageSubtitle =
    mode === "drafts"
      ? "Manage and edit unfinished news drafts before publishing."
      : mode === "published"
        ? "Live news articles visible to Telugu Front readers."
        : "Complete overview and lifecycle management of news articles.";

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed right-6 top-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl transition-all duration-300 ${
            toast.type === "success" ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          {toast.type === "success" ? (
            <Check className="h-4 w-4" />
          ) : (
            <X className="h-4 w-4" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#10243D] sm:text-2xl">
            {pageTitle}
          </h1>
          <p className="mt-1 text-xs text-slate-500">{pageSubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            title="Export filtered posts to CSV"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => void loadPosts()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            title="Refresh list"
          >
            <RefreshCw
              className={`h-4 w-4 text-slate-500 ${loading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 rounded-lg bg-[#D9273B] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#b81f30]"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Post</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, summary, slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-[#10243D] placeholder-slate-400 outline-none transition focus:border-[#D9273B] focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-[#D9273B]"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter (only in 'all' mode) */}
          {mode === "all" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-[#D9273B]"
            >
              <option value="ALL">All Statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          )}

          {/* Page size */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-[#D9273B]"
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Bar (Visible when items selected) */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-[#EFF5FC] px-4 py-2.5 text-xs font-semibold text-[#10243D]">
          <span>{selectedIds.length} posts selected</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkAction("publish")}
              className="rounded-md bg-emerald-600 px-2.5 py-1 text-white hover:bg-emerald-700"
            >
              Publish Selected
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction("unpublish")}
              className="rounded-md bg-amber-600 px-2.5 py-1 text-white hover:bg-amber-700"
            >
              Unpublish Selected
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction("trash")}
              className="rounded-md bg-rose-600 px-2.5 py-1 text-white hover:bg-rose-700"
            >
              Move to Trash
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-slate-500 hover:text-slate-700"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Posts Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="border-b border-slate-100 bg-[#F8FAFD] text-slate-600">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-[#D9273B] focus:ring-[#D9273B]"
                  />
                </th>
                <th className="px-4 py-3 font-semibold">Article</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Author</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Flags</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[#D9273B]" />
                    <p className="mt-2 font-medium">Loading articles...</p>
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 font-medium text-slate-600">
                      No posts found
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {search
                        ? "Try adjusting your search or filters."
                        : "Click 'Create New Post' to publish your first article."}
                    </p>
                  </td>
                </tr>
              ) : (
                posts.map((post) => {
                  const isChecked = selectedIds.includes(post.id);
                  const isPublishing = actionId === post.id;

                  return (
                    <tr
                      key={post.id}
                      className={`transition-colors hover:bg-slate-50/70 ${
                        isChecked ? "bg-rose-50/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(post.id)}
                          className="h-4 w-4 rounded border-slate-300 text-[#D9273B] focus:ring-[#D9273B]"
                        />
                      </td>

                      <td className="max-w-[280px] px-4 py-3">
                        <div className="flex items-center gap-3">
                          {post.featured_image ? (
                            <img
                              src={post.featured_image}
                              alt=""
                              className="h-10 w-12 shrink-0 rounded-md object-cover"
                            />
                          ) : (
                            <div className="grid h-10 w-12 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-300">
                              <ImageOff className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p
                              className="truncate font-semibold text-[#10243D] hover:underline cursor-pointer"
                              onClick={() => handleOpenEdit(post)}
                              title={post.title}
                            >
                              {post.title}
                            </p>
                            <p className="truncate text-[10px] text-slate-400">
                              /{post.slug}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                        {post.category ? (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                            {post.category.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">Uncategorized</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {post.author?.display_name || "Admin"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            post.status === "PUBLISHED"
                              ? "bg-emerald-100 text-emerald-700"
                              : post.status === "DRAFT"
                                ? "bg-amber-100 text-amber-700"
                                : post.status === "SCHEDULED"
                                  ? "bg-sky-100 text-sky-700"
                                  : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {post.status}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {/* Featured toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleFeatured(post)}
                            title={
                              post.is_featured
                                ? "Featured article"
                                : "Click to mark as featured"
                            }
                            className={`rounded p-1 transition ${
                              post.is_featured
                                ? "text-amber-500 hover:text-amber-600"
                                : "text-slate-300 hover:text-slate-400"
                            }`}
                          >
                            <Star
                              className={`h-4 w-4 ${post.is_featured ? "fill-amber-500" : ""}`}
                            />
                          </button>

                          {/* Breaking news toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleBreaking(post)}
                            title={
                              post.is_breaking_news
                                ? "Breaking News"
                                : "Click to mark Breaking News"
                            }
                            className={`rounded p-1 transition ${
                              post.is_breaking_news
                                ? "text-rose-600 hover:text-rose-700"
                                : "text-slate-300 hover:text-slate-400"
                            }`}
                          >
                            <Zap
                              className={`h-4 w-4 ${post.is_breaking_news ? "fill-rose-600" : ""}`}
                            />
                          </button>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-[11px] text-slate-500">
                        {formatDate(
                          post.status === "PUBLISHED"
                            ? post.published_at
                            : post.created_at,
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Publish/Unpublish toggle */}
                          <button
                            type="button"
                            onClick={() => handleTogglePublish(post)}
                            disabled={isPublishing}
                            className={`rounded px-2 py-1 text-[10px] font-semibold transition ${
                              post.status === "PUBLISHED"
                                ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                            title={
                              post.status === "PUBLISHED"
                                ? "Unpublish to draft"
                                : "Publish article immediately"
                            }
                          >
                            {isPublishing
                              ? "..."
                              : post.status === "PUBLISHED"
                                ? "Unpublish"
                                : "Publish"}
                          </button>

                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(post)}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-[#10243D]"
                            title="Edit Post"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          {/* Duplicate button */}
                          <button
                            type="button"
                            onClick={() => handleDuplicate(post)}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-[#10243D]"
                            title="Duplicate as Draft"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>

                          {/* Move to Trash */}
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmPost({ type: "trash", post })
                            }
                            className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                            title="Move to Trash"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
          <p>
            Showing <span className="font-semibold">{posts.length}</span> of{" "}
            <span className="font-semibold">{total}</span> articles
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 px-3 py-1 font-semibold disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <span className="font-medium text-slate-700">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1 font-semibold disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* POST EDITOR MODAL                                                   */}
      {/* =================================================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-[#10243D]">
                  {editingPost ? "Edit News Article" : "Create New Post"}
                </h2>
                <p className="text-xs text-slate-400">
                  Fill in the article details, media, and lifecycle status.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={handleSubmit}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 text-xs"
            >
              {/* Title */}
              <div>
                <label className="block font-semibold text-[#10243D]">
                  Article Title <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Telangana Budget Session Highlights"
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-[#10243D] outline-none focus:border-[#D9273B]"
                />
              </div>

              {/* Category & Status Row */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-[#10243D]">
                    Category
                  </label>
                  <select
                    value={form.category_id}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        category_id: e.target.value,
                      }))
                    }
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-[#D9273B]"
                  >
                    <option value="">Select a Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#10243D]">
                    Lifecycle Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        status: e.target.value as PostStatus,
                      }))
                    }
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-[#D9273B]"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="SCHEDULED">Scheduled</option>
                  </select>
                </div>
              </div>

              {/* Scheduled Date (if SCHEDULED) */}
              {form.status === "SCHEDULED" && (
                <div>
                  <label className="block font-semibold text-[#10243D]">
                    Schedule Publication Time
                  </label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        scheduled_at: e.target.value,
                      }))
                    }
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-[#D9273B]"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    The article will remain scheduled until this time.
                  </p>
                </div>
              )}

              {/* Summary */}
              <div>
                <label className="block font-semibold text-[#10243D]">
                  Short Summary / Excerpt
                </label>
                <textarea
                  rows={2}
                  placeholder="A concise 1-2 sentence overview shown in feeds and social cards."
                  value={form.summary}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, summary: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-xs text-[#10243D] outline-none focus:border-[#D9273B]"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block font-semibold text-[#10243D]">
                  Main Content (HTML / Text)
                </label>
                <textarea
                  rows={6}
                  placeholder="Write full news article content..."
                  value={form.content}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, content: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 font-mono text-xs text-[#10243D] outline-none focus:border-[#D9273B]"
                />
              </div>

              {/* Featured Image */}
              <div>
                <label className="block font-semibold text-[#10243D]">
                  Featured Image
                </label>
                <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    placeholder="Image URL (or upload from your computer below)"
                    value={form.featured_image}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        featured_image: e.target.value,
                      }))
                    }
                    className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-[#D9273B]"
                  />

                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageFileChange}
                      className="hidden"
                      id="post-image-file"
                    />
                    <label
                      htmlFor="post-image-file"
                      className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      {uploadingImage ? (
                        <LoaderCircle className="h-4 w-4 animate-spin text-[#D9273B]" />
                      ) : (
                        <Upload className="h-4 w-4 text-slate-500" />
                      )}
                      <span>{uploadingImage ? "Uploading..." : "Upload File"}</span>
                    </label>
                  </div>
                </div>

                {form.featured_image && (
                  <div className="mt-2 flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
                    <img
                      src={form.featured_image}
                      alt="Preview"
                      className="h-14 w-20 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-slate-700">
                        {form.featured_image}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, featured_image: "" }))
                        }
                        className="mt-1 text-[11px] font-semibold text-rose-600 hover:underline"
                      >
                        Remove image
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Flags (Featured & Breaking News) */}
              <div className="flex flex-wrap items-center gap-6 rounded-lg border border-slate-100 bg-[#F8FAFD] p-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        is_featured: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#D9273B] focus:ring-[#D9273B]"
                  />
                  <span className="font-semibold text-slate-700">
                    Mark as Featured Article
                  </span>
                </label>

                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.is_breaking_news}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        is_breaking_news: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#D9273B] focus:ring-[#D9273B]"
                  />
                  <span className="font-semibold text-slate-700">
                    Mark as Breaking News
                  </span>
                </label>
              </div>

              {/* SEO Settings */}
              <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <p className="font-bold text-[#10243D]">SEO Metadata (Optional)</p>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    SEO Title
                  </label>
                  <input
                    type="text"
                    placeholder="Search engine optimized headline"
                    value={form.seo_title}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, seo_title: e.target.value }))
                    }
                    className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-[#D9273B]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    SEO Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Search engine snippet"
                    value={form.seo_description}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        seo_description: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 text-xs outline-none focus:border-[#D9273B]"
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-[#D9273B] px-5 py-2 font-semibold text-white shadow-sm hover:bg-[#b81f30] disabled:opacity-50"
                >
                  {saving && (
                    <LoaderCircle className="h-4 w-4 animate-spin text-white" />
                  )}
                  <span>
                    {saving
                      ? "Saving..."
                      : editingPost
                        ? "Save Changes"
                        : form.status === "PUBLISHED"
                          ? "Publish Article"
                          : "Save as Draft"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* CONFIRMATION DIALOG                                                 */}
      {/* =================================================================== */}
      {confirmPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-rose-100">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-[#10243D]">
                {confirmPost.type === "bulk_trash"
                  ? "Move Selected to Trash?"
                  : "Move Post to Trash?"}
              </h3>
            </div>

            <p className="mt-3 text-xs text-slate-500 leading-relaxed">
              {confirmPost.type === "bulk_trash"
                ? `Are you sure you want to move ${selectedIds.length} posts to Trash? You can restore them anytime from the Posts Trash.`
                : `Are you sure you want to move "${confirmPost.post?.title}" to Trash? You can restore it anytime.`}
            </p>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmPost(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmTrash}
                disabled={saving}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {saving ? "Moving..." : "Move to Trash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
