import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Check,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { Category } from "../services/categories";
import {
  getCategories,
  restoreCategory,
  permanentlyDeleteCategory,
} from "../services/categories";

type ConfirmAction =
  | { type: "restore"; categories: Category[] }
  | { type: "delete"; categories: Category[] }
  | null;

const NAVY = "#10243D";
const RED = "#C32632";

export default function DeletedCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDeletedCategories = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");

    try {
      const response = await getCategories({
        page: 1,
        page_size: 100,
        trash: true,
      });

      setCategories(
        response.items.filter((category) => category.is_deleted),
      );
      setSelectedIds([]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load deleted categories.",
      );
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
        void loadDeletedCategories();
    }, 0);

    return () => window.clearTimeout(timer);
    }, [loadDeletedCategories]);

  const filteredCategories = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return categories;

    return categories.filter((category) =>
      [
        category.name,
        category.slug,
        category.description ?? "",
      ].some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [categories, search]);

  const allSelected =
    filteredCategories.length > 0 &&
    filteredCategories.every((category) =>
      selectedIds.includes(category.id),
    );

  function toggleSelected(id: number) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }

  function toggleAll() {
    if (allSelected) {
      const visibleIds = new Set(
        filteredCategories.map((category) => category.id),
      );
      setSelectedIds((current) =>
        current.filter((id) => !visibleIds.has(id)),
      );
    } else {
      setSelectedIds((current) =>
        Array.from(
          new Set([
            ...current,
            ...filteredCategories.map((category) => category.id),
          ]),
        ),
      );
    }
  }

  async function performAction() {
    if (!confirmAction || actionLoading) return;

    const action = confirmAction;
    setActionLoading(true);
    setError("");
    setNotice("");
    setConfirmAction(null);

    try {
      const results = await Promise.allSettled(
        action.categories.map((category) =>
          action.type === "restore"
            ? restoreCategory(category.id)
            : permanentlyDeleteCategory(category.id),
        ),
      );

      const succeeded = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failed = results.length - succeeded;

      if (succeeded > 0) {
        const verb = action.type === "restore" ? "restored" : "permanently deleted";
        setNotice(
          `${succeeded} categor${succeeded === 1 ? "y" : "ies"} ${verb} successfully.`,
        );
      }

      if (failed > 0) {
        const firstFailure = results.find(
          (result) => result.status === "rejected",
        );

        setError(
          firstFailure?.status === "rejected" &&
            firstFailure.reason instanceof Error
            ? firstFailure.reason.message
            : `Unable to complete ${failed} action(s).`,
        );
      }

      await loadDeletedCategories(false);
    } finally {
      setActionLoading(false);
    }
  }

  const confirmCategories = confirmAction?.categories ?? [];
  const isRestore = confirmAction?.type === "restore";

  return (
    <div className="space-y-5 pb-8">
      {/* Page header */}
      <section className="relative overflow-hidden rounded-2xl bg-[#10243D] p-6 text-white shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-[#C32632]/25 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-200">
              Content management
            </p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
              Deleted Categories
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              Review deleted categories, restore them, or permanently remove
              categories you no longer need.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadDeletedCategories()}
            disabled={loading || actionLoading}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>

      {/* Summary cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Deleted categories</p>
          <p className="mt-2 text-2xl font-bold text-[#10243D]">
            {categories.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Search results</p>
          <p className="mt-2 text-2xl font-bold text-[#10243D]">
            {filteredCategories.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Selected</p>
          <p className="mt-2 text-2xl font-bold text-[#10243D]">
            {selectedIds.length}
          </p>
        </div>
      </section>

      {/* Notifications */}
      {notice && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          <Check size={18} className="mt-0.5 shrink-0" />
          <p className="flex-1">{notice}</p>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <p className="flex-1">{error}</p>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search and bulk actions */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search category name, slug, or description..."
              aria-label="Search deleted categories"
              className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-[#10243D] focus:bg-white"
            />
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  setConfirmAction({
                    type: "restore",
                    categories: categories.filter((category) =>
                      selectedIds.includes(category.id),
                    ),
                  })
                }
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#10243D] px-3 text-sm font-semibold text-white hover:bg-[#19385D] disabled:opacity-50"
              >
                <RotateCcw size={15} />
                Restore selected
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  setConfirmAction({
                    type: "delete",
                    categories: categories.filter((category) =>
                      selectedIds.includes(category.id),
                    ),
                  })
                }
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#C32632] px-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 size={15} />
                Delete permanently
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Deleted categories table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-4 sm:px-5">
          <h2 className="font-bold text-[#10243D]">Trash</h2>
          <p className="text-sm text-slate-500">
            {filteredCategories.length} deleted{" "}
            {filteredCategories.length === 1 ? "category" : "categories"}
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-slate-500">
            <LoaderCircle size={30} className="animate-spin text-[#C32632]" />
            <p className="text-sm">Loading deleted categories...</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
            <Archive size={36} className="text-slate-300" />
            <h3 className="mt-3 font-bold text-[#10243D]">
              {search ? "No matching categories" : "Trash is empty"}
            </h3>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              {search
                ? "Try another search term."
                : "Categories moved to Trash will appear here."}
            </p>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-3 text-sm font-semibold text-[#C32632] hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all matching categories"
                      className="h-4 w-4 accent-[#C32632]"
                    />
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Category
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Slug
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCategories.map((category) => (
                  <tr key={category.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(category.id)}
                        onChange={() => toggleSelected(category.id)}
                        aria-label={`Select ${category.name}`}
                        className="h-4 w-4 accent-[#C32632]"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-[#10243D]">
                        {category.name}
                      </p>
                      {category.description && (
                        <p className="mt-1 max-w-sm truncate text-xs text-slate-500">
                          {category.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {category.slug}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                        Deleted
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() =>
                            setConfirmAction({
                              type: "restore",
                              categories: [category],
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#10243D] hover:bg-slate-50 disabled:opacity-50"
                        >
                          <RotateCcw size={14} />
                          Restore
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() =>
                            setConfirmAction({
                              type: "delete",
                              categories: [category],
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-[#C32632] hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Confirmation dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-confirm-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div
              className={`grid h-12 w-12 place-items-center rounded-xl ${
                isRestore ? "bg-slate-100 text-[#10243D]" : "bg-red-50 text-[#C32632]"
              }`}
            >
              {isRestore ? <RotateCcw size={22} /> : <Trash2 size={22} />}
            </div>

            <h2
              id="category-confirm-title"
              className="mt-4 text-lg font-bold text-[#10243D]"
            >
              {isRestore ? "Restore categories?" : "Delete permanently?"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {isRestore
                ? `Restore ${confirmCategories.length} selected ${
                    confirmCategories.length === 1 ? "category" : "categories"
                  } to the active list?`
                : `Permanently delete ${confirmCategories.length} selected ${
                    confirmCategories.length === 1 ? "category" : "categories"
                  }? This action cannot be undone.`}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void performAction()}
                disabled={actionLoading}
                className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: isRestore ? NAVY : RED }}
              >
                {actionLoading && (
                  <LoaderCircle size={15} className="animate-spin" />
                )}
                {isRestore ? "Restore" : "Delete permanently"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
