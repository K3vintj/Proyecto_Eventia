import { useEffect, useState, type FormEvent } from 'react'
import { CatalogError, formatPrice } from './catalog-api'
import { createEvent, fetchEvents, fetchPlanner, fetchQuotes, formatEventDate, formatQuoteAmount, isQuoteExpired, issueQuote, type ClientEvent, type PlannerEvent, type QuoteRecord } from './venue-api'

const statusLabel = (status: string) => {
  if (status === 'recibida') return 'Recibida'
  if (status === 'emitida') return 'Emitida'
  if (status === 'modificacion_solicitada') return 'Modificación solicitada'
  if (status === 'aceptada') return 'Aceptada'
  if (status === 'rechazada') return 'Rechazada'
  if (status === 'cancelada') return 'Cancelada'
  if (status === 'cotizada') return 'Cotizada'
  return 'Recibida'
}

const statusClass = (status: string) => {
  if (status === 'emitida' || status === 'cotizada') return 'is-emitida'
  if (status === 'aceptada') return 'is-aceptada'
  if (status === 'rechazada' || status === 'cancelada') return 'is-rechazada'
  if (status === 'modificacion_solicitada') return 'is-revision'
  return 'is-recibida'
}

const selectionLine = (selection: QuoteRecord['selection']) => {
  if (!selection) return ''
  return [
    selection.packageName,
    selection.styleName,
    selection.paletteName,
    selection.colorNote,
    selection.durationMinutes ? `${selection.durationMinutes} min` : '',
    selection.preferredGenres,
    selection.songRequests,
    selection.serverCount ? `${selection.serverCount} meseros` : '',
    selection.durationHours ? `${selection.durationHours} h` : '',
    selection.modalityName,
    selection.uniformName,
    selection.rentalDays ? `${selection.rentalDays} día(s)` : '',
    selection.guests ? `${selection.guests.toLocaleString('es-MX')} invitados` : '',
    selection.eventTime,
    selection.eventLocation,
    ...(selection.elementNames || []),
    ...(selection.roleNames || []),
    ...(selection.furnitureItemNames || []),
    ...selection.menuNames,
    ...selection.addonNames,
  ].filter(Boolean).join(' · ')
}

const pesosInput = (cents: number | null | undefined) => {
  if (cents === null || cents === undefined) return ''
  const pesos = cents / 100
  return Number.isInteger(pesos) ? String(pesos) : pesos.toFixed(2)
}

const toCents = (value: string) => {
  const cleaned = value.replace(/[$\s]/g, '')
  const normalized = cleaned.includes('.')
    ? cleaned.replace(/,/g, '')
    : /^\d+,\d{1,2}$/.test(cleaned)
      ? cleaned.replace(',', '.')
      : cleaned.replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const cents = Math.round(Number(normalized) * 100)
  if (!Number.isInteger(cents) || cents < 1 || cents > 1000000000) return null
  return cents
}

type IssueDraft = {
  amount: string
  validUntil: string
  conditions: string
  detail: string
}

const draftFromQuote = (quote: QuoteRecord): IssueDraft => ({
  amount: pesosInput(quote.issuedCents),
  validUntil: quote.validUntil || '',
  conditions: quote.conditions || '',
  detail: quote.issuedDetail || selectionLine(quote.selection),
})

export const QuoteOffer = ({ quote, audience = 'client' }: { quote: QuoteRecord; audience?: 'client' | 'provider' }) => {
  if (quote.issuedCents === null || quote.issuedCents === undefined) {
    const isClosed = quote.status === 'aceptada' || quote.status === 'rechazada' || quote.status === 'cancelada'
    return (
      <div className="quote-offer is-waiting">
        <span>Cotización formal</span>
        <strong>{isClosed ? 'Sin emisión formal' : 'Pendiente de emisión'}</strong>
        <p>
          {isClosed
            ? 'Esta solicitud se cerró antes de registrar un monto emitido.'
            : audience === 'provider'
              ? 'Responde con monto, vigencia y condiciones para que el cliente pueda decidir.'
              : 'El proveedor todavía no envía monto, vigencia ni condiciones.'}
        </p>
      </div>
    )
  }
  const expired = isQuoteExpired(quote.validUntil)
  return (
    <div className={`quote-offer${expired ? ' is-expired' : ''}`}>
      <span>Cotización emitida · {quote.currency || 'MXN'}</span>
      <strong>{formatQuoteAmount(quote.issuedCents, quote.currency)}</strong>
      <p>{quote.conditions || 'Sin condiciones adicionales.'}</p>
      {quote.issuedDetail ? <p>{quote.issuedDetail}</p> : null}
      <small>
        {quote.validUntil ? `Vigente hasta ${formatEventDate(quote.validUntil)}` : 'Sin fecha de vigencia'}
        {expired ? ' · Esta vigencia ya venció' : ''}
      </small>
    </div>
  )
}

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
                {item.selection ? <small>{selectionLine(item.selection)}</small> : null}
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

const canIssue = (status: string) => status === 'recibida' || status === 'modificacion_solicitada' || status === 'emitida'

const minQuoteDate = (() => {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
})()

const QuoteList = ({ title, hint, empty, mode }: { title: string; hint: string; empty: string; mode: 'client' | 'provider' }) => {
  const [quotes, setQuotes] = useState<QuoteRecord[]>([])
  const [drafts, setDrafts] = useState<Record<number, IssueDraft>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [savingId, setSavingId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<{ id: number; kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchQuotes()
      .then((result) => {
        setQuotes(result.quotes)
        setDrafts(Object.fromEntries(result.quotes.map((quote) => [quote.id, draftFromQuote(quote)])))
      })
      .catch((error: unknown) => setMessage(error instanceof CatalogError ? error.message : 'No se pudieron cargar las solicitudes.'))
      .finally(() => setIsLoading(false))
  }, [])

  const handleDraft = (quoteId: number, patch: Partial<IssueDraft>) => {
    setDrafts((current) => ({ ...current, [quoteId]: { ...current[quoteId], ...patch } }))
  }

  const handleIssue = async (event: FormEvent, quote: QuoteRecord) => {
    event.preventDefault()
    const draft = drafts[quote.id] || draftFromQuote(quote)
    const amountCents = toCents(draft.amount)
    if (amountCents === null) {
      setFeedback({ id: quote.id, kind: 'error', text: 'Escribe un monto mayor a cero. Puedes usar decimales, por ejemplo 18500.50.' })
      return
    }
    setSavingId(quote.id)
    setFeedback(null)
    try {
      await issueQuote(quote.id, {
        amountCents,
        conditions: draft.conditions.trim(),
        detail: draft.detail.trim(),
        validUntil: draft.validUntil || null,
        currency: 'MXN',
      })
      const successText = quote.status === 'emitida'
        ? 'Cotización actualizada. El cliente ya ve el monto vigente.'
        : 'Cotización emitida. El cliente ya puede ver monto y condiciones.'
      setFeedback({ id: quote.id, kind: 'ok', text: successText })
      try {
        const result = await fetchQuotes()
        setQuotes(result.quotes)
        setDrafts(Object.fromEntries(result.quotes.map((item) => [item.id, draftFromQuote(item)])))
      } catch {
        setFeedback({ id: quote.id, kind: 'ok', text: `${successText} Recarga la lista si no ves el cambio.` })
      }
    } catch (error: unknown) {
      setFeedback({ id: quote.id, kind: 'error', text: error instanceof CatalogError ? error.message : 'No se pudo emitir la cotización.' })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="planning-panel" aria-labelledby="quotes-title">
      <div className="planning-heading"><h2 id="quotes-title">{title}</h2><p>{hint}</p></div>
      {isLoading ? <p>Cargando solicitudes…</p> : null}
      {message ? <p className="quote-feedback is-error" role="alert">{message}</p> : null}
      {!isLoading && quotes.length === 0 ? <p>{empty}</p> : null}
      {quotes.map((quote) => {
        const draft = drafts[quote.id] || draftFromQuote(quote)
        const asked = selectionLine(quote.selection)
        const counterpart = mode === 'provider' ? quote.clientName : quote.providerName
        return (
          <article className="quote-card" key={quote.id}>
            <div className="quote-card-head">
              <div>
                <h3>{quote.serviceTitle}</h3>
                <p className="quote-meta">
                  {counterpart || 'Sin nombre'} · {quote.eventName || 'Sin evento'} · {formatEventDate(quote.eventDate)}
                  {quote.guestCount ? ` · ${quote.guestCount.toLocaleString('es-MX')} invitados` : ''}
                </p>
              </div>
              <span className={`quote-pill ${statusClass(quote.status)}`}>{statusLabel(quote.status)}</span>
            </div>
            <QuoteOffer quote={quote} audience={mode} />
            <p className="quote-meta">{quote.notes || 'Sin observaciones del cliente.'}</p>
            {asked ? <p className="quote-meta">Selección solicitada: {asked}</p> : null}
            <p className="quote-meta">Solicitada el {formatEventDate(quote.requestedOn)}</p>
            {mode === 'provider' && canIssue(quote.status) ? (
              <form className="venue-form quote-issue" onSubmit={(event) => void handleIssue(event, quote)}>
                {quote.status === 'modificacion_solicitada' ? <p className="quote-meta">El cliente pidió cambios. Emite de nuevo el monto y las condiciones vigentes.</p> : null}
                <div className="quote-issue-grid">
                  <div>
                    <label htmlFor={`quote-amount-${quote.id}`}>Monto (MXN)</label>
                    <input id={`quote-amount-${quote.id}`} inputMode="decimal" value={draft.amount} placeholder="18500" required onChange={(event) => handleDraft(quote.id, { amount: event.target.value })} />
                  </div>
                  <div>
                    <label htmlFor={`quote-until-${quote.id}`}>Vigente hasta</label>
                    <input id={`quote-until-${quote.id}`} type="date" min={minQuoteDate} value={draft.validUntil} onChange={(event) => handleDraft(quote.id, { validUntil: event.target.value })} />
                  </div>
                </div>
                <label htmlFor={`quote-conditions-${quote.id}`}>Condiciones</label>
                <textarea id={`quote-conditions-${quote.id}`} value={draft.conditions} maxLength={500} placeholder="Incluye horario, anticipo o lo que queda fuera del servicio." onChange={(event) => handleDraft(quote.id, { conditions: event.target.value })} />
                <label htmlFor={`quote-detail-${quote.id}`}>Detalle de lo cotizado</label>
                <textarea id={`quote-detail-${quote.id}`} value={draft.detail} maxLength={500} placeholder="Paquete, duración o selección que cubre este precio." onChange={(event) => handleDraft(quote.id, { detail: event.target.value })} />
                {feedback?.id === quote.id ? <p className={`quote-feedback is-${feedback.kind}`} role="status">{feedback.text}</p> : null}
                <button className="search-button" type="submit" disabled={savingId === quote.id}>
                  {savingId === quote.id ? 'Enviando…' : quote.status === 'emitida' ? 'Actualizar cotización' : 'Emitir cotización'}
                </button>
              </form>
            ) : null}
          </article>
        )
      })}
    </section>
  )
}

export const ClientQuotes = () => (
  <QuoteList title="Cotizaciones" hint="Aquí ves el monto y las condiciones que emite el proveedor antes de aceptar, rechazar o pedir un cambio." empty="Todavía no solicitas cotizaciones." mode="client" />
)

export const ProviderQuotes = () => (
  <QuoteList title="Solicitudes recibidas" hint="Emite el precio, la vigencia y las condiciones. El cliente las verá en su evento antes de decidir." empty="Todavía no recibes solicitudes." mode="provider" />
)
