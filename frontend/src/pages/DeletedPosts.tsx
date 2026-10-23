import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Check,
  ImageOff,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  bulkActionPosts,
  getPosts,
  permanentlyDeletePost,
  restorePost,
} from "../services/posts";
import type { Post } from "../services/posts";

type ConfirmAction =
  | { type: "restore"; post?: Post }
  | { type: "bulk_restore" }
  | { type: "delete"; post?: Post }
  | { type: "bulk_delete" }
  | null;

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

export default function DeletedPosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = useCallback(
    (type: "success" | "error", message: string) => {
      setToast({ type, message });
      window.setTimeout(() => setToast(null), 4000);
    },
    [],
  );

  const loadDeletedPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPosts({
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        trash: true,
        sort_by: "deleted_at",
        sort_order: "desc",
      });
      setPosts(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Unable to load deleted posts.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDeletedPosts();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [loadDeletedPosts]);

  const allSelected =
    posts.length > 0 && posts.every((p) => selectedIds.includes(p.id));

  function toggleSelected(id: number) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(posts.map((p) => p.id));
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;
    setActionLoading(true);

    try {
      if (confirmAction.type === "restore" && confirmAction.post) {
        await restorePost(confirmAction.post.id);
        showToast("success", `Restored "${confirmAction.post.title}".`);
      } else if (confirmAction.type === "delete" && confirmAction.post) {
        await permanentlyDeletePost(confirmAction.post.id);
        showToast(
          "success",
          `Permanently deleted "${confirmAction.post.title}".`,
        );
      } else if (confirmAction.type === "bulk_restore" && selectedIds.length > 0) {
        const res = await bulkActionPosts({
          action: "restore",
          post_ids: selectedIds,
        });
        showToast("success", res.message);
        setSelectedIds([]);
      } else if (confirmAction.type === "bulk_delete" && selectedIds.length > 0) {
        const res = await bulkActionPosts({
          action: "permanent_delete",
          post_ids: selectedIds,
        });
        showToast("success", res.message);
        setSelectedIds([]);
      }

      setConfirmAction(null);
      void loadDeletedPosts();
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Action could not be completed.",
      );
    } finally {
      setActionLoading(false);
    }
  }

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

      {/* Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#10243D] sm:text-2xl">
              Deleted Posts
            </h1>
            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-600">
              {total} in Trash
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Soft-deleted articles can be restored or permanently removed by administrators.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadDeletedPosts()}
          disabled={loading}
          className="flex items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 text-slate-500 ${loading ? "animate-spin" : ""}`}
          />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search and Bulk Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search deleted posts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-[#10243D] placeholder-slate-400 outline-none transition focus:border-[#D9273B] focus:bg-white"
          />
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">
              {selectedIds.length} selected
            </span>
            <button
              type="button"
              onClick={() => setConfirmAction({ type: "bulk_restore" })}
              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restore</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction({ type: "bulk_delete" })}
              className="flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Permanently</span>
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-xs">
            <thead className="border-b border-slate-100 bg-[#F8FAFD] text-slate-600">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-300 text-[#D9273B] focus:ring-[#D9273B]"
                  />
                </th>
                <th className="px-4 py-3 font-semibold">Article</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Status Before Delete</th>
                <th className="px-4 py-3 font-semibold">Deleted At</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[#D9273B]" />
                    <p className="mt-2 font-medium">Loading trash...</p>
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Archive className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 font-medium text-slate-600">
                      Trash is empty
                    </p>
                    <p className="text-[11px] text-slate-400">
                      No deleted articles found.
                    </p>
                  </td>
                </tr>
              ) : (
                posts.map((post) => {
                  const isChecked = selectedIds.includes(post.id);

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
                          onChange={() => toggleSelected(post.id)}
                          className="h-4 w-4 rounded border-slate-300 text-[#D9273B] focus:ring-[#D9273B]"
                        />
                      </td>

                      <td className="max-w-[280px] px-4 py-3">
                        <div className="flex items-center gap-3">
                          {post.featured_image ? (
                            <img
                              src={post.featured_image}
                              alt=""
                              className="h-10 w-12 shrink-0 rounded-md object-cover opacity-75"
                            />
                          ) : (
                            <div className="grid h-10 w-12 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-300">
                              <ImageOff className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p
                              className="truncate font-semibold text-[#10243D]"
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

                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {post.status}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-[11px] text-slate-500">
                        {formatDate(post.deleted_at || post.updated_at)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmAction({ type: "restore", post })
                            }
                            className="flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                            title="Restore article"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Restore</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setConfirmAction({ type: "delete", post })
                            }
                            className="flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                            title="Permanently remove from database"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Delete</span>
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
            <span className="font-semibold">{total}</span> deleted articles
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

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div
                className={`grid h-10 w-10 place-items-center rounded-full ${
                  confirmAction.type.includes("delete")
                    ? "bg-rose-100 text-rose-600"
                    : "bg-emerald-100 text-emerald-600"
                }`}
              >
                {confirmAction.type.includes("delete") ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <RotateCcw className="h-5 w-5" />
                )}
              </div>
              <h3 className="text-base font-bold text-[#10243D]">
                {confirmAction.type === "restore"
                  ? "Restore News Article?"
                  : confirmAction.type === "bulk_restore"
                    ? `Restore ${selectedIds.length} Articles?`
                    : confirmAction.type === "delete"
                      ? "Permanently Delete Article?"
                      : `Permanently Delete ${selectedIds.length} Articles?`}
              </h3>
            </div>

            <p className="mt-3 text-xs text-slate-500 leading-relaxed">
              {confirmAction.type === "restore"
                ? `Restore "${confirmAction.post?.title}" back to active articles.`
                : confirmAction.type === "bulk_restore"
                  ? `Restore ${selectedIds.length} selected articles back to active news.`
                  : confirmAction.type === "delete"
                    ? `Are you sure you want to permanently delete "${confirmAction.post?.title}"? This action CANNOT be undone and will delete the database record and uploaded image.`
                    : `Are you sure you want to permanently delete ${selectedIds.length} selected articles? This cannot be undone.`}
            </p>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                  confirmAction.type.includes("delete")
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {actionLoading
                  ? "Processing..."
                  : confirmAction.type.includes("delete")
                    ? "Delete Permanently"
                    : "Restore"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
