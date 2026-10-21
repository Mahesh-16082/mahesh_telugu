
import { useState, type FormEvent } from 'react'
import Logo from '../components/Logo'
import loginBackground from '../assets/login-background.png'
import { requestOtp, verifyOtp } from '../services/auth'

type LoginStep = 'email' | 'otp'

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  )
}

function FeatureIcon({
  type,
}: {
  type: 'news' | 'coverage' | 'community'
}) {
  const iconProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      {...iconProps}
      aria-hidden="true"
    >
      {type === 'news' && (
        <path d="M13 2 4 14h7l-1 8 10-13h-7l1-7Z" />
      )}

      {type === 'coverage' && (
        <>
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M14 3v5h5M9 12h7M9 16h7" />
        </>
      )}

      {type === 'community' && (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20v-2a6 6 0 0 1 12 0v2z" />
          <path d="M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1" />
        </>
      )}
    </svg>
  )
}

export default function Login() {
  const [step, setStep] = useState<LoginStep>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>(
    'info',
  )

  function showMessage(
    text: string,
    type: 'success' | 'error' | 'info' = 'info',
  ) {
    setMessage(text)
    setMessageType(type)
  }

  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    const normalizedEmail = email.trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      showMessage('Please enter a valid email address.', 'error')
      return
    }

    setLoading(true)

    try {
      const result = await requestOtp(normalizedEmail)

      setEmail(normalizedEmail)
      setOtp('')
      setStep('otp')

      showMessage(
        `${result.message} Code expires in ${Math.ceil(
          result.expires_in_seconds / 60,
        )} minute(s).`,
        'success',
      )
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : 'Unable to send OTP.',
        'error',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    if (!/^\d{6}$/.test(otp)) {
      showMessage('Please enter the complete 6-digit OTP.', 'error')
      return
    }

    setLoading(true)

    try {
      const result = await verifyOtp(email, otp)

      // Keep the token for this browser tab's session.
      sessionStorage.setItem('access_token', result.access_token)
      sessionStorage.setItem('token_type', result.token_type)

      showMessage(`${result.message} Login successful.`, 'success')

      // Dashboard navigation can be added when its route is available.
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : 'OTP verification failed.',
        'error',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleResendOtp() {
    if (loading) return

    setMessage('')
    setLoading(true)

    try {
      const result = await requestOtp(email)

      setOtp('')
      showMessage(result.message, 'success')
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : 'Unable to resend OTP.',
        'error',
      )
    } finally {
      setLoading(false)
    }
  }

  function handleChangeEmail() {
    if (loading) return

    setStep('email')
    setOtp('')
    setMessage('')
  }

  const messageClasses = {
    success: 'border-green-200 bg-green-50 text-green-800',
    error: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-[#DCE4EF] bg-[#F5F8FC] text-[#173B67]',
  }

  return (
    <main className="grid min-h-screen bg-[#F5F8FC] lg:grid-cols-[1.08fr_0.92fr]">
      {/* LEFT: SCENIC BRANDING PANEL */}
      <section
        className="relative isolate flex min-h-[760px] flex-col overflow-hidden bg-cover bg-center bg-no-repeat px-6 py-7 sm:px-10 sm:py-9 lg:min-h-screen lg:px-14 xl:px-20"
        style={{ backgroundImage: `url(${loginBackground})` }}
      >
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-white/65 via-white/25 to-transparent" />

        <Logo />

        <div className="mt-14 max-w-2xl sm:mt-16 lg:mt-[9vh]">
          <p className="mb-4 text-[11px] font-bold tracking-[0.24em] text-[#173B67]">
            TELUGU FRONT · ADMIN PORTAL
          </p>

          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-[-1.5px] text-[#101B2C] sm:text-5xl xl:text-[60px]">
            News that speaks
            <br />
            to every <span className="text-[#C32632]">Telugu.</span>
          </h1>

          <p className="mt-5 text-lg text-[#555D6B] sm:text-[22px]">
            Fast. Reliable. Comprehensive.
          </p>

          <div className="mt-10 space-y-5 sm:space-y-6">
            <div className="flex items-center gap-4">
              <div className="grid h-[60px] w-[60px] shrink-0 place-items-center rounded-2xl bg-white/75 text-[#C32632] shadow-sm backdrop-blur-sm">
                <FeatureIcon type="news" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#172235] sm:text-lg">
                  Breaking News
                </h2>
                <p className="mt-1 text-sm text-[#555D6B] sm:text-base">
                  Real-time updates
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="grid h-[60px] w-[60px] shrink-0 place-items-center rounded-2xl bg-white/75 text-[#C32632] shadow-sm backdrop-blur-sm">
                <FeatureIcon type="coverage" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#172235] sm:text-lg">
                  In-depth Coverage
                </h2>
                <p className="mt-1 text-sm text-[#555D6B] sm:text-base">
                  Politics, Movies, Business &amp; more
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="grid h-[60px] w-[60px] shrink-0 place-items-center rounded-2xl bg-white/75 text-[#C32632] shadow-sm backdrop-blur-sm">
                <FeatureIcon type="community" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#172235] sm:text-lg">
                  For a Global Telugu Community
                </h2>
                <p className="mt-1 text-sm text-[#555D6B] sm:text-base">
                  From Andhra Pradesh to the world
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer className="relative mt-auto -mx-6 -mb-7 overflow-hidden bg-gradient-to-t from-[#101B2C]/95 via-[#101B2C]/80 to-transparent px-6 pb-8 pt-24 text-white sm:-mx-10 sm:-mb-9 sm:px-10 lg:-mx-14 lg:-mb-9 lg:px-14 xl:-mx-20 xl:px-20">
          <p className="text-lg font-bold sm:text-xl">
            “తెలుగు మనసు, ప్రపంచ దృష్టి”
          </p>

          <div className="my-4 h-[5px] w-[74px] rounded-full bg-[#E32636]" />

          <p className="flex flex-wrap gap-x-3 gap-y-2 text-[10px] tracking-[0.16em] text-white/80 sm:text-xs">
            PEOPLE <span>|</span> NEWS <span>|</span> CULTURE <span>|</span>
            OPPORTUNITIES
          </p>
        </footer>
      </section>

      {/* RIGHT: LOGIN CARD */}
      <section className="flex min-h-[680px] items-center justify-center bg-[#F5F8FC] px-4 py-10 sm:px-8 lg:min-h-screen lg:px-10 xl:px-14">
        <div className="w-full max-w-[590px] rounded-2xl border border-[#E5E8ED] bg-white/95 px-6 py-9 shadow-[0_20px_65px_rgba(16,35,61,0.08)] sm:px-10 sm:py-12 lg:px-10 xl:px-12">
          <Logo className="mx-auto justify-center" />

          {step === 'email' ? (
            <>
              <h2 className="mt-8 text-center text-3xl font-bold tracking-tight text-[#101B2C] sm:text-[36px]">
                Welcome Back
              </h2>

              <p className="mt-3 text-center text-sm leading-6 text-[#687080] sm:text-base">
                Sign in to your Telugu Front Admin Portal
              </p>

              <form onSubmit={handleSendOtp} className="mt-9">
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-[#172235] sm:text-base"
                >
                  Email
                </label>

                <div className="flex h-[60px] items-center gap-3 rounded-xl border border-[#D7DCE3] bg-white px-4 transition focus-within:border-[#173B67] focus-within:ring-4 focus-within:ring-[#173B67]/10">
                  <span className="shrink-0 text-[#7B8492]">
                    <MailIcon />
                  </span>

                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#172235] outline-none placeholder:text-[#8A929E] sm:text-base"
                    required
                  />
                </div>

                <p className="mt-3 text-xs leading-5 text-[#727B88]">
                  We will send a one-time verification code to your email.
                </p>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 flex h-[60px] w-full items-center justify-center gap-3 rounded-xl bg-[#C32632] px-4 text-base font-semibold text-white transition hover:bg-[#A91F2A] focus:outline-none focus:ring-4 focus:ring-[#C32632]/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                  {!loading && <span aria-hidden="true">→</span>}
                </button>
              </form>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleChangeEmail}
                disabled={loading}
                className="mt-7 text-sm font-semibold text-[#C32632] hover:underline disabled:opacity-50"
              >
                ← Change email
              </button>

              <div className="mx-auto mt-6 grid h-14 w-14 place-items-center rounded-full bg-[#F5F8FC] text-[#173B67]">
                <MailIcon />
              </div>

              <h2 className="mt-5 text-center text-3xl font-bold tracking-tight text-[#101B2C] sm:text-[36px]">
                Verify OTP
              </h2>

              <p className="mt-3 text-center text-sm text-[#687080]">
                Enter the 6-digit code sent to
              </p>

              <p className="mt-1 break-all text-center text-sm font-semibold text-[#172235]">
                {email}
              </p>

              <form onSubmit={handleVerifyOtp} className="mt-7">
                <label
                  htmlFor="otp"
                  className="mb-2 block text-sm font-semibold text-[#172235]"
                >
                  Verification code
                </label>

                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  className="h-[60px] w-full rounded-xl border border-[#D7DCE3] bg-white px-4 text-center text-xl tracking-[0.5em] text-[#172235] outline-none placeholder:text-sm placeholder:tracking-normal focus:border-[#173B67] focus:ring-4 focus:ring-[#173B67]/10"
                  required
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 flex h-[60px] w-full items-center justify-center gap-3 rounded-xl bg-[#C32632] px-4 text-base font-semibold text-white transition hover:bg-[#A91F2A] focus:outline-none focus:ring-4 focus:ring-[#C32632]/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                  {!loading && <span aria-hidden="true">→</span>}
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="mt-5 w-full text-center text-xs text-[#687080] hover:text-[#C32632] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Didn&apos;t receive the code?{' '}
                  <span className="font-semibold text-[#C32632]">
                    {loading ? 'Please wait...' : 'Resend OTP'}
                  </span>
                </button>
              </form>
            </>
          )}

          {message && (
            <p
              role="status"
              aria-live="polite"
              className={`mt-5 rounded-lg border p-3 text-xs leading-5 ${messageClasses[messageType]}`}
            >
              {message}
            </p>
          )}

          <div className="mt-8 border-t border-[#E5E8ED] pt-5">
            <p className="text-center text-xs leading-5 text-[#727B88]">
              Only authorized admin email addresses can access this portal.
            </p>

            <p className="mt-5 text-center text-xs text-[#727B88]">
              Don&apos;t have access?{' '}
              <a
                href="mailto:admin@telugufront.com"
                className="font-semibold text-[#C32632] hover:underline"
              >
                Contact your administrator
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
