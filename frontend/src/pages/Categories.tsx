import {
  ArrowDown,
  ArrowUp,
  ImageOff,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  X,
  Pencil,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent } from "react";

import {
  createCategory,
  getCategories,
  moveCategoryToTrash,
  reorderCategories,
  updateCategory,
} from "../services/categories";

import type {
  Category,
  CategoryCreate,
  CategoryStatus,
} from "../services/categories";

const NAVY = "#10243D";
const RED = "#C32632";
const PAGE_BG = "#F5F8FC";

type CategoryForm = {
  name: string;
  description: string;
  image_url: string;
  display_order: string;
  is_featured: boolean;
  status: CategoryStatus;
};

type Toast = {
  type: "success" | "error";
  message: string;
};

const EMPTY_FORM: CategoryForm = {
  name: "",
  description: "",
  image_url: "",
  display_order: "0",
  is_featured: false,
  status: "ACTIVE",
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | CategoryStatus
  >("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);

  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmCategory, setConfirmCategory] =
    useState<Category | null>(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);

    try {
      const response = await getCategories({
        page: 1,
        page_size: 100,
        trash: false,
      });

      setCategories(
        [...response.items].sort(
          (a, b) =>
            a.display_order - b.display_order ||
            a.name.localeCompare(b.name),
        ),
      );
    } catch (error) {
      setToast({
        type: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }, []);

    useEffect(() => {
    const timer = window.setTimeout(() => {
        void loadCategories();
    }, 0);

    return () => window.clearTimeout(timer);
    }, [loadCategories]);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(null), 4000);

    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();

    return categories.filter((category) => {
      const matchesSearch =
        !query ||
        category.name.toLowerCase().includes(query) ||
        (category.description || "").toLowerCase().includes(query) ||
        category.slug.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        category.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [categories, search, statusFilter]);

  const activeCount = categories.filter(
    (category) => category.status === "ACTIVE",
  ).length;

  const inactiveCount = categories.filter(
    (category) => category.status === "INACTIVE",
  ).length;

  const featuredCount = categories.filter(
    (category) => category.is_featured,
  ).length;

  function openCreateModal() {
    setEditingCategory(null);
    setForm({
      ...EMPTY_FORM,
      display_order: String(categories.length + 1),
    });
    setModalOpen(true);
  }

  function openEditModal(category: Category) {
    setEditingCategory(category);

    setForm({
      name: category.name,
      description: category.description || "",
      image_url: category.image_url || "",
      display_order: String(category.display_order),
      is_featured: category.is_featured,
      status: category.status,
    });

    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingCategory(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = form.name.trim();

    if (!name) {
      setToast({
        type: "error",
        message: "Please enter a category name.",
      });
      return;
    }

    const displayOrder = Number(form.display_order);

    if (
      !Number.isInteger(displayOrder) ||
      displayOrder < 0
    ) {
      setToast({
        type: "error",
        message: "Display order must be a non-negative integer.",
      });
      return;
    }

    const payload: CategoryCreate = {
      name,
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      display_order: displayOrder,
      is_featured: form.is_featured,
      status: form.status,
    };

    setSaving(true);

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, payload);
        setToast({
          type: "success",
          message: "Category updated successfully.",
        });
      } else {
        await createCategory(payload);
        setToast({
          type: "success",
          message: "Category created successfully.",
        });
      }

      setModalOpen(false);
      setEditingCategory(null);
      setForm(EMPTY_FORM);

      await loadCategories();
    } catch (error) {
      setToast({
        type: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(category: Category) {
    const nextStatus: CategoryStatus =
      category.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    setActionId(category.id);

    try {
      await updateCategory(category.id, {
        status: nextStatus,
      });

      setToast({
        type: "success",
        message: `${category.name} is now ${nextStatus.toLowerCase()}.`,
      });

      await loadCategories();
    } catch (error) {
      setToast({
        type: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setActionId(null);
    }
  }

  async function toggleFeatured(category: Category) {
    setActionId(category.id);

    try {
      await updateCategory(category.id, {
        is_featured: !category.is_featured,
      });

      setToast({
        type: "success",
        message: category.is_featured
          ? "Category removed from featured."
          : "Category marked as featured.",
      });

      await loadCategories();
    } catch (error) {
      setToast({
        type: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setActionId(null);
    }
  }

  async function moveCategory(
    category: Category,
    direction: -1 | 1,
  ) {
    const currentIndex = categories.findIndex(
      (item) => item.id === category.id,
    );

    const targetIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= categories.length
    ) {
      return;
    }

    const reordered = [...categories];

    [reordered[currentIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[currentIndex],
    ];

    const reorderPayload = reordered.map((item, index) => ({
      id: item.id,
      display_order: index + 1,
    }));

    setActionId(category.id);

    try {
      await reorderCategories(reorderPayload);

      setToast({
        type: "success",
        message: "Category order updated.",
      });

      await loadCategories();
    } catch (error) {
      setToast({
        type: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setActionId(null);
    }
  }

  async function handleMoveToTrash() {
    if (!confirmCategory) return;

    const category = confirmCategory;
    setActionId(category.id);

    try {
      await moveCategoryToTrash(category.id);

      setConfirmCategory(null);

      setToast({
        type: "success",
        message: `${category.name} moved to Trash.`,
      });

      await loadCategories();
    } catch (error) {
      setToast({
        type: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setActionId(null);
    }
  }

  return (
    <main
      className="min-h-screen space-y-6 p-4 sm:p-6 lg:p-8"
      style={{ backgroundColor: PAGE_BG }}
    >
      {/* Page heading */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div
          className="relative flex flex-col gap-5 px-6 py-7 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8"
          style={{ backgroundColor: NAVY }}
        >
          <div
            className="absolute -right-10 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
            style={{ backgroundColor: RED }}
          />

          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">
              Content management
            </p>

            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
              Categories
            </h1>

            <p className="mt-2 text-sm text-slate-300">
              Organize and manage categories across Telugu Front.
            </p>
          </div>

          <div className="relative flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadCategories()}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition hover:brightness-95"
              style={{ backgroundColor: RED }}
            >
              <Plus size={17} />
              Add Category
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Total categories",
              value: categories.length,
              icon: "layers",
            },
            {
              label: "Active",
              value: activeCount,
              icon: "active",
            },
            {
              label: "Inactive",
              value: inactiveCount,
              icon: "inactive",
            },
            {
              label: "Featured",
              value: featuredCount,
              icon: "featured",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-200 p-4"
              style={{ backgroundColor: PAGE_BG }}
            >
              <p className="text-sm font-medium text-slate-500">
                {item.label}
              </p>

              <p
                className="mt-2 text-3xl font-bold"
                style={{ color: NAVY }}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Search and filters */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, description, or slug..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-[#173B67] focus:ring-4 focus:ring-[#173B67]/10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              ["ALL", "ACTIVE", "INACTIVE"] as const
            ).map((status) => {
              const selected = statusFilter === status;

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className="rounded-lg border px-3.5 py-2.5 text-xs font-bold transition"
                  style={{
                    backgroundColor: selected ? NAVY : "#FFFFFF",
                    borderColor: selected ? NAVY : "#E2E8F0",
                    color: selected ? "#FFFFFF" : "#475569",
                  }}
                >
                  {status === "ALL"
                    ? "All categories"
                    : status === "ACTIVE"
                      ? "Active"
                      : "Inactive"}
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Showing{" "}
          <span className="font-semibold text-slate-800">
            {filteredCategories.length}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-slate-800">
            {categories.length}
          </span>{" "}
          categories
        </p>
      </section>

      {/* Categories table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              className="font-bold"
              style={{ color: NAVY }}
            >
              All Categories
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Use the arrows to change display order.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("ALL");
            }}
            className="self-start rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 sm:self-auto"
          >
            Clear filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-4">Order</th>
                <th className="px-5 py-4">Image</th>
                <th className="px-5 py-4">Category</th>
                <th className="px-5 py-4">Featured</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Created</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <LoaderCircle
                      size={28}
                      className="mx-auto animate-spin"
                      style={{ color: NAVY }}
                    />
                    <p className="mt-3 text-sm text-slate-500">
                      Loading categories...
                    </p>
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <Search
                      size={30}
                      className="mx-auto text-slate-300"
                    />
                    <h3 className="mt-3 font-bold text-slate-800">
                      No categories found
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Try changing your search or create a category.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCategories.map((category) => {
                  const originalIndex = categories.findIndex(
                    (item) => item.id === category.id,
                  );

                  const busy = actionId === category.id;

                  return (
                    <tr
                      key={category.id}
                      className="transition hover:bg-slate-50/80"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="w-6 text-sm font-bold text-slate-700">
                            {category.display_order}
                          </span>

                          <div className="flex flex-col">
                            <button
                              type="button"
                              title="Move up"
                              disabled={busy || originalIndex === 0}
                              onClick={() =>
                                void moveCategory(category, -1)
                              }
                              className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-25"
                            >
                              <ArrowUp size={14} />
                            </button>

                            <button
                              type="button"
                              title="Move down"
                              disabled={
                                busy ||
                                originalIndex === categories.length - 1
                              }
                              onClick={() =>
                                void moveCategory(category, 1)
                              }
                              className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-25"
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex h-14 w-20 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                          {category.image_url ? (
                            <img
                              src={category.image_url}
                              alt={category.name}
                              className="h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <ImageOff
                              size={20}
                              className="text-slate-400"
                            />
                          )}
                        </div>
                      </td>

                      <td className="max-w-sm px-5 py-4">
                        <p className="font-semibold text-slate-800">
                          {category.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          /{category.slug}
                        </p>
                        {category.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {category.description}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void toggleFeatured(category)}
                          title={
                            category.is_featured
                              ? "Remove featured status"
                              : "Mark as featured"
                          }
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                            category.is_featured
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          <Star
                            size={14}
                            className={
                              category.is_featured ? "fill-current" : ""
                            }
                          />
                          {category.is_featured ? "Featured" : "No"}
                        </button>
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void toggleStatus(category)}
                          className={`rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                            category.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                          title="Click to change status"
                        >
                          {category.status}
                        </button>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-500">
                        {formatDate(category.created_at)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openEditModal(category)}
                            title="Edit category"
                            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setConfirmCategory(category)}
                            title="Move to Trash"
                            className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            {busy ? (
                              <LoaderCircle
                                size={17}
                                className="animate-spin"
                              />
                            ) : (
                              <Trash2 size={17} />
                            )}
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
      </section>

      {/* Create/edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <header
              className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 px-6 py-5"
              style={{ backgroundColor: "#FFFFFF" }}
            >
              <div>
                <h2
                  className="text-xl font-bold"
                  style={{ color: NAVY }}
                >
                  {editingCategory ? "Edit Category" : "Add Category"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter the category details below.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleSave} className="space-y-5 p-6">
              <div>
                <label
                  htmlFor="category-name"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Category name <span className="text-red-600">*</span>
                </label>
                <input
                  id="category-name"
                  required
                  maxLength={255}
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Andhra Pradesh"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none transition focus:border-[#173B67] focus:ring-4 focus:ring-[#173B67]/10"
                />
              </div>

              <div>
                <label
                  htmlFor="category-description"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Description
                </label>
                <textarea
                  id="category-description"
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Describe this category..."
                  className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-[#173B67] focus:ring-4 focus:ring-[#173B67]/10"
                />
              </div>

              <div>
                <label
                  htmlFor="category-image"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Image URL
                </label>
                <input
                  id="category-image"
                  type="url"
                  value={form.image_url}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      image_url: event.target.value,
                    }))
                  }
                  placeholder="https://example.com/category-image.jpg"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none transition focus:border-[#173B67] focus:ring-4 focus:ring-[#173B67]/10"
                />
                {form.image_url.trim() && (
                  <div className="mt-3 flex items-center gap-3">
                    <img
                      src={form.image_url}
                      alt="Category preview"
                      className="h-16 w-24 rounded-lg border border-slate-200 object-cover"
                    />
                    <span className="text-xs text-slate-500">
                      Image preview
                    </span>
                  </div>
                )}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="category-order"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Display order
                  </label>
                  <input
                    id="category-order"
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={form.display_order}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        display_order: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none transition focus:border-[#173B67] focus:ring-4 focus:ring-[#173B67]/10"
                  />
                </div>

                <div>
                  <label
                    htmlFor="category-status"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Status
                  </label>
                  <select
                    id="category-status"
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as CategoryStatus,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none transition focus:border-[#173B67] focus:ring-4 focus:ring-[#173B67]/10"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      is_featured: event.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#C32632]"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">
                    Featured category
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Mark this category as featured for use by the frontend
                    or other supported views.
                  </span>
                </span>
              </label>

              <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: RED }}
                >
                  {saving && (
                    <LoaderCircle size={16} className="animate-spin" />
                  )}
                  {saving
                    ? "Saving..."
                    : editingCategory
                      ? "Save Changes"
                      : "Create Category"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {/* Move-to-Trash confirmation */}
      {confirmCategory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="trash-dialog-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-red-600">
              <Trash2 size={22} />
            </div>

            <h2
              id="trash-dialog-title"
              className="mt-4 text-lg font-bold text-slate-900"
            >
              Move category to Trash?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Move <strong>{confirmCategory.name}</strong> to Trash? You can
              restore it later from Deleted Categories.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmCategory(null)}
                disabled={actionId !== null}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleMoveToTrash()}
                disabled={actionId !== null}
                className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white hover:brightness-95 disabled:opacity-60"
                style={{ backgroundColor: RED }}
              >
                {actionId !== null && (
                  <LoaderCircle size={15} className="animate-spin" />
                )}
                Move to Trash
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Notifications */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-[80] flex max-w-md items-start gap-3 rounded-xl border p-4 shadow-xl ${
            toast.type === "success"
              ? "border-emerald-200 bg-white text-emerald-800"
              : "border-red-200 bg-white text-red-800"
          }`}
        >
          <span className="flex-1 text-sm font-semibold">
            {toast.message}
          </span>

          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded p-0.5 hover:bg-slate-100"
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </main>
  );
}