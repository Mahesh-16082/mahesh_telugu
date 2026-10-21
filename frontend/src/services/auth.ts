
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
).replace(/\/+$/, '')

export interface OTPRequestResponse {
  message: string
  expires_in_seconds: number
}

export interface OTPVerifyResponse {
  message: string
  access_token: string
  token_type: string
}

async function post<T>(path: string, body: object): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error(
      'Cannot connect to the server. Check that FastAPI is running.',
    )
  }

  const data: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const errorData = data as {
      detail?: string | { msg?: string }[]
      message?: string
    } | null

    let errorMessage = `Request failed (${response.status}).`

    if (typeof errorData?.detail === 'string') {
      errorMessage = errorData.detail
    } else if (Array.isArray(errorData?.detail)) {
      errorMessage = errorData.detail
        .map((item) => item.msg ?? 'Invalid request')
        .join(', ')
    } else if (errorData?.message) {
      errorMessage = errorData.message
    }

    throw new Error(errorMessage)
  }

  if (data === null || typeof data !== 'object') {
    throw new Error('The server returned an invalid response.')
  }

  return data as T
}

export function requestOtp(email: string): Promise<OTPRequestResponse> {
  return post<OTPRequestResponse>('/api/auth/request-otp', {
    email: email.trim(),
  })
}

export function verifyOtp(
  email: string,
  otp: string,
): Promise<OTPVerifyResponse> {
  return post<OTPVerifyResponse>('/api/auth/verify-otp', {
    email: email.trim(),
    otp,
  })
}
