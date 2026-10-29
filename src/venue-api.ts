import { CatalogError, formatPrice, type CatalogCategory } from './catalog-api'

export type PriceMode = 'fijo' | 'desde' | 'cotizacion'

export type VenueImage = {
  id: number
  url: string
  alt: string
}

export type VenueServiceLink = {
  id: number
  title: string
  slug: string
  categoryTitle: string
}

export type VenueDetail = {
  id: number
  title: string
  description: string
  priceCents: number | null
  imageUrl: string | null
  isPublished: boolean
  features: string[]
  providerId: number
  provider: {
    businessName: string
    city: string
    description: string
  }
  venue: {
    spaceType: string
    address: string
    capacityMin: number | null
    capacityMax: number | null
    priceMode: PriceMode
  }
  images: VenueImage[]
  providerServices: VenueServiceLink[]
}

export type ClientEvent = {
  id: number
  name: string
  eventDate: string | null
  guestCount: number | null
  eventType?: string
  budgetTargetCents?: number | null
  location?: string
  startTime?: string
}

export type SavedSelection = {
  packageName: string
  guests: number | null
  pendingQuote: boolean
  menuNames: string[]
  addonNames: string[]
  styleName?: string
  paletteName?: string
  colorNote?: string
  elementNames?: string[]
  durationMinutes?: number | null
  preferredGenres?: string
  songRequests?: string
  moments?: string
  serverCount?: number | null
  durationHours?: number | null
  startTime?: string
  endTime?: string
  modalityName?: string
  uniformName?: string
  uniformNote?: string
  roleNames?: string[]
  rentalDays?: number | null
  furnitureItemNames?: string[]
  eventTime: string
  eventLocation: string
}

export type PlannerEvent = ClientEvent & {
  budgetCents: number
  items: {
    plannerItemId?: number
    serviceId: number
    title: string
    slug: string
    categoryTitle: string
    imageUrl?: string | null
    providerName?: string
    estimatedCents: number | null
    selection: SavedSelection | null
  }[]
}

export type QuoteRecord = {
  id: number
  notes: string
  status: string
  requestedOn: string | null
  eventId?: number | null
  eventName: string
  eventDate: string | null
  guestCount: number | null
  serviceId: number
  serviceTitle: string
  slug: string
  clientName: string
  providerName: string
  selection: SavedSelection | null
}

export type ServiceContract = {
  id: number
  amountCents: number | null
  status: string
  hiredOn: string | null
  eventId: number
  eventName: string
  eventDate: string | null
  serviceId: number
  serviceTitle: string
  slug: string
  categoryTitle: string
  imageUrl: string | null
  providerName: string
  quoteId: number | null
  conditions: string
}

export type EventInput = {
  name: string
  eventDate: string
  guestCount: string
  eventType?: string
  budgetTargetCents?: string
  location?: string
  startTime?: string
}

export type PublicProvider = {
  id: number
  businessName: string
  city: string
  description: string
}

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
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
    throw new CatalogError('No se pudo conectar con el servidor.', 0)
  }
  const data = (await response.json().catch(() => ({}))) as T & { message?: string; code?: string }
  if (!response.ok) {
    const error = new CatalogError(data.message || 'No se pudo completar la solicitud.', response.status)
    if (data.code) error.name = data.code
    throw error
  }
  return data
}

export const fetchVenue = (slug: string, serviceId: number) =>
  requestJson<{ category: CatalogCategory; service: VenueDetail }>(`/api/categories/${encodeURIComponent(slug)}/services/${serviceId}`)

export const fetchEvents = () => requestJson<{ events: ClientEvent[] }>('/api/events')

const eventPayload = (input: EventInput) => ({
  name: input.name,
  eventDate: input.eventDate || null,
  guestCount: input.guestCount ? Number(input.guestCount) : null,
  eventType: 'eventType' in input ? input.eventType || '' : undefined,
  budgetTargetCents: input.budgetTargetCents ? Math.round(Number(input.budgetTargetCents) * 100) : null,
  location: input.location || '',
  startTime: input.startTime || '',
})

export const createEvent = (input: EventInput) =>
  requestJson<{ event: ClientEvent }>('/api/events', {
    method: 'POST',
    body: JSON.stringify(eventPayload(input)),
  })

export const updateEvent = (eventId: number, input: EventInput) =>
  requestJson<{ event: ClientEvent }>(`/api/events/${eventId}`, {
    method: 'PUT',
    body: JSON.stringify(eventPayload(input)),
  })

export const removePlannerItem = (eventId: number, serviceId: number) =>
  requestJson<{ ok: boolean; budgetCents: number }>(`/api/planner/items/${serviceId}?eventId=${eventId}`, { method: 'DELETE' })

export const acceptQuote = (quoteId: number) =>
  requestJson<{ ok: boolean; amountCents: number | null; eventId: number; serviceId: number }>(`/api/quotes/${quoteId}/accept`, { method: 'POST' })

export const rejectQuote = (quoteId: number) =>
  requestJson<{ ok: boolean }>(`/api/quotes/${quoteId}/reject`, { method: 'POST' })

export const requestQuoteModification = (quoteId: number, notes: string) =>
  requestJson<{ ok: boolean }>(`/api/quotes/${quoteId}/request-modification`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  })

export const fetchContracts = () => requestJson<{ contracts: ServiceContract[] }>('/api/contracts')

export const ACTIVE_EVENT_KEY = 'eventia-active-event'

export const readActiveEventId = () => {
  try {
    const value = Number(localStorage.getItem(ACTIVE_EVENT_KEY) || '')
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export const writeActiveEventId = (eventId: number | null) => {
  try {
    if (!eventId) localStorage.removeItem(ACTIVE_EVENT_KEY)
    else localStorage.setItem(ACTIVE_EVENT_KEY, String(eventId))
  } catch {
    /* ignore */
  }
}

export const preferEventId = (events: ClientEvent[]) => {
  const active = readActiveEventId()
  if (active && events.some((event) => event.id === active)) return String(active)
  return events[0] ? String(events[0].id) : ''
}

export const addVenueToEvent = (slug: string, serviceId: number, eventId: number) =>
  requestJson<{ ok: boolean; created: boolean; message?: string; budgetCents?: number; estimatedCents?: number | null }>(
    `/api/categories/${encodeURIComponent(slug)}/services/${serviceId}/planner`,
    { method: 'POST', body: JSON.stringify({ eventId }) },
  )

export const requestVenueQuote = (slug: string, serviceId: number, eventId: number, notes: string) =>
  requestJson<{ ok: boolean; created: boolean; message?: string }>(
    `/api/categories/${encodeURIComponent(slug)}/services/${serviceId}/quotes`,
    { method: 'POST', body: JSON.stringify({ eventId, notes }) },
  )

export const fetchPlanner = () => requestJson<{ events: PlannerEvent[] }>('/api/planner')

export const fetchQuotes = () => requestJson<{ quotes: QuoteRecord[] }>('/api/quotes')

export const fetchProvider = (providerId: number) =>
  requestJson<{ provider: PublicProvider; services: VenueServiceLink[] }>(`/api/providers/${providerId}`)

export const formatReferencePrice = (priceCents: number | null, mode: PriceMode) => {
  if (mode === 'desde' && priceCents !== null) return `Desde ${formatPrice(priceCents)}`
  if (mode === 'fijo' && priceCents !== null) return formatPrice(priceCents)
  if (priceCents !== null) return `${formatPrice(priceCents)} · sujeto a cotización`
  return 'Sujeto a cotización'
}

export const priceModeLabel = (mode: PriceMode) => {
  if (mode === 'fijo') return 'Precio fijo'
  if (mode === 'desde') return 'Precio desde'
  return 'Sujeto a cotización'
}

export const formatEventDate = (value: string | null) => {
  if (!value) return 'Sin fecha'
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(Number(year), Number(month) - 1, Number(day)))
}
