
import { useState } from 'react'
import dashboardBanner from '../assets/dashboard-banner.png'

type IconProps = { name: string; className?: string }

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
    chart: 'M3 3v18h18 M8 16v-5 M13 16V6 M18 16v-8',
    plus: 'M12 5v14 M5 12h14',
    logout: 'M10 17l5-5-5-5 M15 12H3',
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

const menuItems = [
  { label: 'Dashboard', icon: 'dashboard' },
  {
    label: 'Posts',
    icon: 'posts',
    children: ['All Posts', 'Drafts', 'Published', 'Trash'],
  },
  {
    label: 'Categories',
    icon: 'categories',
    children: ['All Categories', 'Trash'],
  },
  { label: 'Breaking News', icon: 'breaking' },
  { label: 'Cards', icon: 'cards' },
  { label: 'Advertisements', icon: 'ads' },
]

function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: string
  children: React.ReactNode
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="flex min-h-[48px] items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-[15px] font-bold text-[#17243B]">{title}</h2>
        {action && (
          <button className="text-xs font-semibold text-[#D9273B] hover:underline">
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
      <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-50 text-slate-400">
        <Icon name="posts" />
      </div>
      <p className="max-w-xs text-xs leading-5 text-slate-500">{text}</p>
    </div>
  )
}

export default function Dashboard() {
  const [active, setActive] = useState('Dashboard')
  const [expanded, setExpanded] = useState(['Posts', 'Categories'])
  const [mobileMenu, setMobileMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('Last 7 Days')

  function selectPage(label: string) {
    setActive(label)
    setMobileMenu(false)
  }

  function toggleGroup(label: string) {
    setExpanded((previous) =>
      previous.includes(label)
        ? previous.filter((item) => item !== label)
        : [...previous, label],
    )
  }

  const statistics = [
    {
      title: 'Total Posts',
      icon: 'posts',
      iconClass: 'bg-rose-100 text-rose-600',
      cardClass: 'bg-[#FFF6F7]',
    },
    {
      title: 'Published Posts',
      icon: 'check',
      iconClass: 'bg-emerald-100 text-emerald-600',
      cardClass: 'bg-[#F0FBF5]',
    },
    {
      title: 'Draft Posts',
      icon: 'edit',
      iconClass: 'bg-amber-100 text-amber-600',
      cardClass: 'bg-[#FFFBEE]',
    },
    {
      title: 'Total Categories',
      icon: 'categories',
      iconClass: 'bg-violet-100 text-violet-600',
      cardClass: 'bg-[#F7F3FF]',
    },
  ]

  return (
    <div className="min-h-screen bg-[#F2F5FA] text-[#17243B]">
      {mobileMenu && (
        <button
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#10243D] text-white transition-transform lg:translate-x-0 ${
          mobileMenu ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black">
            <span className="text-[#10243D]">T</span>
            <span className="text-[#D9273B]">F</span>
          </div>
          <div>
            <p className="text-[18px] font-extrabold tracking-tight">
              Telugu <span className="text-[#F04454]">Front</span>
            </p>
            <p className="text-[9px] tracking-[0.24em] text-slate-300">
              ADMIN PORTAL
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
          {menuItems.map((item) => (
            <div key={item.label}>
              <button
                onClick={() => {
                  if (item.children) {
                    toggleGroup(item.label)
                  } else {
                    selectPage(item.label)
                  }
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition ${
                  active === item.label
                    ? 'bg-[#D9273B] font-semibold text-white shadow-md'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <Icon name={item.icon} />
                <span className="flex-1">{item.label}</span>
                {item.children && (
                  <span className="text-xs">
                    {expanded.includes(item.label) ? '⌃' : '⌄'}
                  </span>
                )}
              </button>

              {item.children && expanded.includes(item.label) && (
                <div className="ml-7 mt-1 space-y-1 border-l border-white/15 pl-3">
                  {item.children.map((child) => (
                    <button
                      key={child}
                      onClick={() => selectPage(child)}
                      className={`block w-full rounded-md px-3 py-2 text-left text-xs ${
                        active === child
                          ? 'bg-white/10 font-semibold text-white'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {child}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-600 font-bold">
              A
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Administrator</p>
              <p className="text-xs text-slate-400">Admin Portal</p>
            </div>
            <button
              title="Sign out"
              onClick={() => {
                sessionStorage.removeItem('access_token')
                sessionStorage.removeItem('token_type')
                window.location.assign('/')
              }}
              className="rounded-md p-2 text-slate-300 hover:bg-white/10"
            >
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="min-h-screen lg:ml-[260px]">
        <header className="sticky top-0 z-20 flex h-[64px] items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            aria-label="Open navigation"
            onClick={() => setMobileMenu(true)}
            className="rounded-md p-2 hover:bg-slate-100 lg:hidden"
          >
            <Icon name="menu" />
          </button>

          <div className="relative max-w-[540px] flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon name="search" />
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search articles, categories, or anything..."
              className="h-10 w-full rounded-lg border border-slate-100 bg-[#F3F6FA] pl-10 pr-3 text-xs outline-none focus:border-[#173B67] sm:text-sm"
            />
          </div>

          <button
            aria-label="Notifications"
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          >
            <Icon name="bell" />
            <span className="absolute right-1 top-1 h-4 min-w-4 rounded-full bg-[#D9273B] px-1 text-[9px] leading-4 text-white">
              3
            </span>
          </button>

          <div className="hidden items-center gap-2 sm:flex">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#E3EAF4] font-bold text-[#173B67]">
              A
            </div>
            <div className="hidden md:block">
              <p className="text-xs font-semibold">Administrator</p>
              <p className="text-[10px] text-slate-500">Administrator</p>
            </div>
          </div>
        </header>

        <main className="space-y-4 p-4 sm:p-5">
          
        {/* Welcome banner */}
        <section
        className="relative flex min-h-[182px] items-center overflow-hidden rounded-xl bg-cover bg-center px-6 py-6 sm:px-7 sm:py-7"
        style={{ backgroundImage: `url(${dashboardBanner})` }}
        >
        <div className="absolute inset-0 bg-gradient-to-r from-[#FFF0E2]/95 via-[#FCE5D4]/65 to-[#10243D]/20" />

        <div className="relative z-10 max-w-[58%]">
            <p className="text-[9px] font-bold tracking-[0.25em] text-[#344256]">
            WELCOME TO TELUGU FRONT
            </p>

            <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-[#10243D] sm:text-4xl">
            Good Afternoon,
            <span className="block text-[#D9273B]">Administrator</span>
            </h1>

            <p className="mt-2 text-sm text-[#465569]">
            Manage your news, keep your audience informed.
            </p>
        </div>

        <div className="absolute bottom-5 right-5 z-10 hidden text-right text-white drop-shadow-md md:block">
            <p className="text-lg font-bold">తెలుగు మనసు,</p>
            <p className="text-lg font-bold">ప్రపంచ దృష్టి</p>
            <p className="mt-3 text-[9px] tracking-[0.15em]">
            PEOPLE | NEWS | CULTURE | OPPORTUNITIES
            </p>
        </div>
        </section>


          {/* Statistics */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {statistics.map((stat) => (
              <article
                key={stat.title}
                className={`flex min-h-[92px] items-center gap-3 rounded-xl border border-white p-4 shadow-sm ${stat.cardClass}`}
              >
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${stat.iconClass}`}>
                  <Icon name={stat.icon} className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-600">{stat.title}</p>
                  <p className="mt-1 text-2xl font-extrabold text-[#10243D]">—</p>
                  <p className="text-[10px] text-slate-500">Awaiting backend data</p>
                </div>
              </article>
            ))}
          </section>

          {/* Recent posts and breaking news */}
          <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.55fr_1fr]">
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

          {/* Charts and quick actions */}
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
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
              <EmptyState text={`Activity for ${period.toLowerCase()} will be charted using real post data.`} />
            </Panel>

            <Panel title="Posts by Status">
              <EmptyState text="Published, draft, and trashed post counts will appear here." />
            </Panel>

            <Panel title="Quick Actions">
              <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {[
                  ['Create New Post', 'posts', 'All Posts', 'bg-rose-50 text-rose-700'],
                  ['Manage Categories', 'categories', 'All Categories', 'bg-amber-50 text-amber-700'],
                  ['Add Breaking News', 'breaking', 'Breaking News', 'bg-violet-50 text-violet-700'],
                  ['Manage Advertisements', 'ads', 'Advertisements', 'bg-sky-50 text-sky-700'],
                ].map(([label, icon, page, color]) => (
                  <button
                    key={label}
                    onClick={() => selectPage(page)}
                    className={`flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition hover:brightness-95 ${color}`}
                  >
                    <Icon name={icon} className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>
            </Panel>
          </section>

          {active !== 'Dashboard' && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-bold">{active}</h2>
              <p className="mt-2 text-sm text-slate-500">
                The {active} page can be connected to its existing frontend
                component and API next.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
