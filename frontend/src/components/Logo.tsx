
import logo from '../assets/telugu-front-logo.jpeg'

type LogoProps = {
  collapsed?: boolean
}

export default function Logo({ collapsed = false }: LogoProps) {
  return (
    <div className="flex w-full items-center gap-3 overflow-hidden">
      <img
        src={logo}
        alt="Telugu Front"
        className="h-11 w-11 shrink-0 rounded-full bg-white object-contain"
      />

      {!collapsed && (
        <div className="min-w-0">
          <p className="whitespace-nowrap text-[18px] font-bold leading-tight tracking-tight text-white">
            Telugu <span className="text-[#EF3340]">Front</span>
          </p>
          <p className="mt-1 whitespace-nowrap text-[9px] font-medium tracking-[0.24em] text-slate-300">
            ADMIN PORTAL
          </p>
        </div>
      )}
    </div>
  )
}
