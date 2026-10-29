import type { Role } from './navigation'

export type ProviderProfile = {
  businessName: string
  city: string
  description: string
  isComplete: boolean
}

export type SessionUser = {
  id: number
  name: string
  email: string
  username: string
  role: Role
  initials: string
  avatarUrl: string | null
  phone: string | null
  providerProfile: ProviderProfile | null
}
