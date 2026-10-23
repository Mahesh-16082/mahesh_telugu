import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  Edit3,
  ImageOff,
  Loader2,
  RefreshCw,
  Share2,
  Smartphone,
} from "lucide-react";

import {
  getApiErrorMessage,
  getPost,
  getPostStatusLabel,
} from "../services/posts";
import type { Post } from "../services/posts";

type PostPreviewProps = {
  postId: number;
  onBack: () => void;
  onEdit?: (postId: number) => void;
};

function formatPublishedTime(value?: string | null): string {
  if (!value) {
    return "Not published";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function truncateText(value: string, maximumLength: number): string {
  if (value.length <= maximumLength) {
    return value;
  }
  return value.slice(0, maximumLength).trimEnd() + "…";
}

export default function PostPreview({
  postId,
  onBack,
  onEdit,
}: PostPreviewProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [liked, setLiked] = useState<boolean>(false);
  const [bookmarked, setBookmarked] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [showFullDescription, setShowFullDescription] = useState<boolean>(false);

  const loadPost = useCallback(async () => {
    if (!Number.isFinite(postId) || postId <= 0) {
      setError("Invalid post ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await getPost(postId);
      setPost(response);
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Unable to load mobile preview.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void loadPost();
  }, [loadPost]);

  const displayedDescription = useMemo(() => {
    if (!post) return "";
    const fullText = post.summary || post.short_description || post.content || "";
    if (showFullDescription) return fullText;
    return truncateText(fullText, 250);
  }, [post, showFullDescription]);

  const copyShareLink = async () => {
    if (!post) return;
    const link = `${window.location.origin}/posts/${post.slug || post.id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text: post.summary || "",
          url: link,
        });
        return;
      }

      await navigator.clipboard.writeText(link);
      window.alert("Post link copied to clipboard.");
    } catch {
      // User cancelled native share
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <Loader2
            size={36}
            className="mx-auto animate-spin text-[#D9273B]"
          />
          <p className="mt-3 text-sm font-semibold text-slate-500">
            Loading mobile preview…
          </p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
        <Smartphone size={40} className="mx-auto text-rose-500" />
        <h1 className="mt-4 text-xl font-bold text-rose-900">
          Preview Unavailable
        </h1>
        <p className="mt-2 text-sm text-rose-700">
          {error ?? "Post not found."}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to Posts
          </button>
          <button
            type="button"
            onClick={() => void loadPost()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#D9273B] px-4 py-2 text-xs font-bold text-white hover:bg-[#b81f30]"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const imageSrc = post.featured_image || post.featured_image_url;
  const descriptionText = post.summary || post.short_description || post.content || "";

  return (
    <main className="relative min-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl bg-[#F2F5FA] px-4 py-6 sm:px-8">
      {/* Soft editorial background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(220, 210, 190, 0.20), transparent 28%), radial-gradient(circle at 85% 75%, rgba(220, 210, 190, 0.16), transparent 30%)",
        }}
      />

      {/* Close preview */}
      <button
        type="button"
        onClick={onBack}
        aria-label="Close preview"
        title="Close preview"
        className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-[#D9273B] text-white shadow-lg transition hover:bg-[#b81f30] sm:right-8 sm:top-7"
      >
        <span className="text-3xl font-light leading-none">×</span>
      </button>

      <div className="relative mx-auto flex max-w-5xl items-start justify-center gap-8 pt-0 sm:pt-0">
        {/* Article card */}
        <article className="w-full max-w-[515px] overflow-hidden rounded-2xl bg-white shadow-[0_18px_45px_rgba(16,36,61,0.12)]">
          <div className="relative h-[300px] overflow-hidden border-b-4 border-[#D9273B] bg-slate-200 sm:h-[300px]">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={post.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center bg-slate-100 text-slate-400">
                <ImageOff size={42} />
                <p className="mt-3 text-sm font-semibold">No cover image available</p>
              </div>
            )}
          </div>

          <div className="px-4 pb-7 pt-7 sm:px-4 sm:pt-7">
            <h1 className="font-serif text-[25px] font-bold leading-[1.25] text-[#171717] sm:text-[26px]">
              {post.title || "Untitled News Story"}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-[16px] leading-6">
              <span className="font-medium text-[#D9273B]">
                {post.category?.name || "News"}
              </span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-500">
                Updated:{" "}
                {new Intl.DateTimeFormat("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }).format(
                  new Date(post.updated_at || post.published_at || post.created_at),
                )}{" "}
                IST
              </span>
            </div>

            <p className="mt-4 whitespace-pre-line font-serif text-[22px] leading-[1.38] text-[#171717] sm:text-[23px]">
              {displayedDescription || "No short summary has been added."}
            </p>

            {descriptionText.length > 250 && (
              <button
                type="button"
                onClick={() => setShowFullDescription((curr) => !curr)}
                className="mt-3 font-sans text-sm font-semibold text-[#D9273B] hover:underline"
              >
                {showFullDescription ? "Show less" : "Read more"}
              </button>
            )}

            {post.is_breaking_news && (
              <div className="mt-4">
                <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white">
                  Breaking News
                </span>
              </div>
            )}

            {/* Share action */}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => void copyShareLink()}
                aria-label="Share article"
                title="Share article"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D9273B] text-white shadow-lg transition hover:bg-[#b81f30]"
              >
                <Share2 size={25} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </article>

        {/* Story navigation controls from the reference design */}
        <div className="hidden flex-col gap-7 pt-[300px] sm:flex">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Scroll to top"
            title="Scroll to top"
            className="flex h-[70px] w-[70px] items-center justify-center rounded-full border-2 border-[#D9273B] bg-white/70 text-[#D9273B] transition hover:bg-[#D9273B] hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 19V5" />
              <path d="m5 12 7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" })}
            aria-label="Scroll to bottom"
            title="Scroll to bottom"
            className="flex h-[70px] w-[70px] items-center justify-center rounded-full border-2 border-[#D9273B] bg-white/70 text-[#D9273B] transition hover:bg-[#D9273B] hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14" />
              <path d="m19 12-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Edit remains available without changing the reference layout on small screens */}
      {onEdit && (
        <button
          type="button"
          onClick={() => onEdit(post.id)}
          className="relative mx-auto mt-5 flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Edit3 size={16} />
          Edit Post
        </button>
      )}
    </main>
  );
}
