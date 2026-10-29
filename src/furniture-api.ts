import { CatalogError, formatPrice } from './catalog-api'
import { createEvent, fetchEvents, type ClientEvent } from './venue-api'

export type FurnitureImage = { id: number; url: string; alt: string; tag: string }
export type FurnitureItem = {
  id: number
  name: string
  description: string
  subcategory: string
  style: string
  capacity: number | null
  priceCents: number | null
  priceUnit: 'evento' | 'dia' | 'jornada' | 'unidad' | 'fijo' | 'cotizacion'
  minQty: number | null
  stock: number | null
  imageUrl: string
  conditions: string
  isActive?: boolean
}
export type FurniturePackage = {
  id: number
  name: string
  description: string
  priceCents: number | null
  priceUnit: 'evento' | 'dia' | 'jornada' | 'fijo' | 'cotizacion'
  rentalLabel: string
  conditions: string
  imageUrl: string
  isActive?: boolean
  items: { itemId: number; quantity: number }[]
}
export type FurnitureAddon = {
  id: number
  name: string
  description: string
  priceCents: number | null
  priceUnit: 'evento' | 'dia' | 'unidad' | 'fijo' | 'cotizacion'
  isActive?: boolean
}

export type FurnitureInfo = {
  coverageArea: string
  specialties: string
  furnitureTypes: string
  priceMode: '' | 'fijo' | 'desde' | 'cotizacion'
  conditions: string
  items: FurnitureItem[]
  packages: FurniturePackage[]
  addons: FurnitureAddon[]
  images: FurnitureImage[]
}

export type FurnitureService = {
  id: number
  title: string
  description: string
  priceCents: number | null
  isPublished: boolean
  providerId: number
  provider: { businessName: string; city: string; description: string }
  providerServices: { id: number; title: string; slug: string; categoryTitle: string }[]
  furniture: FurnitureInfo
}

export type FurnitureEstimate = {
  cents: number | null
  pending: boolean
  error: string
  recommendation: { tables: number | null; chairs: number | null }
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

export const fetchFurniture = (serviceId: number) =>
  requestJson<{ category: { title: string; imageUrl: string }; service: FurnitureService }>(`/api/categories/mobiliario/services/${serviceId}`)

export const saveFurniture = (kind: 'planner' | 'quote', serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ ok: boolean; created: boolean; updated?: boolean; message?: string; budgetCents?: number; estimatedCents?: number | null }>(
    `/api/categories/mobiliario/services/${serviceId}/${kind === 'quote' ? 'quotes' : 'planner'}`,
    { method: 'POST', body: JSON.stringify(body) },
  )

export { createEvent, fetchEvents, type ClientEvent }

export const moneyLabel = (unit: string, cents: number | null) => {
  if (cents === null || unit === 'cotizacion' || unit === '') return 'Sujeto a cotización'
  if (unit === 'desde') return `Desde ${formatPrice(cents)}`
  if (unit === 'evento') return `${formatPrice(cents)} por evento`
  if (unit === 'dia') return `${formatPrice(cents)} por día`
  if (unit === 'jornada') return `${formatPrice(cents)} por jornada`
  if (unit === 'unidad') return `${formatPrice(cents)} por unidad`
  return formatPrice(cents)
}

export const recommendFurniture = (guests: number | null, tableCapacity: number | null) => {
  if (!guests) return { tables: null, chairs: null }
  return { tables: tableCapacity ? Math.ceil(guests / tableCapacity) : null, chairs: guests }
}

const multiplierForUnit = (unit: string, rentalDays: number) => (unit === 'dia' ? rentalDays : 1)

const addAmount = (total: { cents: number; pending: boolean; hasAmount: boolean }, priceCents: number | null, unit: string, quantity = 1, rentalDays = 1) => {
  if (priceCents === null || unit === 'cotizacion' || unit === 'desde' || unit === '') {
    return { ...total, pending: true, hasAmount: total.hasAmount || (unit === 'desde' && priceCents !== null), cents: unit === 'desde' && priceCents !== null ? total.cents + priceCents : total.cents }
  }
  return { cents: total.cents + priceCents * quantity * multiplierForUnit(unit, rentalDays), pending: total.pending, hasAmount: true }
}

export const estimateFurniture = (service: FurnitureService, input: {
  packageId: number | null
  quantities: Record<number, number>
  addonQuantities: Record<number, number>
  rentalDays: number
  guests: number | null
  calculatorTableItemId: number | null
}): FurnitureEstimate => {
  const info = service.furniture
  const selected = input.packageId ? info.packages.find((item) => item.id === input.packageId) || null : null
  const packageQty = new Map((selected?.items || []).map((entry) => [entry.itemId, entry.quantity]))
  const tableItem = input.calculatorTableItemId ? info.items.find((item) => item.id === input.calculatorTableItemId) || null : null
  const recommendation = recommendFurniture(input.guests, tableItem?.capacity || null)
  const days = input.rentalDays > 0 ? input.rentalDays : 1
  let total = { cents: 0, pending: false, hasAmount: false }
  if (selected) total = addAmount(total, selected.priceCents, selected.priceUnit, 1, days)
  else if (!Object.keys(input.quantities).length) total = addAmount(total, service.priceCents, info.priceMode === 'fijo' ? 'fijo' : info.priceMode === 'desde' ? 'desde' : 'cotizacion')

  for (const item of info.items) {
    const quantity = input.quantities[item.id]
    if (!quantity) continue
    if (item.minQty !== null && quantity < item.minQty) return { cents: null, pending: true, error: `${item.name} pide al menos ${item.minQty}.`, recommendation }
    if (item.stock !== null && quantity > item.stock) return { cents: null, pending: true, error: `${item.name} solo tiene ${item.stock} disponibles registrados.`, recommendation }
    const billable = Math.max(0, quantity - (packageQty.get(item.id) || 0))
    if (!billable) continue
    total = addAmount(total, item.priceCents, item.priceUnit, billable, days)
  }
  for (const addon of info.addons) {
    const quantity = input.addonQuantities[addon.id]
    if (!quantity) continue
    total = addAmount(total, addon.priceCents, addon.priceUnit, quantity, days)
  }
  if (!selected && !Object.keys(input.quantities).length && !Object.keys(input.addonQuantities).length) {
    return { cents: total.hasAmount ? total.cents : null, pending: true, error: '', recommendation }
  }
  return { cents: total.hasAmount ? total.cents : null, pending: total.pending || !total.hasAmount, error: '', recommendation }
}

export const createOwnFurniture = (title: string) =>
  requestJson<{ id: number }>('/api/provider/furniture', { method: 'POST', body: JSON.stringify({ title }) })

export const saveOwnFurniture = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ ok: boolean }>(`/api/provider/furniture/${serviceId}`, { method: 'PUT', body: JSON.stringify(body) })

export const addFurnitureItem = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/furniture/${serviceId}/items`, { method: 'POST', body: JSON.stringify(body) })

export const removeFurnitureItem = (serviceId: number, itemId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/furniture/${serviceId}/items/${itemId}`, { method: 'DELETE' })

export const addFurniturePackage = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/furniture/${serviceId}/packages`, { method: 'POST', body: JSON.stringify(body) })

export const removeFurniturePackage = (serviceId: number, packageId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/furniture/${serviceId}/packages/${packageId}`, { method: 'DELETE' })

export const addFurnitureAddon = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/furniture/${serviceId}/addons`, { method: 'POST', body: JSON.stringify(body) })

export const removeFurnitureAddon = (serviceId: number, addonId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/furniture/${serviceId}/addons/${addonId}`, { method: 'DELETE' })

export const addFurnitureImage = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/furniture/${serviceId}/images`, { method: 'POST', body: JSON.stringify(body) })
