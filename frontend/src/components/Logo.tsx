
import logo from '../assets/telugu-front-logo.jpeg'

type LogoProps = {
  className?: string
}

export default function Logo({ className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={logo}
        alt="Telugu Front logo"
        className="h-14 w-14 shrink-0 rounded-full object-contain sm:h-16 sm:w-16"
      />

      <span className="text-xl font-extrabold tracking-tight text-[#101B2C] sm:text-2xl">
        Telugu <span className="text-[#C32632]">Front</span>
      </span>
    </div>
  )
}
