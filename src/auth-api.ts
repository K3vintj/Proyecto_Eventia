import type { SessionUser } from './session'

type ApiError = Error & { fields?: Record<string, string> }

type ApiFailure = {
  message?: string
  fields?: Record<string, string>
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor.')
  }
  const data = (await response.json().catch(() => ({}))) as T & ApiFailure
  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo completar la solicitud.') as ApiError
    error.fields = data.fields
    throw error
  }
  return data
}

export const fetchSession = () => request<{ user: SessionUser | null }>('/api/auth/me')

export const login = (input: { identifier: string; password: string; remember: boolean }) =>
  request<{ user: SessionUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) })

export const logout = () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })

export const register = (input: {
  fullName: string
  email: string
  username: string
  password: string
  confirmPassword: string
  role: 'cliente' | 'proveedor'
  acceptedTerms: boolean
}) => request<{ user: SessionUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(input) })

export const forgotPassword = (email: string) =>
  request<{ delivery: 'development'; message: string; recoveryPath: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })

export const validateResetToken = (token: string) =>
  request<{ valid: boolean }>(`/api/auth/reset-password/${encodeURIComponent(token)}`)

export const resetPassword = (input: { token: string; password: string; confirmPassword: string }) =>
  request<{ ok: boolean; message: string }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(input) })

export const saveProviderProfile = (input: { businessName: string; city: string; description: string }) =>
  request<{ user: SessionUser }>('/api/provider/profile', { method: 'PUT', body: JSON.stringify(input) })

export const saveAccountProfile = (input: { fullName: string; email: string; avatarUrl: string; phone: string }) =>
  request<{ user: SessionUser }>('/api/account/profile', { method: 'PUT', body: JSON.stringify(input) })

export const changeAccountPassword = (input: { currentPassword: string; password: string; confirmPassword: string }) =>
  request<{ ok: boolean; message: string }>('/api/account/password', { method: 'PUT', body: JSON.stringify(input) })

export const fetchAdminUsers = () => request<{ users: SessionUser[] }>('/api/admin/users')

let pendingNotice = ''

export const setLoginNotice = (message: string) => {
  pendingNotice = message
}

export const takeLoginNotice = () => {
  const message = pendingNotice
  pendingNotice = ''
  return message
}
