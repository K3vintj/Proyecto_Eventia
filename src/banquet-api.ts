import { CatalogError, formatPrice } from './catalog-api'
import type { DecorInfo } from './decoration-api'
import type { MusicInfo } from './music-api'
import type { WaitstaffInfo } from './waitstaff-api'
import type { FurnitureInfo } from './furniture-api'
import { createEvent, fetchEvents, type ClientEvent } from './venue-api'

export type BanquetPriceUnit = 'persona' | 'fijo' | 'cotizacion'
export type MenuCourse = 'entrada' | 'fuerte' | 'guarnicion' | 'postre' | 'bebida' | 'otro'
export type OfferingInclusion = 'incluido' | 'opcional' | 'no_incluido'

export type BanquetDish = {
  id: number
  course: MenuCourse
  name: string
  optionGroup: string
}

export type BanquetImage = {
  id: number
  url: string
  alt: string
  packageId?: number | null
}

export type BanquetPackage = {
  id: number
  name: string
  description: string
  priceCents: number | null
  priceUnit: BanquetPriceUnit
  minGuests: number | null
  conditions: string
  isActive?: boolean
  dishes: BanquetDish[]
  images: BanquetImage[]
}

export type BanquetOffering = {
  id: number
  name: string
  inclusion: OfferingInclusion
  priceCents: number | null
  priceUnit: BanquetPriceUnit
}

export type BanquetInfo = {
  serviceType: string
  coverageArea: string
  priceMode: BanquetPriceUnit | ''
  guestMin: number | null
  guestMax: number | null
  packages: BanquetPackage[]
  offerings: BanquetOffering[]
}

export type BanquetService = {
  id: number
  title: string
  description: string
  priceCents: number | null
  imageUrl: string | null
  isPublished: boolean
  providerId: number
  provider: { businessName: string; city: string; description: string }
  images: BanquetImage[]
  providerServices: { id: number; title: string; slug: string; categoryTitle: string }[]
  banquet: BanquetInfo
}

export type BanquetSelection = {
  packageId: number | null
  guests: number | null
  menuOptionIds: number[]
  addonIds: number[]
}

export type BanquetEstimate = {
  cents: number | null
  pending: boolean
  error: string
}

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

export const fetchBanquet = (serviceId: number) =>
  requestJson<{ category: { title: string; imageUrl: string }; service: BanquetService }>(`/api/categories/banquetes/services/${serviceId}`)

export const saveBanquet = (kind: 'planner' | 'quote', serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ ok: boolean; created: boolean; message?: string; budgetCents?: number; estimatedCents?: number | null }>(
    `/api/categories/banquetes/services/${serviceId}/${kind === 'quote' ? 'quotes' : 'planner'}`,
    { method: 'POST', body: JSON.stringify(body) },
  )

export { createEvent, fetchEvents, type ClientEvent }

const courseLabels: Record<MenuCourse, string> = {
  entrada: 'Entradas',
  fuerte: 'Plato fuerte',
  guarnicion: 'Guarniciones',
  postre: 'Postres',
  bebida: 'Bebidas',
  otro: 'Otros',
}

export const courseLabel = (course: MenuCourse) => courseLabels[course]

export const unitLabel = (unit: BanquetPriceUnit | '', cents: number | null) => {
  if (cents === null || unit === 'cotizacion') return 'Sujeto a cotización'
  if (unit === 'persona') return `${formatPrice(cents)} por persona`
  return formatPrice(cents)
}

const addAmount = (total: { cents: number; pending: boolean; hasAmount: boolean }, priceCents: number | null, unit: BanquetPriceUnit, guests: number | null) => {
  if (priceCents === null || unit === 'cotizacion') return { ...total, pending: true }
  if (unit === 'persona') {
    if (!guests) return { ...total, pending: true }
    return { cents: total.cents + priceCents * guests, pending: total.pending, hasAmount: true }
  }
  return { cents: total.cents + priceCents, pending: total.pending, hasAmount: true }
}

export const estimateBanquet = (service: BanquetService, selection: BanquetSelection): BanquetEstimate => {
  const { guests } = selection
  const banquet = service.banquet
  if (banquet.guestMin !== null && guests !== null && guests < banquet.guestMin) {
    return { cents: null, pending: true, error: `Este banquete atiende desde ${banquet.guestMin.toLocaleString('es-MX')} invitados.` }
  }
  if (banquet.guestMax !== null && guests !== null && guests > banquet.guestMax) {
    return { cents: null, pending: true, error: `Este banquete atiende hasta ${banquet.guestMax.toLocaleString('es-MX')} invitados.` }
  }
  const selected = selection.packageId === null ? null : banquet.packages.find((item) => item.id === selection.packageId) || null
  if (selected?.minGuests && (guests === null || guests < selected.minGuests)) {
    return { cents: null, pending: true, error: `Este paquete pide al menos ${selected.minGuests.toLocaleString('es-MX')} invitados.` }
  }
  if ((selected?.priceUnit === 'persona' || (!selected && banquet.priceMode === 'persona')) && guests === null) {
    return { cents: null, pending: true, error: 'Indica el número de invitados.' }
  }
  let total = { cents: 0, pending: false, hasAmount: false }
  if (selected) total = addAmount(total, selected.priceCents, selected.priceUnit, guests)
  else total = addAmount(total, service.priceCents, banquet.priceMode === 'persona' ? 'persona' : banquet.priceMode === 'fijo' ? 'fijo' : 'cotizacion', guests)
  for (const addon of banquet.offerings.filter((item) => item.inclusion === 'opcional' && selection.addonIds.includes(item.id))) {
    total = addAmount(total, addon.priceCents, addon.priceUnit, guests)
  }
  return { cents: total.hasAmount ? total.cents : null, pending: total.pending || !total.hasAmount, error: '' }
}

export type ProviderServiceSummary = {
  id: number
  title: string
  slug: string
  categoryTitle: string
  isPublished: boolean
}

export const fetchOwnServices = () => requestJson<{ services: ProviderServiceSummary[] }>('/api/provider/services')

export const fetchOwnService = (serviceId: number) =>
  requestJson<{ service: { id: number; title: string; description: string; priceCents: number | null; isPublished: boolean; slug: string; categoryTitle: string; images: BanquetImage[]; banquet: BanquetInfo | null; decoration: DecorInfo | null; music: MusicInfo | null; waitstaff: WaitstaffInfo | null; furniture: FurnitureInfo | null } }>(`/api/provider/services/${serviceId}`)

export const createOwnBanquet = (title: string) =>
  requestJson<{ id: number }>('/api/provider/banquets', { method: 'POST', body: JSON.stringify({ title }) })

export const saveOwnBanquet = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ ok: boolean }>(`/api/provider/services/${serviceId}`, { method: 'PUT', body: JSON.stringify(body) })

export const addOwnImage = (serviceId: number, body: { imageUrl: string; altText: string; packageId?: number }) =>
  requestJson<{ id: number }>(`/api/provider/services/${serviceId}/images`, { method: 'POST', body: JSON.stringify(body) })

export const removeOwnImage = (serviceId: number, imageId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/services/${serviceId}/images/${imageId}`, { method: 'DELETE' })

export const addOwnPackage = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/services/${serviceId}/packages`, { method: 'POST', body: JSON.stringify(body) })

export const removeOwnPackage = (serviceId: number, packageId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/services/${serviceId}/packages/${packageId}`, { method: 'DELETE' })

export const addOwnDish = (serviceId: number, packageId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/services/${serviceId}/packages/${packageId}/menu`, { method: 'POST', body: JSON.stringify(body) })

export const removeOwnDish = (serviceId: number, packageId: number, itemId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/services/${serviceId}/packages/${packageId}/menu/${itemId}`, { method: 'DELETE' })

export const addOwnOffering = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/services/${serviceId}/offerings`, { method: 'POST', body: JSON.stringify(body) })

export const removeOwnOffering = (serviceId: number, offeringId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/services/${serviceId}/offerings/${offeringId}`, { method: 'DELETE' })
