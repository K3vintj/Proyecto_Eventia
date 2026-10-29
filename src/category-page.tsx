import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { setLoginNotice } from './auth-api'
import {
  addToPlanner,
  CatalogError,
  fetchCategory,
  fetchCategoryService,
  formatPrice,
  requestQuote,
  type CatalogCategory,
  type CatalogService,
} from './catalog-api'
import { clearCategoryArrival, readCategoryArrival } from './category-transition'
import { Logo } from './logo'
import { gsap } from './motion'
import { safeCategoryReturn } from './navigation'
import { VenueDetail } from './venue-detail'
import { BanquetDetail } from './banquet-detail'
import { DecorationDetail } from './decoration-detail'
import { MusicDetail } from './music-detail'
import { WaitstaffDetail } from './waitstaff-detail'
import { FurnitureDetail } from './furniture-detail'
import type { SessionUser } from './session'

type CategoryPageProps = {
  slug: string
  serviceId: number | null
  session: SessionUser | null
  onNavigate: (path: string) => void
}

const PRICE_FLOOR = 0
const PRICE_CEILING = 100000
const PRICE_STEP = 1000

const marketplacePath = (session: SessionUser | null) => (session?.role === 'cliente' ? '/inicio' : '/')

const formatPesos = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount)

const handleBack = (onNavigate: (path: string) => void) => {
  if (document.referrer.startsWith(window.location.origin)) {
    window.history.back()
    return
  }
  onNavigate('/')
}

const CategoryTopbar = ({ session, onNavigate }: { session: SessionUser | null; onNavigate: (path: string) => void }) => (
  <header className="category-topbar">
    <a href="/" aria-label="Ir al inicio de Eventia" onClick={(event) => { event.preventDefault(); onNavigate('/') }}><Logo /></a>
    <div className="category-topbar-actions">
      <button className="outline-button compact" type="button" onClick={() => handleBack(onNavigate)}>Volver</button>
      <a className="outline-button compact" href={marketplacePath(session)} onClick={(event) => { event.preventDefault(); onNavigate(marketplacePath(session)) }}>Marketplace</a>
    </div>
  </header>
)

const ServicePhoto = ({ service }: { service: CatalogService }) => {
  if (service.imageUrl) {
    return <div className="category-card-photo"><img src={service.imageUrl} alt="" /></div>
  }
  const initial = service.provider.businessName.trim().charAt(0).toUpperCase() || 'E'
  return <div className="category-card-photo" aria-hidden="true">{initial}</div>
}

export const CategoryPage = ({ slug, serviceId, session, onNavigate }: CategoryPageProps) => {
  const [preview] = useState(() => readCategoryArrival(slug))
  const [category, setCategory] = useState<CatalogCategory | null>(null)
  const [services, setServices] = useState<CatalogService[]>([])
  const [availableFeatures, setAvailableFeatures] = useState<string[]>([])
  const [service, setService] = useState<CatalogService | null>(null)
  const [minPrice, setMinPrice] = useState(PRICE_FLOOR)
  const [maxPrice, setMaxPrice] = useState(PRICE_CEILING)
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [applied, setApplied] = useState({ minPrice: '', maxPrice: '', features: [] as string[] })
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')
  const [missing, setMissing] = useState(false)
  const pageRef = useRef<HTMLElement>(null)
  const mediaRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const catalogRef = useRef<HTMLDivElement>(null)
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const isEntering = Boolean(preview) && !serviceId && !reduceMotion
  const hero = category ?? (preview ? { slug: preview.slug, title: preview.title, description: preview.description, imageUrl: preview.imageUrl } : null)

  useLayoutEffect(() => {
    const arrival = readCategoryArrival(slug)
    const media = mediaRef.current
    if (!arrival || !media || serviceId || reduceMotion) return
    const html = document.documentElement
    const previousScroll = html.style.scrollBehavior
    html.style.scrollBehavior = 'auto'
    window.scrollTo(0, 0)
    html.style.scrollBehavior = previousScroll
    const copyItems = copyRef.current ? gsap.utils.toArray<HTMLElement>(copyRef.current.children) : []
    const destination = media.getBoundingClientRect()
    gsap.set(media, { zIndex: 30, transformOrigin: '0 0' })
    let ignore = false
    const finish = () => {
      if (ignore) return
      clearCategoryArrival(slug)
      pageRef.current?.classList.remove('is-entering')
      media.style.cssText = ''
    }
    const timeline = gsap.timeline({ onComplete: finish })
    timeline.fromTo(media, {
      x: arrival.rect.x - destination.x,
      y: arrival.rect.y - destination.y,
      width: arrival.rect.width,
      height: arrival.rect.height,
      clipPath: arrival.clipPath,
    }, {
      x: 0,
      y: 0,
      width: destination.width,
      height: destination.height,
      clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
      duration: 1.05,
      ease: 'power3.inOut',
    })
    timeline.fromTo(copyItems, { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.12, duration: 0.55, ease: 'power2.out' }, 0.34)
    return () => {
      ignore = true
      timeline.kill()
      media.style.cssText = ''
    }
  }, [reduceMotion, serviceId, slug])

  useLayoutEffect(() => {
    if (isLoading || !isEntering || !catalogRef.current) return
    const tween = gsap.fromTo(catalogRef.current, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.6, delay: 0.12, ease: 'power2.out' })
    return () => {
      tween.kill()
    }
  }, [isEntering, isLoading])

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setMessage('')
    setStatus('')
    setMissing(false)
    const specialized = Boolean(serviceId && (slug === 'locacion' || slug === 'banquetes' || slug === 'flores-decoracion' || slug === 'musica' || slug === 'meseros' || slug === 'mobiliario'))
    const load = specialized
      ? Promise.resolve()
      : serviceId
      ? fetchCategoryService(slug, serviceId).then((result) => {
          if (!active) return
          setCategory(result.category)
          setService(result.service)
        })
      : fetchCategory(slug, applied).then((result) => {
          if (!active) return
          setCategory(result.category)
          setServices(result.services)
          setAvailableFeatures(result.features)
          setService(null)
        })
    load.catch((error: unknown) => {
      if (!active) return
      const catalogError = error instanceof CatalogError ? error : null
      if (catalogError?.status === 404) {
        setMissing(true)
        return
      }
      setMessage(catalogError?.message || 'No se pudo cargar la categoría.')
    }).finally(() => {
      if (active) setIsLoading(false)
    })
    return () => {
      active = false
    }
  }, [slug, serviceId, applied])

  const handleApply = (event: FormEvent) => {
    event.preventDefault()
    setApplied({
      minPrice: minPrice > PRICE_FLOOR ? String(minPrice) : '',
      maxPrice: maxPrice < PRICE_CEILING ? String(maxPrice) : '',
      features: selectedFeatures,
    })
  }

  const handleMinPrice = (value: number) => {
    setMinPrice(Math.min(value, maxPrice))
  }

  const handleMaxPrice = (value: number) => {
    setMaxPrice(Math.max(value, minPrice))
  }

  const handleToggleFeature = (feature: string) => {
    setSelectedFeatures((current) => current.includes(feature) ? current.filter((item) => item !== feature) : [...current, feature])
  }

  const handlePrivateAction = async (kind: 'quote' | 'planner', target: CatalogService) => {
    const returnPath = safeCategoryReturn(window.location.pathname) || `/categorias/${slug}`
    if (!session) {
      setLoginNotice('Inicia sesión con una cuenta de cliente para continuar.')
      onNavigate(`/ingresar?next=${encodeURIComponent(returnPath)}`)
      return
    }
    if (session.role !== 'cliente') {
      setStatus('Solo una cuenta de cliente puede solicitar cotizaciones o agregar servicios al planificador.')
      return
    }
    setStatus('')
    try {
      const result = kind === 'quote' ? await requestQuote(slug, target.id) : await addToPlanner(slug, target.id)
      if (result.message) {
        setStatus(result.message)
        return
      }
      setStatus(kind === 'quote' ? 'Cotización solicitada.' : 'Servicio agregado al planificador.')
    } catch (error) {
      const catalogError = error instanceof CatalogError ? error : null
      if (catalogError?.status === 401) {
        setLoginNotice('Inicia sesión con una cuenta de cliente para continuar.')
        onNavigate(`/ingresar?next=${encodeURIComponent(returnPath)}`)
        return
      }
      setStatus(catalogError?.message || 'No se pudo completar la acción.')
    }
  }

  return (
    <main className={isEntering ? 'category-page is-entering' : 'category-page'} ref={pageRef}>
      <CategoryTopbar session={session} onNavigate={onNavigate} />
      {isLoading && !hero && !(serviceId && (slug === 'locacion' || slug === 'banquetes' || slug === 'flores-decoracion' || slug === 'musica' || slug === 'meseros' || slug === 'mobiliario')) ? <p className="category-status">Cargando categoría…</p> : null}
      {!isLoading && missing ? (
        <section className="category-empty">
          <h1>Categoría no disponible</h1>
          <p>Esta ruta no corresponde a una categoría del catálogo.</p>
        </section>
      ) : null}
      {!isLoading && message ? <p className="category-status" role="alert">{message}</p> : null}
      {hero && !serviceId ? (
        <section className="category-hero">
          <div className="category-hero-media" ref={mediaRef}>
            <img src={hero.imageUrl} alt="" />
            <div className="category-hero-shade" />
          </div>
          <div className="category-hero-copy" ref={copyRef}>
            <span className="eyebrow light">Categoría</span>
            <h1>{hero.title}</h1>
            <p>{hero.description}</p>
          </div>
        </section>
      ) : null}
      {serviceId && slug === 'locacion' ? <VenueDetail slug={slug} serviceId={serviceId} session={session} onNavigate={onNavigate} /> : null}
      {serviceId && slug === 'banquetes' ? <BanquetDetail serviceId={serviceId} session={session} onNavigate={onNavigate} /> : null}
      {serviceId && slug === 'flores-decoracion' ? <DecorationDetail serviceId={serviceId} session={session} onNavigate={onNavigate} /> : null}
      {serviceId && slug === 'musica' ? <MusicDetail serviceId={serviceId} session={session} onNavigate={onNavigate} /> : null}
      {serviceId && slug === 'meseros' ? <WaitstaffDetail serviceId={serviceId} session={session} onNavigate={onNavigate} /> : null}
      {serviceId && slug === 'mobiliario' ? <FurnitureDetail serviceId={serviceId} session={session} onNavigate={onNavigate} /> : null}
      {!isLoading && category && serviceId && service && slug !== 'locacion' && slug !== 'banquetes' && slug !== 'flores-decoracion' && slug !== 'musica' && slug !== 'meseros' && slug !== 'mobiliario' ? (
        <ServiceDetail category={category} service={service} slug={slug} status={status} onNavigate={onNavigate} onAction={handlePrivateAction} />
      ) : null}
      {!isLoading && category && !serviceId ? (
        <div ref={catalogRef}>
          <CategoryCatalog
            services={services}
            features={availableFeatures}
            minPrice={minPrice}
            maxPrice={maxPrice}
            selectedFeatures={selectedFeatures}
            hasFilters={Boolean(applied.minPrice || applied.maxPrice || applied.features.length)}
            status={status}
            slug={slug}
            onNavigate={onNavigate}
            onMinPrice={handleMinPrice}
            onMaxPrice={handleMaxPrice}
            onToggleFeature={handleToggleFeature}
            onApply={handleApply}
            onAction={handlePrivateAction}
          />
        </div>
      ) : null}
    </main>
  )
}

const ServiceActions = ({ service, slug, onNavigate, onAction }: { service: CatalogService; slug: string; onNavigate: (path: string) => void; onAction: (kind: 'quote' | 'planner', service: CatalogService) => void }) => {
  const detailPath = `/categorias/${slug}/servicios/${service.id}`
  return (
    <div className="category-card-actions">
      <a className="outline-button compact" href={detailPath} onClick={(event) => { event.preventDefault(); onNavigate(detailPath) }}>Ver detalle</a>
      <button className="outline-button compact" type="button" onClick={() => slug === 'locacion' || slug === 'banquetes' || slug === 'flores-decoracion' || slug === 'musica' || slug === 'meseros' || slug === 'mobiliario' ? onNavigate(`/categorias/${slug}/servicios/${service.id}?accion=cotizacion`) : onAction('quote', service)}>Solicitar cotización</button>
      <button className="outline-button compact" type="button" onClick={() => slug === 'locacion' || slug === 'banquetes' || slug === 'flores-decoracion' || slug === 'musica' || slug === 'meseros' || slug === 'mobiliario' ? onNavigate(`/categorias/${slug}/servicios/${service.id}?accion=planificador`) : onAction('planner', service)}>{slug === 'locacion' || slug === 'banquetes' || slug === 'flores-decoracion' || slug === 'musica' || slug === 'meseros' || slug === 'mobiliario' ? 'Agregar a mi evento' : 'Agregar al planificador'}</button>
    </div>
  )
}

const ServiceDetail = ({ category, service, slug, status, onNavigate, onAction }: { category: CatalogCategory; service: CatalogService; slug: string; status: string; onNavigate: (path: string) => void; onAction: (kind: 'quote' | 'planner', service: CatalogService) => void }) => (
  <>
    <section className="category-hero">
      <div className="category-hero-media">
        {service.imageUrl ? <img src={service.imageUrl} alt="" /> : null}
        <div className="category-hero-shade" />
      </div>
      <div className="category-hero-copy">
        <span className="eyebrow light">{category.title}</span>
        <h1>{service.provider.businessName}</h1>
        <p>{service.title === service.provider.businessName ? category.title : service.title}{service.provider.city ? ` · ${service.provider.city}` : ''}</p>
      </div>
    </section>
    <section className="category-detail-panel">
      <p>{service.description}</p>
      {service.provider.description ? <p>{service.provider.description}</p> : null}
      <strong>{formatPrice(service.priceCents)}</strong>
      {service.features.length > 0 ? <ul className="category-feature-list">{service.features.map((feature) => <li key={feature}>{feature}</li>)}</ul> : null}
      <ServiceActions service={service} slug={slug} onNavigate={onNavigate} onAction={onAction} />
      {status ? <p className="category-status" role="status">{status}</p> : null}
      <a className="text-button" href={`/categorias/${slug}`} onClick={(event) => { event.preventDefault(); onNavigate(`/categorias/${slug}`) }}>Volver a {category.title}</a>
    </section>
  </>
)

type CatalogProps = {
  services: CatalogService[]
  features: string[]
  minPrice: number
  maxPrice: number
  selectedFeatures: string[]
  hasFilters: boolean
  status: string
  slug: string
  onNavigate: (path: string) => void
  onMinPrice: (value: number) => void
  onMaxPrice: (value: number) => void
  onToggleFeature: (feature: string) => void
  onApply: (event: FormEvent) => void
  onAction: (kind: 'quote' | 'planner', service: CatalogService) => void
}

const PriceRange = ({ minPrice, maxPrice, onMinPrice, onMaxPrice }: { minPrice: number; maxPrice: number; onMinPrice: (value: number) => void; onMaxPrice: (value: number) => void }) => {
  const controlRef = useRef<HTMLDivElement>(null)
  const dragThumb = useRef<'min' | 'max' | null>(null)
  const span = PRICE_CEILING - PRICE_FLOOR
  const start = ((minPrice - PRICE_FLOOR) / span) * 100
  const end = ((maxPrice - PRICE_FLOOR) / span) * 100
  const priceFromPointer = (clientX: number) => {
    const rect = controlRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 22) return PRICE_FLOOR
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left - 11) / (rect.width - 22)))
    return Math.round((PRICE_FLOOR + ratio * span) / PRICE_STEP) * PRICE_STEP
  }
  const moveThumb = (thumb: 'min' | 'max', clientX: number) => {
    const next = priceFromPointer(clientX)
    if (thumb === 'min') onMinPrice(Math.min(next, maxPrice))
    else onMaxPrice(Math.max(next, minPrice))
  }
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const next = priceFromPointer(event.clientX)
    const thumb = Math.abs(next - minPrice) <= Math.abs(next - maxPrice) ? 'min' : 'max'
    dragThumb.current = thumb
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      dragThumb.current = thumb
    }
    moveThumb(thumb, event.clientX)
  }
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragThumb.current) return
    moveThumb(dragThumb.current, event.clientX)
  }
  const handlePointerEnd = () => {
    dragThumb.current = null
  }
  const handleMinChange = (value: string) => {
    onMinPrice(Math.min(Number(value), maxPrice))
  }
  const handleMaxChange = (value: string) => {
    onMaxPrice(Math.max(Number(value), minPrice))
  }
  return (
    <div className="price-range">
      <span className="price-range-label">Precio</span>
      <div className="price-range-readout" aria-live="polite">
        <span>{formatPesos(minPrice)}</span>
        <span>{formatPesos(maxPrice)}</span>
      </div>
      <div className="price-range-control" ref={controlRef} role="group" aria-label="Rango de precio" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd}>
        <div className="price-range-track" />
        <div className="price-range-fill" style={{ left: `calc(${start} * (100% - 22px) / 100 + 11px)`, width: `calc(${Math.max(0, end - start)} * (100% - 22px) / 100)` }} />
        <span className="price-range-thumb" style={{ left: `calc(${start} * (100% - 22px) / 100)` }} />
        <span className="price-range-thumb" style={{ left: `calc(${end} * (100% - 22px) / 100)` }} />
        <input className="price-range-input" type="range" min={PRICE_FLOOR} max={PRICE_CEILING} step={PRICE_STEP} value={minPrice} aria-label="Precio mínimo" aria-valuetext={formatPesos(minPrice)} onChange={(event) => handleMinChange(event.target.value)} />
        <input className="price-range-input" type="range" min={PRICE_FLOOR} max={PRICE_CEILING} step={PRICE_STEP} value={maxPrice} aria-label="Precio máximo" aria-valuetext={formatPesos(maxPrice)} onChange={(event) => handleMaxChange(event.target.value)} />
      </div>
    </div>
  )
}

const CategoryCatalog = ({ services, features, minPrice, maxPrice, selectedFeatures, hasFilters, status, slug, onNavigate, onMinPrice, onMaxPrice, onToggleFeature, onApply, onAction }: CatalogProps) => (
  <div className="category-layout category-catalog">
      <form className="category-filters" onSubmit={onApply}>
        <h2>Filtros</h2>
        <PriceRange minPrice={minPrice} maxPrice={maxPrice} onMinPrice={onMinPrice} onMaxPrice={onMaxPrice} />
        {features.length > 0 ? (
          <fieldset>
            <legend>Características</legend>
            {features.map((feature) => (
              <label className="category-check" key={feature}>
                <input type="checkbox" checked={selectedFeatures.includes(feature)} onChange={() => onToggleFeature(feature)} />
                {feature}
              </label>
            ))}
          </fieldset>
        ) : null}
        <button className="outline-button compact" type="submit">Aplicar filtros</button>
      </form>
      <section>
        {status ? <p className="category-status" role="status">{status}</p> : null}
        {services.length === 0 ? (
          <div className="category-empty">
            <h2>{hasFilters ? 'Sin coincidencias' : 'Aún no hay servicios'}</h2>
            <p>{hasFilters ? 'Ningún proveedor coincide con esos filtros.' : 'Cuando un proveedor publique un servicio en esta categoría, aparecerá aquí.'}</p>
          </div>
        ) : (
          <div className="category-grid">
            {services.map((item) => (
              <article className="category-card" key={item.id}>
                <ServicePhoto service={item} />
                <div className="category-card-body">
                  <h2>{item.provider.businessName}</h2>
                  {item.title !== item.provider.businessName ? <p>{item.title}</p> : null}
                  <p>{item.description}</p>
                  <strong>{formatPrice(item.priceCents)}</strong>
                  <ServiceActions service={item} slug={slug} onNavigate={onNavigate} onAction={onAction} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
  </div>
)
