
import { useState } from 'react'

type TopbarProps = {
  search: string
  onSearchChange: (value: string) => void
  onOpenMobileMenu: () => void
  onOpenProfile: () => void
  administratorName?: string
  administratorEmail?: string
  administratorRole?: string
}

export default function Topbar({
  search,
  onSearchChange,
  onOpenMobileMenu,
  onOpenProfile,
  administratorName = 'Administrator',
  administratorEmail = '',
  administratorRole = 'Administrator',
}: TopbarProps) {
  const [profileOpen, setProfileOpen] = useState(false)

  const initialsSource =
    administratorName.trim() || administratorEmail.trim() || 'Administrator'

  const initial =
    initialsSource
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'A'

  function handleOpenProfile() {
    setProfileOpen(false)
    onOpenProfile()
  }

  function handleSignOut() {
    sessionStorage.removeItem('access_token')
    sessionStorage.removeItem('token_type')
    window.location.assign('/')
  }

  return (
    <header className="sticky top-0 z-20 flex h-[64px] w-full min-w-0 items-center gap-3 border-b border-slate-200 bg-white/95 px-3 backdrop-blur sm:px-6">
      {/* Mobile navigation */}
      <button
        type="button"
        aria-label="Open navigation"
        onClick={onOpenMobileMenu}
        className="shrink-0 rounded-lg p-2 text-slate-700 transition hover:bg-slate-100 lg:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M4 6h16 M4 12h16 M4 18h16" />
        </svg>
      </button>

      {/* Search */}
      <div className="relative min-w-0 max-w-[540px] flex-1">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        >
          <circle cx="10.5" cy="10.5" r="7.5" />
          <path d="m16 16 5 5" />
        </svg>

        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search articles, categories, or anything..."
          aria-label="Search articles and categories"
          className="h-10 w-full rounded-lg border border-slate-100 bg-[#F3F6FA] pl-10 pr-3 text-xs outline-none transition focus:border-[#173B67] focus:ring-2 focus:ring-[#173B67]/10 sm:text-sm"
        />
      </div>

      {/* Right-side actions */}
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative shrink-0 rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4" />
          </svg>

          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#D9273B] px-1 text-[9px] leading-4 text-white">
            3
          </span>
        </button>

        {/* Administrator profile */}
        <div className="relative">
          <button
            type="button"
            aria-label="Administrator profile menu"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((open) => !open)}
            className="flex items-center gap-2 rounded-xl p-1.5 text-left transition hover:bg-slate-50 sm:gap-3 sm:px-2"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#E3EAF4] font-bold text-[#173B67]">
              {initial}
            </span>

            {/* ADMIN first, bold email second */}
            <span className="hidden min-w-0 md:block">
              <span className="block text-xs font-semibold text-slate-800">
                ADMIN
              </span>

              <span className="block max-w-[220px] truncate text-xs font-bold text-slate-800">
                {administratorEmail || 'Email unavailable'}
              </span>
            </span>

            {/* Dropdown arrow */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`hidden h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 sm:block ${
                profileOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {profileOpen && (
            <>
              <button
                type="button"
                aria-label="Close profile menu"
                className="fixed inset-0 z-30 cursor-default"
                onClick={() => setProfileOpen(false)}
              />

              <div
                role="menu"
                className="absolute right-0 top-full z-40 mt-2 w-64 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              >
                {/* Account details */}
                <div className="border-b border-slate-100 bg-[#F8FAFD] p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#E3EAF4] font-bold text-[#173B67]">
                      {initial}
                    </span>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800">
                        ADMIN
                      </p>

                      <p className="break-all text-sm font-bold text-[#10243D]">
                        {administratorEmail || 'Email unavailable'}
                      </p>

                      <p className="mt-1 text-xs font-medium text-[#173B67]">
                        {administratorRole}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-2">
                  {/* Profile navigation */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleOpenProfile}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      className="h-5 w-5 text-slate-500"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="8" r="4" />
                      <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                    </svg>

                    Profile
                  </button>

                  <div className="my-2 border-t border-slate-100" />

                  {/* Sign out */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#C32632] transition hover:bg-red-50"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path d="M10 17l5-5-5-5 M15 12H3 M21 4v16" />
                    </svg>

                    Logout
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
