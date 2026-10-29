import { CatalogError, formatPrice } from './catalog-api'
import { createEvent, fetchEvents, type ClientEvent } from './venue-api'

export type DecorImage = { id: number; url: string; alt: string; tag: string; styleId: number | null; packageId: number | null }
export type DecorStyle = { id: number; name: string; description: string; isActive?: boolean; images: DecorImage[] }
export type DecorPalette = { id: number; name: string; colors: string[]; description: string }
export type DecorElement = { id: number; name: string; description: string; priceCents: number | null; priceUnit: 'unidad' | 'fijo' | 'cotizacion'; minQty: number | null; maxQty: number | null; isAddon: boolean }
export type DecorPackage = { id: number; name: string; description: string; priceCents: number | null; priceUnit: 'fijo' | 'desde' | 'cotizacion'; includedItems: string; coverage: string; conditions: string; isActive?: boolean; images: DecorImage[] }

export type DecorInfo = {
  coverageArea: string
  specialties: string
  priceMode: '' | 'fijo' | 'desde' | 'cotizacion'
  styles: DecorStyle[]
  palettes: DecorPalette[]
  elements: DecorElement[]
  packages: DecorPackage[]
  images: DecorImage[]
}

export type DecorService = {
  id: number
  title: string
  description: string
  priceCents: number | null
  isPublished: boolean
  providerId: number
  provider: { businessName: string; city: string; description: string }
  providerServices: { id: number; title: string; slug: string; categoryTitle: string }[]
  decoration: DecorInfo
}

export type DecorEstimate = { cents: number | null; pending: boolean; error: string }

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

export const fetchDecoration = (serviceId: number) =>
  requestJson<{ category: { title: string; imageUrl: string }; service: DecorService }>(`/api/categories/flores-decoracion/services/${serviceId}`)

export const saveDecoration = (kind: 'planner' | 'quote', serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ ok: boolean; created: boolean; message?: string; budgetCents?: number; estimatedCents?: number | null }>(
    `/api/categories/flores-decoracion/services/${serviceId}/${kind === 'quote' ? 'quotes' : 'planner'}`,
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

export const estimateDecoration = (service: DecorService, input: { packageId: number | null; quantities: Record<number, number> }): DecorEstimate => {
  const decor = service.decoration
  const selected = input.packageId ? decor.packages.find((item) => item.id === input.packageId) || null : null
  let total = { cents: 0, pending: false, hasAmount: false }
  if (selected) total = addAmount(total, selected.priceCents, selected.priceUnit)
  else total = addAmount(total, service.priceCents, decor.priceMode === 'fijo' ? 'fijo' : decor.priceMode === 'desde' ? 'desde' : 'cotizacion')
  for (const element of decor.elements) {
    const quantity = input.quantities[element.id]
    if (!quantity) continue
    if (element.minQty !== null && quantity < element.minQty) return { cents: null, pending: true, error: `${element.name} pide al menos ${element.minQty}.` }
    if (element.maxQty !== null && quantity > element.maxQty) return { cents: null, pending: true, error: `${element.name} admite hasta ${element.maxQty}.` }
    total = addAmount(total, element.priceCents, element.priceUnit, quantity)
  }
  return { cents: total.hasAmount ? total.cents : null, pending: total.pending || !total.hasAmount, error: '' }
}

export const createOwnDecoration = (title: string) =>
  requestJson<{ id: number }>('/api/provider/decorations', { method: 'POST', body: JSON.stringify({ title }) })

export const saveOwnDecoration = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ ok: boolean }>(`/api/provider/decorations/${serviceId}`, { method: 'PUT', body: JSON.stringify(body) })

export const addDecorStyle = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/decorations/${serviceId}/styles`, { method: 'POST', body: JSON.stringify(body) })

export const removeDecorStyle = (serviceId: number, styleId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/decorations/${serviceId}/styles/${styleId}`, { method: 'DELETE' })

export const addDecorPalette = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/decorations/${serviceId}/palettes`, { method: 'POST', body: JSON.stringify(body) })

export const removeDecorPalette = (serviceId: number, paletteId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/decorations/${serviceId}/palettes/${paletteId}`, { method: 'DELETE' })

export const addDecorElement = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/decorations/${serviceId}/elements`, { method: 'POST', body: JSON.stringify(body) })

export const removeDecorElement = (serviceId: number, elementId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/decorations/${serviceId}/elements/${elementId}`, { method: 'DELETE' })

export const addDecorPackage = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/decorations/${serviceId}/packages`, { method: 'POST', body: JSON.stringify(body) })

export const removeDecorPackage = (serviceId: number, packageId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/decorations/${serviceId}/packages/${packageId}`, { method: 'DELETE' })

export const addDecorImage = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/decorations/${serviceId}/images`, { method: 'POST', body: JSON.stringify(body) })
