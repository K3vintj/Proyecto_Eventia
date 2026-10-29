import { CatalogError, formatPrice } from './catalog-api'
import { createEvent, fetchEvents, type ClientEvent } from './venue-api'

export type WaitstaffImage = { id: number; url: string; alt: string; tag: string }
export type WaitstaffRole = {
  id: number
  name: string
  description: string
  priceCents: number | null
  priceUnit: 'hora' | 'jornada' | 'persona' | 'fijo' | 'cotizacion'
  minHours: number | null
  minQty: number | null
  maxQty: number | null
  isPrimary: boolean
  imageUrl: string
  conditions: string
  isActive?: boolean
}
export type WaitstaffModality = { id: number; name: string; description: string; isActive?: boolean }
export type WaitstaffUniform = { id: number; name: string; description: string; isActive?: boolean }
export type WaitstaffDuty = { id: number; name: string; description: string; inclusion: 'incluido' | 'adicional'; isActive?: boolean }
export type WaitstaffPackage = {
  id: number
  name: string
  description: string
  serverCount: number | null
  hoursIncluded: number | null
  includedStaff: string
  modalityName: string
  priceCents: number | null
  priceUnit: 'fijo' | 'desde' | 'cotizacion'
  conditions: string
  servicesIncluded: string
  isActive?: boolean
}

export type WaitstaffInfo = {
  coverageArea: string
  specialties: string
  priceMode: '' | 'fijo' | 'desde' | 'cotizacion'
  guestsPerServer: number | null
  minServers: number | null
  maxServers: number | null
  minHours: number | null
  overtimeCents: number | null
  overtimeUnit: 'hora' | 'cotizacion'
  conditions: string
  roles: WaitstaffRole[]
  modalities: WaitstaffModality[]
  uniforms: WaitstaffUniform[]
  duties: WaitstaffDuty[]
  packages: WaitstaffPackage[]
  images: WaitstaffImage[]
}

export type WaitstaffService = {
  id: number
  title: string
  description: string
  priceCents: number | null
  isPublished: boolean
  providerId: number
  provider: { businessName: string; city: string; description: string }
  providerServices: { id: number; title: string; slug: string; categoryTitle: string }[]
  waitstaff: WaitstaffInfo
}

export type WaitstaffEstimate = { cents: number | null; pending: boolean; error: string; durationHours: number | null; recommendedServers: number | null }

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

export const fetchWaitstaff = (serviceId: number) =>
  requestJson<{ category: { title: string; imageUrl: string }; service: WaitstaffService }>(`/api/categories/meseros/services/${serviceId}`)

export const saveWaitstaff = (kind: 'planner' | 'quote', serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ ok: boolean; created: boolean; message?: string; budgetCents?: number; estimatedCents?: number | null }>(
    `/api/categories/meseros/services/${serviceId}/${kind === 'quote' ? 'quotes' : 'planner'}`,
    { method: 'POST', body: JSON.stringify(body) },
  )

export { createEvent, fetchEvents, type ClientEvent }

export const moneyLabel = (unit: string, cents: number | null) => {
  if (cents === null || unit === 'cotizacion' || unit === '') return 'Sujeto a cotización'
  if (unit === 'desde') return `Desde ${formatPrice(cents)}`
  if (unit === 'hora') return `${formatPrice(cents)} por hora`
  if (unit === 'jornada') return `${formatPrice(cents)} por jornada`
  if (unit === 'persona') return `${formatPrice(cents)} por persona`
  return formatPrice(cents)
}

export const durationHoursFromSchedule = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) return null
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number)
    return hours * 60 + minutes
  }
  let start = toMinutes(startTime)
  let end = toMinutes(endTime)
  if (end <= start) end += 24 * 60
  return Math.max(1, Math.ceil((end - start) / 60))
}

export const recommendServers = (guests: number | null, guestsPerServer: number | null) => {
  if (!guests || !guestsPerServer) return null
  return Math.max(1, Math.ceil(guests / guestsPerServer))
}

const addAmount = (total: { cents: number; pending: boolean; hasAmount: boolean }, priceCents: number | null, unit: string, quantity = 1, hours = 1) => {
  if (priceCents === null || unit === 'cotizacion' || unit === 'desde' || unit === '') {
    return { ...total, pending: true, hasAmount: total.hasAmount || (unit === 'desde' && priceCents !== null), cents: unit === 'desde' && priceCents !== null ? total.cents + priceCents : total.cents }
  }
  if (unit === 'hora') return { cents: total.cents + priceCents * quantity * hours, pending: total.pending, hasAmount: true }
  if (unit === 'persona' || unit === 'jornada') return { cents: total.cents + priceCents * quantity, pending: total.pending, hasAmount: true }
  return { cents: total.cents + priceCents, pending: total.pending, hasAmount: true }
}

export const estimateWaitstaff = (service: WaitstaffService, input: {
  packageId: number | null
  serverCount: number | null
  guests: number | null
  startTime: string
  endTime: string
  durationHours: number | null
  quantities: Record<number, number>
}): WaitstaffEstimate => {
  const info = service.waitstaff
  const selected = input.packageId ? info.packages.find((item) => item.id === input.packageId) || null : null
  let durationHours = durationHoursFromSchedule(input.startTime, input.endTime)
  if (durationHours === null) durationHours = input.durationHours
  if (info.minHours && durationHours !== null && durationHours < info.minHours) {
    return { cents: null, pending: true, error: `La jornada mínima de este proveedor es de ${info.minHours} horas.`, durationHours, recommendedServers: recommendServers(input.guests, info.guestsPerServer) }
  }
  if (selected?.hoursIncluded && durationHours !== null && durationHours < selected.hoursIncluded) {
    return { cents: null, pending: true, error: `El paquete incluye ${selected.hoursIncluded} horas como mínimo.`, durationHours, recommendedServers: recommendServers(input.guests, info.guestsPerServer) }
  }
  let serverCount = input.serverCount
  if (selected?.serverCount != null) {
    if (serverCount !== null && serverCount !== selected.serverCount) {
      return { cents: null, pending: true, error: `Este paquete requiere exactamente ${selected.serverCount} meseros.`, durationHours, recommendedServers: recommendServers(input.guests, info.guestsPerServer) }
    }
    serverCount = selected.serverCount
  }
  if (serverCount !== null) {
    if (info.minServers !== null && serverCount < info.minServers) return { cents: null, pending: true, error: `Este proveedor pide al menos ${info.minServers} meseros.`, durationHours, recommendedServers: recommendServers(input.guests, info.guestsPerServer) }
    if (info.maxServers !== null && serverCount > info.maxServers) return { cents: null, pending: true, error: `Este proveedor admite hasta ${info.maxServers} meseros.`, durationHours, recommendedServers: recommendServers(input.guests, info.guestsPerServer) }
  }
  const primary = info.roles.find((item) => item.isPrimary) || null
  const billableHours = durationHours || 1
  let total = { cents: 0, pending: false, hasAmount: false }
  if (selected) {
    total = addAmount(total, selected.priceCents, selected.priceUnit)
    if (selected.hoursIncluded && durationHours && durationHours > selected.hoursIncluded) {
      total = addAmount(total, info.overtimeCents, info.overtimeUnit === 'hora' ? 'hora' : 'cotizacion', 1, durationHours - selected.hoursIncluded)
    }
  } else if (primary && serverCount !== null) {
    total = addAmount(total, primary.priceCents, primary.priceUnit, serverCount, billableHours)
  } else {
    total = addAmount(total, service.priceCents, info.priceMode === 'fijo' ? 'fijo' : info.priceMode === 'desde' ? 'desde' : 'cotizacion')
  }
  for (const role of info.roles.filter((item) => !item.isPrimary)) {
    const quantity = input.quantities[role.id]
    if (!quantity) continue
    if (role.minQty !== null && quantity < role.minQty) return { cents: null, pending: true, error: `${role.name} pide al menos ${role.minQty}.`, durationHours, recommendedServers: recommendServers(input.guests, info.guestsPerServer) }
    if (role.maxQty !== null && quantity > role.maxQty) return { cents: null, pending: true, error: `${role.name} admite hasta ${role.maxQty}.`, durationHours, recommendedServers: recommendServers(input.guests, info.guestsPerServer) }
    total = addAmount(total, role.priceCents, role.priceUnit, quantity, billableHours)
  }
  return {
    cents: total.hasAmount ? total.cents : null,
    pending: total.pending || !total.hasAmount,
    error: '',
    durationHours,
    recommendedServers: recommendServers(input.guests, info.guestsPerServer),
  }
}

export const createOwnWaitstaff = (title: string) =>
  requestJson<{ id: number }>('/api/provider/waitstaff', { method: 'POST', body: JSON.stringify({ title }) })

export const saveOwnWaitstaff = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ ok: boolean }>(`/api/provider/waitstaff/${serviceId}`, { method: 'PUT', body: JSON.stringify(body) })

export const addWaitstaffRole = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/waitstaff/${serviceId}/roles`, { method: 'POST', body: JSON.stringify(body) })

export const removeWaitstaffRole = (serviceId: number, roleId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/waitstaff/${serviceId}/roles/${roleId}`, { method: 'DELETE' })

export const addWaitstaffModality = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/waitstaff/${serviceId}/modalities`, { method: 'POST', body: JSON.stringify(body) })

export const removeWaitstaffModality = (serviceId: number, modalityId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/waitstaff/${serviceId}/modalities/${modalityId}`, { method: 'DELETE' })

export const addWaitstaffUniform = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/waitstaff/${serviceId}/uniforms`, { method: 'POST', body: JSON.stringify(body) })

export const removeWaitstaffUniform = (serviceId: number, uniformId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/waitstaff/${serviceId}/uniforms/${uniformId}`, { method: 'DELETE' })

export const addWaitstaffDuty = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/waitstaff/${serviceId}/duties`, { method: 'POST', body: JSON.stringify(body) })

export const removeWaitstaffDuty = (serviceId: number, dutyId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/waitstaff/${serviceId}/duties/${dutyId}`, { method: 'DELETE' })

export const addWaitstaffPackage = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/waitstaff/${serviceId}/packages`, { method: 'POST', body: JSON.stringify(body) })

export const removeWaitstaffPackage = (serviceId: number, packageId: number) =>
  requestJson<{ ok: boolean }>(`/api/provider/waitstaff/${serviceId}/packages/${packageId}`, { method: 'DELETE' })

export const addWaitstaffImage = (serviceId: number, body: Record<string, unknown>) =>
  requestJson<{ id: number }>(`/api/provider/waitstaff/${serviceId}/images`, { method: 'POST', body: JSON.stringify(body) })
