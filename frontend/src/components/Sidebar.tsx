
import { useEffect, useState } from 'react'
import Logo from './Logo'

type SidebarProps = {
  active: string
  onNavigate: (page: string) => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

type MenuItem = {
  label: string
  icon: string
  children?: string[]
}

const menuItems: MenuItem[] = [
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

function MenuIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    dashboard:
      'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    posts:
      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8',
    categories:
      'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    breaking: 'M13 2 4 14h7l-1 8 10-13h-7z',
    cards: 'M3 3h18v18H3z M3 16l6-6 4 4 3-3 5 5',
    ads: 'M3 11v2h4l5 5V6l-5 5z M16 9a5 5 0 0 1 0 6 M18 5a10 10 0 0 1 0 14',
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.dashboard} />
    </svg>
  )
}

export default function Sidebar({
  active,
  onNavigate,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const [expanded, setExpanded] = useState<string[]>([
    'Posts',
    'Categories',
  ])

  // Close the mobile sidebar when Escape is pressed.
  useEffect(() => {
    if (!mobileOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseMobile()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileOpen, onCloseMobile])

  function toggleGroup(label: string) {
    setExpanded((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label],
    )
  }

  function handleNavigate(page: string) {
    onNavigate(page)
    onCloseMobile()
  }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {/* Sidebar drawer */}
      <aside
        id="admin-sidebar"
        aria-label="Admin navigation"
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(260px,85vw)] flex-col overflow-hidden bg-[#10243D] text-white shadow-xl transition-transform duration-200 ease-in-out lg:w-[260px] lg:translate-x-0 lg:shadow-none ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo and close button */}
        <div className="flex h-[72px] shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 sm:px-5">
          <div className="min-w-0 flex-1 overflow-hidden">
            <Logo />
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
            title="Close sidebar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 lg:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M18 6 6 18 M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation menu */}
        <nav
          className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Main navigation"
        >
          {menuItems.map((item) => {
            const isActive =
              active === item.label ||
              (item.label === 'Posts' &&
                ['All Posts', 'Drafts', 'Published', 'Posts Trash'].includes(
                  active,
                )) ||
              (item.label === 'Categories' &&
                ['All Categories', 'Category Trash'].includes(active))

            const isExpanded = expanded.includes(item.label)

            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() =>
                    item.children
                      ? toggleGroup(item.label)
                      : handleNavigate(item.label)
                  }
                  aria-expanded={item.children ? isExpanded : undefined}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-[#D9273B] font-semibold text-white shadow-md'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <MenuIcon name={item.icon} />

                  <span className="min-w-0 flex-1 truncate">
                    {item.label}
                  </span>

                  {item.children && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`h-4 w-4 shrink-0 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  )}
                </button>

                {item.children && isExpanded && (
                  <div className="ml-7 mt-1 space-y-1 border-l border-white/15 pl-3">
                    {item.children.map((child) => {
                      const page =
                        child === 'Trash'
                          ? item.label === 'Categories'
                            ? 'Category Trash'
                            : 'Posts Trash'
                          : child

                      const selected = active === page

                      return (
                        <button
                          key={`${item.label}-${child}`}
                          type="button"
                          onClick={() => handleNavigate(page)}
                          className={`block min-h-10 w-full rounded-md px-3 py-2.5 text-left text-xs transition-colors ${
                            selected
                              ? 'bg-white/10 font-semibold text-white'
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {child}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
