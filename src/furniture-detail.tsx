import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { setLoginNotice } from './auth-api'
import { CatalogError, formatPrice } from './catalog-api'
import {
  createEvent,
  estimateFurniture,
  fetchEvents,
  fetchFurniture,
  moneyLabel,
  saveFurniture,
  type ClientEvent,
  type FurnitureService,
} from './furniture-api'
import { preferEventId, writeActiveEventId } from './venue-api'
import { safeCategoryReturn } from './navigation'
import type { SessionUser } from './session'
import { Dialog } from './venue-detail'

type FurnitureAction = 'planificador' | 'cotizacion' | ''

const missing = (value: string) => value.trim() || 'Sin registrar'

const readAction = (): FurnitureAction => {
  const action = new URLSearchParams(window.location.search).get('accion')
  return action === 'planificador' || action === 'cotizacion' ? action : ''
}

export const FurnitureDetail = ({ serviceId, session, onNavigate }: { serviceId: number; session: SessionUser | null; onNavigate: (path: string) => void }) => {
  const [categoryTitle, setCategoryTitle] = useState('')
  const [categoryImage, setCategoryImage] = useState('')
  const [service, setService] = useState<FurnitureService | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isUnpublished, setIsUnpublished] = useState(false)
  const [tag, setTag] = useState('')
  const [photoIndex, setPhotoIndex] = useState(0)
  const [imageReady, setImageReady] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [isZoomed, setIsZoomed] = useState(false)
  const [subcategory, setSubcategory] = useState('')
  const [styleFilter, setStyleFilter] = useState('')
  const [query, setQuery] = useState('')
  const [packageId, setPackageId] = useState<number | null>(null)
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [addonQuantities, setAddonQuantities] = useState<Record<number, number>>({})
  const [rentalDays, setRentalDays] = useState(1)
  const [calculatorTableItemId, setCalculatorTableItemId] = useState<number | null>(null)
  const [events, setEvents] = useState<ClientEvent[]>([])
  const [eventId, setEventId] = useState('')
  const [guestsEdited, setGuestsEdited] = useState(false)
  const [guests, setGuests] = useState('')
  const [action, setAction] = useState<FurnitureAction>('')
  const [notes, setNotes] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventType, setEventType] = useState('')
  const [newGuests, setNewGuests] = useState('')
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    let active = true
    setIsLoading(true)
    fetchFurniture(serviceId)
      .then((result) => {
        if (!active) return
        setCategoryTitle(result.category.title)
        setCategoryImage(result.category.imageUrl)
        setService(result.service)
      })
      .catch((error: unknown) => {
        if (!active) return
        const catalogError = error instanceof CatalogError ? error : null
        if (catalogError?.name === 'unpublished') {
          setIsUnpublished(true)
          return
        }
        setLoadError(catalogError?.status === 404 ? 'No encontramos ese servicio de mobiliario.' : catalogError?.message || 'No se pudo cargar el mobiliario.')
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [serviceId])

  useEffect(() => {
    if (session?.role !== 'cliente') return
    fetchEvents().then((result) => setEvents(result.events)).catch(() => setEvents([]))
  }, [session])

  const photos = useMemo(() => {
    const own = (service?.furniture.images || []).filter((image) => !tag || image.tag === tag)
    if (own.length > 0) return own
    return categoryImage ? [{ id: 0, url: categoryImage, alt: `Imagen de respaldo de la categoría ${categoryTitle}`, tag: '' }] : []
  }, [categoryImage, categoryTitle, service, tag])
  const photo = photos[photoIndex] || photos[0]
  const isFallback = Boolean(service && service.furniture.images.length === 0)
  const tags = [...new Set((service?.furniture.images || []).map((image) => image.tag).filter(Boolean))]
  const selectedEvent = events.find((item) => String(item.id) === eventId) || null
  const guestsNumber = guests ? Number(guests) : null
  const estimate = service
    ? estimateFurniture(service, {
        packageId,
        quantities,
        addonQuantities,
        rentalDays,
        guests: Number.isInteger(guestsNumber) ? guestsNumber : null,
        calculatorTableItemId,
      })
    : { cents: null, pending: true, error: '', recommendation: { tables: null, chairs: null } }
  const estimateText = estimate.cents === null ? 'Sujeto a cotización' : formatPrice(estimate.cents)

  const chooseEvent = (id: string) => {
    setEventId(id)
    const chosen = events.find((item) => String(item.id) === id)
    if (!guestsEdited && guests === '' && chosen?.guestCount) setGuests(String(chosen.guestCount))
  }

  const askLogin = (nextAction: FurnitureAction) => {
    const next = safeCategoryReturn(`/categorias/mobiliario/servicios/${serviceId}?accion=${nextAction}`)
    setLoginNotice('Inicia sesión con una cuenta de cliente para continuar con este mobiliario.')
    onNavigate(`/ingresar?next=${encodeURIComponent(next || `/categorias/mobiliario/servicios/${serviceId}`)}`)
  }

  const openAction = async (nextAction: Exclude<FurnitureAction, ''>) => {
    setFormError('')
    setConfirmation('')
    if (!session) return askLogin(nextAction)
    if (session.role !== 'cliente') {
      setFormError('Solo una cuenta de cliente puede agregar mobiliario o solicitar cotizaciones.')
      setAction(nextAction)
      return
    }
    if (estimate.error) {
      setFormError(estimate.error)
      return
    }
    if (!packageId && !Object.keys(quantities).length && !Object.keys(addonQuantities).length) {
      setFormError('Selecciona al menos un artículo, paquete o complemento.')
      return
    }
    setAction(nextAction)
    const result = await fetchEvents()
    setEvents(result.events)
    setIsCreating(result.events.length === 0)
    const preferred = preferEventId(result.events)
    const selected = result.events.find((item) => String(item.id) === preferred) || result.events[0]
    if (!eventId && preferred) {
      setEventId(preferred)
      if (!guestsEdited && guests === '' && selected?.guestCount) setGuests(String(selected.guestCount))
    }
  }

  useEffect(() => {
    const requested = readAction()
    if (!requested || !service) return
    const url = new URL(window.location.href)
    url.searchParams.delete('accion')
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
    void openAction(requested)
  }, [service])

  const setItemQty = (id: number, quantity: number, minQty: number | null) => {
    setQuantities((current) => {
      if (!quantity || quantity < 1) {
        const next = { ...current }
        delete next[id]
        return next
      }
      return { ...current, [id]: Math.max(minQty || 1, quantity) }
    })
  }

  const applyRecommendation = () => {
    if (!service) return
    const tables = estimate.recommendation.tables
    const chairs = estimate.recommendation.chairs
    const table = calculatorTableItemId ? service.furniture.items.find((item) => item.id === calculatorTableItemId) : null
    if (table && tables) setItemQty(table.id, tables, table.minQty)
    const chair = service.furniture.items.find((item) => item.subcategory.toLowerCase().includes('silla') || item.name.toLowerCase().includes('silla'))
    if (chair && chairs) setItemQty(chair.id, chairs, chair.minQty)
  }

  const handleConfirm = async () => {
    if (!service || !eventId) {
      setFormError('Elige un evento para continuar.')
      return
    }
    if (estimate.error) {
      setFormError(estimate.error)
      return
    }
    setIsSaving(true)
    setFormError('')
    try {
      const result = await saveFurniture(action === 'cotizacion' ? 'quote' : 'planner', service.id, {
        eventId: Number(eventId),
        packageId,
        rentalDays,
        guests: guests || null,
        calculatorTableItemId,
        items: Object.entries(quantities).map(([id, quantity]) => ({ id: Number(id), quantity })),
        addons: Object.entries(addonQuantities).map(([id, quantity]) => ({ id: Number(id), quantity })),
        notes,
        eventLocation: action === 'cotizacion' ? eventLocation : '',
      })
      if (result.message && !result.created && !result.updated) {
        setFormError(result.message)
        return
      }
      const budget = result.estimatedCents == null
        ? ' El precio sigue sujeto a cotización.'
        : ` Estimación guardada: ${formatPrice(result.estimatedCents)}${estimate.pending ? ' · incluye conceptos por cotizar.' : '.'}`
      setConfirmation(action === 'cotizacion'
        ? 'La solicitud quedó registrada para el proveedor. Pedir cotización no reserva ni contrata el mobiliario.'
        : `${result.updated ? 'La selección de mobiliario se actualizó en el evento.' : 'El mobiliario quedó en la planificación del evento.'} Agregarlo no lo reserva ni lo contrata.${budget}`)
    } catch (error: unknown) {
      const catalogError = error instanceof CatalogError ? error : null
      if (catalogError?.status === 401) return askLogin(action || 'planificador')
      setFormError(catalogError?.message || 'No se pudo guardar la operación.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateEvent = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setFormError('')
    try {
      const result = await createEvent({ name: eventName, eventDate, guestCount: newGuests, eventType })
      setEvents((current) => [...current, result.event])
      setEventId(String(result.event.id))
      setIsCreating(false)
      if (!guestsEdited && guests === '' && result.event.guestCount) setGuests(String(result.event.guestCount))
    } catch (error: unknown) {
      setFormError(error instanceof CatalogError ? error.message : 'No se pudo crear el evento.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="venue-page" aria-busy="true">
        <p className="venue-loading">Cargando el mobiliario…</p>
        <div className="decor-layout">
          <div className="venue-skeleton venue-skeleton-hero" />
          <div className="venue-skeleton venue-skeleton-block" />
        </div>
      </div>
    )
  }
  if (isUnpublished) return <section className="category-empty"><h1>Mobiliario no disponible</h1><p>Esta publicación está desactivada y no se puede consultar.</p></section>
  if (loadError || !service || !photo) return <section className="category-empty"><h1>No se pudo abrir el mobiliario</h1><p role="alert">{loadError || 'No encontramos ese servicio de mobiliario.'}</p></section>

  const info = service.furniture
  const subcategories = [...new Set(info.items.map((item) => item.subcategory).filter(Boolean))]
  const styles = [...new Set(info.items.map((item) => item.style).filter(Boolean))]
  const catalog = info.items.filter((item) => {
    if (subcategory && item.subcategory !== subcategory) return false
    if (styleFilter && item.style !== styleFilter) return false
    if (query && !item.name.toLowerCase().includes(query.trim().toLowerCase())) return false
    return true
  })
  const selectedPackage = info.packages.find((item) => item.id === packageId) || null
  const selectedItems = info.items.filter((item) => quantities[item.id])
  const selectedAddons = info.addons.filter((item) => addonQuantities[item.id])
  const tableOptions = info.items.filter((item) => item.capacity)
  const coverage = info.coverageArea || service.provider.city

  return (
    <article className="venue-page">
      <div className="decor-layout">
        <div className="venue-copy">
          <section className="venue-gallery" aria-label="Galería de mobiliario">
            <div className="venue-stage">
              {!imageReady && !imageFailed ? <div className="venue-skeleton venue-skeleton-hero" /> : null}
              {imageFailed ? <p className="venue-note">No se pudo cargar la fotografía.</p> : <img src={photo.url} alt={photo.alt || service.provider.businessName} onLoad={() => setImageReady(true)} onError={() => { setImageReady(true); setImageFailed(true) }} />}
              <div className="venue-gallery-nav">
                <button type="button" aria-label="Fotografía anterior" onClick={() => { setImageReady(false); setImageFailed(false); setPhotoIndex((current) => (current - 1 + photos.length) % photos.length) }}>‹</button>
                <button type="button" aria-label="Fotografía siguiente" onClick={() => { setImageReady(false); setImageFailed(false); setPhotoIndex((current) => (current + 1) % photos.length) }}>›</button>
                <button type="button" onClick={() => setIsZoomed(true)} disabled={imageFailed}>Ampliar</button>
              </div>
            </div>
            {isFallback ? <p className="venue-note">Este proveedor todavía no publica fotografías. La imagen es un respaldo de la categoría.</p> : null}
            {tags.length > 0 ? (
              <div className="banquet-menu" role="group" aria-label="Etiquetas de la galería">
                <button className={tag === '' ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={tag === ''} onClick={() => { setTag(''); setPhotoIndex(0) }}>Todas</button>
                {tags.map((item) => <button className={tag === item ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={tag === item} key={item} onClick={() => { setTag(item); setPhotoIndex(0) }}>{item}</button>)}
              </div>
            ) : null}
            {photos.length > 1 ? (
              <div className="venue-thumbs" role="list">
                {photos.map((item, index) => (
                  <button className={index === photoIndex ? 'is-selected' : ''} type="button" aria-label={`Ver fotografía ${index + 1}${item.tag ? `, ${item.tag}` : ''}`} aria-current={index === photoIndex} key={`${item.id}-${index}`} onClick={() => { setImageReady(false); setImageFailed(false); setPhotoIndex(index) }}>
                    <img src={item.url} alt="" />
                  </button>
                ))}
              </div>
            ) : null}
          </section>
          <span className="eyebrow violet">{categoryTitle}</span>
          <h1>{service.provider.businessName}</h1>
          <p className="venue-lead">{service.title === service.provider.businessName ? missing(info.specialties || info.furnitureTypes) : service.title}</p>
          <p>{service.description || 'Sin descripción.'}</p>
          <dl className="venue-facts">
            <div><dt>Tipos de mobiliario</dt><dd>{missing(info.furnitureTypes)}</dd></div>
            <div><dt>Especialidades</dt><dd>{missing(info.specialties)}</dd></div>
            <div><dt>Cobertura</dt><dd>{missing(coverage)}</dd></div>
            <div><dt>Modalidad de precios</dt><dd>{moneyLabel(info.priceMode, service.priceCents)}</dd></div>
          </dl>
          <section className="venue-provider" aria-labelledby="furniture-provider">
            <h2 id="furniture-provider">Proveedor</h2>
            <div className="venue-provider-card">
              <span className="venue-mark" aria-hidden="true">{service.provider.businessName.trim().charAt(0).toUpperCase() || 'M'}</span>
              <div>
                <strong>{service.provider.businessName}</strong>
                <p>{service.provider.description || 'Este negocio todavía no escribe una descripción.'}</p>
                <a className="outline-button compact" href={`/negocios/${service.providerId}`} onClick={(event) => { event.preventDefault(); onNavigate(`/negocios/${service.providerId}`) }}>Ver perfil del proveedor</a>
              </div>
            </div>
          </section>
          <section className="venue-block" aria-labelledby="furniture-event">
            <h2 id="furniture-event">Evento e invitados</h2>
            {session?.role === 'cliente' ? (
              events.length > 0 ? (
                <>
                  <label htmlFor="furniture-event-select">Evento</label>
                  <select id="furniture-event-select" value={eventId} onChange={(event) => chooseEvent(event.target.value)}>
                    <option value="">Sin elegir</option>
                    {events.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                  </select>
                  <p>{selectedEvent ? `${selectedEvent.eventType || 'Sin tipo'} · ${selectedEvent.eventDate || 'Sin fecha'} · ${selectedEvent.guestCount ? `${selectedEvent.guestCount.toLocaleString('es-MX')} invitados` : 'Sin invitados'}` : 'Elige un evento para usar su fecha e invitados.'}</p>
                </>
              ) : <p>Todavía no tienes eventos. Puedes configurar y crear uno al guardar.</p>
            ) : <p>Al iniciar sesión podrás vincular esta selección a un evento.</p>}
            <label htmlFor="furniture-guests">Número de invitados para la estimación</label>
            <input id="furniture-guests" inputMode="numeric" value={guests} onChange={(event) => { setGuestsEdited(true); setGuests(event.target.value) }} />
          </section>
          <section className="venue-block" aria-labelledby="furniture-catalog">
            <h2 id="furniture-catalog">Catálogo</h2>
            {info.items.length === 0 ? <p>Este proveedor todavía no publica artículos de mobiliario.</p> : (
              <>
                <label htmlFor="furniture-search">Buscar por nombre</label>
                <input id="furniture-search" value={query} onChange={(event) => setQuery(event.target.value)} />
                {subcategories.length ? (
                  <div className="banquet-menu" role="group" aria-label="Subcategorías">
                    <button className={subcategory === '' ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={subcategory === ''} onClick={() => setSubcategory('')}>Todas</button>
                    {subcategories.map((item) => <button className={subcategory === item ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={subcategory === item} key={item} onClick={() => setSubcategory(item)}>{item}</button>)}
                  </div>
                ) : null}
                {styles.length ? (
                  <div className="banquet-menu" role="group" aria-label="Estilos">
                    <button className={styleFilter === '' ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={styleFilter === ''} onClick={() => setStyleFilter('')}>Todos los estilos</button>
                    {styles.map((item) => <button className={styleFilter === item ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={styleFilter === item} key={item} onClick={() => setStyleFilter(item)}>{item}</button>)}
                  </div>
                ) : null}
                <div className="banquet-grid">
                  {catalog.map((item) => (
                    <div className={quantities[item.id] ? 'banquet-choice is-selected' : 'banquet-choice'} key={item.id}>
                      {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
                      <strong>{item.name}</strong>
                      {item.subcategory ? <span>{item.subcategory}{item.style ? ` · ${item.style}` : ''}</span> : null}
                      {item.description ? <span>{item.description}</span> : null}
                      <b>{moneyLabel(item.priceUnit, item.priceCents)}</b>
                      {item.capacity ? <small>Capacidad: {item.capacity}</small> : null}
                      {item.minQty ? <small>Mínimo: {item.minQty}</small> : null}
                      {item.stock !== null ? <small>Existencias registradas: {item.stock}</small> : null}
                      {item.conditions ? <small>{item.conditions}</small> : null}
                      <label>
                        Cantidad
                        <input inputMode="numeric" aria-label={`Cantidad de ${item.name}`} value={quantities[item.id] || ''} placeholder="0" onChange={(event) => setItemQty(item.id, Number(event.target.value) || 0, item.minQty)} />
                      </label>
                    </div>
                  ))}
                </div>
                {!catalog.length ? <p>No hay artículos con esos filtros.</p> : null}
              </>
            )}
          </section>
          <section className="venue-block" aria-labelledby="furniture-calculator">
            <h2 id="furniture-calculator">Calculadora de mesas y sillas</h2>
            {tableOptions.length === 0 ? <p>No hay mesas con capacidad registrada. La recomendación de sillas puede partir de una por invitado cuando indiques invitados.</p> : (
              <>
                <label htmlFor="furniture-table-model">Modelo de mesa</label>
                <select id="furniture-table-model" value={calculatorTableItemId ?? ''} onChange={(event) => setCalculatorTableItemId(event.target.value ? Number(event.target.value) : null)}>
                  <option value="">Sin elegir</option>
                  {tableOptions.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.capacity} personas</option>)}
                </select>
              </>
            )}
            <p>
              {guestsNumber
                ? `Referencia: ${estimate.recommendation.tables ? `${estimate.recommendation.tables} mesas` : 'sin mesa seleccionada'} · ${estimate.recommendation.chairs ?? 0} sillas. Es orientativa y no garantiza disponibilidad.`
                : 'Indica invitados para obtener una referencia. Puedes ajustar las cantidades a mano.'}
            </p>
            <button className="outline-button compact" type="button" onClick={applyRecommendation} disabled={!estimate.recommendation.tables && !estimate.recommendation.chairs}>Aplicar sugerencia al catálogo</button>
          </section>
          <section className="venue-block" aria-labelledby="furniture-packages">
            <h2 id="furniture-packages">Paquetes</h2>
            {info.packages.length === 0 ? <p>No hay paquetes publicados.</p> : (
              <div className="banquet-grid">
                {info.packages.map((item) => (
                  <button className={item.id === packageId ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={item.id === packageId} key={item.id} onClick={() => setPackageId(item.id === packageId ? null : item.id)}>
                    {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
                    <strong>{item.name}</strong>
                    {item.description ? <span>{item.description}</span> : null}
                    <b>{moneyLabel(item.priceUnit, item.priceCents)}</b>
                    {item.rentalLabel ? <small>{item.rentalLabel}</small> : null}
                    {item.items.length ? <small>Incluye {item.items.length} tipo(s) de artículo</small> : null}
                    {item.conditions ? <small>{item.conditions}</small> : null}
                  </button>
                ))}
              </div>
            )}
            <p>Los artículos incluidos en un paquete no se cobran otra vez hasta superar la cantidad del paquete.</p>
          </section>
          <section className="venue-block" aria-labelledby="furniture-rental">
            <h2 id="furniture-rental">Duración de renta</h2>
            <label htmlFor="furniture-days">Días de renta (aplica a tarifas por día)</label>
            <input id="furniture-days" inputMode="numeric" value={rentalDays} onChange={(event) => setRentalDays(Math.max(1, Number(event.target.value) || 1))} />
            <p>Las tarifas por evento o jornada no se multiplican automáticamente por día.</p>
          </section>
          <section className="venue-block" aria-labelledby="furniture-addons">
            <h2 id="furniture-addons">Servicios adicionales</h2>
            {info.addons.length === 0 ? <p>Este proveedor no publicó complementos de entrega o montaje.</p> : (
              <ul className="banquet-menu">
                {info.addons.map((item) => (
                  <li key={item.id}>
                    <label>
                      <input type="checkbox" checked={Boolean(addonQuantities[item.id])} onChange={() => setAddonQuantities((current) => {
                        if (current[item.id]) {
                          const next = { ...current }
                          delete next[item.id]
                          return next
                        }
                        return { ...current, [item.id]: 1 }
                      })} />
                      <span><strong>{item.name}</strong> · {moneyLabel(item.priceUnit, item.priceCents)}{item.description ? ` · ${item.description}` : ''}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="venue-price" aria-label="Resumen del mobiliario">
          <span>Presupuesto estimado</span>
          <strong>{estimateText}</strong>
          {estimate.pending ? <p>Hay conceptos sujetos a cotización. El importe no es definitivo.</p> : null}
          <p>El costo mostrado es una estimación. El precio final será definido mediante la cotización del proveedor.</p>
          <dl className="venue-facts">
            <div><dt>Paquete</dt><dd>{selectedPackage?.name || 'Sin paquete'}</dd></div>
            <div><dt>Artículos</dt><dd>{selectedItems.length ? selectedItems.map((item) => `${item.name} × ${quantities[item.id]}`).join(', ') : 'Sin elegir'}</dd></div>
            <div><dt>Complementos</dt><dd>{selectedAddons.length ? selectedAddons.map((item) => item.name).join(', ') : 'Sin elegir'}</dd></div>
            <div><dt>Duración</dt><dd>{rentalDays} día{rentalDays === 1 ? '' : 's'}</dd></div>
          </dl>
          {estimate.error ? <p role="alert">{estimate.error}</p> : null}
          <button className="search-button" type="button" onClick={() => void openAction('planificador')}>Agregar a mi evento</button>
          <button className="outline-button" type="button" onClick={() => void openAction('cotizacion')}>Solicitar cotización</button>
          {formError && !action ? <p role="alert">{formError}</p> : null}
        </aside>
      </div>
      {isZoomed && !imageFailed ? <Dialog title={service.provider.businessName} onClose={() => setIsZoomed(false)}><img className="venue-zoom" src={photo.url} alt={photo.alt || service.provider.businessName} /></Dialog> : null}
      {action ? (
        <Dialog title={action === 'cotizacion' ? 'Solicitar cotización' : 'Agregar a mi evento'} onClose={() => { setAction(''); setConfirmation(''); setFormError('') }}>
          <p className="venue-note">{service.provider.businessName} · {selectedItems.length} artículo(s) · {estimateText}</p>
          {confirmation ? (
            <div>
              <p role="status">{confirmation}</p>
              <a className="search-button" href={action === 'cotizacion' ? '/cotizaciones' : '/planificador'} onClick={(event) => { event.preventDefault(); onNavigate(action === 'cotizacion' ? '/cotizaciones' : '/planificador') }}>{action === 'cotizacion' ? 'Ver solicitudes' : 'Ver planificación'}</a>
            </div>
          ) : null}
          {!confirmation && session?.role === 'cliente' && isCreating ? (
            <form className="venue-form" onSubmit={handleCreateEvent}>
              <p>{events.length === 0 ? 'Todavía no tienes eventos. Crea el primero para continuar.' : 'Crea un evento nuevo para continuar.'}</p>
              <label htmlFor="furniture-new-name">Nombre del evento</label>
              <input id="furniture-new-name" value={eventName} onChange={(event) => setEventName(event.target.value)} required />
              <label htmlFor="furniture-new-type">Tipo de celebración</label>
              <input id="furniture-new-type" value={eventType} onChange={(event) => setEventType(event.target.value)} />
              <label htmlFor="furniture-new-date">Fecha</label>
              <input id="furniture-new-date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
              <label htmlFor="furniture-new-guests">Número de invitados</label>
              <input id="furniture-new-guests" inputMode="numeric" value={newGuests} onChange={(event) => setNewGuests(event.target.value)} />
              {formError ? <p role="alert">{formError}</p> : null}
              <button className="search-button" type="submit" disabled={isSaving}>{isSaving ? 'Creando…' : events.length === 0 ? 'Crear mi primer evento' : 'Crear evento'}</button>
            </form>
          ) : null}
          {!confirmation && session?.role === 'cliente' && !isCreating ? (
            <form className="venue-form" onSubmit={(event) => { event.preventDefault(); void handleConfirm() }}>
              <label htmlFor="furniture-modal-event">Evento</label>
              <select id="furniture-modal-event" value={eventId} onChange={(event) => chooseEvent(event.target.value)}>
                {events.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
              <p>Resumen: {selectedPackage?.name || 'Sin paquete'} · {selectedItems.map((item) => `${item.name} × ${quantities[item.id]}`).join(', ') || 'Sin artículos'} · {estimateText}</p>
              {action === 'cotizacion' ? (
                <>
                  <label htmlFor="furniture-place">Lugar del evento</label>
                  <input id="furniture-place" value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} />
                  <label htmlFor="furniture-notes">Observaciones</label>
                  <textarea id="furniture-notes" maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
                </>
              ) : null}
              {formError ? <p role="alert">{formError}</p> : null}
              <button className="search-button" type="submit" disabled={isSaving}>{isSaving ? 'Guardando…' : 'Confirmar'}</button>
            </form>
          ) : null}
        </Dialog>
      ) : null}
    </article>
  )
}
