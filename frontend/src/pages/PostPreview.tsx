import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  Bookmark,
  Clock3,
  Edit3,
  Heart,
  ImageOff,
  Loader2,
  MessageCircle,
  MoreVertical,
  RefreshCw,
  Send,
  Share2,
  Smartphone,
  Volume2,
  VolumeX,
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
  const descriptionText = post.summary || post.short_description || "";

  return (
    <div className="space-y-6 pb-10">
      {/* =======================================================
       * TOP HEADER BAR
       * ======================================================= */}
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            title="Back to Posts"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D9273B]">
              Mobile Feed Simulator
            </p>
            <h1 className="mt-0.5 text-2xl font-bold text-[#10243D]">
              Post Preview
            </h1>
            <p className="text-xs text-slate-500">
              Previewing post #{post.id} as an InShorts-style mobile card.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(post.id)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <Edit3 size={15} />
              <span>Edit Post</span>
            </button>
          )}

          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#10243D] px-4 text-xs font-bold text-white transition hover:bg-[#1b3455]"
          >
            <ArrowLeft size={15} />
            <span>Back to Posts</span>
          </button>
        </div>
      </section>

      {/* =======================================================
       * 2-COLUMN PREVIEW LAYOUT
       * ======================================================= */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* LEFT / CENTER: SMARTPHONE SIMULATOR */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#10243D]">
                Mobile Presentation
              </h2>
              <p className="text-xs text-slate-500">
                Simulated smartphone reader experience.
              </p>
            </div>

            <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
              {getPostStatusLabel(post.status)}
            </span>
          </div>

          {/* Smartphone Hardware Frame */}
          <div className="mx-auto w-full max-w-[390px] rounded-[42px] bg-[#111827] p-[10px] shadow-2xl">
            <div className="relative min-h-[760px] overflow-hidden rounded-[34px] bg-white">
              {/* Dynamic Island / Notch */}
              <div className="absolute left-1/2 top-2 z-40 h-7 w-28 -translate-x-1/2 rounded-full bg-black" />

              {/* Status Bar */}
              <div className="relative flex h-10 items-center justify-between bg-white px-6 pt-2 text-[11px] font-bold text-slate-800">
                <span>9:41</span>
                <div className="flex items-center gap-1.5">
                  <span>5G</span>
                  <div className="h-2.5 w-5 rounded-sm border border-slate-900 p-[1px]">
                    <div className="h-full w-3/4 rounded-[1px] bg-slate-900" />
                  </div>
                </div>
              </div>

              {/* App Brand Header */}
              <header className="flex h-14 items-center justify-between border-b border-slate-100 bg-white px-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#D9273B] text-xs font-black text-white shadow-sm">
                    TF
                  </div>
                  <div>
                    <p className="text-sm font-black tracking-tight text-[#10243D]">
                      TELUGU FRONT
                    </p>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                      Short News
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="rounded-full p-2 text-slate-600 hover:bg-slate-100"
                >
                  <MoreVertical size={18} />
                </button>
              </header>

              {/* Mobile News Article Card */}
              <article className="relative flex min-h-[654px] flex-col bg-white">
                {/* Featured Media */}
                <div className="relative h-[330px] overflow-hidden bg-slate-200">
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={post.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-slate-100 text-slate-400">
                      <div className="text-center">
                        <ImageOff size={36} className="mx-auto" />
                        <p className="mt-2 text-xs font-semibold">
                          No featured image
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/75 to-transparent" />

                  {/* Media Badges */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-[#D9273B] px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
                        {post.category?.name ?? "News"}
                      </span>

                      {post.is_breaking_news && (
                        <span className="rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
                          Breaking News
                        </span>
                      )}

                      {post.is_featured && (
                        <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
                          Featured
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setMuted((curr) => !curr)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/60"
                      title={muted ? "Unmute" : "Mute"}
                    >
                      {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                    </button>
                  </div>
                </div>

                {/* Article Body */}
                <div className="flex-1 px-4 pb-3 pt-3.5">
                  <h2 className="text-[19px] font-black leading-[1.25] tracking-tight text-slate-950">
                    {post.title || "Untitled News Story"}
                  </h2>

                  <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-slate-500">
                    <Clock3 size={13} />
                    <span>
                      {formatPublishedTime(
                        post.published_at ?? post.updated_at ?? post.created_at,
                      )}
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-slate-700">
                      {post.author?.display_name || "Telugu Front"}
                    </span>
                  </div>

                  <p className="mt-3 text-[13.5px] leading-[1.65] text-slate-700">
                    {displayedDescription || "No short summary has been added."}
                  </p>

                  {descriptionText.length > 250 && (
                    <button
                      type="button"
                      onClick={() => setShowFullDescription((curr) => !curr)}
                      className="mt-1.5 text-xs font-bold text-[#D9273B] hover:underline"
                    >
                      {showFullDescription ? "Show less" : "Read more"}
                    </button>
                  )}

                  {post.slug && (
                    <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                      <span>Article slug:</span>
                      <span className="font-mono text-slate-600">/{post.slug}</span>
                    </div>
                  )}
                </div>

                {/* Bottom Interactive Bar */}
                <div className="grid grid-cols-5 border-t border-slate-100 bg-white px-2 py-2">
                  <button
                    type="button"
                    onClick={() => setLiked((curr) => !curr)}
                    className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-[9px] font-semibold text-slate-500 transition hover:bg-slate-50"
                  >
                    <Heart
                      size={18}
                      className={
                        liked ? "fill-[#D9273B] text-[#D9273B]" : "text-slate-500"
                      }
                    />
                    <span>{liked ? "Liked" : "Like"}</span>
                  </button>

                  <button
                    type="button"
                    className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-[9px] font-semibold text-slate-500 transition hover:bg-slate-50"
                  >
                    <MessageCircle size={18} />
                    <span>Comment</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void copyShareLink()}
                    className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-[9px] font-semibold text-slate-500 transition hover:bg-slate-50"
                  >
                    <Share2 size={18} />
                    <span>Share</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBookmarked((curr) => !curr)}
                    className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-[9px] font-semibold text-slate-500 transition hover:bg-slate-50"
                  >
                    <Bookmark
                      size={18}
                      className={
                        bookmarked
                          ? "fill-[#10243D] text-[#10243D]"
                          : "text-slate-500"
                      }
                    />
                    <span>Save</span>
                  </button>

                  <button
                    type="button"
                    className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-[9px] font-semibold text-slate-500 transition hover:bg-slate-50"
                  >
                    <Send size={18} />
                    <span>Send</span>
                  </button>
                </div>
              </article>

              {/* Bottom Phone Bar */}
              <div className="absolute bottom-1 left-1/2 h-1.5 w-28 -translate-x-1/2 rounded-full bg-slate-900" />
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: PREVIEW METADATA & SIDEBAR */}
        <aside className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-[#10243D]">Preview Information</h2>

            <div className="mt-4 space-y-3">
              {/* Headline Length */}
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Headline length
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">
                    {post.title.length} / 75 chars
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      post.title.length <= 75
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    {post.title.length <= 75 ? "Optimal" : "Too long"}
                  </span>
                </div>
              </div>

              {/* Description Length */}
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Summary length
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">
                    {descriptionText.length} / 400 chars
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      descriptionText.length <= 400
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    {descriptionText.length <= 400 ? "Optimal" : "Too long"}
                  </span>
                </div>
              </div>

              {/* Media Type */}
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Media presentation
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  {imageSrc ? "Featured cover image" : "No image attached"}
                </p>
              </div>

              {/* Category & Status */}
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Content status
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  {getPostStatusLabel(post.status)}
                </p>
              </div>
            </div>
          </section>

          {/* Preview Notes Card */}
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="font-bold text-amber-900">Preview Notes</h2>
            <p className="mt-2 text-xs leading-5 text-amber-800">
              This card simulates the Telugu Front mobile short-news feed. Spacing, line wraps, and font rendering may vary slightly across actual iOS and Android devices.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
