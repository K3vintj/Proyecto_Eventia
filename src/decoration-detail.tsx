import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { setLoginNotice } from './auth-api'
import { CatalogError, formatPrice } from './catalog-api'
import {
  createEvent,
  estimateDecoration,
  fetchDecoration,
  fetchEvents,
  moneyLabel,
  saveDecoration,
  type ClientEvent,
  type DecorService,
} from './decoration-api'
import { preferEventId, writeActiveEventId } from './venue-api'
import { safeCategoryReturn } from './navigation'
import type { SessionUser } from './session'
import { Dialog } from './venue-detail'

type DecorAction = 'planificador' | 'cotizacion' | ''

const missing = (value: string) => value.trim() || 'Sin registrar'

const readAction = (): DecorAction => {
  const action = new URLSearchParams(window.location.search).get('accion')
  return action === 'planificador' || action === 'cotizacion' ? action : ''
}

export const DecorationDetail = ({ serviceId, session, onNavigate }: { serviceId: number; session: SessionUser | null; onNavigate: (path: string) => void }) => {
  const [categoryTitle, setCategoryTitle] = useState('')
  const [categoryImage, setCategoryImage] = useState('')
  const [service, setService] = useState<DecorService | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isUnpublished, setIsUnpublished] = useState(false)
  const [tag, setTag] = useState('')
  const [photoIndex, setPhotoIndex] = useState(0)
  const [imageReady, setImageReady] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [isZoomed, setIsZoomed] = useState(false)
  const [styleId, setStyleId] = useState<number | null>(null)
  const [paletteId, setPaletteId] = useState<number | null>(null)
  const [colorNote, setColorNote] = useState('')
  const [packageId, setPackageId] = useState<number | null>(null)
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [events, setEvents] = useState<ClientEvent[]>([])
  const [eventId, setEventId] = useState('')
  const [guestsEdited, setGuestsEdited] = useState(false)
  const [guests, setGuests] = useState('')
  const [action, setAction] = useState<DecorAction>('')
  const [notes, setNotes] = useState('')
  const [eventTime, setEventTime] = useState('')
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
    fetchDecoration(serviceId)
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
        setLoadError(catalogError?.status === 404 ? 'No encontramos esa decoración.' : catalogError?.message || 'No se pudo cargar la decoración.')
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [serviceId])

  useEffect(() => {
    if (session?.role !== 'cliente') return
    fetchEvents().then((result) => setEvents(result.events)).catch(() => setEvents([]))
  }, [session])

  const photos = useMemo(() => {
    const own = (service?.decoration.images || []).filter((image) => !tag || image.tag === tag)
    if (own.length > 0) return own
    return categoryImage ? [{ id: 0, url: categoryImage, alt: `Imagen de respaldo de la categoría ${categoryTitle}`, tag: '', styleId: null, packageId: null }] : []
  }, [categoryImage, categoryTitle, service, tag])
  const photo = photos[photoIndex] || photos[0]
  const isFallback = Boolean(service && service.decoration.images.length === 0)
  const tags = [...new Set((service?.decoration.images || []).map((image) => image.tag).filter(Boolean))]
  const selectedEvent = events.find((item) => String(item.id) === eventId) || null
  const estimate = service ? estimateDecoration(service, { packageId, quantities }) : { cents: null, pending: true, error: '' }
  const estimateText = estimate.cents === null ? 'Sujeto a cotización' : formatPrice(estimate.cents)

  const chooseEvent = (id: string) => {
    setEventId(id)
    const chosen = events.find((item) => String(item.id) === id)
    if (!guestsEdited && guests === '' && chosen?.guestCount) setGuests(String(chosen.guestCount))
  }

  const askLogin = (nextAction: DecorAction) => {
    const next = safeCategoryReturn(`/categorias/flores-decoracion/servicios/${serviceId}?accion=${nextAction}`)
    setLoginNotice('Inicia sesión con una cuenta de cliente para continuar con esta decoración.')
    onNavigate(`/ingresar?next=${encodeURIComponent(next || `/categorias/flores-decoracion/servicios/${serviceId}`)}`)
  }

  const openAction = async (nextAction: Exclude<DecorAction, ''>) => {
    setFormError('')
    setConfirmation('')
    if (!session) return askLogin(nextAction)
    if (session.role !== 'cliente') {
      setFormError('Solo una cuenta de cliente puede agregar decoración o solicitar cotizaciones.')
      setAction(nextAction)
      return
    }
    if (estimate.error) {
      setFormError(estimate.error)
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

  const toggleElement = (id: number, minQty: number | null) => {
    setQuantities((current) => {
      if (current[id]) {
        const next = { ...current }
        delete next[id]
        return next
      }
      return { ...current, [id]: minQty || 1 }
    })
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
      const result = await saveDecoration(action === 'cotizacion' ? 'quote' : 'planner', service.id, {
        eventId: Number(eventId),
        styleId,
        paletteId,
        packageId,
        colorNote,
        guests: guests || null,
        elements: Object.entries(quantities).map(([id, quantity]) => ({ id: Number(id), quantity })),
        notes,
        eventTime: action === 'cotizacion' ? eventTime : '',
        eventLocation: action === 'cotizacion' ? eventLocation : '',
      })
      if (result.message && !result.created) {
        setFormError(result.message)
        return
      }
      const budget = result.estimatedCents == null
        ? ' El precio sigue sujeto a cotización.'
        : ` Estimación guardada: ${formatPrice(result.estimatedCents)}${estimate.pending ? ' · incluye conceptos por cotizar.' : '.'}`
      setConfirmation(action === 'cotizacion'
        ? 'La solicitud quedó registrada para el proveedor. Pedir cotización no contrata la decoración.'
        : `La decoración quedó en la planificación del evento. Agregarla no la contrata.${budget}`)
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
        <p className="venue-loading">Cargando la decoración…</p>
        <div className="decor-layout">
          <div className="venue-skeleton venue-skeleton-hero" />
          <div className="venue-skeleton venue-skeleton-block" />
        </div>
      </div>
    )
  }
  if (isUnpublished) return <section className="category-empty"><h1>Decoración no disponible</h1><p>Esta publicación está desactivada y no se puede consultar.</p></section>
  if (loadError || !service || !photo) return <section className="category-empty"><h1>No se pudo abrir la decoración</h1><p role="alert">{loadError || 'No encontramos esa decoración.'}</p></section>

  const decor = service.decoration
  const selectedStyle = decor.styles.find((item) => item.id === styleId) || null
  const selectedPalette = decor.palettes.find((item) => item.id === paletteId) || null
  const selectedPackage = decor.packages.find((item) => item.id === packageId) || null
  const selectedElements = decor.elements.filter((item) => quantities[item.id])
  const coverage = decor.coverageArea || service.provider.city

  return (
    <article className="venue-page">
      <div className="decor-layout">
        <div className="venue-copy">
          <section className="venue-gallery" aria-label="Portafolio del decorador">
            <div className="venue-stage">
              {!imageReady && !imageFailed ? <div className="venue-skeleton venue-skeleton-hero" /> : null}
              {imageFailed ? <p className="venue-note">No se pudo cargar la fotografía.</p> : <img src={photo.url} alt={photo.alt || service.title} onLoad={() => setImageReady(true)} onError={() => { setImageReady(true); setImageFailed(true) }} />}
              <div className="venue-gallery-nav">
                <button type="button" aria-label="Fotografía anterior" onClick={() => { setImageReady(false); setImageFailed(false); setPhotoIndex((current) => (current - 1 + photos.length) % photos.length) }}>‹</button>
                <button type="button" aria-label="Fotografía siguiente" onClick={() => { setImageReady(false); setImageFailed(false); setPhotoIndex((current) => (current + 1) % photos.length) }}>›</button>
                <button type="button" onClick={() => setIsZoomed(true)} disabled={imageFailed}>Ampliar</button>
              </div>
            </div>
            {isFallback ? <p className="venue-note">Este decorador todavía no publica fotografías. La imagen es un respaldo de la categoría.</p> : null}
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
          <p className="venue-lead">{service.title === service.provider.businessName ? missing(decor.specialties) : service.title}</p>
          <p>{service.description || 'Sin descripción.'}</p>
          <dl className="venue-facts">
            <div><dt>Especialidades</dt><dd>{missing(decor.specialties)}</dd></div>
            <div><dt>Cobertura</dt><dd>{missing(coverage)}</dd></div>
            <div><dt>Precio de referencia</dt><dd>{moneyLabel(decor.priceMode, service.priceCents)}</dd></div>
            <div><dt>Publicación</dt><dd>{service.isPublished ? 'Publicado' : 'No publicado'}</dd></div>
          </dl>
          <section className="venue-provider" aria-labelledby="decor-provider">
            <h2 id="decor-provider">Proveedor</h2>
            <div className="venue-provider-card">
              <span className="venue-mark" aria-hidden="true">{service.provider.businessName.trim().charAt(0).toUpperCase() || 'E'}</span>
              <div>
                <strong>{service.provider.businessName}</strong>
                <p>{service.provider.description || 'Este negocio todavía no escribe una descripción.'}</p>
                <a className="outline-button compact" href={`/negocios/${service.providerId}`} onClick={(event) => { event.preventDefault(); onNavigate(`/negocios/${service.providerId}`) }}>Ver perfil del proveedor</a>
              </div>
            </div>
          </section>
          <section className="venue-block" aria-labelledby="decor-event">
            <h2 id="decor-event">Tipo de celebración</h2>
            {session?.role === 'cliente' ? (
              events.length > 0 ? (
                <>
                  <label htmlFor="decor-event-select">Evento</label>
                  <select id="decor-event-select" value={eventId} onChange={(event) => chooseEvent(event.target.value)}>
                    <option value="">Sin elegir</option>
                    {events.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                  </select>
                  <p>{selectedEvent ? `${selectedEvent.eventType || 'Sin tipo registrado'} · ${selectedEvent.eventDate || 'Sin fecha'} · ${selectedEvent.guestCount ? `${selectedEvent.guestCount.toLocaleString('es-MX')} invitados` : 'Sin invitados'}` : 'Elige un evento para usar su tipo, fecha e invitados.'}</p>
                </>
              ) : <p>Todavía no tienes eventos. Puedes crear uno al agregar la decoración.</p>
            ) : <p>Al iniciar sesión se usa el tipo de celebración registrado en tu evento, si existe.</p>}
          </section>
          <section className="venue-block" aria-labelledby="decor-styles">
            <h2 id="decor-styles">Estilos</h2>
            {decor.styles.length === 0 ? <p>Este decorador todavía no publica estilos.</p> : (
              <div className="banquet-grid">
                {decor.styles.map((item) => (
                  <button className={item.id === styleId ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={item.id === styleId} key={item.id} onClick={() => setStyleId(item.id === styleId ? null : item.id)}>
                    {item.images[0] ? <img src={item.images[0].url} alt="" /> : null}
                    <strong>{item.name}</strong>
                    {item.description ? <span>{item.description}</span> : null}
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="venue-block" aria-labelledby="decor-packages">
            <h2 id="decor-packages">Paquetes</h2>
            {decor.packages.length === 0 ? <p>No hay paquetes publicados. Puedes solicitar una decoración personalizada.</p> : (
              <div className="banquet-grid">
                {decor.packages.map((item) => (
                  <button className={item.id === packageId ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={item.id === packageId} key={item.id} onClick={() => setPackageId(item.id === packageId ? null : item.id)}>
                    <strong>{item.name}</strong>
                    {item.description ? <span>{item.description}</span> : null}
                    <b>{moneyLabel(item.priceUnit, item.priceCents)}</b>
                    {item.includedItems ? <small>Incluye: {item.includedItems}</small> : null}
                    {item.coverage ? <small>Cobertura: {item.coverage}</small> : null}
                    {item.conditions ? <small>{item.conditions}</small> : null}
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="venue-block" aria-labelledby="decor-colors">
            <h2 id="decor-colors">Paleta de colores</h2>
            {decor.palettes.length === 0 ? <p>Este decorador no publicó paletas.</p> : (
              <div className="banquet-grid">
                {decor.palettes.map((item) => (
                  <button className={item.id === paletteId ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={item.id === paletteId} key={item.id} onClick={() => setPaletteId(item.id === paletteId ? null : item.id)}>
                    <strong>{item.name}</strong>
                    <span className="color-row">{item.colors.map((color) => <span className="color-swatch" key={color} style={{ background: color }}>{color}</span>)}</span>
                    {item.description ? <small>{item.description}</small> : null}
                  </button>
                ))}
              </div>
            )}
            <label htmlFor="color-note">Colores de preferencia</label>
            <input id="color-note" value={colorNote} maxLength={120} onChange={(event) => setColorNote(event.target.value)} />
            <p>Indicar colores no garantiza que el proveedor confirme esa combinación. La propuesta formal sale de su cotización.</p>
          </section>
          <section className="venue-block" aria-labelledby="decor-elements">
            <h2 id="decor-elements">Elementos decorativos</h2>
            {decor.elements.length === 0 ? <p>Este decorador no publicó elementos ni complementos.</p> : (
              <ul className="banquet-menu">
                {decor.elements.map((item) => (
                  <li key={item.id}>
                    <label>
                      <input type="checkbox" checked={Boolean(quantities[item.id])} onChange={() => toggleElement(item.id, item.minQty)} />
                      <span><strong>{item.name}</strong>{item.isAddon ? ' · Complemento' : ''} · {moneyLabel(item.priceUnit, item.priceCents)}{item.description ? ` · ${item.description}` : ''}</span>
                    </label>
                    {quantities[item.id] ? (
                      <label>
                        Cantidad
                        <input inputMode="numeric" aria-label={`Cantidad de ${item.name}`} value={quantities[item.id]} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))} />
                      </label>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="venue-price" aria-label="Resumen de la decoración">
          <span>Presupuesto estimado</span>
          <strong>{estimateText}</strong>
          {estimate.pending ? <p>Hay conceptos sujetos a cotización. El importe no es definitivo.</p> : null}
          <p>El costo mostrado es una estimación. El precio final será definido mediante la cotización del proveedor.</p>
          <dl className="venue-facts">
            <div><dt>Estilo</dt><dd>{selectedStyle?.name || 'Sin elegir'}</dd></div>
            <div><dt>Paleta</dt><dd>{selectedPalette?.name || 'Sin elegir'}</dd></div>
            <div><dt>Colores de preferencia</dt><dd>{colorNote || 'Sin indicar'}</dd></div>
            <div><dt>Paquete</dt><dd>{selectedPackage?.name || 'Decoración personalizada'}</dd></div>
            <div><dt>Elementos</dt><dd>{selectedElements.length ? selectedElements.map((item) => `${item.name} × ${quantities[item.id]}`).join(', ') : 'Sin elegir'}</dd></div>
          </dl>
          <label htmlFor="decor-guests">Número de invitados</label>
          <input id="decor-guests" inputMode="numeric" value={guests} onChange={(event) => { setGuestsEdited(true); setGuests(event.target.value) }} />
          {estimate.error ? <p role="alert">{estimate.error}</p> : null}
          <button className="search-button" type="button" onClick={() => void openAction('planificador')}>Agregar a mi evento</button>
          <button className="outline-button" type="button" onClick={() => void openAction('cotizacion')}>Solicitar cotización</button>
          {formError && !action ? <p role="alert">{formError}</p> : null}
        </aside>
      </div>
      {isZoomed && !imageFailed ? <Dialog title={service.provider.businessName} onClose={() => setIsZoomed(false)}><img className="venue-zoom" src={photo.url} alt={photo.alt || service.title} /></Dialog> : null}
      {action ? (
        <Dialog title={action === 'cotizacion' ? 'Solicitar cotización' : 'Agregar a mi evento'} onClose={() => { setAction(''); setConfirmation(''); setFormError('') }}>
          <p className="venue-note">{service.provider.businessName} · {selectedStyle?.name || 'Sin estilo'} · {estimateText}</p>
          {confirmation ? (
            <div>
              <p role="status">{confirmation}</p>
              <a className="search-button" href={action === 'cotizacion' ? '/cotizaciones' : '/planificador'} onClick={(event) => { event.preventDefault(); onNavigate(action === 'cotizacion' ? '/cotizaciones' : '/planificador') }}>{action === 'cotizacion' ? 'Ver solicitudes' : 'Ver planificación'}</a>
            </div>
          ) : null}
          {!confirmation && session?.role === 'cliente' && isCreating ? (
            <form className="venue-form" onSubmit={handleCreateEvent}>
              <p>{events.length === 0 ? 'Todavía no tienes eventos. Crea el primero para continuar.' : 'Crea un evento nuevo para continuar.'}</p>
              <label htmlFor="decor-new-name">Nombre del evento</label>
              <input id="decor-new-name" value={eventName} onChange={(event) => setEventName(event.target.value)} required />
              <label htmlFor="decor-new-type">Tipo de celebración</label>
              <input id="decor-new-type" value={eventType} onChange={(event) => setEventType(event.target.value)} />
              <label htmlFor="decor-new-date">Fecha</label>
              <input id="decor-new-date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
              <label htmlFor="decor-new-guests">Número de invitados</label>
              <input id="decor-new-guests" inputMode="numeric" value={newGuests} onChange={(event) => setNewGuests(event.target.value)} />
              {formError ? <p role="alert">{formError}</p> : null}
              <button className="search-button" type="submit" disabled={isSaving}>{isSaving ? 'Creando…' : events.length === 0 ? 'Crear mi primer evento' : 'Crear evento'}</button>
            </form>
          ) : null}
          {!confirmation && session?.role === 'cliente' && !isCreating ? (
            <form className="venue-form" onSubmit={(event) => { event.preventDefault(); void handleConfirm() }}>
              <label htmlFor="decor-modal-event">Evento</label>
              <select id="decor-modal-event" value={eventId} onChange={(event) => chooseEvent(event.target.value)}>
                {events.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
              <p>Resumen: {selectedStyle?.name || 'Sin estilo'} · {selectedPalette?.name || colorNote || 'Sin paleta'} · {selectedPackage?.name || 'Personalizada'} · {estimateText}</p>
              {selectedEvent ? <p>{selectedEvent.eventType || 'Sin tipo registrado'} · {selectedEvent.eventDate || 'Sin fecha'}</p> : null}
              {action === 'cotizacion' ? (
                <>
                  <label htmlFor="decor-time">Horario</label>
                  <input id="decor-time" type="time" value={eventTime} onChange={(event) => setEventTime(event.target.value)} />
                  <label htmlFor="decor-place">Lugar del evento</label>
                  <input id="decor-place" value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} />
                  <label htmlFor="decor-notes">Observaciones</label>
                  <textarea id="decor-notes" maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
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
