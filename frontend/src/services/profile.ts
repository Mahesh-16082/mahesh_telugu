import api from '../lib/api'

export type AdminProfile = {
  id?: number | string
  name?: string | null
  full_name?: string | null
  email: string
  role: string
  is_active?: boolean
  created_at?: string | null
}

export async function getMyProfile(): Promise<AdminProfile> {
  const response = await api.get<AdminProfile>('/api/auth/me')
  return response
}
