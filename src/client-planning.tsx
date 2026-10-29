import { useEffect, useState, type FormEvent } from 'react'
import { CatalogError, formatPrice } from './catalog-api'
import { createEvent, fetchEvents, fetchPlanner, fetchQuotes, formatEventDate, type ClientEvent, type PlannerEvent, type QuoteRecord } from './venue-api'

const statusLabel = (status: string) => status === 'recibida' ? 'Recibida' : status

export const ClientEvents = ({ onNavigate }: { onNavigate: (path: string) => void }) => {
  const [events, setEvents] = useState<ClientEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [eventType, setEventType] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const load = () => {
    setIsLoading(true)
    fetchEvents()
      .then((result) => setEvents(result.events))
      .catch((error: unknown) => setMessage(error instanceof CatalogError ? error.message : 'No se pudieron cargar los eventos.'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    setIsSaving(true)
    try {
      const result = await createEvent({ name, eventDate, guestCount, eventType })
      setEvents((current) => [...current, result.event])
      setName('')
      setEventDate('')
      setGuestCount('')
      setEventType('')
    } catch (error: unknown) {
      setMessage(error instanceof CatalogError ? error.message : 'No se pudo crear el evento.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="planning-panel" aria-labelledby="my-events">
      <div className="planning-heading"><h2 id="my-events">Mis eventos</h2><p>Celebraciones en las que puedes planear servicios.</p></div>
      {isLoading ? <p>Cargando eventos…</p> : null}
      {!isLoading && events.length === 0 ? <p>Todavía no tienes eventos. Crea el primero para agregar lugares a su presupuesto.</p> : null}
      {events.map((item) => (
        <div className="planning-row" key={item.id}>
          <div><strong>{item.name}</strong><small>{formatEventDate(item.eventDate)}{item.eventType ? ` · ${item.eventType}` : ''}</small></div>
          <b>{item.guestCount ? `${item.guestCount.toLocaleString('es-MX')} invitados` : 'Sin invitados'}</b>
          <button className="outline-button compact" type="button" onClick={() => onNavigate('/planificador')}>Ver planificación</button>
        </div>
      ))}
      <form className="venue-form" onSubmit={handleCreate}>
        <h3>{events.length === 0 ? 'Crear mi primer evento' : 'Crear evento'}</h3>
        <label htmlFor="client-event-name">Nombre del evento</label>
        <input id="client-event-name" value={name} onChange={(event) => setName(event.target.value)} required />
        <label htmlFor="client-event-date">Fecha</label>
        <input id="client-event-date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
        <label htmlFor="client-event-guests">Número de invitados</label>
        <input id="client-event-guests" inputMode="numeric" value={guestCount} onChange={(event) => setGuestCount(event.target.value)} />
        <label htmlFor="client-event-type">Tipo de celebración</label>
        <input id="client-event-type" value={eventType} onChange={(event) => setEventType(event.target.value)} />
        {message ? <p role="alert">{message}</p> : null}
        <button className="search-button" type="submit" disabled={isSaving}>{isSaving ? 'Creando…' : 'Guardar evento'}</button>
      </form>
    </section>
  )
}

export const ClientPlanner = ({ onNavigate }: { onNavigate: (path: string) => void }) => {
  const [events, setEvents] = useState<PlannerEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchPlanner()
      .then((result) => setEvents(result.events))
      .catch((error: unknown) => setMessage(error instanceof CatalogError ? error.message : 'No se pudo cargar la planificación.'))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <section className="planning-panel" aria-labelledby="planner-title">
      <div className="planning-heading"><h2 id="planner-title">Planificador</h2><p>Los lugares agregados siguen en el presupuesto. No están contratados.</p></div>
      {isLoading ? <p>Cargando planificación…</p> : null}
      {message ? <p role="alert">{message}</p> : null}
      {!isLoading && events.length === 0 ? <p>No hay eventos. <button className="outline-button compact" type="button" onClick={() => onNavigate('/eventos')}>Crear mi primer evento</button></p> : null}
      {events.map((event) => (
        <article className="planning-event" key={event.id}>
          <h3>{event.name}</h3>
          <p>{formatEventDate(event.eventDate)} · {event.guestCount ? `${event.guestCount.toLocaleString('es-MX')} invitados` : 'Sin invitados'}</p>
          {event.items.length === 0 ? <p>Este evento todavía no tiene servicios en el presupuesto.</p> : null}
          {event.items.map((item) => (
            <div className="planning-row" key={`${event.id}-${item.serviceId}`}>
              <div>
                <strong>{item.title}</strong>
                <small>{item.categoryTitle}</small>
                {item.selection ? <small>{[item.selection.packageName, item.selection.styleName, item.selection.paletteName, item.selection.colorNote, item.selection.durationMinutes ? `${item.selection.durationMinutes} min` : '', item.selection.preferredGenres, item.selection.serverCount ? `${item.selection.serverCount} meseros` : '', item.selection.durationHours ? `${item.selection.durationHours} h` : '', item.selection.modalityName, item.selection.rentalDays ? `${item.selection.rentalDays} día(s)` : '', item.selection.guests ? `${item.selection.guests.toLocaleString('es-MX')} invitados` : '', ...(item.selection.elementNames || []), ...(item.selection.roleNames || []), ...(item.selection.furnitureItemNames || []), ...item.selection.menuNames, ...item.selection.addonNames].filter(Boolean).join(' · ')}</small> : null}
              </div>
              <b>{item.estimatedCents === null ? 'Precio por confirmar' : formatPrice(item.estimatedCents)}{item.selection?.pendingQuote ? ' · sujeto a cotización' : ''}</b>
              <a href={`/categorias/${item.slug}/servicios/${item.serviceId}`} onClick={(click) => { click.preventDefault(); onNavigate(`/categorias/${item.slug}/servicios/${item.serviceId}`) }}>{item.slug === 'banquetes' ? 'Ver banquete' : item.slug === 'locacion' ? 'Ver lugar' : item.slug === 'flores-decoracion' ? 'Ver decoración' : item.slug === 'musica' ? 'Ver música' : item.slug === 'meseros' ? 'Ver meseros' : item.slug === 'mobiliario' ? 'Ver mobiliario' : 'Ver servicio'}</a>
            </div>
          ))}
          <p>Presupuesto estimado: <strong>{event.items.some((item) => item.estimatedCents !== null) ? formatPrice(event.budgetCents) : 'Sin montos confirmados'}</strong></p>
        </article>
      ))}
    </section>
  )
}

const QuoteList = ({ title, hint, empty, mode }: { title: string; hint: string; empty: string; mode: 'client' | 'provider' }) => {
  const [quotes, setQuotes] = useState<QuoteRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchQuotes()
      .then((result) => setQuotes(result.quotes))
      .catch((error: unknown) => setMessage(error instanceof CatalogError ? error.message : 'No se pudieron cargar las solicitudes.'))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <section className="planning-panel" aria-labelledby="quotes-title">
      <div className="planning-heading"><h2 id="quotes-title">{title}</h2><p>{hint}</p></div>
      {isLoading ? <p>Cargando solicitudes…</p> : null}
      {message ? <p role="alert">{message}</p> : null}
      {!isLoading && quotes.length === 0 ? <p>{empty}</p> : null}
      {quotes.map((quote) => (
        <article className="planning-event" key={quote.id}>
          <h3>{quote.serviceTitle}</h3>
          <p>{mode === 'provider' ? quote.clientName : quote.providerName} · {quote.eventName || 'Sin evento'} · {formatEventDate(quote.eventDate)}</p>
          <p>{quote.notes || 'Sin observaciones.'}</p>
          {quote.selection ? <p>{[quote.selection.packageName, quote.selection.styleName, quote.selection.paletteName, quote.selection.colorNote, quote.selection.durationMinutes ? `${quote.selection.durationMinutes} min` : '', quote.selection.preferredGenres, quote.selection.songRequests, quote.selection.serverCount ? `${quote.selection.serverCount} meseros` : '', quote.selection.durationHours ? `${quote.selection.durationHours} h` : '', quote.selection.modalityName, quote.selection.uniformName, quote.selection.rentalDays ? `${quote.selection.rentalDays} día(s)` : '', quote.selection.guests ? `${quote.selection.guests.toLocaleString('es-MX')} invitados` : '', quote.selection.eventTime, quote.selection.eventLocation, ...(quote.selection.elementNames || []), ...(quote.selection.roleNames || []), ...(quote.selection.furnitureItemNames || []), ...quote.selection.menuNames, ...quote.selection.addonNames].filter(Boolean).join(' · ') || 'Sin configuración adicional.'}</p> : null}
          <p>{statusLabel(quote.status)} · {formatEventDate(quote.requestedOn)}</p>
        </article>
      ))}
    </section>
  )
}

export const ClientQuotes = () => (
  <QuoteList title="Cotizaciones" hint="Solicitudes enviadas. Una solicitud no contrata el servicio." empty="Todavía no solicitas cotizaciones." mode="client" />
)

export const ProviderQuotes = () => (
  <QuoteList title="Solicitudes recibidas" hint="Cotizaciones que los clientes enviaron a tu negocio." empty="Todavía no recibes solicitudes." mode="provider" />
)
