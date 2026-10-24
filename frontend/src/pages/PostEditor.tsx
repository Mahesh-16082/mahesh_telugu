import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  ChangeEvent,
  FormEvent,
} from "react";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Cloud,
  CloudOff,
  ImageOff,
  ImagePlus,
  Loader2,
  LogOut,
  Save,
  Send,
  Smartphone,
  Star,
  Upload,
  X,
  Zap,
} from "lucide-react";

import {
  createDraft,
  createPost,
  getApiErrorMessage,
  getPost,
  updatePost,
  uploadPostImage,
} from "../services/posts";
import type {
  Post,
  PostCreate,
  PostStatus,
  PostUpdate,
} from "../services/posts";
import { getCategories } from "../services/categories";
import type { Category } from "../services/categories";

const TITLE_MAX_LENGTH = 255;
const DESCRIPTION_MAX_LENGTH = 500;

type PostEditorProps = {
  postId?: number | null;
  onBack: () => void;
  onPreview?: (post: Post) => void;
  onSaved?: (post: Post) => void;
};

type FormState = {
  title: string;
  slug: string;
  summary: string;
  content: string;
  category_id: number | null;
  featured_image: string;
  status: PostStatus;
  is_featured: boolean;
  is_breaking_news: boolean;
  seo_title: string;
  seo_description: string;
  scheduled_at: string;
};

const BLANK_FORM: FormState = {
  title: "",
  slug: "",
  summary: "",
  content: "",
  category_id: null,
  featured_image: "",
  status: "DRAFT",
  is_featured: false,
  is_breaking_news: false,
  seo_title: "",
  seo_description: "",
  scheduled_at: "",
};

export default function PostEditor({
  postId,
  onBack,
  onPreview,
  onSaved,
}: PostEditorProps) {
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentPost, setCurrentPost] = useState<Post | null>(null);

  const [loading, setLoading] = useState<boolean>(Boolean(postId));
  const [pageError, setPageError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [confirmLeave, setConfirmLeave] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDirtyRef = useRef<boolean>(false);
  const formRef = useRef<FormState>(BLANK_FORM);
  formRef.current = form;

  const showToast = useCallback(
    (type: "success" | "error", message: string) => {
      setToast({ type, message });
      window.setTimeout(() => setToast(null), 3500);
    },
    [],
  );

  // Load Categories
  useEffect(() => {
    let cancelled = false;
    async function fetchCategories() {
      try {
        const res = await getCategories({ page: 1, page_size: 100 });
        if (!cancelled) {
          setCategories(res.items.filter((c) => !c.is_deleted));
        }
      } catch {
        // Fallback
      }
    }
    void fetchCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load Existing Post if editing
  useEffect(() => {
    if (!postId) {
      setForm(BLANK_FORM);
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function loadPostDetails() {
      setLoading(true);
      setPageError(null);
      try {
        const post = await getPost(postId!);
        if (cancelled) return;
        setCurrentPost(post);
        setForm({
          title: post.title,
          slug: post.slug,
          summary: post.summary || post.short_description || "",
          content: post.content || "",
          category_id: post.category_id,
          featured_image: post.featured_image || post.featured_image_url || "",
          status: post.status,
          is_featured: post.is_featured,
          is_breaking_news: post.is_breaking_news,
          seo_title: post.seo_title || "",
          seo_description: post.seo_description || "",
          scheduled_at: post.scheduled_at
            ? new Date(post.scheduled_at).toISOString().slice(0, 16)
            : "",
        });
      } catch (err) {
        if (!cancelled) {
          setPageError(getApiErrorMessage(err, "Failed to load article details."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPostDetails();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    isDirtyRef.current = true;
  }

  // Handle Image Upload to Cloudinary
  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const res = await uploadPostImage(file);
      setField("featured_image", res.image_url);
      showToast("success", "Featured image uploaded successfully.");
    } catch (err) {
      showToast(
        "error",
        getApiErrorMessage(err, "Image upload failed. Allowed types: JPEG, PNG, WebP."),
      );
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Save as Draft
  const saveAsDraft = useCallback(
    async (silent: boolean = false) => {
      const current = formRef.current;
      if (!current.title.trim()) {
        if (!silent) showToast("error", "Please provide a title to save a draft.");
        return null;
      }

      setSaveState("saving");
      try {
        const payload: PostUpdate = {
          title: current.title.trim(),
          slug: current.slug.trim() || undefined,
          summary: current.summary.trim() || undefined,
          content: current.content,
          category_id: current.category_id,
          featured_image: current.featured_image.trim() || undefined,
          status: "DRAFT",
          is_featured: current.is_featured,
          is_breaking_news: current.is_breaking_news,
          seo_title: current.seo_title.trim() || undefined,
          seo_description: current.seo_description.trim() || undefined,
        };

        let saved: Post;
        if (currentPost?.id) {
          saved = await updatePost(currentPost.id, payload);
        } else {
          saved = await createDraft({
            title: current.title.trim(),
            slug: current.slug.trim() || undefined,
            summary: current.summary.trim() || undefined,
            content: current.content,
            category_id: current.category_id,
            featured_image: current.featured_image.trim() || undefined,
          });
          setCurrentPost(saved);
        }

        setLastSaved(new Date());
        setSaveState("saved");
        isDirtyRef.current = false;
        if (!silent) showToast("success", "Draft saved successfully.");
        if (onSaved) onSaved(saved);
        return saved;
      } catch (err) {
        setSaveState("error");
        if (!silent) {
          showToast("error", getApiErrorMessage(err, "Failed to save draft."));
        }
        return null;
      }
    },
    [currentPost, onSaved, showToast],
  );

  // Autosave timer after 5 seconds of inactivity
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (isDirtyRef.current && formRef.current.title.trim() && saveState !== "saving") {
        void saveAsDraft(true);
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [saveAsDraft, saveState]);

  // Publish / Schedule / Update
 
  async function handlePublishSubmit(event: FormEvent) {
    event.preventDefault();

    // Validate all required fields before creating or updating a post.
    if (!form.title.trim()) {
      showToast("error", "Article headline is required.");
      return;
    }

    if (!form.category_id) {
      showToast("error", "Please select a category.");
      return;
    }

    if (!form.summary.trim()) {
      showToast("error", "Short Summary / Excerpt is required.");
      return;
    }

    if (!form.featured_image.trim()) {
      showToast("error", "Please upload a cover image or enter an image URL.");
      return;
    }

    if (form.status === "SCHEDULED" && !form.scheduled_at) {
      showToast("error", "Please select a scheduled publication date and time.");
      return;
    }

    setPublishing(true);
    setPageError(null);

    try {
      // When editing a published post, the primary action unpublishes it.
      const isUnpublishing =
        Boolean(currentPost?.id) &&
        currentPost?.status === "PUBLISHED" &&
        form.status === "PUBLISHED";

      const targetStatus: PostStatus = isUnpublishing
        ? "DRAFT"
        : form.status === "SCHEDULED"
          ? "SCHEDULED"
          : "PUBLISHED";

      const payload: PostCreate = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        summary: form.summary.trim() || undefined,
        content: form.content,
        category_id: form.category_id,
        featured_image: form.featured_image.trim() || undefined,
        status: targetStatus,
        is_featured: form.is_featured,
        is_breaking_news: form.is_breaking_news,
        seo_title: form.seo_title.trim() || undefined,
        seo_description: form.seo_description.trim() || undefined,
        scheduled_at:
          targetStatus === "SCHEDULED" && form.scheduled_at
            ? new Date(form.scheduled_at).toISOString()
            : undefined,
      };

      let result: Post;
      if (currentPost?.id) {
        result = await updatePost(currentPost.id, payload);
      } else {
        result = await createPost(payload);
      }

      isDirtyRef.current = false;
      showToast(
        "success",
        targetStatus === "DRAFT"
          ? "Story unpublished successfully."
          : targetStatus === "SCHEDULED"
            ? "Story scheduled successfully."
            : "Story published to Telugu Front.",
      );
      if (onSaved) onSaved(result);
      setTimeout(() => onBack(), 700);
    } catch (err) {
      const msg = getApiErrorMessage(err, "Publication failed.");
      setPageError(msg);
      showToast("error", msg);
    } finally {
      setPublishing(false);
    }
  }

  function handleBackClick() {
    if (isDirtyRef.current) {
      setConfirmLeave(true);
    } else {
      onBack();
    }
  }

  const titleLength = form.title.length;
  const descriptionLength = form.summary.length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#D9273B]" />
          <p className="mt-3 text-sm font-semibold text-slate-500">
            Loading editor...
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handlePublishSubmit} className="space-y-5 pb-10">
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
          {toast.type === "success" ? (
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          ) : (
            <CloudOff size={18} className="shrink-0 text-rose-600" />
          )}
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

      {/* Confirmation Dialog for Unsaved Changes */}
      {confirmLeave && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-700">
                <LogOut size={22} strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#10243D]">
                  Unsaved Changes
                </h3>
                <p className="text-xs text-slate-500">
                  You have unsaved changes in your article.
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              Do you want to save your progress as a draft before leaving, or discard changes?
            </p>

            <div className="mt-6 flex flex-wrap justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmLeave(false);
                  onBack();
                }}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                Discard & Leave
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmLeave(false);
                  await saveAsDraft(false);
                  onBack();
                }}
                className="rounded-xl bg-[#D9273B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#b81f30]"
              >
                Save Draft & Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
       * TOP HEADER BAR
       * ======================================================= */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center">
        <button
          type="button"
          onClick={handleBackClick}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 hover:text-[#10243D]"
        >
          <ArrowLeft size={16} />
          <span>Back to Posts</span>
        </button>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D9273B]">
            Telugu Front Newsroom
          </p>
          <h1 className="text-xl font-bold text-[#10243D] sm:text-2xl">
            {postId ? "Edit News Story" : "Create News Story"}
          </h1>

          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            {saveState === "saving" ? (
              <>
                <Cloud size={14} className="animate-pulse text-[#D9273B]" />
                <span>Saving draft…</span>
              </>
            ) : saveState === "saved" ? (
              <>
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>
                  Draft saved{" "}
                  {lastSaved &&
                    `at ${lastSaved.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`}
                </span>
              </>
            ) : saveState === "error" ? (
              <>
                <CloudOff size={14} className="text-rose-600" />
                <span className="text-rose-600">Autosave failed</span>
              </>
            ) : (
              <>
                <Cloud size={14} className="text-slate-400" />
                <span>Changes autosave after 5 seconds</span>
              </>
            )}
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          {currentPost && onPreview && (
            <button
              type="button"
              onClick={() => onPreview(currentPost)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <Smartphone size={16} className="text-[#D9273B]" />
              <span>Mobile Preview</span>
            </button>
          )}

          <button
            type="button"
            disabled={saveState === "saving" || publishing}
            onClick={() => void saveAsDraft(false)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {saveState === "saving" ? (
              <Loader2 size={15} className="animate-spin text-[#D9273B]" />
            ) : (
              <Save size={15} className="text-slate-600" />
            )}
            <span>Save as Draft</span>
          </button>

          <button
            type="submit"
            disabled={publishing || saveState === "saving"}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#D9273B] px-5 text-xs font-bold text-white shadow-md transition hover:bg-[#b81f30] disabled:opacity-50"
          >
            {publishing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            <span>
              {publishing
                ? "Processing…"
                : currentPost?.status === "PUBLISHED" &&
                    form.status === "PUBLISHED"
                  ? "Unpublish"
                  : form.status === "SCHEDULED"
                    ? "Schedule Story"
                    : "Publish Story"}
            </span>
          </button>
        </div>
      </div>

      {pageError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {pageError}
        </div>
      )}

      {/* =======================================================
       * 2-COLUMN MAIN LAYOUT
       * ======================================================= */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* LEFT COLUMN: ARTICLE CONTENT */}
        <div className="space-y-5">
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {/* Title / Headline */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-bold text-[#10243D]">
                  Article Headline <span className="text-rose-600">*</span>
                </label>
                <span
                  className={`text-[11px] font-semibold ${
                    titleLength >= TITLE_MAX_LENGTH
                      ? "text-rose-600 font-bold"
                      : titleLength >= 100
                        ? "text-amber-600"
                        : "text-slate-400"
                  }`}
                >
                  {titleLength} / {TITLE_MAX_LENGTH} characters
                </span>
              </div>
              <input
                type="text"
                required
                maxLength={TITLE_MAX_LENGTH}
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="Enter clear, compelling news headline..."
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-[#10243D] outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#D9273B] focus:bg-white focus:ring-2 focus:ring-red-100"
              />
              <p className="text-[11px] text-slate-400">
                Keep the headline direct, informative, and optimized for feeds.
              </p>
            </div>

            {/* Short Description / Summary */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-bold text-[#10243D]">
                  Short Summary / Excerpt <span className="text-rose-600">*</span>
                </label>
                <span
                  className={`text-[11px] font-semibold ${
                    descriptionLength >= DESCRIPTION_MAX_LENGTH
                      ? "text-rose-600 font-bold"
                      : "text-slate-400"
                  }`}
                >
                  {descriptionLength} / {DESCRIPTION_MAX_LENGTH} characters
                </span>
              </div>
              <textarea
                required
                rows={3}
                maxLength={DESCRIPTION_MAX_LENGTH}
                value={form.summary}
                onChange={(e) => setField("summary", e.target.value)}
                placeholder="Write a concise 2-3 sentence overview for mobile cards and feeds..."
                className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-[#10243D] leading-5 outline-none transition placeholder:text-slate-400 focus:border-[#D9273B] focus:bg-white focus:ring-2 focus:ring-red-100"
              />
              <p className="text-[11px] text-slate-400">
                This summary appears directly on preview cards and news feeds.
              </p>
            </div>

            {/* Main Content */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#10243D]">
                Full Article Content
              </label>
              <textarea
                
                rows={10}
                value={form.content}
                onChange={(e) => setField("content", e.target.value)}
                placeholder="Write full article content (HTML or plain text supported)..."
                className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-[#10243D] leading-6 outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-[#D9273B] focus:bg-white focus:ring-2 focus:ring-red-100"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: PUBLISHING SIDEBAR */}
        <div className="space-y-5">
          {/* Publishing Settings Card */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#10243D]">Publishing</h2>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#10243D]">
                Category <span className="text-rose-600">*</span>
              </label>
              <select
                required
                value={form.category_id ?? ""}
                onChange={(e) =>
                  setField(
                    "category_id",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-[#D9273B]"
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Lifecycle Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#10243D]">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setField("status", e.target.value as PostStatus)
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-[#D9273B]"
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            {/* Schedule Date (if scheduled) */}
            {form.status === "SCHEDULED" && (
              <div className="space-y-1.5 rounded-xl border border-sky-100 bg-sky-50/50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800">
                  <CalendarClock size={15} />
                  <span>Schedule Publication</span>
                </div>
                <input
                  type="datetime-local"
                  required
                  value={form.scheduled_at}
                  onChange={(e) => setField("scheduled_at", e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-[#D9273B]"
                />
                <p className="text-[10px] text-slate-500">
                  Article will remain scheduled until this time passes.
                </p>
              </div>
            )}

            {/* Flags */}
            <div className="space-y-2.5 pt-2">
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50">
                <div>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Star
                      size={15}
                      className={form.is_featured ? "fill-amber-500 text-amber-500" : "text-slate-400"}
                    />
                    Featured Story
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Pin story in featured news section
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) => setField("is_featured", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#D9273B] focus:ring-[#D9273B]"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50">
                <div>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Zap
                      size={15}
                      className={form.is_breaking_news ? "fill-rose-600 text-rose-600" : "text-slate-400"}
                    />
                    Breaking News
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Give this story highest ticker priority
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={form.is_breaking_news}
                  onChange={(e) => setField("is_breaking_news", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#D9273B] focus:ring-[#D9273B]"
                />
              </label>
            </div>
          </div>

          {/* Featured Image Card */}
          <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#10243D]">
              <ImagePlus size={16} className="text-[#D9273B]" />
              <span>Cover & Featured Image <span className="text-red-500">*</span></span>
            </h2>

            {form.featured_image ? (
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <img
                  src={form.featured_image}
                  alt="Featured cover"
                  className="h-44 w-full object-cover"
                  
                />
                <button
                  type="button"
                  onClick={() => setField("featured_image", "")}
                  className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white backdrop-blur transition hover:bg-black/80"
                  title="Remove image"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="flex h-36 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
                <ImageOff size={28} className="text-slate-300" />
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  No cover image selected
                </p>
                <p className="text-[10px] text-slate-400">
                  Upload an image from your device or paste a URL below
                </p>
              </div>
            )}

            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
                id="cloudinary-upload-input"
              />
              <label
                htmlFor="cloudinary-upload-input"
                className={`flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 transition hover:bg-slate-100 ${
                  uploadingImage ? "pointer-events-none opacity-50" : ""
                }`}
              >
                {uploadingImage ? (
                  <Loader2 size={16} className="animate-spin text-[#D9273B]" />
                ) : (
                  <Upload size={16} className="text-slate-500" />
                )}
                <span>
                  {uploadingImage
                    ? "Uploading to Cloudinary..."
                    : "Upload Image File"}
                </span>
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={form.featured_image}
                  onChange={(e) => setField("featured_image", e.target.value)}
                  placeholder="Or paste direct image URL..."
                  className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs text-slate-700 outline-none focus:border-[#D9273B]"
                />
              </div>
            </div>
          </div>

          {/* Draft Protection Info */}
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-900">
            <strong>Draft protection:</strong> Changes automatically autosave every 5 seconds. You can also save manually using the Save as Draft button.
          </div>
        </div>
      </div>
    </form>
  );
}