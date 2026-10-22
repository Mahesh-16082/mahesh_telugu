import { useState } from 'react'
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
  { label: 'Posts', icon: 'posts', children: ['All Posts', 'Drafts', 'Published', 'Trash'] },
  { label: 'Categories', icon: 'categories', children: ['All Categories', 'Trash'] },
  { label: 'Breaking News', icon: 'breaking' },
  { label: 'Cards', icon: 'cards' },
  { label: 'Advertisements', icon: 'ads' },
]

function MenuIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    posts: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8',
    categories: 'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    breaking: 'M13 2 4 14h7l-1 8 10-13h-7z',
    cards: 'M3 3h18v18H3z M3 16l6-6 4 4 3-3 5 5',
    ads: 'M3 11v2h4l5 5V6l-5 5z M16 9a5 5 0 0 1 0 6 M18 5a10 10 0 0 1 0 14',
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path d={paths[name] ?? paths.dashboard} />
    </svg>
  )
}

export default function Sidebar({ active, onNavigate, mobileOpen, onCloseMobile }: SidebarProps) {
  const [expanded, setExpanded] = useState<string[]>(['Posts', 'Categories'])

  function toggleGroup(label: string) {
    setExpanded(current => current.includes(label) ? current.filter(item => item !== label) : [...current, label])
  }

  return (
    <>
      {mobileOpen && (
        <button aria-label="Close navigation overlay" onClick={onCloseMobile} className="fixed inset-0 z-30 bg-black/40 lg:hidden" />
      )}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#10243D] text-white transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[72px] shrink-0 items-center border-b border-white/10 px-5">
          <Logo />
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4" aria-label="Main navigation">
          {menuItems.map(item => {
            const isActive = active === item.label
            const isExpanded = expanded.includes(item.label)
            return (
              <div key={item.label}>
                <button
                  onClick={() => item.children ? toggleGroup(item.label) : onNavigate(item.label)}
                  aria-expanded={item.children ? isExpanded : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors ${isActive ? 'bg-[#D9273B] font-semibold text-white shadow-md' : 'text-slate-200 hover:bg-white/10'}`}
                >
                  <MenuIcon name={item.icon} />
                  <span className="flex-1">{item.label}</span>
                  {item.children && <span className="text-xs">{isExpanded ? '⌃' : '⌄'}</span>}
                </button>

                {item.children && isExpanded && (
                  <div className="ml-7 mt-1 space-y-1 border-l border-white/15 pl-3">
                    {item.children.map(child => (
                      <button
                        key={`${item.label}-${child}`}
                        onClick={() => onNavigate(child)}
                        className={`block w-full rounded-md px-3 py-2.5 text-left text-xs transition-colors ${active === child ? 'bg-white/10 font-semibold text-white' : 'text-slate-300 hover:text-white'}`}
                      >
                        {child}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-600 font-bold">A</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Administrator</p>
              <p className="text-xs text-slate-400">Admin Portal</p>
            </div>
            <button title="Sign out" onClick={() => { sessionStorage.removeItem('access_token'); sessionStorage.removeItem('token_type'); window.location.assign('/') }} className="rounded-md p-2 text-slate-300 hover:bg-white/10" aria-label="Sign out">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M10 17l5-5-5-5 M15 12H3 M21 4v16" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

