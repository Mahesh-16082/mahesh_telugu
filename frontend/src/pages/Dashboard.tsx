
import { useState } from 'react'
import type { ReactNode } from 'react'
import dashboardBanner from '../assets/dashboard-banner.png'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import Categories from './Categories'
import DeletedCategories from './DeletedCategories'

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
  children,
}: {
  title: string
  action?: string
  children: ReactNode
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="flex min-h-11 items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-[#17243B]">{title}</h2>
        {action && (
          <button
            type="button"
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

export default function Dashboard() {
  const [active, setActive] = useState('Dashboard')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('Last 7 Days')

  const statistics = [
    {
      title: 'Total Posts',
      icon: 'posts',
      iconClass: 'bg-rose-100 text-rose-600',
      cardClass: 'bg-[#FFF5F6]',
    },
    {
      title: 'Published Posts',
      icon: 'check',
      iconClass: 'bg-emerald-100 text-emerald-600',
      cardClass: 'bg-[#EFFBF4]',
    },
    {
      title: 'Draft Posts',
      icon: 'edit',
      iconClass: 'bg-amber-100 text-amber-600',
      cardClass: 'bg-[#FFFBEE]',
    },
    {
      title: 'Total Categories',
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
    <div className="min-h-screen bg-[#F2F5FA] text-[#17243B]">
      <Sidebar
        active={active}
        onNavigate={navigate}
        mobileOpen={mobileMenu}
        onCloseMobile={() => setMobileMenu(false)}
      />

      {/* Main area */}
      <div className="min-h-screen min-w-0 lg:ml-[260px]">
        <Topbar
          search={search}
          onSearchChange={setSearch}
          onOpenMobileMenu={() => setMobileMenu(true)}
          administratorName="Administrator"
        />

        <main className="min-w-0 space-y-4 p-3 sm:p-4">
          {active === 'All Categories' ? (
            <Categories />
          ) : active === 'Category Trash' ? (
            <DeletedCategories />
          ) : active === 'Posts Trash' ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h1 className="text-xl font-bold text-[#10243D]">Deleted Posts</h1>
              <p className="mt-2 text-sm text-slate-500">
                The deleted posts page has not been connected yet.
              </p>
            </section>
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

            <div className="relative z-10 max-w-[60%]">
              <p className="text-[9px] font-bold tracking-[0.25em] text-[#344256]">
                WELCOME TO TELUGU FRONT
              </p>
              <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-[#10243D] sm:text-3xl">
                Good Afternoon,
                <span className="block text-[#D9273B]">Administrator</span>
              </h1>
              <p className="mt-2 text-xs text-[#465569] sm:text-sm">
                Manage your news, keep your audience informed.
              </p>
            </div>

            {/* Telugu slogan shifted left and upward */}
            <div className="absolute right-8 top-[34px] z-10 hidden text-right text-white drop-shadow-md sm:block lg:right-10 lg:top-[30px]">
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
                    —
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Awaiting backend data
                  </p>
                </div>
              </article>
            ))}
          </section>

          {/* Recent Posts and Breaking News */}
          <section className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-[1.55fr_1fr]">
            <Panel title="Recent Posts" action="View All">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-left text-xs">
                  <thead className="bg-[#F0F4F9] text-slate-600">
                    <tr>
                      <th className="px-3 py-3 font-semibold">Title</th>
                      <th className="px-3 py-3 font-semibold">Category</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3 font-semibold">Date</th>
                      <th className="px-3 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={5}>
                        <EmptyState text="Your latest posts will appear here after the posts API is connected." />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Breaking News" action="View All">
              <EmptyState text="Breaking news from your backend will appear here." />
            </Panel>
          </section>

          {/* Analytics */}
          <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel title="Posts Overview">
              <div className="flex items-center justify-between px-4 pt-3">
                <span className="text-xs text-slate-400">Post activity</span>
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
              <EmptyState
                text={`Activity for ${period.toLowerCase()} will appear here.`}
              />
            </Panel>

            <Panel title="Posts by Status">
              <EmptyState text="Published, draft, and trash counts will appear here." />
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
