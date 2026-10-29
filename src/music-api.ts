import { CatalogError, formatPrice } from './catalog-api'
import { createEvent, fetchEvents, type ClientEvent } from './venue-api'

export type MusicImage = { id: number; url: string; alt: string; tag: string }
export type MusicGenre = { id: number; name: string; description: string }
export type MusicTrack = { id: number; title: string; audioUrl: string; durationSeconds: number | null; isActive?: boolean }
export type MusicVideo = { id: number; title: string; description: string; videoUrl: string; thumbnailUrl: string; isActive?: boolean }
export type MusicRepertoireItem = { id: number; title: string; genre: string; notes: string; isActive?: boolean }
export type MusicPackage = {
  id: number
  name: string
  description: string
  durationMinutes: number | null
  durationOptions: string
  durations: number[]
  memberCount: number | null
  presentationType: string
  equipmentIncluded: string
  priceCents: number | null
  priceUnit: 'fijo' | 'desde' | 'cotizacion'
  conditions: string
  extras: string
  isActive?: boolean
}
export type MusicAddon = {
  id: number
  name: string
  description: string
  priceCents: number | null
  priceUnit: 'unidad' | 'fijo' | 'cotizacion'
  isActive?: boolean
}
export type MusicTechnical = {
  minSpace: string
  electricalRequirements: string
  needsStage: string
  soundIncluded: string
  lightingIncluded: string
  setupTime: string
  teardownTime: string
  accessRequirements: string
  restrictions: string
  travelNotes: string
}

export type MusicInfo = {
  artistName: string
  serviceType: string
  coverageArea: string
  presentation: string
  priceMode: '' | 'fijo' | 'desde' | 'cotizacion'
  technical: MusicTechnical
  genres: MusicGenre[]
  tracks: MusicTrack[]
  videos: MusicVideo[]
  repertoire: MusicRepertoireItem[]
  packages: MusicPackage[]
  addons: MusicAddon[]
  images: MusicImage[]
}

export type MusicService = {
  id: number
  title: string
  description: string
  priceCents: number | null
  isPublished: boolean
  providerId: number
  provider: { businessName: string; city: string; description: string }
  providerServices: { id: number; title: string; slug: string; categoryTitle: string }[]
  music: MusicInfo
}

export type MusicEstimate = { cents: number | null; pending: boolean; error: string }

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    credentials: 'same-origin',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new CatalogError(data.message || 'No se pudo completar la solicitud.', response.status)
    if (data.code) error.name = data.code
    throw error
  }
  return data
}

export const fetchMusic = (serviceId: number) =>
  requestJson<{ category: { title: string; imageUrl: string }; service: MusicService }>(`/api/categories/musica/services/${serviceId}`)

export const saveMusic = (kind: 'planner' | 'quote', serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ ok: boolean; created: boolean; message?: string; budgetCents?: number; estimatedCents?: number | null }>(
    `/api/categories/musica/services/${serviceId}/${kind === 'quote' ? 'quotes' : 'planner'}`,
    { method: 'POST', body: JSON.stringify(body) },
  )

export { createEvent, fetchEvents, type ClientEvent }

export const moneyLabel = (unit: string, cents: number | null) => {
  if (cents === null || unit === 'cotizacion' || unit === '') return 'Sujeto a cotización'
  if (unit === 'desde') return `Desde ${formatPrice(cents)}`
  if (unit === 'unidad') return `${formatPrice(cents)} por unidad`
  return formatPrice(cents)
}

const addAmount = (total: { cents: number; pending: boolean; hasAmount: boolean }, priceCents: number | null, unit: string, quantity = 1) => {
  if (priceCents === null || unit === 'cotizacion' || unit === 'desde' || unit === '') {
    return { ...total, pending: true, hasAmount: total.hasAmount || (unit === 'desde' && priceCents !== null), cents: unit === 'desde' && priceCents !== null ? total.cents + priceCents : total.cents }
  }
  if (unit === 'unidad') return { cents: total.cents + priceCents * quantity, pending: total.pending, hasAmount: true }
  return { cents: total.cents + priceCents, pending: total.pending, hasAmount: true }
}

export const estimateMusic = (service: MusicService, input: { packageId: number | null; durationMinutes: number | null; quantities: Record<number, number> }): MusicEstimate => {
  const music = service.music
  const selected = input.packageId ? music.packages.find((item) => item.id === input.packageId) || null : null
  if (selected && selected.durations.length > 0) {
    if (input.durationMinutes === null) return { cents: null, pending: true, error: 'Elige una duración disponible del paquete.' }
    if (!selected.durations.includes(input.durationMinutes)) return { cents: null, pending: true, error: 'Esa duración no está disponible en el paquete elegido.' }
  }
  let total = { cents: 0, pending: false, hasAmount: false }
  if (selected) total = addAmount(total, selected.priceCents, selected.priceUnit)
  else total = addAmount(total, service.priceCents, music.priceMode === 'fijo' ? 'fijo' : music.priceMode === 'desde' ? 'desde' : 'cotizacion')
  for (const addon of music.addons) {
    const quantity = input.quantities[addon.id]
    if (!quantity) continue
    total = addAmount(total, addon.priceCents, addon.priceUnit, quantity)
  }
  return { cents: total.hasAmount ? total.cents : null, pending: total.pending || !total.hasAmount, error: '' }
}

export const createOwnMusic = (title: string) =>
  requestJson<{ id: number }>('/api/provider/music', { method: 'POST', body: JSON.stringify({ title }) })

export const saveOwnMusic = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ ok: boolean }>(`/api/provider/music/${serviceId}`, { method: 'PUT', body: JSON.stringify(body) })

export const addMusicGenre = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/music/${serviceId}/genres`, { method: 'POST', body: JSON.stringify(body) })

export const removeMusicGenre = (serviceId: number, genreId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/music/${serviceId}/genres/${genreId}`, { method: 'DELETE' })

export const addMusicTrack = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/music/${serviceId}/tracks`, { method: 'POST', body: JSON.stringify(body) })

export const removeMusicTrack = (serviceId: number, trackId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/music/${serviceId}/tracks/${trackId}`, { method: 'DELETE' })

export const addMusicVideo = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/music/${serviceId}/videos`, { method: 'POST', body: JSON.stringify(body) })

export const removeMusicVideo = (serviceId: number, videoId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/music/${serviceId}/videos/${videoId}`, { method: 'DELETE' })

export const addMusicRepertoire = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/music/${serviceId}/repertoire`, { method: 'POST', body: JSON.stringify(body) })

export const removeMusicRepertoire = (serviceId: number, itemId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/music/${serviceId}/repertoire/${itemId}`, { method: 'DELETE' })

export const addMusicPackage = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/music/${serviceId}/packages`, { method: 'POST', body: JSON.stringify(body) })

export const removeMusicPackage = (serviceId: number, packageId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/music/${serviceId}/packages/${packageId}`, { method: 'DELETE' })

export const addMusicAddon = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/music/${serviceId}/addons`, { method: 'POST', body: JSON.stringify(body) })

export const removeMusicAddon = (serviceId: number, addonId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/music/${serviceId}/addons/${addonId}`, { method: 'DELETE' })

export const addMusicImage = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/music/${serviceId}/images`, { method: 'POST', body: JSON.stringify(body) })

export const videoEmbedUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace('/', '')
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
    }
    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v')
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
    }
    if (parsed.hostname.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop()
      return id ? `https://player.vimeo.com/video/${id}` : null
    }
  } catch {
    return null
  }
  return null
}

export const isDirectVideo = (url: string) => /\.(mp4|webm|ogg)(\?|$)/i.test(url)
