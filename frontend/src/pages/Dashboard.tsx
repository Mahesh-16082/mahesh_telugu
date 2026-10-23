import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import dashboardBanner from '../assets/dashboard-banner.png'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import Categories from './Categories'
import DeletedCategories from './DeletedCategories'
import Posts from './Posts'
import DeletedPosts from './DeletedPosts'
import Profile from './Profile'
import { getMyProfile } from '../services/profile'
import type { AdminProfile } from '../services/profile'
import { getRecentPosts, getStatusCounts } from '../services/posts'
import type { Post, PostStatusCounts } from '../services/posts'
import { getCategories } from '../services/categories'

type IconProps = {
  name: string
  className?: string
}

function Icon({ name, className = 'h-5 w-5' }: IconProps) {
  const paths: Record<string, string> = {
    dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    posts: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8',
    categories: 'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    breaking: 'M13 2 4 14h7l-1 8 10-13h-7z',
    cards: 'M3 3h18v18H3z M3 16l6-6 4 4 3-3 5 5',
    ads: 'M3 11v2h4l5 5V6l-5 5z M16 9a5 5 0 0 1 0 6 M18 5a10 10 0 0 1 0 14',
    search: 'm21 21-4.3-4.3 M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0z',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
    menu: 'M4 6h16 M4 12h16 M4 18h16',
    check: 'M20 6 9 17l-5-5',
    edit: 'm16 4 4 4 M4 20l4-.8L20 7a2.8 2.8 0 0 0-4-4L4 15z',
    folder: 'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    logout: 'M10 17l5-5-5-5 M15 12H3 M21 4v16',
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.dashboard} />
    </svg>
  )
}

function Panel({
  title,
  action,
  onAction,
  children,
}: {
  title: string
  action?: string
  onAction?: () => void
  children: ReactNode
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="flex min-h-11 items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-[#17243B]">{title}</h2>
        {action && (
          <button
            type="button"
            onClick={onAction}
            className="text-xs font-semibold text-[#D9273B] hover:underline"
          >
            {action} →
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-[170px] flex-col items-center justify-center gap-2 p-5 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-400">
        <Icon name="posts" />
      </div>
      <p className="max-w-xs text-xs leading-5 text-slate-500">{text}</p>
    </div>
  )
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export default function Dashboard() {
  const [active, setActive] = useState('Dashboard')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('Last 7 Days')
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)

  // Live dashboard data
  const [statusCounts, setStatusCounts] = useState<PostStatusCounts | null>(null)
  const [totalCategories, setTotalCategories] = useState<number | null>(null)
  const [recentPosts, setRecentPosts] = useState<Post[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadAdminProfile() {
      try {
        const profile = await getMyProfile()
        if (!cancelled) setAdminProfile(profile)
      } catch {
        // Keep the dashboard usable if profile details cannot be loaded.
      }
    }

    async function loadDashboardStats() {
      try {
        const counts = await getStatusCounts()
        if (!cancelled) setStatusCounts(counts)
      } catch {
        // Silent catch
      }

      try {
        const catRes = await getCategories({ page: 1, page_size: 1 })
        if (!cancelled) setTotalCategories(catRes.total)
      } catch {
        // Silent catch
      }

      try {
        const recent = await getRecentPosts(5)
        if (!cancelled) setRecentPosts(recent)
      } catch {
        // Silent catch
      }
    }

    void loadAdminProfile()
    void loadDashboardStats()

    return () => {
      cancelled = true
    }
  }, [active])

  const administratorName =
    adminProfile?.full_name?.trim() ||
    adminProfile?.name?.trim() ||
    adminProfile?.email ||
    'Administrator'

  const statistics = [
    {
      title: 'Total Posts',
      value: statusCounts !== null ? statusCounts.all : '—',
      caption: statusCounts !== null ? `${statusCounts.all} active posts` : 'Awaiting data',
      icon: 'posts',
      iconClass: 'bg-rose-100 text-rose-600',
      cardClass: 'bg-[#FFF5F6]',
    },
    {
      title: 'Published Posts',
      value: statusCounts !== null ? statusCounts.published : '—',
      caption: statusCounts !== null ? `${statusCounts.published} live on site` : 'Awaiting data',
      icon: 'check',
      iconClass: 'bg-emerald-100 text-emerald-600',
      cardClass: 'bg-[#EFFBF4]',
    },
    {
      title: 'Draft Posts',
      value: statusCounts !== null ? statusCounts.draft : '—',
      caption: statusCounts !== null ? `${statusCounts.draft} in progress` : 'Awaiting data',
      icon: 'edit',
      iconClass: 'bg-amber-100 text-amber-600',
      cardClass: 'bg-[#FFFBEE]',
    },
    {
      title: 'Total Categories',
      value: totalCategories !== null ? totalCategories : '—',
      caption: totalCategories !== null ? `${totalCategories} categories` : 'Awaiting data',
      icon: 'folder',
      iconClass: 'bg-violet-100 text-violet-600',
      cardClass: 'bg-[#F7F3FF]',
    },
  ]

  function navigate(label: string, parent?: string) {
    if (label === 'Trash' && parent === 'Categories') {
      setActive('Category Trash')
    } else if (label === 'Trash' && parent === 'Posts') {
      setActive('Posts Trash')
    } else {
      setActive(label)
    }

    setMobileMenu(false)
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-[#F2F5FA] text-[#17243B]">
      <Sidebar
        active={active}
        onNavigate={navigate}
        mobileOpen={mobileMenu}
        onCloseMobile={() => setMobileMenu(false)}
      />

      {/* Main application area */}
      <div className="ml-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:ml-[260px]">
        {/* Keep the topbar stationary */}
        <div className="shrink-0">
          <Topbar
            search={search}
            onSearchChange={setSearch}
            onOpenMobileMenu={() => setMobileMenu(true)}
            onOpenProfile={() => setActive('Profile information')}
            administratorName={administratorName}
            administratorEmail={adminProfile?.email || ''}
            administratorRole={adminProfile?.role || 'Administrator'}
          />
        </div>

        {/* Only this content area scrolls vertically */}
        <main className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-4">
          {active === 'All Categories' ? (
            <Categories />
          ) : active === 'Category Trash' ? (
            <DeletedCategories />
          ) : active === 'All Posts' ? (
            <Posts mode="all" onNavigate={navigate} />
          ) : active === 'Drafts' ? (
            <Posts mode="drafts" onNavigate={navigate} />
          ) : active === 'Published' ? (
            <Posts mode="published" onNavigate={navigate} />
          ) : active === 'Posts Trash' ? (
            <DeletedPosts />
          ) : active === 'Profile information' ? (
            <Profile onBack={() => setActive('Dashboard')} />
          ) : active !== 'Dashboard' ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h1 className="text-xl font-bold text-[#10243D]">{active}</h1>
              <p className="mt-2 text-sm text-slate-500">
                This module will be connected next.
              </p>
            </section>
          ) : (
            <>
              {/* Welcome banner */}
              <section
                className="relative flex h-[182px] items-center overflow-hidden rounded-xl bg-cover bg-center px-5 py-4 sm:px-6"
                style={{ backgroundImage: `url(${dashboardBanner})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#FFF0E2]/75 via-[#FCE5D4]/15 to-[#10243D]/10" />

                <div className="relative z-10 min-w-0 max-w-[75%] sm:max-w-[60%]">
                  <p className="text-[9px] font-bold tracking-[0.25em] text-[#344256]">
                    WELCOME TO TELUGU FRONT
                  </p>
                  <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-[#10243D] sm:text-3xl">
                    Good Afternoon,
                    <span className="block break-words text-[#D9273B]">
                      ADMIN
                    </span>
                  </h1>
                  <p className="mt-2 text-xs text-[#465569] sm:text-sm">
                    Manage your news, keep your audience informed.
                  </p>
                </div>

                {/* Telugu slogan */}
                <div className="absolute right-8 top-[30px] z-10 hidden text-right text-white drop-shadow-md sm:block lg:right-10">
                  <p className="text-lg font-bold">“తెలుగు మనసు,</p>
                  <p className="text-lg font-bold">ప్రపంచ దృష్టి”</p>
                  <p className="mt-3 whitespace-nowrap text-[9px] tracking-[0.12em]">
                    PEOPLE | NEWS | CULTURE | OPPORTUNITIES
                  </p>
                </div>
              </section>

              {/* Statistics */}
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                {statistics.map((stat) => (
                  <article
                    key={stat.title}
                    className={`flex min-h-[92px] items-center gap-3 rounded-xl border border-white p-3 shadow-sm sm:p-4 ${stat.cardClass}`}
                  >
                    <div
                      className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${stat.iconClass}`}
                    >
                      <Icon name={stat.icon} className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-600">
                        {stat.title}
                      </p>
                      <p className="mt-1 text-2xl font-extrabold text-[#10243D]">
                        {stat.value}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {stat.caption}
                      </p>
                    </div>
                  </article>
                ))}
              </section>

              {/* Recent Posts and Breaking News */}
              <section className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-[1.55fr_1fr]">
                <Panel
                  title="Recent Posts"
                  action="View All"
                  onAction={() => setActive('All Posts')}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[540px] text-left text-xs">
                      <thead className="bg-[#F0F4F9] text-slate-600">
                        <tr>
                          <th className="px-3 py-3 font-semibold">Title</th>
                          <th className="px-3 py-3 font-semibold">Category</th>
                          <th className="px-3 py-3 font-semibold">Status</th>
                          <th className="px-3 py-3 font-semibold">Date</th>
                          <th className="px-3 py-3 text-right font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentPosts.length === 0 ? (
                          <tr>
                            <td colSpan={5}>
                              <EmptyState text="No posts yet. Click 'Create New Post' below to add your first article." />
                            </td>
                          </tr>
                        ) : (
                          recentPosts.map((post) => (
                            <tr
                              key={post.id}
                              className="border-b border-slate-50 transition-colors hover:bg-slate-50/50"
                            >
                              <td className="max-w-[200px] truncate px-3 py-2.5 font-semibold text-[#10243D]">
                                {post.title}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {post.category?.name || 'Uncategorized'}
                              </td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    post.status === 'PUBLISHED'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {post.status}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-slate-500">
                                {formatDate(
                                  post.status === 'PUBLISHED'
                                    ? post.published_at
                                    : post.created_at,
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => setActive('All Posts')}
                                  className="text-xs font-semibold text-[#D9273B] hover:underline"
                                >
                                  Manage →
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                <Panel
                  title="Breaking News"
                  action="View All"
                  onAction={() => setActive('Breaking News')}
                >
                  <EmptyState text="Breaking news from your backend will appear here." />
                </Panel>
              </section>

              {/* Analytics */}
              <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3">
                <Panel title="Posts Overview">
                  <div className="flex items-center justify-between px-4 pt-3">
                    <span className="text-xs text-slate-400">
                      Post activity
                    </span>
                    <select
                      value={period}
                      onChange={(event) => setPeriod(event.target.value)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] outline-none"
                    >
                      <option>Last 7 Days</option>
                      <option>Last 30 Days</option>
                      <option>Last 90 Days</option>
                    </select>
                  </div>
                  <div className="p-5 text-center">
                    <div className="text-2xl font-extrabold text-[#10243D]">
                      {statusCounts?.all ?? 0}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Total active articles published or drafted
                    </p>
                  </div>
                </Panel>

                <Panel title="Posts by Status">
                  {statusCounts ? (
                    <div className="space-y-3 p-4 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-medium text-emerald-700">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          Published
                        </span>
                        <span className="font-bold text-[#10243D]">
                          {statusCounts.published}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-medium text-amber-700">
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                          Drafts
                        </span>
                        <span className="font-bold text-[#10243D]">
                          {statusCounts.draft}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-medium text-rose-700">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                          Trash
                        </span>
                        <span className="font-bold text-[#10243D]">
                          {statusCounts.trash}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <EmptyState text="Published, draft, and trash counts will appear here." />
                  )}
                </Panel>

                <Panel title="Quick Actions">
                  <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                    {[
                      {
                        label: 'Create New Post',
                        icon: 'posts',
                        page: 'All Posts',
                        color: 'bg-rose-50 text-rose-700',
                      },
                      {
                        label: 'Manage Categories',
                        icon: 'categories',
                        page: 'All Categories',
                        color: 'bg-amber-50 text-amber-700',
                      },
                      {
                        label: 'Add Breaking News',
                        icon: 'breaking',
                        page: 'Breaking News',
                        color: 'bg-violet-50 text-violet-700',
                      },
                      {
                        label: 'Manage Advertisements',
                        icon: 'ads',
                        page: 'Advertisements',
                        color: 'bg-sky-50 text-sky-700',
                      },
                    ].map((action) => (
                      <button
                        type="button"
                        key={action.label}
                        onClick={() => navigate(action.page)}
                        className={`flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:brightness-95 ${action.color}`}
                      >
                        <Icon name={action.icon} className="h-5 w-5" />
                        {action.label}
                      </button>
                    ))}
                  </div>
                </Panel>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
