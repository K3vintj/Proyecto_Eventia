import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { setLoginNotice } from './auth-api'
import { CatalogError, formatPrice } from './catalog-api'
import { safeCategoryReturn } from './navigation'
import type { SessionUser } from './session'
import { Dialog } from './venue-detail'
import {
  createEvent,
  estimateWaitstaff,
  fetchEvents,
  fetchWaitstaff,
  moneyLabel,
  saveWaitstaff,
  type ClientEvent,
  type WaitstaffService,
} from './waitstaff-api'
import { preferEventId, writeActiveEventId } from './venue-api'

type WaitstaffAction = 'planificador' | 'cotizacion' | ''

const missing = (value: string) => value.trim() || 'Sin registrar'

const readAction = (): WaitstaffAction => {
  const action = new URLSearchParams(window.location.search).get('accion')
  return action === 'planificador' || action === 'cotizacion' ? action : ''
}

export const WaitstaffDetail = ({ serviceId, session, onNavigate }: { serviceId: number; session: SessionUser | null; onNavigate: (path: string) => void }) => {
  const [categoryTitle, setCategoryTitle] = useState('')
  const [categoryImage, setCategoryImage] = useState('')
  const [service, setService] = useState<WaitstaffService | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isUnpublished, setIsUnpublished] = useState(false)
  const [tag, setTag] = useState('')
  const [photoIndex, setPhotoIndex] = useState(0)
  const [imageReady, setImageReady] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [isZoomed, setIsZoomed] = useState(false)
  const [packageId, setPackageId] = useState<number | null>(null)
  const [serverCount, setServerCount] = useState(1)
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [modalityId, setModalityId] = useState<number | null>(null)
  const [uniformId, setUniformId] = useState<number | null>(null)
  const [uniformNote, setUniformNote] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [durationHours, setDurationHours] = useState('')
  const [events, setEvents] = useState<ClientEvent[]>([])
  const [eventId, setEventId] = useState('')
  const [guestsEdited, setGuestsEdited] = useState(false)
  const [guests, setGuests] = useState('')
  const [action, setAction] = useState<WaitstaffAction>('')
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
    fetchWaitstaff(serviceId)
      .then((result) => {
        if (!active) return
        setCategoryTitle(result.category.title)
        setCategoryImage(result.category.imageUrl)
        setService(result.service)
        const min = result.service.waitstaff.minServers || 1
        setServerCount(min)
      })
      .catch((error: unknown) => {
        if (!active) return
        const catalogError = error instanceof CatalogError ? error : null
        if (catalogError?.name === 'unpublished') {
          setIsUnpublished(true)
          return
        }
        setLoadError(catalogError?.status === 404 ? 'No encontramos ese servicio de meseros.' : catalogError?.message || 'No se pudo cargar el servicio de meseros.')
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [serviceId])

  useEffect(() => {
    if (session?.role !== 'cliente') return
    fetchEvents().then((result) => setEvents(result.events)).catch(() => setEvents([]))
  }, [session])

  const photos = useMemo(() => {
    const own = (service?.waitstaff.images || []).filter((image) => !tag || image.tag === tag)
    if (own.length > 0) return own
    return categoryImage ? [{ id: 0, url: categoryImage, alt: `Imagen de respaldo de la categoría ${categoryTitle}`, tag: '' }] : []
  }, [categoryImage, categoryTitle, service, tag])
  const photo = photos[photoIndex] || photos[0]
  const isFallback = Boolean(service && service.waitstaff.images.length === 0)
  const tags = [...new Set((service?.waitstaff.images || []).map((image) => image.tag).filter(Boolean))]
  const selectedEvent = events.find((item) => String(item.id) === eventId) || null
  const guestsNumber = guests ? Number(guests) : null
  const estimate = service
    ? estimateWaitstaff(service, {
        packageId,
        serverCount,
        guests: Number.isInteger(guestsNumber) ? guestsNumber : null,
        startTime,
        endTime,
        durationHours: durationHours ? Number(durationHours) : null,
        quantities,
      })
    : { cents: null, pending: true, error: '', durationHours: null, recommendedServers: null }
  const estimateText = estimate.cents === null ? 'Sujeto a cotización' : formatPrice(estimate.cents)

  const chooseEvent = (id: string) => {
    setEventId(id)
    const chosen = events.find((item) => String(item.id) === id)
    if (!guestsEdited && guests === '' && chosen?.guestCount) setGuests(String(chosen.guestCount))
  }

  const askLogin = (nextAction: WaitstaffAction) => {
    const next = safeCategoryReturn(`/categorias/meseros/servicios/${serviceId}?accion=${nextAction}`)
    setLoginNotice('Inicia sesión con una cuenta de cliente para continuar con este servicio de meseros.')
    onNavigate(`/ingresar?next=${encodeURIComponent(next || `/categorias/meseros/servicios/${serviceId}`)}`)
  }

  const openAction = async (nextAction: Exclude<WaitstaffAction, ''>) => {
    setFormError('')
    setConfirmation('')
    if (!session) return askLogin(nextAction)
    if (session.role !== 'cliente') {
      setFormError('Solo una cuenta de cliente puede agregar meseros o solicitar cotizaciones.')
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

  const choosePackage = (id: number) => {
    const next = id === packageId ? null : id
    setPackageId(next)
    const selected = service?.waitstaff.packages.find((item) => item.id === next) || null
    if (selected?.serverCount) setServerCount(selected.serverCount)
    if (selected?.hoursIncluded && !startTime && !endTime) setDurationHours(String(selected.hoursIncluded))
    if (selected?.modalityName) {
      const modality = service?.waitstaff.modalities.find((item) => item.name === selected.modalityName)
      setModalityId(modality?.id ?? null)
    }
  }

  const changeServers = (delta: number) => {
    if (packageId && service?.waitstaff.packages.find((item) => item.id === packageId)?.serverCount != null) return
    const min = service?.waitstaff.minServers || 1
    const max = service?.waitstaff.maxServers || 100
    setServerCount((current) => Math.min(max, Math.max(min, current + delta)))
  }

  const toggleRole = (id: number, minQty: number | null) => {
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
      const result = await saveWaitstaff(action === 'cotizacion' ? 'quote' : 'planner', service.id, {
        eventId: Number(eventId),
        packageId,
        serverCount,
        guests: guests || null,
        startTime,
        endTime,
        durationHours: durationHours || null,
        modalityId,
        uniformId,
        uniformNote,
        roles: Object.entries(quantities).map(([id, quantity]) => ({ id: Number(id), quantity })),
        notes,
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
        ? 'La solicitud quedó registrada para el proveedor. Pedir cotización no contrata el servicio de meseros.'
        : `Los meseros quedaron en la planificación del evento. Agregarlos no los contrata.${budget}`)
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
        <p className="venue-loading">Cargando el servicio de meseros…</p>
        <div className="decor-layout">
          <div className="venue-skeleton venue-skeleton-hero" />
          <div className="venue-skeleton venue-skeleton-block" />
        </div>
      </div>
    )
  }
  if (isUnpublished) return <section className="category-empty"><h1>Servicio de meseros no disponible</h1><p>Esta publicación está desactivada y no se puede consultar.</p></section>
  if (loadError || !service || !photo) return <section className="category-empty"><h1>No se pudo abrir el servicio de meseros</h1><p role="alert">{loadError || 'No encontramos ese servicio de meseros.'}</p></section>

  const info = service.waitstaff
  const selectedPackage = info.packages.find((item) => item.id === packageId) || null
  const selectedModality = info.modalities.find((item) => item.id === modalityId) || null
  const selectedUniform = info.uniforms.find((item) => item.id === uniformId) || null
  const primaryRole = info.roles.find((item) => item.isPrimary) || null
  const complementary = info.roles.filter((item) => !item.isPrimary)
  const selectedRoles = complementary.filter((item) => quantities[item.id])
  const packageLocked = selectedPackage?.serverCount != null
  const coverage = info.coverageArea || service.provider.city
  const includedDuties = info.duties.filter((item) => item.inclusion === 'incluido')
  const extraDuties = info.duties.filter((item) => item.inclusion === 'adicional')

  return (
    <article className="venue-page">
      <div className="decor-layout">
        <div className="venue-copy">
          <section className="venue-gallery" aria-label="Galería del personal">
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
          <p className="venue-lead">{service.title === service.provider.businessName ? missing(info.specialties) : service.title}</p>
          <p>{service.description || 'Sin descripción.'}</p>
          <dl className="venue-facts">
            <div><dt>Especialidades</dt><dd>{missing(info.specialties)}</dd></div>
            <div><dt>Cobertura</dt><dd>{missing(coverage)}</dd></div>
            <div><dt>Precio de referencia</dt><dd>{moneyLabel(info.priceMode, service.priceCents)}</dd></div>
            <div><dt>Condiciones</dt><dd>{missing(info.conditions)}</dd></div>
          </dl>
          <section className="venue-provider" aria-labelledby="waitstaff-provider">
            <h2 id="waitstaff-provider">Proveedor</h2>
            <div className="venue-provider-card">
              <span className="venue-mark" aria-hidden="true">{service.provider.businessName.trim().charAt(0).toUpperCase() || 'M'}</span>
              <div>
                <strong>{service.provider.businessName}</strong>
                <p>{service.provider.description || 'Este negocio todavía no escribe una descripción.'}</p>
                <a className="outline-button compact" href={`/negocios/${service.providerId}`} onClick={(event) => { event.preventDefault(); onNavigate(`/negocios/${service.providerId}`) }}>Ver perfil del proveedor</a>
              </div>
            </div>
          </section>
          <section className="venue-block" aria-labelledby="waitstaff-roles">
            <h2 id="waitstaff-roles">Tipos de personal</h2>
            {info.roles.length === 0 ? <p>Este proveedor todavía no publica puestos de personal.</p> : (
              <div className="banquet-grid">
                {info.roles.map((item) => (
                  <div className="banquet-choice" key={item.id}>
                    {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
                    <strong>{item.name}{item.isPrimary ? ' · Principal' : ''}</strong>
                    {item.description ? <span>{item.description}</span> : null}
                    <b>{moneyLabel(item.priceUnit, item.priceCents)}</b>
                    {item.minHours ? <small>Mínimo {item.minHours} h</small> : null}
                    {item.conditions ? <small>{item.conditions}</small> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="venue-block" aria-labelledby="waitstaff-packages">
            <h2 id="waitstaff-packages">Paquetes</h2>
            {info.packages.length === 0 ? <p>No hay paquetes publicados. Puedes armar una solicitud personalizada.</p> : (
              <div className="banquet-grid">
                {info.packages.map((item) => (
                  <button className={item.id === packageId ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={item.id === packageId} key={item.id} onClick={() => choosePackage(item.id)}>
                    <strong>{item.name}</strong>
                    {item.description ? <span>{item.description}</span> : null}
                    <b>{moneyLabel(item.priceUnit, item.priceCents)}</b>
                    {item.serverCount ? <small>{item.serverCount} meseros</small> : null}
                    {item.hoursIncluded ? <small>{item.hoursIncluded} horas incluidas</small> : null}
                    {item.includedStaff ? <small>Complementario: {item.includedStaff}</small> : null}
                    {item.modalityName ? <small>Modalidad: {item.modalityName}</small> : null}
                    {item.servicesIncluded ? <small>{item.servicesIncluded}</small> : null}
                    {item.conditions ? <small>{item.conditions}</small> : null}
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="venue-block" aria-labelledby="waitstaff-event">
            <h2 id="waitstaff-event">Evento e invitados</h2>
            {session?.role === 'cliente' ? (
              events.length > 0 ? (
                <>
                  <label htmlFor="waitstaff-event-select">Evento</label>
                  <select id="waitstaff-event-select" value={eventId} onChange={(event) => chooseEvent(event.target.value)}>
                    <option value="">Sin elegir</option>
                    {events.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                  </select>
                  <p>{selectedEvent ? `${selectedEvent.eventType || 'Sin tipo registrado'} · ${selectedEvent.eventDate || 'Sin fecha'} · ${selectedEvent.guestCount ? `${selectedEvent.guestCount.toLocaleString('es-MX')} invitados` : 'Sin invitados'}` : 'Elige un evento para usar su fecha e invitados.'}</p>
                </>
              ) : <p>Todavía no tienes eventos. Puedes crear uno al agregar el servicio.</p>
            ) : <p>Al iniciar sesión podrás vincular este servicio a uno de tus eventos.</p>}
            <label htmlFor="waitstaff-guests">Número de invitados para la estimación</label>
            <input id="waitstaff-guests" inputMode="numeric" value={guests} onChange={(event) => { setGuestsEdited(true); setGuests(event.target.value) }} />
            <p>Ajustar esta cantidad no modifica el evento original.</p>
          </section>
          <section className="venue-block" aria-labelledby="waitstaff-count">
            <h2 id="waitstaff-count">Número de meseros</h2>
            <div className="waitstaff-stepper" role="group" aria-label="Cantidad de meseros">
              <button className="outline-button compact" type="button" aria-label="Disminuir meseros" disabled={packageLocked} onClick={() => changeServers(-1)}>−</button>
              <input aria-label="Cantidad de meseros" inputMode="numeric" value={serverCount} disabled={packageLocked} onChange={(event) => {
                const next = Number(event.target.value)
                if (!Number.isInteger(next)) return
                const min = info.minServers || 1
                const max = info.maxServers || 100
                setServerCount(Math.min(max, Math.max(min, next)))
              }} />
              <button className="outline-button compact" type="button" aria-label="Aumentar meseros" disabled={packageLocked} onClick={() => changeServers(1)}>+</button>
            </div>
            {packageLocked ? <p>La cantidad está fijada por el paquete seleccionado.</p> : null}
            <div className="waitstaff-advice">
              <h3>Calculadora orientativa</h3>
              {estimate.recommendedServers ? (
                <p>Con la proporción registrada por este proveedor ({info.guestsPerServer} invitados por mesero), una referencia sería {estimate.recommendedServers} meseros. Es orientativa y no garantiza cobertura.</p>
              ) : (
                <p>Este proveedor no registró una proporción invitados/mesero. Usa tu selección y solicita asesoramiento en la cotización.</p>
              )}
            </div>
          </section>
          <section className="venue-block" aria-labelledby="waitstaff-schedule">
            <h2 id="waitstaff-schedule">Duración del servicio</h2>
            <label htmlFor="waitstaff-start">Hora de inicio</label>
            <input id="waitstaff-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            <label htmlFor="waitstaff-end">Hora de finalización</label>
            <input id="waitstaff-end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            <label htmlFor="waitstaff-duration">Duración en horas (si no defines horario)</label>
            <input id="waitstaff-duration" inputMode="numeric" value={durationHours} onChange={(event) => setDurationHours(event.target.value)} />
            <p>{estimate.durationHours ? `Duración calculada: ${estimate.durationHours} h${info.minHours ? ` · jornada mínima ${info.minHours} h` : ''}.` : info.minHours ? `Jornada mínima registrada: ${info.minHours} h.` : 'Define horario o duración para estimar con tarifas por hora.'}</p>
          </section>
          <section className="venue-block" aria-labelledby="waitstaff-extra">
            <h2 id="waitstaff-extra">Personal complementario</h2>
            {complementary.length === 0 ? <p>Este proveedor no publicó personal complementario.</p> : (
              <ul className="banquet-menu">
                {complementary.map((item) => (
                  <li key={item.id}>
                    <label>
                      <input type="checkbox" checked={Boolean(quantities[item.id])} onChange={() => toggleRole(item.id, item.minQty)} />
                      <span><strong>{item.name}</strong> · {moneyLabel(item.priceUnit, item.priceCents)}{item.description ? ` · ${item.description}` : ''}</span>
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
          <section className="venue-block" aria-labelledby="waitstaff-modality">
            <h2 id="waitstaff-modality">Tipo de atención</h2>
            {info.modalities.length === 0 ? <p>Este proveedor no publicó modalidades de atención.</p> : (
              <div className="banquet-grid">
                {info.modalities.map((item) => (
                  <button className={item.id === modalityId ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={item.id === modalityId} key={item.id} onClick={() => setModalityId(item.id === modalityId ? null : item.id)}>
                    <strong>{item.name}</strong>
                    {item.description ? <span>{item.description}</span> : null}
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="venue-block" aria-labelledby="waitstaff-uniform">
            <h2 id="waitstaff-uniform">Uniforme y presentación</h2>
            {info.uniforms.length === 0 ? <p>Este proveedor no publicó opciones de uniforme.</p> : (
              <div className="banquet-grid">
                {info.uniforms.map((item) => (
                  <button className={item.id === uniformId ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={item.id === uniformId} key={item.id} onClick={() => setUniformId(item.id === uniformId ? null : item.id)}>
                    <strong>{item.name}</strong>
                    {item.description ? <span>{item.description}</span> : null}
                  </button>
                ))}
              </div>
            )}
            <label htmlFor="waitstaff-uniform-note">Preferencia especial</label>
            <input id="waitstaff-uniform-note" value={uniformNote} maxLength={200} onChange={(event) => setUniformNote(event.target.value)} />
            <p>Indicar una preferencia no garantiza disponibilidad.</p>
          </section>
          <section className="venue-block" aria-labelledby="waitstaff-duties">
            <h2 id="waitstaff-duties">Funciones y responsabilidades</h2>
            {info.duties.length === 0 ? <p>Este proveedor todavía no detalla funciones incluidas.</p> : (
              <>
                {includedDuties.length ? (
                  <>
                    <h3>Incluidas</h3>
                    <ul className="banquet-menu">{includedDuties.map((item) => <li key={item.id}><strong>{item.name}</strong>{item.description ? ` · ${item.description}` : ''}</li>)}</ul>
                  </>
                ) : null}
                {extraDuties.length ? (
                  <>
                    <h3>Adicionales</h3>
                    <ul className="banquet-menu">{extraDuties.map((item) => <li key={item.id}><strong>{item.name}</strong>{item.description ? ` · ${item.description}` : ''}</li>)}</ul>
                  </>
                ) : null}
              </>
            )}
          </section>
        </div>
        <aside className="venue-price" aria-label="Resumen del servicio de meseros">
          <span>Presupuesto estimado</span>
          <strong>{estimateText}</strong>
          {estimate.pending ? <p>Hay conceptos sujetos a cotización. El importe no es definitivo.</p> : null}
          <p>El costo mostrado es una estimación. El precio final será definido mediante la cotización del proveedor.</p>
          <dl className="venue-facts">
            <div><dt>Paquete</dt><dd>{selectedPackage?.name || 'Configuración personalizada'}</dd></div>
            <div><dt>Meseros</dt><dd>{serverCount}{primaryRole ? ` · ${primaryRole.name}` : ''}</dd></div>
            <div><dt>Duración</dt><dd>{estimate.durationHours ? `${estimate.durationHours} h` : 'Sin definir'}</dd></div>
            <div><dt>Horario</dt><dd>{startTime && endTime ? `${startTime} – ${endTime}` : 'Sin indicar'}</dd></div>
            <div><dt>Modalidad</dt><dd>{selectedModality?.name || selectedPackage?.modalityName || 'Sin elegir'}</dd></div>
            <div><dt>Uniforme</dt><dd>{selectedUniform?.name || uniformNote || 'Sin indicar'}</dd></div>
            <div><dt>Complementarios</dt><dd>{selectedRoles.length ? selectedRoles.map((item) => `${item.name} × ${quantities[item.id]}`).join(', ') : 'Sin elegir'}</dd></div>
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
          <p className="venue-note">{service.provider.businessName} · {serverCount} meseros · {estimateText}</p>
          {confirmation ? (
            <div>
              <p role="status">{confirmation}</p>
              <a className="search-button" href={action === 'cotizacion' ? '/cotizaciones' : '/planificador'} onClick={(event) => { event.preventDefault(); onNavigate(action === 'cotizacion' ? '/cotizaciones' : '/planificador') }}>{action === 'cotizacion' ? 'Ver solicitudes' : 'Ver planificación'}</a>
            </div>
          ) : null}
          {!confirmation && session?.role === 'cliente' && isCreating ? (
            <form className="venue-form" onSubmit={handleCreateEvent}>
              <p>{events.length === 0 ? 'Todavía no tienes eventos. Crea el primero para continuar.' : 'Crea un evento nuevo para continuar.'}</p>
              <label htmlFor="waitstaff-new-name">Nombre del evento</label>
              <input id="waitstaff-new-name" value={eventName} onChange={(event) => setEventName(event.target.value)} required />
              <label htmlFor="waitstaff-new-type">Tipo de celebración</label>
              <input id="waitstaff-new-type" value={eventType} onChange={(event) => setEventType(event.target.value)} />
              <label htmlFor="waitstaff-new-date">Fecha</label>
              <input id="waitstaff-new-date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
              <label htmlFor="waitstaff-new-guests">Número de invitados</label>
              <input id="waitstaff-new-guests" inputMode="numeric" value={newGuests} onChange={(event) => setNewGuests(event.target.value)} />
              {formError ? <p role="alert">{formError}</p> : null}
              <button className="search-button" type="submit" disabled={isSaving}>{isSaving ? 'Creando…' : events.length === 0 ? 'Crear mi primer evento' : 'Crear evento'}</button>
            </form>
          ) : null}
          {!confirmation && session?.role === 'cliente' && !isCreating ? (
            <form className="venue-form" onSubmit={(event) => { event.preventDefault(); void handleConfirm() }}>
              <label htmlFor="waitstaff-modal-event">Evento</label>
              <select id="waitstaff-modal-event" value={eventId} onChange={(event) => chooseEvent(event.target.value)}>
                {events.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
              <p>Resumen: {selectedPackage?.name || 'Personalizado'} · {serverCount} meseros · {estimate.durationHours ? `${estimate.durationHours} h` : 'Sin duración'} · {estimateText}</p>
              {selectedEvent ? <p>{selectedEvent.eventType || 'Sin tipo registrado'} · {selectedEvent.eventDate || 'Sin fecha'}</p> : null}
              {action === 'cotizacion' ? (
                <>
                  <label htmlFor="waitstaff-place">Lugar del evento</label>
                  <input id="waitstaff-place" value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} />
                  <label htmlFor="waitstaff-notes">Observaciones</label>
                  <textarea id="waitstaff-notes" maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
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
