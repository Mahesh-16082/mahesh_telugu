type TopbarProps = {
  search: string
  onSearchChange: (value: string) => void
  onOpenMobileMenu: () => void
  administratorName?: string
}

export default function Topbar({
  search,
  onSearchChange,
  onOpenMobileMenu,
  administratorName = 'Administrator',
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-[64px] items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <button
        aria-label="Open navigation"
        onClick={onOpenMobileMenu}
        className="rounded-md p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5">
          <path d="M4 6h16 M4 12h16 M4 18h16" />
        </svg>
      </button>

      <div className="relative max-w-[540px] flex-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
          <circle cx="10.5" cy="10.5" r="7.5" />
          <path d="m16 16 5 5" />
        </svg>
        <input
          value={search}
          onChange={event => onSearchChange(event.target.value)}
          placeholder="Search articles, categories, or anything..."
          aria-label="Search articles and categories"
          className="h-10 w-full rounded-lg border border-slate-100 bg-[#F3F6FA] pl-10 pr-3 text-xs outline-none transition focus:border-[#173B67] focus:ring-2 focus:ring-[#173B67]/10 sm:text-sm"
        />
      </div>

      <button aria-label="Notifications" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4" />
        </svg>
        <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#D9273B] px-1 text-[9px] leading-4 text-white">3</span>
      </button>

      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#E3EAF4] font-bold text-[#173B67]">A</div>
        <div className="hidden md:block">
          <p className="text-xs font-semibold text-slate-800">{administratorName}</p>
          <p className="text-[10px] text-slate-500">Administrator</p>
        </div>
        <span className="hidden px-1 text-xs text-slate-500 sm:inline">⌄</span>
      </div>
    </header>
  )
}
