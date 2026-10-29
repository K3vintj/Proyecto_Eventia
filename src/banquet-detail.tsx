import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { setLoginNotice } from './auth-api'
import { CatalogError, formatPrice } from './catalog-api'
import { safeCategoryReturn } from './navigation'
import type { SessionUser } from './session'
import { Dialog } from './venue-detail'
import { preferEventId, writeActiveEventId } from './venue-api'
import {
  courseLabel,
  createEvent,
  estimateBanquet,
  fetchBanquet,
  fetchEvents,
  saveBanquet,
  unitLabel,
  type BanquetPackage,
  type BanquetService,
  type ClientEvent,
  type MenuCourse,
} from './banquet-api'

type BanquetAction = 'planificador' | 'cotizacion' | ''

type BanquetDetailProps = {
  serviceId: number
  session: SessionUser | null
  onNavigate: (path: string) => void
}

const missing = (value: string) => value.trim() || 'Sin registrar'

const readAction = (): BanquetAction => {
  const action = new URLSearchParams(window.location.search).get('accion')
  if (action === 'planificador' || action === 'cotizacion') return action
  return ''
}

const guestRange = (min: number | null, max: number | null) => {
  if (min === null && max === null) return 'Sin registrar'
  if (min !== null && max !== null) return `${min.toLocaleString('es-MX')} a ${max.toLocaleString('es-MX')}`
  if (max !== null) return `Hasta ${max.toLocaleString('es-MX')}`
  return `Desde ${min?.toLocaleString('es-MX')}`
}

const BanquetSkeleton = () => (
  <div className="venue-page" aria-busy="true" aria-live="polite">
    <p className="venue-loading">Cargando el banquete…</p>
    <div className="venue-layout">
      <div className="venue-skeleton venue-skeleton-hero" />
      <div className="venue-copy">
        <div className="venue-skeleton venue-skeleton-line" />
        <div className="venue-skeleton venue-skeleton-title" />
        <div className="venue-skeleton venue-skeleton-block" />
        <div className="venue-skeleton venue-skeleton-block" />
        <div className="venue-skeleton venue-skeleton-block" />
      </div>
      <div className="venue-skeleton venue-skeleton-block" />
    </div>
  </div>
)

const courses: MenuCourse[] = ['entrada', 'fuerte', 'guarnicion', 'postre', 'bebida', 'otro']

export const BanquetDetail = ({ serviceId, session, onNavigate }: BanquetDetailProps) => {
  const [categoryTitle, setCategoryTitle] = useState('')
  const [categoryImage, setCategoryImage] = useState('')
  const [service, setService] = useState<BanquetService | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isUnpublished, setIsUnpublished] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [imageReady, setImageReady] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [isZoomed, setIsZoomed] = useState(false)
  const [packageId, setPackageId] = useState<number | null>(null)
  const [guests, setGuests] = useState('')
  const [guestsEdited, setGuestsEdited] = useState(false)
  const [menuChoices, setMenuChoices] = useState<Record<string, number>>({})
  const [addonIds, setAddonIds] = useState<number[]>([])
  const [action, setAction] = useState<BanquetAction>('')
  const [events, setEvents] = useState<ClientEvent[]>([])
  const [eventId, setEventId] = useState('')
  const [notes, setNotes] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [newGuests, setNewGuests] = useState('')
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setLoadError('')
    setIsUnpublished(false)
    fetchBanquet(serviceId)
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
        setLoadError(catalogError?.status === 404 ? 'No encontramos ese banquete.' : catalogError?.message || 'No se pudo cargar el banquete.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [serviceId])

  const selectedPackage = service?.banquet.packages.find((item) => item.id === packageId) || null
  const photos = useMemo(() => {
    if (!service) return []
    const own = [...service.images, ...(selectedPackage?.images || [])]
    if (own.length > 0) return own
    return categoryImage ? [{ id: 0, url: categoryImage, alt: `Imagen de respaldo de la categoría ${categoryTitle}` }] : []
  }, [categoryImage, categoryTitle, selectedPackage, service])
  const photo = photos[photoIndex] || photos[0]
  const isFallback = Boolean(service && service.images.length === 0 && !(selectedPackage?.images.length))

  useEffect(() => {
    setPhotoIndex(0)
    setImageReady(false)
    setImageFailed(false)
  }, [packageId, serviceId])

  const parsedGuests = guests.trim() === '' ? null : /^\d+$/.test(guests) ? Number(guests) : undefined
  const menuOptionIds = Object.values(menuChoices)
  const estimate = service && parsedGuests !== undefined
    ? estimateBanquet(service, { packageId, guests: parsedGuests, menuOptionIds, addonIds })
    : { cents: null, pending: true, error: guests.trim() === '' ? '' : 'El número de invitados no es válido.' }

  const askLogin = (nextAction: BanquetAction) => {
    const next = safeCategoryReturn(`/categorias/banquetes/servicios/${serviceId}?accion=${nextAction}`)
    setLoginNotice('Inicia sesión con una cuenta de cliente para continuar con este banquete.')
    onNavigate(`/ingresar?next=${encodeURIComponent(next || `/categorias/banquetes/servicios/${serviceId}`)}`)
  }

  const openAction = async (nextAction: Exclude<BanquetAction, ''>) => {
    setFormError('')
    setConfirmation('')
    if (!session) {
      askLogin(nextAction)
      return
    }
    if (session.role !== 'cliente') {
      setFormError('Solo una cuenta de cliente puede agregar banquetes o solicitar cotizaciones.')
      setAction(nextAction)
      return
    }
    if (estimate.error) {
      setFormError(estimate.error)
      return
    }
    setAction(nextAction)
    try {
      const result = await fetchEvents()
      setEvents(result.events)
      const preferred = preferEventId(result.events)
      setEventId(preferred)
      setIsCreating(result.events.length === 0)
      const selected = result.events.find((item) => String(item.id) === preferred) || result.events[0]
      if (!guestsEdited && guests === '' && selected?.guestCount) setGuests(String(selected.guestCount))
    } catch (error: unknown) {
      setFormError(error instanceof CatalogError ? error.message : 'No se pudieron cargar tus eventos.')
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

  const handleCreateEvent = async (event: FormEvent) => {
    event.preventDefault()
    setFormError('')
    setIsSaving(true)
    try {
      const result = await createEvent({ name: eventName, eventDate, guestCount: newGuests })
      setEvents((current) => [...current, result.event])
      setEventId(String(result.event.id))
      setIsCreating(false)
      if (!guestsEdited && guests === '' && result.event.guestCount) setGuests(String(result.event.guestCount))
      setEventName('')
      setEventDate('')
      setNewGuests('')
    } catch (error: unknown) {
      setFormError(error instanceof CatalogError ? error.message : 'No se pudo crear el evento.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirm = async () => {
    if (!service || !eventId) {
      setFormError('Elige un evento para continuar.')
      return
    }
    if (estimate.error || parsedGuests === undefined) {
      setFormError(estimate.error || 'El número de invitados no es válido.')
      return
    }
    setIsSaving(true)
    setFormError('')
    try {
      const result = await saveBanquet(action === 'cotizacion' ? 'quote' : 'planner', service.id, {
        eventId: Number(eventId),
        packageId,
        guests: parsedGuests,
        menuOptionIds,
        addonIds,
        notes,
        eventTime: action === 'cotizacion' ? eventTime : '',
        eventLocation: action === 'cotizacion' ? eventLocation : '',
      })
      if (result.message && !result.created) {
        setFormError(result.message)
        return
      }
      const budget = result.estimatedCents == null
        ? ' El precio sigue sujeto a cotización y no suma un monto cerrado.'
        : ` Estimación guardada: ${formatPrice(result.estimatedCents)}.`
      setConfirmation(action === 'cotizacion'
        ? 'La solicitud quedó registrada para el proveedor. Pedir cotización no contrata el banquete.'
        : `El banquete quedó en la planificación del evento. Agregarlo no lo contrata.${budget}`)
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

  const handlePackage = (item: BanquetPackage) => {
    setPackageId(item.id === packageId ? null : item.id)
    setMenuChoices({})
  }

  const handleAddon = (id: number) => {
    setAddonIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  if (isLoading) return <BanquetSkeleton />
  if (isUnpublished) {
    return (
      <section className="category-empty">
        <h1>Banquete no disponible</h1>
        <p>Esta publicación está desactivada y no se puede consultar.</p>
      </section>
    )
  }
  if (loadError || !service || !photo) {
    return (
      <section className="category-empty">
        <h1>No se pudo abrir el banquete</h1>
        <p role="alert">{loadError || 'No encontramos ese banquete.'}</p>
      </section>
    )
  }

  const coverage = service.banquet.coverageArea || service.provider.city
  const reference = unitLabel(service.banquet.priceMode, service.priceCents)
  const included = service.banquet.offerings.filter((item) => item.inclusion === 'incluido')
  const optional = service.banquet.offerings.filter((item) => item.inclusion === 'opcional')
  const excluded = service.banquet.offerings.filter((item) => item.inclusion === 'no_incluido')
  const dishes = selectedPackage?.dishes || []
  const groups = [...new Set(dishes.map((dish) => dish.optionGroup).filter(Boolean))]
  const estimateText = estimate.cents === null ? 'Sujeto a cotización' : formatPrice(estimate.cents)
  const selectedEvent = events.find((item) => String(item.id) === eventId) || null

  return (
    <article className="venue-page">
      <div className="venue-layout">
        <section className="venue-gallery" aria-label="Fotografías del banquete">
          <div className="venue-stage">
            {!imageReady && !imageFailed ? <div className="venue-skeleton venue-skeleton-hero" /> : null}
            {imageFailed ? <p className="venue-note">No se pudo cargar la fotografía.</p> : (
              <img src={photo.url} alt={photo.alt || service.title} onLoad={() => setImageReady(true)} onError={() => { setImageReady(true); setImageFailed(true) }} />
            )}
            <div className="venue-gallery-nav">
              <button type="button" aria-label="Fotografía anterior" onClick={() => { setImageReady(false); setImageFailed(false); setPhotoIndex((current) => (current - 1 + photos.length) % photos.length) }}>‹</button>
              <button type="button" aria-label="Fotografía siguiente" onClick={() => { setImageReady(false); setImageFailed(false); setPhotoIndex((current) => (current + 1) % photos.length) }}>›</button>
              <button type="button" onClick={() => setIsZoomed(true)} disabled={imageFailed}>Ampliar</button>
            </div>
          </div>
          {isFallback ? <p className="venue-note">Este banquete todavía no publica fotografías. La imagen es un respaldo de la categoría.</p> : null}
          {photos.length > 1 ? (
            <div className="venue-thumbs" role="list">
              {photos.map((item, index) => (
                <button className={index === photoIndex ? 'is-selected' : ''} type="button" aria-label={`Ver fotografía ${index + 1}`} aria-current={index === photoIndex} key={`${item.id}-${index}`} onClick={() => { setImageReady(false); setImageFailed(false); setPhotoIndex(index) }}>
                  <img src={item.url} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </section>
        <section className="venue-copy">
          <span className="eyebrow violet">{categoryTitle}</span>
          <h1>{service.provider.businessName}</h1>
          <p className="venue-lead">{service.title === service.provider.businessName ? missing(service.banquet.serviceType) : service.title}</p>
          <p>{service.description || 'Sin descripción.'}</p>
          <dl className="venue-facts">
            <div><dt>Tipo de servicio</dt><dd>{missing(service.banquet.serviceType)}</dd></div>
            <div><dt>Cobertura</dt><dd>{missing(coverage)}</dd></div>
            <div><dt>Precio de referencia</dt><dd>{reference}</dd></div>
            <div><dt>Modalidad</dt><dd>{service.banquet.priceMode === 'persona' ? 'Por persona' : service.banquet.priceMode === 'fijo' ? 'Precio fijo' : service.banquet.priceMode === 'cotizacion' ? 'Sujeto a cotización' : 'Sin registrar'}</dd></div>
            <div><dt>Invitados</dt><dd>{guestRange(service.banquet.guestMin, service.banquet.guestMax)}</dd></div>
            <div><dt>Publicación</dt><dd>{service.isPublished ? 'Publicado' : 'No publicado'}</dd></div>
          </dl>
          <section className="venue-block" aria-labelledby="banquet-packages">
            <h2 id="banquet-packages">Paquetes</h2>
            {service.banquet.packages.length === 0 ? <p>Este proveedor todavía no publica paquetes.</p> : (
              <div className="banquet-grid" role="list">
                {service.banquet.packages.map((item) => (
                  <button className={item.id === packageId ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={item.id === packageId} key={item.id} onClick={() => handlePackage(item)}>
                    <strong>{item.name}</strong>
                    {item.description ? <span>{item.description}</span> : null}
                    <b>{unitLabel(item.priceUnit, item.priceCents)}</b>
                    {item.minGuests ? <small>Mínimo {item.minGuests.toLocaleString('es-MX')} invitados</small> : null}
                    {item.conditions ? <small>{item.conditions}</small> : null}
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="venue-block" aria-labelledby="banquet-menu">
            <h2 id="banquet-menu">Menú incluido</h2>
            {!selectedPackage ? <p>Selecciona un paquete para ver su menú.</p> : null}
            {selectedPackage && dishes.length === 0 ? <p>Este paquete no tiene platillos registrados.</p> : null}
            {courses.map((course) => {
              const fixed = dishes.filter((dish) => dish.course === course && !dish.optionGroup)
              if (fixed.length === 0) return null
              return (
                <div key={course}>
                  <h3>{courseLabel(course)}</h3>
                  <ul className="category-feature-list">{fixed.map((dish) => <li key={dish.id}>{dish.name}</li>)}</ul>
                </div>
              )
            })}
            {groups.map((group) => (
              <fieldset className="banquet-menu" key={group}>
                <legend>{group}</legend>
                {dishes.filter((dish) => dish.optionGroup === group).map((dish) => (
                  <label key={dish.id}>
                    <input type="radio" name={`menu-${group}`} checked={menuChoices[group] === dish.id} onChange={() => setMenuChoices((current) => ({ ...current, [group]: dish.id }))} />
                    {dish.name}
                  </label>
                ))}
              </fieldset>
            ))}
          </section>
          <section className="venue-block" aria-labelledby="banquet-features">
            <h2 id="banquet-features">Características del servicio</h2>
            {included.length + optional.length + excluded.length === 0 ? <p>Este banquete no tiene características registradas.</p> : null}
            {included.length > 0 ? <div><h3>Incluidos</h3><ul className="category-feature-list">{included.map((item) => <li key={item.id}>{item.name}</li>)}</ul></div> : null}
            {optional.length > 0 ? (
              <div>
                <h3>Opcionales</h3>
                <ul className="banquet-menu">
                  {optional.map((item) => (
                    <li key={item.id}>
                      <label>
                        <input type="checkbox" checked={addonIds.includes(item.id)} onChange={() => handleAddon(item.id)} />
                        {item.name} · {unitLabel(item.priceUnit, item.priceCents)}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : included.length + excluded.length > 0 ? <p>No hay complementos publicados.</p> : null}
            {excluded.length > 0 ? <div><h3>No incluidos</h3><ul className="category-feature-list">{excluded.map((item) => <li key={item.id}>{item.name}</li>)}</ul></div> : null}
          </section>
          <section className="venue-provider" aria-labelledby="banquet-provider">
            <h2 id="banquet-provider">Proveedor</h2>
            <div className="venue-provider-card">
              <span className="venue-mark" aria-hidden="true">{service.provider.businessName.trim().charAt(0).toUpperCase() || 'E'}</span>
              <div>
                <strong>{service.provider.businessName}</strong>
                <p>{service.provider.description || 'Este negocio todavía no escribe una descripción.'}</p>
                <a className="outline-button compact" href={`/negocios/${service.providerId}`} onClick={(event) => { event.preventDefault(); onNavigate(`/negocios/${service.providerId}`) }}>Ver perfil del proveedor</a>
              </div>
            </div>
          </section>
        </section>
        <aside className="venue-price" aria-label="Presupuesto del banquete">
          <span>Presupuesto estimado</span>
          <strong>{estimateText}</strong>
          {estimate.pending ? <p>Hay conceptos sujetos a cotización. El importe no es definitivo.</p> : null}
          <p>El costo mostrado es una estimación. El precio final será definido mediante la cotización del proveedor.</p>
          <label htmlFor="banquet-guests">Número de invitados</label>
          <input id="banquet-guests" inputMode="numeric" value={guests} onChange={(event) => { setGuestsEdited(true); setGuests(event.target.value) }} />
          {estimate.error ? <p role="alert">{estimate.error}</p> : null}
          <button className="search-button" type="button" onClick={() => void openAction('planificador')}>Agregar a mi evento</button>
          <button className="outline-button" type="button" onClick={() => void openAction('cotizacion')}>Solicitar cotización</button>
          {formError && !action ? <p role="alert">{formError}</p> : null}
        </aside>
      </div>
      {isZoomed && !imageFailed ? (
        <Dialog title={service.provider.businessName} onClose={() => setIsZoomed(false)}>
          <img className="venue-zoom" src={photo.url} alt={photo.alt || service.title} />
        </Dialog>
      ) : null}
      {action ? (
        <Dialog title={action === 'cotizacion' ? 'Solicitar cotización' : 'Agregar a mi evento'} onClose={() => { setAction(''); setConfirmation(''); setFormError('') }}>
          <p className="venue-note">{service.provider.businessName} · {selectedPackage?.name || 'Sin paquete'} · {estimateText}</p>
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
              <label htmlFor="banquet-event-name">Nombre del evento</label>
              <input id="banquet-event-name" value={eventName} onChange={(event) => setEventName(event.target.value)} required />
              <label htmlFor="banquet-event-date">Fecha</label>
              <input id="banquet-event-date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
              <label htmlFor="banquet-event-guests">Número de invitados</label>
              <input id="banquet-event-guests" inputMode="numeric" value={newGuests} onChange={(event) => setNewGuests(event.target.value)} />
              {formError ? <p role="alert">{formError}</p> : null}
              <button className="search-button" type="submit" disabled={isSaving}>{isSaving ? 'Creando…' : events.length === 0 ? 'Crear mi primer evento' : 'Crear evento'}</button>
            </form>
          ) : null}
          {!confirmation && session?.role === 'cliente' && !isCreating ? (
            <form className="venue-form" onSubmit={(event) => { event.preventDefault(); void handleConfirm() }}>
              <label htmlFor="banquet-event-select">Evento</label>
              <select id="banquet-event-select" value={eventId} onChange={(event) => {
                const nextId = event.target.value
                setEventId(nextId)
                const chosen = events.find((item) => String(item.id) === nextId)
                if (!guestsEdited && guests === '' && chosen?.guestCount) setGuests(String(chosen.guestCount))
              }}>
                {events.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
              {selectedEvent ? <p>{selectedEvent.name} · {selectedEvent.guestCount ? `${selectedEvent.guestCount.toLocaleString('es-MX')} invitados en el evento` : 'Sin invitados registrados'}</p> : null}
              <p>Resumen: {selectedPackage?.name || 'Sin paquete'} · {parsedGuests ? `${parsedGuests.toLocaleString('es-MX')} invitados` : 'Sin invitados en el configurador'} · {estimateText}</p>
              {action === 'cotizacion' ? (
                <>
                  <label htmlFor="banquet-time">Horario del evento</label>
                  <input id="banquet-time" type="time" value={eventTime} onChange={(event) => setEventTime(event.target.value)} />
                  <label htmlFor="banquet-location">Ubicación del evento</label>
                  <input id="banquet-location" value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} />
                  <label htmlFor="banquet-notes">Observaciones</label>
                  <textarea id="banquet-notes" value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} />
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
