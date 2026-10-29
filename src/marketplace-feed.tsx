import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { setLoginNotice } from './auth-api'
import {
  addToPlanner,
  CatalogError,
  fetchMarketplaceFeed,
  formatPrice,
  requestQuote,
  type CatalogCategory,
  type MarketplaceFeedQuery,
  type MarketplaceService,
} from './catalog-api'
import type { SessionUser } from './session'

type MarketplaceFeedProps = {
  session: SessionUser
  onNavigate: (path: string) => void
}

type FeedFilters = {
  q: string
  city: string
  category: string
  pricing: 'all' | 'fixed' | 'quote'
  sort: MarketplaceFeedQuery['sort']
  minPrice: string
  maxPrice: string
}

const PAGE_SIZE = 12
const FAVORITES_KEY = 'eventia-marketplace-favorites'

const CHIP_LABELS: Record<string, string> = {
  locacion: 'Lugares',
  banquetes: 'Banquetes',
  'flores-decoracion': 'Decoración',
  musica: 'Música',
  meseros: 'Meseros',
  mobiliario: 'Mobiliario',
  fotografia: 'Fotografía',
}

const SPECIALIZED = new Set(['locacion', 'banquetes', 'flores-decoracion', 'musica', 'meseros', 'mobiliario'])

const emptyFilters = (): FeedFilters => ({
  q: '',
  city: '',
  category: '',
  pricing: 'all',
  sort: 'recent',
  minPrice: '',
  maxPrice: '',
})

const favoriteKey = (service: Pick<MarketplaceService, 'id'> & { category: { slug: string } }) => `${service.category.slug}:${service.id}`

const readFavorites = (): string[] => {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

const writeFavorites = (items: string[]) => {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(items))
}

const detailPath = (service: MarketplaceService) => `/categorias/${service.category.slug}/servicios/${service.id}`

const categoryPath = (slug: string) => `/categorias/${slug}`

const Icon = ({ name, size = 18 }: { name: 'search' | 'pin' | 'heart' | 'eye' | 'plus' | 'close' | 'filter' | 'arrow'; size?: number }) => {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="M6 6 18 18M18 6 6 18" />,
    filter: <path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const ServicePhoto = ({ service, lazy = true }: { service: MarketplaceService; lazy?: boolean }) => {
  if (service.imageUrl) {
    return <img src={service.imageUrl} alt="" loading={lazy ? 'lazy' : 'eager'} />
  }
  const initial = service.provider.businessName.trim().charAt(0).toUpperCase() || 'E'
  return <span className="mp-card-fallback" aria-hidden="true">{initial}</span>
}

const ServiceSkeleton = () => (
  <div className="mp-card mp-skeleton" aria-hidden="true">
    <div className="mp-card-media skeleton-block" />
    <div className="mp-card-body">
      <div className="skeleton-line w-40" />
      <div className="skeleton-line w-70" />
      <div className="skeleton-line w-55" />
      <div className="skeleton-line w-35" />
    </div>
  </div>
)

export const MarketplaceFeed = ({ session, onNavigate }: MarketplaceFeedProps) => {
  const titleId = useId()
  const [draft, setDraft] = useState<FeedFilters>(emptyFilters)
  const [applied, setApplied] = useState<FeedFilters>(emptyFilters)
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [recommended, setRecommended] = useState<MarketplaceService[]>([])
  const [services, setServices] = useState<MarketplaceService[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [favorites, setFavorites] = useState<string[]>(() => readFavorites())
  const [quickView, setQuickView] = useState<MarketplaceService | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)

  const loadPage = async (nextPage: number, filters: FeedFilters, append: boolean) => {
    const requestId = ++requestIdRef.current
    if (append) setIsLoadingMore(true)
    else {
      setIsLoading(true)
      setServices([])
      setHasMore(false)
    }
    setError('')
    try {
      const result = await fetchMarketplaceFeed({
        q: filters.q.trim() || undefined,
        city: filters.city.trim() || undefined,
        category: filters.category || undefined,
        pricing: filters.pricing,
        sort: filters.sort,
        minPrice: filters.minPrice || undefined,
        maxPrice: filters.maxPrice || undefined,
        page: nextPage,
        limit: PAGE_SIZE,
      })
      if (requestId !== requestIdRef.current) return
      setCategories(result.categories)
      setTotal(result.total)
      setHasMore(result.hasMore)
      setPage(result.page)
      setServices((current) => (append ? [...current, ...result.services] : result.services))
      const isBrowseHome = !filters.category && !filters.q && !filters.city && filters.pricing === 'all' && !filters.minPrice && !filters.maxPrice
      if (!append && !isBrowseHome) setRecommended([])
      if (!append && isBrowseHome) {
        try {
          const picks = await fetchMarketplaceFeed({ sort: 'featured', limit: 8 })
          if (requestId !== requestIdRef.current) return
          setRecommended(picks.services)
        } catch {
          if (requestId !== requestIdRef.current) return
          setRecommended(result.services.slice(0, 6))
        }
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      const catalogError = err instanceof CatalogError ? err : null
      setError(catalogError?.message || 'No se pudo cargar el marketplace.')
      if (!append) {
        setServices([])
        setTotal(0)
        setHasMore(false)
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    }
  }

  useEffect(() => {
    void loadPage(1, applied, false)
  }, [applied])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore || isLoading || isLoadingMore) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadPage(page + 1, applied, true)
    }, { rootMargin: '240px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, isLoading, isLoadingMore, page, applied])

  useEffect(() => {
    if (!quickView) return
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setQuickView(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      previous?.focus()
    }
  }, [quickView])

  const handleSearch = (event: FormEvent) => {
    event.preventDefault()
    setApplied({ ...draft })
    setFiltersOpen(false)
  }

  const handleChip = (slug: string) => {
    const category = applied.category === slug ? '' : slug
    const next = { ...draft, category }
    setDraft(next)
    setApplied(next)
  }

  const handleSort = (sort: FeedFilters['sort']) => {
    const next = { ...applied, sort }
    setDraft(next)
    setApplied(next)
  }

  const handleClearFilters = () => {
    const next = { ...emptyFilters(), sort: applied.sort }
    setDraft(next)
    setApplied(next)
    setFiltersOpen(false)
  }

  const toggleFavorite = (service: MarketplaceService) => {
    const key = favoriteKey(service)
    setFavorites((current) => {
      const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
      writeFavorites(next)
      return next
    })
  }

  const requireCliente = (path: string) => {
    if (session.role !== 'cliente') {
      setStatus('Solo una cuenta de cliente puede usar esta acción.')
      return false
    }
    if (!session) {
      setLoginNotice('Inicia sesión con una cuenta de cliente para continuar.')
      onNavigate(`/ingresar?next=${encodeURIComponent(path)}`)
      return false
    }
    return true
  }

  const handleAction = async (kind: 'quote' | 'planner', service: MarketplaceService) => {
    const path = detailPath(service)
    if (!requireCliente(path)) return
    if (SPECIALIZED.has(service.category.slug)) {
      onNavigate(`${path}?accion=${kind === 'quote' ? 'cotizacion' : 'planificador'}`)
      return
    }
    setStatus('')
    try {
      const result = kind === 'quote'
        ? await requestQuote(service.category.slug, service.id)
        : await addToPlanner(service.category.slug, service.id)
      if (result.message) {
        setStatus(result.message)
        return
      }
      setStatus(kind === 'quote' ? 'Cotización solicitada.' : 'Servicio agregado a tu evento.')
    } catch (err) {
      const catalogError = err instanceof CatalogError ? err : null
      if (catalogError?.status === 401) {
        setLoginNotice('Inicia sesión con una cuenta de cliente para continuar.')
        onNavigate(`/ingresar?next=${encodeURIComponent(path)}`)
        return
      }
      setStatus(catalogError?.message || 'No se pudo completar la acción.')
    }
  }

  const activeFilterCount = [
    applied.category,
    applied.pricing !== 'all' ? applied.pricing : '',
    applied.minPrice,
    applied.maxPrice,
    applied.city,
  ].filter(Boolean).length

  return (
    <div className="mp-feed">
      <header className="mp-hero">
        <div>
          <span className="eyebrow violet">Marketplace</span>
          <h2 id={titleId}>Explora servicios para tu evento</h2>
          <p>Descubre opciones reales, filtra al instante y abre una vista rápida sin salir de esta página.</p>
        </div>
      </header>

      <form className="search-bar marketplace-search" onSubmit={handleSearch} aria-labelledby={titleId}>
        <div className="search-field">
          <span className="search-icon"><Icon name="search" size={26} /></span>
          <div>
            <label htmlFor="mp-search-query">¿Qué estás buscando?</label>
            <input
              id="mp-search-query"
              value={draft.q}
              placeholder="Locación, fotografía, música..."
              onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))}
            />
          </div>
        </div>
        <div className="search-field location">
          <span className="search-icon"><Icon name="pin" size={26} /></span>
          <div>
            <label htmlFor="mp-search-city">Ubicación</label>
            <input
              id="mp-search-city"
              value={draft.city}
              placeholder="Ciudad de México"
              onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))}
            />
          </div>
        </div>
        <button className="search-button" type="submit"><Icon name="search" size={22} /> <span>Buscar</span></button>
      </form>

      <div className="mp-chips" role="toolbar" aria-label="Categorías rápidas">
        <button className={!applied.category ? 'mp-chip is-active' : 'mp-chip'} type="button" aria-pressed={!applied.category} onClick={() => handleChip('')}>Todos</button>
        {categories.map((category) => (
          <button
            className={applied.category === category.slug ? 'mp-chip is-active' : 'mp-chip'}
            type="button"
            key={category.slug}
            aria-pressed={applied.category === category.slug}
            onClick={() => handleChip(category.slug)}
          >
            {CHIP_LABELS[category.slug] || category.title}
            {typeof category.serviceCount === 'number' ? <span>{category.serviceCount}</span> : null}
          </button>
        ))}
      </div>

      <div className="mp-layout">
        <aside className={filtersOpen ? 'mp-filters is-open' : 'mp-filters'} aria-label="Filtros del marketplace">
          <div className="mp-filters-panel">
            <div className="mp-filters-head">
              <h3>Filtros</h3>
              <button className="text-button" type="button" onClick={handleClearFilters}>Limpiar</button>
            </div>
            <label className="mp-filter-field">
              <span>Precio mínimo (MXN)</span>
              <input
                type="number"
                min={0}
                max={10000000}
                value={draft.minPrice}
                placeholder="0"
                onChange={(event) => setDraft((current) => ({ ...current, minPrice: event.target.value }))}
              />
            </label>
            <label className="mp-filter-field">
              <span>Precio máximo (MXN)</span>
              <input
                type="number"
                min={0}
                max={10000000}
                value={draft.maxPrice}
                placeholder="Sin límite"
                onChange={(event) => setDraft((current) => ({ ...current, maxPrice: event.target.value }))}
              />
            </label>
            <fieldset className="mp-filter-field">
              <legend>Modalidad de precio</legend>
              {([
                ['all', 'Todos'],
                ['fixed', 'Con precio fijo'],
                ['quote', 'Sujeto a cotización'],
              ] as const).map(([value, label]) => (
                <label className="mp-check" key={value}>
                  <input
                    type="radio"
                    name="mp-pricing"
                    checked={draft.pricing === value}
                    onChange={() => setDraft((current) => ({ ...current, pricing: value }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="mp-filter-field">
              <legend>Categoría</legend>
              <label className="mp-check">
                <input type="radio" name="mp-category" checked={!draft.category} onChange={() => setDraft((current) => ({ ...current, category: '' }))} />
                <span>Todas</span>
              </label>
              {categories.map((category) => (
                <label className="mp-check" key={category.slug}>
                  <input
                    type="radio"
                    name="mp-category"
                    checked={draft.category === category.slug}
                    onChange={() => setDraft((current) => ({ ...current, category: category.slug }))}
                  />
                  <span>{category.title}</span>
                </label>
              ))}
            </fieldset>
            <button className="mp-apply" type="button" onClick={() => { setApplied({ ...draft }); setFiltersOpen(false) }}>Aplicar filtros</button>
            <button className="mp-filters-close" type="button" onClick={() => setFiltersOpen(false)}>Cerrar</button>
          </div>
        </aside>

        <div className="mp-main">
          <div className="mp-toolbar">
            <p className="mp-count" role="status">{isLoading ? 'Cargando servicios…' : `${total} servicio${total === 1 ? '' : 's'}`}</p>
            <div className="mp-toolbar-actions">
              <button className="outline-button compact mp-filters-toggle" type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
                <Icon name="filter" size={16} /> Filtros{activeFilterCount ? ` (${activeFilterCount})` : ''}
              </button>
              <label className="mp-sort">
                <span>Ordenar</span>
                <select
                  value={applied.sort}
                  aria-label="Ordenar servicios"
                  onChange={(event) => handleSort(event.target.value as FeedFilters['sort'])}
                >
                  <option value="recommended">Recomendados</option>
                  <option value="recent">Más recientes</option>
                  <option value="popular">Más populares</option>
                  <option value="featured">Destacados</option>
                  <option value="price_asc">Precio: menor a mayor</option>
                  <option value="price_desc">Precio: mayor a menor</option>
                </select>
              </label>
            </div>
          </div>

          {status ? <p className="mp-status" role="status">{status}</p> : null}
          {error ? <p className="mp-status is-error" role="alert">{error}</p> : null}

          {recommended.length > 0 ? (
            <section className="mp-recommended" aria-label="Seleccionados para ti">
              <div className="mp-section-head">
                <div>
                  <span className="eyebrow violet">Seleccionados para ti</span>
                  <h3>Servicios que hacen la diferencia</h3>
                </div>
              </div>
              <div className="mp-recommended-rail">
                {recommended.map((service) => (
                  <ServiceCard
                    key={`rec-${favoriteKey(service)}`}
                    service={service}
                    saved={favorites.includes(favoriteKey(service))}
                    onNavigate={onNavigate}
                    onQuickView={setQuickView}
                    onToggleFavorite={toggleFavorite}
                    onAction={handleAction}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mp-grid-section" aria-label="Catálogo de servicios">
            <div className="mp-section-head">
              <div>
                <span className="eyebrow violet">Explorar</span>
                <h3>{applied.category ? categories.find((item) => item.slug === applied.category)?.title || 'Categoría' : 'Todos los servicios'}</h3>
              </div>
              {applied.category ? (
                <a className="text-button" href={categoryPath(applied.category)} onClick={(event) => { event.preventDefault(); onNavigate(categoryPath(applied.category)) }}>
                  Ver página de categoría <Icon name="arrow" size={16} />
                </a>
              ) : null}
            </div>

            {isLoading ? (
              <div className="mp-grid" aria-busy="true" aria-label="Cargando servicios">
                {Array.from({ length: 8 }, (_, index) => <ServiceSkeleton key={index} />)}
              </div>
            ) : null}

            {!isLoading && services.length === 0 ? (
              <div className="mp-empty" role="status">
                <h3>Sin coincidencias</h3>
                <p>Prueba otra búsqueda, cambia los filtros o explora todas las categorías.</p>
                <button className="outline-button compact" type="button" onClick={handleClearFilters}>Restablecer filtros</button>
              </div>
            ) : null}

            {!isLoading && services.length > 0 ? (
              <div className="mp-grid">
                {services.map((service) => (
                  <ServiceCard
                    key={favoriteKey(service)}
                    service={service}
                    saved={favorites.includes(favoriteKey(service))}
                    onNavigate={onNavigate}
                    onQuickView={setQuickView}
                    onToggleFavorite={toggleFavorite}
                    onAction={handleAction}
                  />
                ))}
              </div>
            ) : null}

            {isLoadingMore ? (
              <div className="mp-grid mp-grid-more" aria-busy="true">
                {Array.from({ length: 4 }, (_, index) => <ServiceSkeleton key={`more-${index}`} />)}
              </div>
            ) : null}

            <div ref={sentinelRef} className="mp-sentinel" aria-hidden="true" />
            {!isLoading && hasMore ? (
              <div className="mp-load-more">
                <button className="outline-button compact" type="button" disabled={isLoadingMore} onClick={() => void loadPage(page + 1, applied, true)}>
                  Cargar más servicios
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {filtersOpen ? <button className="mp-filters-backdrop" type="button" aria-label="Cerrar filtros" onClick={() => setFiltersOpen(false)} /> : null}

      {quickView ? (
        <div className="mp-quickview" role="presentation" onClick={() => setQuickView(null)}>
          <div
            className="mp-quickview-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mp-quickview-title"
            tabIndex={-1}
            ref={dialogRef}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              if (event.key === 'Escape') setQuickView(null)
            }}
          >
            <button className="mp-quickview-close" type="button" aria-label="Cerrar vista rápida" onClick={() => setQuickView(null)}>
              <Icon name="close" size={18} />
            </button>
            <div className="mp-quickview-media">
              <ServicePhoto service={quickView} lazy={false} />
            </div>
            <div className="mp-quickview-body">
              <span className="eyebrow violet">{quickView.category.title}</span>
              <h3 id="mp-quickview-title">{quickView.title}</h3>
              <p className="mp-provider">{quickView.provider.businessName}{quickView.provider.city ? ` · ${quickView.provider.city}` : ''}</p>
              <strong className="mp-price">{formatPrice(quickView.priceCents)}</strong>
              <p>{quickView.description}</p>
              {quickView.features.length > 0 ? (
                <ul className="mp-tags">
                  {quickView.features.slice(0, 6).map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
              ) : null}
              <div className="mp-card-actions">
                <button className="outline-button compact" type="button" onClick={() => { onNavigate(detailPath(quickView)); setQuickView(null) }}>Ver detalle</button>
                <button className="outline-button compact" type="button" onClick={() => void handleAction('quote', quickView)}>Solicitar cotización</button>
                <button className="outline-button compact" type="button" onClick={() => void handleAction('planner', quickView)}>Agregar a mi evento</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

type CardProps = {
  service: MarketplaceService
  saved: boolean
  onNavigate: (path: string) => void
  onQuickView: (service: MarketplaceService) => void
  onToggleFavorite: (service: MarketplaceService) => void
  onAction: (kind: 'quote' | 'planner', service: MarketplaceService) => void
}

const ServiceCard = ({ service, saved, onNavigate, onQuickView, onToggleFavorite, onAction }: CardProps) => {
  const path = detailPath(service)
  return (
    <article className="mp-card">
      <div className="mp-card-media">
        <a href={path} onClick={(event) => { event.preventDefault(); onNavigate(path) }} aria-label={`Ver ${service.title}`}>
          <ServicePhoto service={service} />
        </a>
        <button
          className={saved ? 'mp-heart is-saved' : 'mp-heart'}
          type="button"
          aria-label={saved ? `Quitar ${service.title} de guardados` : `Guardar ${service.title}`}
          aria-pressed={saved}
          onClick={() => onToggleFavorite(service)}
        >
          <Icon name="heart" size={16} />
        </button>
        <span className="mp-badge">{service.category.title}</span>
      </div>
      <div className="mp-card-body">
        <p className="mp-provider">{service.provider.businessName}</p>
        <h4>
          <a href={path} onClick={(event) => { event.preventDefault(); onNavigate(path) }}>{service.title}</a>
        </h4>
        <p className="mp-copy">{service.description}</p>
        <p className="mp-meta">{service.provider.city || 'Ubicación a confirmar'}</p>
        <strong className="mp-price">{formatPrice(service.priceCents)}</strong>
        {service.features.length > 0 ? (
          <ul className="mp-tags">
            {service.features.slice(0, 3).map((feature) => <li key={feature}>{feature}</li>)}
          </ul>
        ) : null}
        <div className="mp-card-actions">
          <button className="outline-button compact" type="button" onClick={() => onQuickView(service)}><Icon name="eye" size={15} /> Vista rápida</button>
          <button className="outline-button compact" type="button" onClick={() => void onAction('planner', service)}><Icon name="plus" size={15} /> A mi evento</button>
          <button className="outline-button compact" type="button" onClick={() => void onAction('quote', service)}>Cotizar</button>
        </div>
      </div>
    </article>
  )
}
