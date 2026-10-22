import api from "../lib/api";

/* =========================
   TYPES
========================= */

export type CategoryStatus = "ACTIVE" | "INACTIVE";

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_featured: boolean;
  display_order: number;
  status: CategoryStatus;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryCreate {
  name: string;
  slug?: string;
  description?: string | null;
  image_url?: string | null;
  is_featured?: boolean;
  display_order?: number;
  status?: CategoryStatus;
}

export type CategoryUpdate = Partial<CategoryCreate>;

export interface CategoryListResponse {
  items: Category[];
  total: number;
  page: number;
  page_size: number;
}

/* =========================
   API OPERATIONS
========================= */

export interface CategoryListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: CategoryStatus;
  trash?: boolean;
}

export async function getCategories(
  params: CategoryListParams = {},
): Promise<CategoryListResponse> {
  const response = await api.get<CategoryListResponse | Category[]>(
    "/api/categories",
    {
      page: params.page,
      page_size: params.page_size,
      search: params.search,
      status: params.status,
      trash: params.trash,
    },
  );

  if (Array.isArray(response)) {
    return {
      items: response,
      total: response.length,
      page: params.page ?? 1,
      page_size: params.page_size ?? response.length,
    };
  }

  return response;
}

export function getCategory(id: number): Promise<Category> {
  return api.get<Category>(`/api/categories/${id}`);
}

export function createCategory(
  payload: CategoryCreate,
): Promise<Category> {
  return api.post<Category>("/api/categories", payload);
}

export function updateCategory(
  id: number,
  payload: CategoryUpdate,
): Promise<Category> {
  return api.patch<Category>(`/api/categories/${id}`, payload);
}

export function moveCategoryToTrash(
  id: number,
): Promise<Category> {
  return api.delete<Category>(`/api/categories/${id}`);
}

export function restoreCategory(
  id: number,
): Promise<Category> {
  return api.post<Category>(`/api/categories/${id}/restore`);
}

export function permanentlyDeleteCategory(
  id: number,
): Promise<void> {
  return api.delete<void>(`/api/categories/${id}/permanent`);
}

export interface CategoryReorderItem {
  id: number;
  display_order: number;
}

export function reorderCategories(
  categories: CategoryReorderItem[],
): Promise<{ message: string }> {
  return api.post<{ message: string }>("/api/categories/reorder", {
    categories,
  });
}