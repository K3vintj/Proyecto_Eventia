import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { setLoginNotice } from './auth-api'
import { CatalogError, formatPrice } from './catalog-api'
import { safeCategoryReturn } from './navigation'
import type { SessionUser } from './session'
import {
  addVenueToEvent,
  createEvent,
  fetchEvents,
  fetchVenue,
  formatEventDate,
  formatReferencePrice,
  preferEventId,
  priceModeLabel,
  requestVenueQuote,
  writeActiveEventId,
  type ClientEvent,
  type VenueDetail as VenueRecord,
} from './venue-api'

type VenueAction = 'planificador' | 'cotizacion' | ''

type VenueDetailProps = {
  slug: string
  serviceId: number
  session: SessionUser | null
  onNavigate: (path: string) => void
}

const missing = (value: string) => value.trim() || 'Sin registrar'

const capacityLabel = (min: number | null, max: number | null) => {
  if (min === null && max === null) return 'Sin registrar'
  if (min !== null && max !== null) return `${min.toLocaleString('es-MX')} a ${max.toLocaleString('es-MX')} invitados`
  if (max !== null) return `Hasta ${max.toLocaleString('es-MX')} invitados`
  return `Desde ${min?.toLocaleString('es-MX')} invitados`
}

const readAction = (): VenueAction => {
  const action = new URLSearchParams(window.location.search).get('accion')
  if (action === 'planificador' || action === 'cotizacion') return action
  return ''
}

const VenueSkeleton = () => (
  <div className="venue-page" aria-busy="true" aria-live="polite">
    <p className="venue-loading">Cargando el lugar…</p>
    <div className="venue-layout">
      <div className="venue-skeleton venue-skeleton-hero" />
      <div className="venue-copy">
        <div className="venue-skeleton venue-skeleton-line" />
        <div className="venue-skeleton venue-skeleton-title" />
        <div className="venue-skeleton venue-skeleton-block" />
        <div className="venue-skeleton venue-skeleton-block" />
      </div>
    </div>
  </div>
)

export const Dialog = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement
    const dialog = dialogRef.current
    const focusable = dialog?.querySelector<HTMLElement>('button, [href], input, select, textarea')
    focusable?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])

  return (
    <div className="venue-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="venue-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef}>
        <div className="venue-dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button className="outline-button compact" type="button" onClick={onClose}>Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const VenueDetail = ({ slug, serviceId, session, onNavigate }: VenueDetailProps) => {
  const [categoryTitle, setCategoryTitle] = useState('')
  const [categoryImage, setCategoryImage] = useState('')
  const [venue, setVenue] = useState<VenueRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isUnpublished, setIsUnpublished] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [imageReady, setImageReady] = useState(false)
  const [isZoomed, setIsZoomed] = useState(false)
  const [action, setAction] = useState<VenueAction>('')
  const [events, setEvents] = useState<ClientEvent[]>([])
  const [eventId, setEventId] = useState('')
  const [notes, setNotes] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setLoadError('')
    setIsUnpublished(false)
    fetchVenue(slug, serviceId)
      .then((result) => {
        if (!active) return
        setCategoryTitle(result.category.title)
        setCategoryImage(result.category.imageUrl)
        setVenue(result.service)
      })
      .catch((error: unknown) => {
        if (!active) return
        const catalogError = error instanceof CatalogError ? error : null
        if (catalogError?.name === 'unpublished') {
          setIsUnpublished(true)
          return
        }
        setLoadError(catalogError?.status === 404 ? 'No encontramos ese lugar.' : catalogError?.message || 'No se pudo cargar el lugar.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [serviceId, slug])

  useEffect(() => {
    const requested = readAction()
    if (!requested || !venue) return
    if (!session) {
      const next = safeCategoryReturn(`${window.location.pathname}?accion=${requested}`) || window.location.pathname
      setLoginNotice('Inicia sesión con una cuenta de cliente para continuar.')
      onNavigate(`/ingresar?next=${encodeURIComponent(next)}`)
      return
    }
    if (session.role !== 'cliente') return
    setAction(requested)
    fetchEvents()
      .then((result) => {
        setEvents(result.events)
        setEventId(preferEventId(result.events))
        setIsCreating(result.events.length === 0)
      })
      .catch((error: unknown) => setFormError(error instanceof CatalogError ? error.message : 'No se pudieron cargar tus eventos.'))
  }, [onNavigate, session, venue])

  const photos = venue && venue.images.length > 0
    ? venue.images
    : [{ id: 0, url: categoryImage, alt: `Imagen de respaldo de ${categoryTitle}. Este lugar todavía no publica fotografías.` }]
  const photo = photos[photoIndex] || photos[0]
  const isFallback = Boolean(venue && venue.images.length === 0)
  const selectedEvent = events.find((item) => String(item.id) === eventId) || null

  const askLogin = (nextAction: VenueAction) => {
    const next = safeCategoryReturn(`/categorias/${slug}/servicios/${serviceId}?accion=${nextAction}`)
    setLoginNotice('Inicia sesión con una cuenta de cliente para continuar.')
    onNavigate(`/ingresar?next=${encodeURIComponent(next || `/categorias/${slug}/servicios/${serviceId}`)}`)
  }

  const openAction = async (nextAction: Exclude<VenueAction, ''>) => {
    setConfirmation('')
    setFormError('')
    if (!session) {
      askLogin(nextAction)
      return
    }
    if (session.role !== 'cliente') {
      setFormError('Solo una cuenta de cliente puede agregar lugares o solicitar cotizaciones.')
      setAction(nextAction)
      return
    }
    setAction(nextAction)
    try {
      const result = await fetchEvents()
      setEvents(result.events)
      setEventId(preferEventId(result.events))
      setIsCreating(result.events.length === 0)
    } catch (error: unknown) {
      setFormError(error instanceof CatalogError ? error.message : 'No se pudieron cargar tus eventos.')
    }
  }

  const handleCreateEvent = async (event: FormEvent) => {
    event.preventDefault()
    setFormError('')
    setIsSaving(true)
    try {
      const result = await createEvent({ name: eventName, eventDate, guestCount })
      setEvents((current) => [...current, result.event])
      setEventId(String(result.event.id))
      writeActiveEventId(result.event.id)
      setIsCreating(false)
      setEventName('')
      setEventDate('')
      setGuestCount('')
    } catch (error: unknown) {
      setFormError(error instanceof CatalogError ? error.message : 'No se pudo crear el evento.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirm = async () => {
    if (!venue || !eventId) {
      setFormError('Elige un evento para continuar.')
      return
    }
    setIsSaving(true)
    setFormError('')
    try {
      const result = action === 'cotizacion'
        ? await requestVenueQuote(slug, venue.id, Number(eventId), notes)
        : await addVenueToEvent(slug, venue.id, Number(eventId))
      if (result.message && !result.created) {
        setFormError(result.message)
        return
      }
      const estimated = 'estimatedCents' in result ? result.estimatedCents : undefined
      const budget = estimated === null
        ? ' Su precio sigue por confirmar y no suma un monto al presupuesto.'
        : typeof result.budgetCents === 'number'
          ? ` Presupuesto estimado del evento: ${formatPrice(result.budgetCents)}.`
          : ''
      setConfirmation(action === 'cotizacion'
        ? 'La solicitud quedó registrada para el proveedor. Pedir cotización no contrata el lugar.'
        : `El lugar quedó en la planificación del evento. Agregarlo no lo contrata.${budget}`)
    } catch (error: unknown) {
      const catalogError = error instanceof CatalogError ? error : null
      if (catalogError?.status === 401) {
        askLogin(action || 'planificador')
        return
      }
      setFormError(catalogError?.message || 'No se pudo guardar la operación.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <VenueSkeleton />
  if (isUnpublished) {
    return (
      <section className="category-empty">
        <h1>Lugar no disponible</h1>
        <p>Esta publicación está desactivada y no se puede consultar.</p>
      </section>
    )
  }
  if (loadError || !venue || !photo) {
    return (
      <section className="category-empty">
        <h1>No se pudo abrir el lugar</h1>
        <p role="alert">{loadError || 'No encontramos ese lugar.'}</p>
      </section>
    )
  }

  const place = [venue.venue.address, venue.provider.city].filter(Boolean).join(' · ')
  const reference = formatReferencePrice(venue.priceCents, venue.venue.priceMode)

  return (
    <article className="venue-page">
      <div className="venue-layout">
        <section className="venue-gallery" aria-label="Fotografías del lugar">
          <div className="venue-stage">
            {!imageReady ? <div className="venue-skeleton venue-skeleton-hero" /> : null}
            <img
              src={photo.url}
              alt={photo.alt || venue.title}
              onLoad={() => setImageReady(true)}
              onError={() => setImageReady(true)}
            />
            <div className="venue-gallery-nav">
              <button type="button" aria-label="Fotografía anterior" onClick={() => { setImageReady(false); setPhotoIndex((current) => (current - 1 + photos.length) % photos.length) }}>‹</button>
              <button type="button" aria-label="Fotografía siguiente" onClick={() => { setImageReady(false); setPhotoIndex((current) => (current + 1) % photos.length) }}>›</button>
              <button type="button" onClick={() => setIsZoomed(true)}>Ampliar</button>
            </div>
          </div>
          {isFallback ? <p className="venue-note">Este lugar todavía no publica fotografías. La imagen es un respaldo de la categoría.</p> : null}
          {photos.length > 1 ? (
            <div className="venue-thumbs" role="list">
              {photos.map((item, index) => (
                <button className={index === photoIndex ? 'is-selected' : ''} type="button" aria-label={`Ver fotografía ${index + 1}`} aria-current={index === photoIndex} key={`${item.id}-${index}`} onClick={() => { setImageReady(false); setPhotoIndex(index) }}>
                  <img src={item.url} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </section>
        <section className="venue-copy">
          <span className="eyebrow violet">{categoryTitle}</span>
          <h1>{venue.provider.businessName}</h1>
          <p className="venue-lead">{venue.title === venue.provider.businessName ? missing(venue.venue.spaceType) : venue.title}</p>
          <p>{venue.description || 'Sin descripción.'}</p>
          <dl className="venue-facts">
            <div><dt>Tipo de espacio</dt><dd>{missing(venue.venue.spaceType)}</dd></div>
            <div><dt>Ubicación</dt><dd>{missing(place)}</dd></div>
            <div><dt>Capacidad</dt><dd>{capacityLabel(venue.venue.capacityMin, venue.venue.capacityMax)}</dd></div>
            <div><dt>Modalidad de precio</dt><dd>{priceModeLabel(venue.venue.priceMode)}</dd></div>
            <div><dt>Proveedor</dt><dd>{venue.provider.businessName}</dd></div>
            <div><dt>Publicación</dt><dd>{venue.isPublished ? 'Publicado' : 'No publicado'}</dd></div>
          </dl>
          <section className="venue-block" aria-labelledby="venue-features">
            <h2 id="venue-features">Características e instalaciones</h2>
            {venue.features.length > 0 ? (
              <ul className="category-feature-list">{venue.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            ) : <p>Este lugar no tiene características registradas.</p>}
          </section>
          <section className="venue-provider" aria-labelledby="venue-provider">
            <h2 id="venue-provider">Proveedor</h2>
            <div className="venue-provider-card">
              <span className="venue-mark" aria-hidden="true">{venue.provider.businessName.trim().charAt(0).toUpperCase() || 'E'}</span>
              <div>
                <strong>{venue.provider.businessName}</strong>
                <p>{venue.provider.description || 'Este negocio todavía no escribe una descripción.'}</p>
                <a className="outline-button compact" href={`/negocios/${venue.providerId}`} onClick={(event) => { event.preventDefault(); onNavigate(`/negocios/${venue.providerId}`) }}>Ver perfil del proveedor</a>
              </div>
            </div>
            {venue.providerServices.length > 0 ? (
              <ul className="venue-other">
                {venue.providerServices.map((item) => (
                  <li key={`${item.slug}-${item.id}`}>
                    <a href={`/categorias/${item.slug}/servicios/${item.id}`} onClick={(event) => { event.preventDefault(); onNavigate(`/categorias/${item.slug}/servicios/${item.id}`) }}>{item.title}</a>
                    <span>{item.categoryTitle}</span>
                  </li>
                ))}
              </ul>
            ) : <p>Este negocio no tiene otros servicios publicados.</p>}
          </section>
        </section>
        <aside className="venue-price" aria-label="Precio y acciones">
          <span>Precio de referencia</span>
          <strong>{reference}</strong>
          <p>Agregar este espacio a un evento lo considera en el presupuesto. No queda contratado.</p>
          <button className="search-button" type="button" onClick={() => void openAction('planificador')}>Agregar a mi evento</button>
          <button className="outline-button" type="button" onClick={() => void openAction('cotizacion')}>Solicitar cotización</button>
          {formError && !action ? <p role="alert">{formError}</p> : null}
        </aside>
      </div>
      {isZoomed ? (
        <Dialog title={venue.provider.businessName} onClose={() => setIsZoomed(false)}>
          <img className="venue-zoom" src={photo.url} alt={photo.alt || venue.title} />
        </Dialog>
      ) : null}
      {action ? (
        <Dialog title={action === 'cotizacion' ? 'Solicitar cotización' : 'Agregar a mi evento'} onClose={() => { setAction(''); setConfirmation(''); setFormError('') }}>
          <p className="venue-note">{venue.provider.businessName} · {reference}</p>
          {session?.role !== 'cliente' ? <p role="alert">Solo una cuenta de cliente puede continuar.</p> : null}
          {confirmation ? (
            <div>
              <p role="status">{confirmation}</p>
              <a className="search-button" href={action === 'cotizacion' ? '/cotizaciones' : '/planificador'} onClick={(event) => { event.preventDefault(); onNavigate(action === 'cotizacion' ? '/cotizaciones' : '/planificador') }}>
                {action === 'cotizacion' ? 'Ver solicitudes' : 'Ver planificación'}
              </a>
            </div>
          ) : null}
          {!confirmation && session?.role === 'cliente' && isCreating ? (
            <form className="venue-form" onSubmit={handleCreateEvent}>
              <p>{events.length === 0 ? 'Todavía no tienes eventos. Crea el primero para continuar.' : 'Crea un evento nuevo para continuar.'}</p>
              <label htmlFor="event-name">Nombre del evento</label>
              <input id="event-name" value={eventName} onChange={(event) => setEventName(event.target.value)} required />
              <label htmlFor="event-date">Fecha</label>
              <input id="event-date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
              <label htmlFor="event-guests">Número de invitados</label>
              <input id="event-guests" inputMode="numeric" value={guestCount} onChange={(event) => setGuestCount(event.target.value)} />
              {formError ? <p role="alert">{formError}</p> : null}
              <button className="search-button" type="submit" disabled={isSaving}>{isSaving ? 'Creando…' : events.length === 0 ? 'Crear mi primer evento' : 'Crear evento'}</button>
              {events.length > 0 ? <button className="outline-button compact" type="button" onClick={() => setIsCreating(false)}>Elegir un evento existente</button> : null}
            </form>
          ) : null}
          {!confirmation && session?.role === 'cliente' && !isCreating ? (
            <form className="venue-form" onSubmit={(event) => { event.preventDefault(); void handleConfirm() }}>
              <label htmlFor="event-select">Evento</label>
              <select id="event-select" value={eventId} onChange={(event) => setEventId(event.target.value)}>
                {events.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
              {selectedEvent ? (
                <dl className="venue-facts">
                  <div><dt>Nombre</dt><dd>{selectedEvent.name}</dd></div>
                  <div><dt>Fecha</dt><dd>{formatEventDate(selectedEvent.eventDate)}</dd></div>
                  <div><dt>Invitados</dt><dd>{selectedEvent.guestCount ? selectedEvent.guestCount.toLocaleString('es-MX') : 'Sin registrar'}</dd></div>
                  <div><dt>Precio estimado</dt><dd>{reference}</dd></div>
                </dl>
              ) : null}
              {action === 'cotizacion' ? (
                <>
                  <label htmlFor="quote-notes">Observaciones</label>
                  <textarea id="quote-notes" value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} placeholder="Horario, montaje u otra necesidad" />
                </>
              ) : null}
              {formError ? <p role="alert">{formError}</p> : null}
              <button className="search-button" type="submit" disabled={isSaving}>{isSaving ? 'Guardando…' : 'Confirmar'}</button>
              <button className="outline-button compact" type="button" onClick={() => setIsCreating(true)}>Crear otro evento</button>
            </form>
          ) : null}
        </Dialog>
      ) : null}
    </article>
  )
}
