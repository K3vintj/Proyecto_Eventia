export type CatalogCategory = {
  slug: string
  title: string
  description: string
  imageUrl: string
  serviceCount?: number
}

export type CatalogProvider = {
  businessName: string
  city: string
  description: string
}

export type CatalogService = {
  id: number
  title: string
  description: string
  priceCents: number | null
  imageUrl: string | null
  features: string[]
  provider: CatalogProvider
}

export type MarketplaceService = CatalogService & {
  category: { slug: string; title: string }
}

export type MarketplaceFeedQuery = {
  q?: string
  city?: string
  category?: string
  pricing?: 'all' | 'fixed' | 'quote'
  sort?: 'recent' | 'price_asc' | 'price_desc' | 'popular' | 'featured' | 'recommended'
  minPrice?: string
  maxPrice?: string
  page?: number
  limit?: number
}

export type MarketplaceFeed = {
  services: MarketplaceService[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
  categories: CatalogCategory[]
}

export type CategoryCatalog = {
  category: CatalogCategory
  services: CatalogService[]
  features: string[]
}

export class CatalogError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const requestCatalog = async <T>(path: string, init?: RequestInit): Promise<T> => {
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
  const data = (await response.json().catch(() => ({}))) as T & { message?: string }
  if (!response.ok) throw new CatalogError(data.message || 'No se pudo completar la solicitud.', response.status)
  return data
}

export const fetchCategories = () => requestCatalog<{ categories: CatalogCategory[] }>('/api/categories')

export const fetchMarketplaceFeed = (query: MarketplaceFeedQuery = {}) => {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.city) params.set('city', query.city)
  if (query.category) params.set('category', query.category)
  if (query.pricing && query.pricing !== 'all') params.set('pricing', query.pricing)
  if (query.sort) params.set('sort', query.sort)
  if (query.minPrice) params.set('minPrice', query.minPrice)
  if (query.maxPrice) params.set('maxPrice', query.maxPrice)
  if (query.page) params.set('page', String(query.page))
  if (query.limit) params.set('limit', String(query.limit))
  const suffix = params.toString()
  return requestCatalog<MarketplaceFeed>(`/api/marketplace/feed${suffix ? `?${suffix}` : ''}`)
}

export const fetchCategory = (slug: string, filters: { minPrice: string; maxPrice: string; features: string[] }) => {
  const params = new URLSearchParams()
  if (filters.minPrice) params.set('minPrice', filters.minPrice)
  if (filters.maxPrice) params.set('maxPrice', filters.maxPrice)
  for (const feature of filters.features) params.append('feature', feature)
  const query = params.toString()
  return requestCatalog<CategoryCatalog>(`/api/categories/${encodeURIComponent(slug)}${query ? `?${query}` : ''}`)
}

export const fetchCategoryService = (slug: string, serviceId: number) =>
  requestCatalog<{ category: CatalogCategory; service: CatalogService }>(`/api/categories/${encodeURIComponent(slug)}/services/${serviceId}`)

export const requestQuote = (slug: string, serviceId: number) =>
  requestCatalog<{ ok: boolean; created: boolean; message?: string }>(`/api/categories/${encodeURIComponent(slug)}/services/${serviceId}/quotes`, { method: 'POST' })

export const addToPlanner = (slug: string, serviceId: number) =>
  requestCatalog<{ ok: boolean; created: boolean; message?: string }>(`/api/categories/${encodeURIComponent(slug)}/services/${serviceId}/planner`, { method: 'POST' })

export const formatPrice = (priceCents: number | null) => {
  if (priceCents === null) return 'Precio a consultar'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(priceCents / 100)
}
