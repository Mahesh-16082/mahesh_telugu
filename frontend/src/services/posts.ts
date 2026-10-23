import api from "../lib/api";

/* =======================================================================
   TYPES
======================================================================= */

export type PostStatus = "DRAFT" | "PUBLISHED" | "SCHEDULED" | "ARCHIVED";

export interface AuthorSummary {
  id: number;
  display_name: string;
  email: string;
  role: string;
  image?: string | null;
}

export interface CategorySummary {
  id: number;
  name: string;
  slug: string;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  short_description: string | null;
  content: string;
  featured_image: string | null;
  featured_image_url: string | null;
  image_public_id: string | null;
  status: PostStatus;
  is_deleted: boolean;
  deleted_at: string | null;
  is_featured: boolean;
  is_breaking_news: boolean;
  seo_title: string | null;
  seo_description: string | null;
  author_id: number;
  author?: AuthorSummary | null;
  category_id: number | null;
  category?: CategorySummary | null;
  published_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostCreate {
  title: string;
  slug?: string;
  summary?: string;
  short_description?: string;
  content?: string;
  featured_image?: string;
  featured_image_url?: string;
  category_id?: number | null;
  status?: PostStatus;
  is_featured?: boolean;
  is_breaking_news?: boolean;
  seo_title?: string;
  seo_description?: string;
  scheduled_at?: string;
}

export interface PostDraftCreate {
  title: string;
  slug?: string;
  summary?: string;
  short_description?: string;
  content?: string;
  featured_image?: string;
  category_id?: number | null;
}

export type PostUpdate = Partial<PostCreate>;

export interface PostListResponse {
  items: Post[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PostStatusCounts {
  all: number;
  published: number;
  draft: number;
  trash: number;
  scheduled: number;
  archived: number;
}

export type PostBulkAction =
  | "trash"
  | "restore"
  | "permanent_delete"
  | "publish"
  | "unpublish"
  | "change_category";

export type BulkPostAction = PostBulkAction;

export interface PostBulkActionRequest {
  action: PostBulkAction;
  post_ids: number[];
  category_id?: number;
}

export interface PostBulkActionResult {
  action: string;
  success_count: number;
  failure_count: number;
  failed_ids: number[];
  message: string;
}

export interface PostListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: PostStatus | string;
  category_id?: number | string;
  author_id?: number | string;
  is_featured?: boolean | string;
  is_breaking_news?: boolean | string;
  trash?: boolean;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  sort_direction?: "asc" | "desc";
  start_date?: string;
  end_date?: string;
  created_from?: string;
  created_to?: string;
}

/* =======================================================================
   HELPERS
======================================================================= */

export function getPostStatusLabel(status: PostStatus | string): string {
  switch (status) {
    case "PUBLISHED":
      return "Published";
    case "DRAFT":
      return "Draft";
    case "SCHEDULED":
      return "Scheduled";
    case "ARCHIVED":
      return "Archived";
    default:
      return status ? String(status) : "Draft";
  }
}

export function getUserDisplayName(user?: AuthorSummary | null): string {
  if (!user) return "Telugu Front Editor";
  return user.display_name?.trim() || user.email || "Author";
}

export function getApiErrorMessage(
  error: unknown,
  fallback: string = "Something went wrong. Please try again.",
): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

/* =======================================================================
   API OPERATIONS
======================================================================= */

export async function getPosts(
  params: PostListParams = {},
): Promise<PostListResponse> {
  const response = await api.get<PostListResponse | Post[]>("/api/posts", {
    page: params.page,
    page_size: params.page_size,
    search: params.search,
    status: params.status,
    category_id: params.category_id !== "" ? params.category_id : undefined,
    author_id: params.author_id !== "" ? params.author_id : undefined,
    is_featured: params.is_featured !== "" ? params.is_featured : undefined,
    is_breaking_news:
      params.is_breaking_news !== "" ? params.is_breaking_news : undefined,
    trash: params.trash,
    sort_by: params.sort_by,
    sort_order: params.sort_order || params.sort_direction,
    start_date: params.start_date || params.created_from,
    end_date: params.end_date || params.created_to,
  });

  if (Array.isArray(response)) {
    return {
      items: response,
      total: response.length,
      page: params.page ?? 1,
      page_size: params.page_size ?? response.length,
      total_pages: 1,
    };
  }

  return response;
}

export function getPost(id: number): Promise<Post> {
  return api.get<Post>(`/api/posts/${id}`);
}

export function getPostBySlug(slug: string): Promise<Post> {
  return api.get<Post>(`/api/posts/slug/${slug}`);
}

export function createPost(payload: PostCreate): Promise<Post> {
  return api.post<Post>("/api/posts", payload);
}

export function createDraft(payload: PostDraftCreate): Promise<Post> {
  return api.post<Post>("/api/posts/drafts", payload);
}

export function updatePost(id: number, payload: PostUpdate): Promise<Post> {
  return api.patch<Post>(`/api/posts/${id}`, payload);
}

export function fullUpdatePost(id: number, payload: PostUpdate): Promise<Post> {
  return api.put<Post>(`/api/posts/${id}`, payload);
}

export function updateDraft(id: number, payload: PostUpdate): Promise<Post> {
  return api.patch<Post>(`/api/posts/drafts/${id}`, payload);
}

export function movePostToTrash(id: number): Promise<Post> {
  return api.delete<Post>(`/api/posts/${id}`);
}

export const trashPost = movePostToTrash;

export function restorePost(id: number): Promise<Post> {
  return api.post<Post>(`/api/posts/${id}/restore`);
}

export function permanentlyDeletePost(id: number): Promise<void> {
  return api.delete<void>(`/api/posts/${id}/permanent`);
}

export function publishPost(id: number): Promise<Post> {
  return api.post<Post>(`/api/posts/${id}/publish`);
}

export function unpublishPost(id: number): Promise<Post> {
  return api.post<Post>(`/api/posts/${id}/unpublish`);
}

export function schedulePost(
  id: number,
  scheduled_at: string,
): Promise<Post> {
  return api.post<Post>(`/api/posts/${id}/schedule`, { scheduled_at });
}

export function duplicatePost(id: number): Promise<Post> {
  return api.post<Post>(`/api/posts/${id}/duplicate`);
}

export function toggleFeatured(id: number): Promise<Post> {
  return api.post<Post>(`/api/posts/${id}/toggle-featured`);
}

export function toggleBreaking(id: number): Promise<Post> {
  return api.post<Post>(`/api/posts/${id}/toggle-breaking`);
}

export function bulkActionPosts(
  payload: PostBulkActionRequest,
): Promise<PostBulkActionResult> {
  return api.post<PostBulkActionResult>("/api/posts/bulk-action", payload);
}

export const runBulkPostAction = bulkActionPosts;

export function getStatusCounts(): Promise<PostStatusCounts> {
  return api.get<PostStatusCounts>("/api/posts/status-counts");
}

export const getPostStatusCounts = getStatusCounts;

export function getRecentPosts(limit: number = 5): Promise<Post[]> {
  return api.get<Post[]>("/api/posts/recent", { limit });
}

export function checkSlugAvailability(
  slug: string,
  excludePostId?: number,
): Promise<{ slug: string; available: boolean }> {
  return api.get<{ slug: string; available: boolean }>("/api/posts/check-slug", {
    slug,
    exclude_post_id: excludePostId,
  });
}

export async function uploadPostImage(
  file: File,
): Promise<{ image_url: string; public_id: string }> {
  const formData = new FormData();
  formData.append("image", file);
  return api.upload<{ image_url: string; public_id: string }>(
    "/api/posts/upload-image",
    formData,
  );
}

export async function exportPostsCsv(params: PostListParams = {}): Promise<void> {
  const blob = await api.download("/api/posts/export", {
    status: params.status,
    category_id: params.category_id,
    author_id: params.author_id,
    search: params.search,
    is_featured: params.is_featured,
    is_breaking_news: params.is_breaking_news,
    start_date: params.start_date || params.created_from,
    end_date: params.end_date || params.created_to,
  });

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `telugu_front_posts_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export const exportPosts = exportPostsCsv;
