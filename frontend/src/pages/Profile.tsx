
import { useCallback, useEffect, useState } from 'react'
import { getMyProfile } from '../services/profile'
import type { AdminProfile } from '../services/profile'

type ProfileProps = {
  onBack: () => void
}

export default function Profile({ onBack }: ProfileProps) {
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Fetch profile data. Used for the initial request and retry.
  const loadProfile = useCallback(async () => {
    setError('')
    setLoading(true)

    try {
      const result = await getMyProfile()
      setProfile(result)
    } catch (err) {
      console.error('Unable to load administrator profile:', err)
      setError('Unable to load your profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial profile request.
  // State updates happen after the asynchronous request completes.
  useEffect(() => {
    let cancelled = false

    async function fetchProfile() {
      try {
        const result = await getMyProfile()

        if (!cancelled) {
          setProfile(result)
          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Unable to load administrator profile:', err)
          setError('Unable to load your profile. Please try again.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchProfile()

    return () => {
      cancelled = true
    }
  }, [])

  const name =
    profile?.full_name?.trim() ||
    profile?.name?.trim() ||
    'Administrator'

  const email = profile?.email || ''
  const role = profile?.role || 'Administrator'

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part[0])
      .join('')
      .toUpperCase() || 'A'

  async function handleRetry() {
    setLoading(true)
    await loadProfile()
  }

  return (
    <div className="min-h-full space-y-6">
      {/* Profile heading and Back button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#10243D]">
            Profile
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Current administrator account
          </p>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-[#173B67] transition hover:border-[#173B67] hover:bg-slate-50 sm:self-auto"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M19 12H5 M12 19l-7-7 7-7" />
          </svg>

          Back to Dashboard
        </button>
      </div>

      {/* Administrator profile card */}
      <section className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {loading ? (
          <div
            className="flex items-center gap-4"
            aria-live="polite"
            aria-label="Loading profile"
          >
            <div className="h-16 w-16 shrink-0 animate-pulse rounded-2xl bg-slate-100" />

            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-52 max-w-full animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ) : error ? (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4"
            role="alert"
          >
            <p className="text-sm text-red-700">{error}</p>

            <button
              type="button"
              onClick={() => void handleRetry()}
              className="mt-3 text-sm font-semibold text-[#C32632] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : profile ? (
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-red-100 text-xl font-bold text-[#C32632]">
              {initials}
            </div>

            <div className="min-w-0 space-y-1">
              <h2 className="break-words text-lg font-bold text-[#10243D] sm:text-xl">
                {name}
              </h2>

              {email && (
                <p className="break-all text-sm text-slate-500">
                  {email}
                </p>
              )}

              <p className="break-words text-sm font-medium text-[#173B67]">
                {role}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No profile information was returned.
          </p>
        )}
      </section>
    </div>
  )
}
