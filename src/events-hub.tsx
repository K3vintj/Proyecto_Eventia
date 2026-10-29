import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { CatalogError, formatPrice } from './catalog-api'
import {
  acceptQuote,
  createEvent,
  fetchContracts,
  fetchEvents,
  fetchPlanner,
  fetchQuotes,
  formatEventDate,
  readActiveEventId,
  rejectQuote,
  removePlannerItem,
  requestQuoteModification,
  updateEvent,
  writeActiveEventId,
  type ClientEvent,
  type EventInput,
  type PlannerEvent,
  type QuoteRecord,
  type ServiceContract,
} from './venue-api'

type EventsHubProps = {
  onNavigate: (path: string) => void
}

type ServiceFilter = 'all' | 'considerado' | 'solicitado' | 'cotizado' | 'contratado'

type HubService = {
  key: string
  serviceId: number
  title: string
  slug: string
  categoryTitle: string
  imageUrl: string | null
  providerName: string
  estimatedCents: number | null
  contractedCents: number | null
  selectionSummary: string
  status: 'considerado' | 'solicitado' | 'cotizado' | 'contratado' | 'rechazado' | 'cancelado'
  quote: QuoteRecord | null
  contract: ServiceContract | null
}

const emptyForm = (): EventInput => ({
  name: '',
  eventDate: '',
  guestCount: '',
  eventType: '',
  budgetTargetCents: '',
  location: '',
  startTime: '',
})

const formFromEvent = (event: ClientEvent): EventInput => ({
  name: event.name,
  eventDate: event.eventDate || '',
  guestCount: event.guestCount ? String(event.guestCount) : '',
  eventType: event.eventType || '',
  budgetTargetCents: event.budgetTargetCents != null ? String(Math.round(event.budgetTargetCents / 100)) : '',
  location: event.location || '',
  startTime: event.startTime || '',
})

const selectionText = (selection: QuoteRecord['selection'] | PlannerEvent['items'][number]['selection']) => {
  if (!selection) return ''
  return [
    selection.packageName,
    selection.styleName,
    selection.paletteName,
    selection.colorNote,
    selection.durationMinutes ? `${selection.durationMinutes} min` : '',
    selection.preferredGenres,
    selection.serverCount ? `${selection.serverCount} meseros` : '',
    selection.durationHours ? `${selection.durationHours} h` : '',
    selection.modalityName,
    selection.rentalDays ? `${selection.rentalDays} día(s)` : '',
    selection.guests ? `${selection.guests.toLocaleString('es-MX')} invitados` : '',
    ...(selection.elementNames || []),
    ...(selection.roleNames || []),
    ...(selection.furnitureItemNames || []),
    ...selection.menuNames,
    ...selection.addonNames,
  ].filter(Boolean).join(' · ')
}

const statusLabel = (status: HubService['status']) => {
  if (status === 'considerado') return 'Considerado'
  if (status === 'solicitado') return 'Solicitado'
  if (status === 'cotizado') return 'Cotizado'
  if (status === 'contratado') return 'Contratado'
  if (status === 'rechazado') return 'Rechazado'
  return 'Cancelado'
}

const quoteStatusLabel = (status: string) => {
  if (status === 'aceptada') return 'Aceptada'
  if (status === 'rechazada') return 'Rechazada'
  if (status === 'modificacion_solicitada') return 'Modificación solicitada'
  if (status === 'cotizada') return 'Cotizada'
  return 'Solicitud enviada'
}

export const EventsHub = ({ onNavigate }: EventsHubProps) => {
  const titleId = useId()
  const [events, setEvents] = useState<ClientEvent[]>([])
  const [planner, setPlanner] = useState<PlannerEvent[]>([])
  const [quotes, setQuotes] = useState<QuoteRecord[]>([])
  const [contracts, setContracts] = useState<ServiceContract[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filter, setFilter] = useState<ServiceFilter>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | 'quote' | null>(null)
  const [activeQuote, setActiveQuote] = useState<QuoteRecord | null>(null)
  const [form, setForm] = useState<EventInput>(emptyForm())
  const [modNotes, setModNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    setIsLoading(true)
    setMessage('')
    try {
      const [eventsResult, plannerResult, quotesResult, contractsResult] = await Promise.all([
        fetchEvents(),
        fetchPlanner(),
        fetchQuotes(),
        fetchContracts(),
      ])
      setEvents(eventsResult.events)
      setPlanner(plannerResult.events)
      setQuotes(quotesResult.quotes)
      setContracts(contractsResult.contracts)
      const stored = readActiveEventId()
      const nextId = eventsResult.events.find((item) => item.id === stored)?.id
        ?? eventsResult.events[0]?.id
        ?? null
      setSelectedId(nextId)
      if (nextId) writeActiveEventId(nextId)
    } catch (error: unknown) {
      setMessage(error instanceof CatalogError ? error.message : 'No se pudo cargar el centro de eventos.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  useEffect(() => {
    if (!modal) return
    dialogRef.current?.focus()
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModal(null)
        setActiveQuote(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal])

  const selectedEvent = events.find((item) => item.id === selectedId) || null
  const selectedPlanner = planner.find((item) => item.id === selectedId) || null

  const services = useMemo(() => {
    if (!selectedId) return [] as HubService[]
    const eventQuotes = quotes.filter((quote) => quote.eventId === selectedId)
    const eventContracts = contracts.filter((contract) => contract.eventId === selectedId)
    const map = new Map<number, HubService>()

    for (const item of selectedPlanner?.items || []) {
      map.set(item.serviceId, {
        key: `service-${item.serviceId}`,
        serviceId: item.serviceId,
        title: item.title,
        slug: item.slug,
        categoryTitle: item.categoryTitle,
        imageUrl: item.imageUrl || null,
        providerName: item.providerName || '',
        estimatedCents: item.estimatedCents,
        contractedCents: null,
        selectionSummary: selectionText(item.selection),
        status: 'considerado',
        quote: null,
        contract: null,
      })
    }

    for (const quote of eventQuotes) {
      const current = map.get(quote.serviceId) || {
        key: `service-${quote.serviceId}`,
        serviceId: quote.serviceId,
        title: quote.serviceTitle,
        slug: quote.slug,
        categoryTitle: '',
        imageUrl: null,
        providerName: quote.providerName,
        estimatedCents: null,
        contractedCents: null,
        selectionSummary: selectionText(quote.selection),
        status: 'solicitado' as const,
        quote: null,
        contract: null,
      }
      current.quote = quote
      current.providerName = quote.providerName || current.providerName
      if (!current.selectionSummary) current.selectionSummary = selectionText(quote.selection)
      if (quote.status === 'aceptada') current.status = 'contratado'
      else if (quote.status === 'rechazada') current.status = 'rechazado'
      else if (quote.status === 'cancelada') current.status = 'cancelado'
      else if (quote.status === 'cotizada') current.status = 'cotizado'
      else if (quote.status === 'modificacion_solicitada') current.status = 'cotizado'
      else current.status = current.status === 'considerado' ? 'solicitado' : current.status
      map.set(quote.serviceId, current)
    }

    for (const contract of eventContracts) {
      const current = map.get(contract.serviceId) || {
        key: `service-${contract.serviceId}`,
        serviceId: contract.serviceId,
        title: contract.serviceTitle,
        slug: contract.slug,
        categoryTitle: contract.categoryTitle,
        imageUrl: contract.imageUrl,
        providerName: contract.providerName,
        estimatedCents: null,
        contractedCents: contract.amountCents,
        selectionSummary: '',
        status: 'contratado' as const,
        quote: null,
        contract: null,
      }
      current.contract = contract
      current.contractedCents = contract.amountCents
      current.status = 'contratado'
      current.imageUrl = current.imageUrl || contract.imageUrl
      current.categoryTitle = current.categoryTitle || contract.categoryTitle
      current.providerName = contract.providerName || current.providerName
      map.set(contract.serviceId, current)
    }

    return [...map.values()]
  }, [selectedId, selectedPlanner, quotes, contracts])

  const filteredServices = services.filter((service) => {
    if (filter === 'all') return true
    if (filter === 'considerado') return service.status === 'considerado'
    if (filter === 'solicitado') return service.status === 'solicitado' || service.status === 'cotizado'
    if (filter === 'cotizado') return service.status === 'cotizado' || (service.quote && ['recibida', 'cotizada', 'modificacion_solicitada'].includes(service.quote.status))
    if (filter === 'contratado') return service.status === 'contratado'
    return true
  })

  const estimatedBudget = selectedPlanner?.budgetCents ?? 0
  const contractedBudget = contracts
    .filter((item) => item.eventId === selectedId && item.amountCents !== null)
    .reduce((sum, item) => sum + (item.amountCents || 0), 0)
  const targetBudget = selectedEvent?.budgetTargetCents ?? null
  const progressBase = targetBudget && targetBudget > 0 ? targetBudget : null
  const progressValue = contractedBudget || estimatedBudget
  const progressPct = progressBase ? Math.min(100, Math.round((progressValue / progressBase) * 100)) : 0
  const isOverBudget = progressBase !== null && progressValue > progressBase

  const counts = {
    all: services.length,
    considerado: services.filter((item) => item.status === 'considerado').length,
    solicitado: services.filter((item) => item.status === 'solicitado' || item.status === 'cotizado').length,
    cotizado: services.filter((item) => item.quote && ['recibida', 'cotizada', 'modificacion_solicitada'].includes(item.quote.status)).length,
    contratado: services.filter((item) => item.status === 'contratado').length,
  }

  const handleSelectEvent = (eventId: number) => {
    setSelectedId(eventId)
    writeActiveEventId(eventId)
    setStatus('')
  }

  const openCreate = () => {
    setForm(emptyForm())
    setModal('create')
  }

  const openEdit = () => {
    if (!selectedEvent) return
    setForm(formFromEvent(selectedEvent))
    setModal('edit')
  }

  const handleSaveEvent = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setMessage('')
    try {
      if (modal === 'edit' && selectedId) {
        const result = await updateEvent(selectedId, form)
        setEvents((current) => current.map((item) => (item.id === result.event.id ? result.event : item)))
        setStatus('Evento actualizado.')
      } else {
        const result = await createEvent(form)
        setEvents((current) => [...current, result.event])
        setSelectedId(result.event.id)
        writeActiveEventId(result.event.id)
        setStatus('Evento creado.')
        await load()
      }
      setModal(null)
    } catch (error: unknown) {
      setMessage(error instanceof CatalogError ? error.message : 'No se pudo guardar el evento.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemove = async (service: HubService) => {
    if (!selectedId || service.status === 'contratado') return
    if (!window.confirm(`¿Quitar “${service.title}” del planificador?`)) return
    setStatus('')
    try {
      await removePlannerItem(selectedId, service.serviceId)
      setStatus('Servicio eliminado del planificador.')
      await load()
    } catch (error: unknown) {
      setStatus(error instanceof CatalogError ? error.message : 'No se pudo eliminar el servicio.')
    }
  }

  const handleAccept = async (quote: QuoteRecord) => {
    if (!window.confirm('Al aceptar se generará la contratación con el importe estimado actual. ¿Continuar?')) return
    setStatus('')
    try {
      await acceptQuote(quote.id)
      setStatus('Cotización aceptada. Contratación registrada.')
      setModal(null)
      setActiveQuote(null)
      await load()
    } catch (error: unknown) {
      setStatus(error instanceof CatalogError ? error.message : 'No se pudo aceptar la cotización.')
    }
  }

  const handleReject = async (quote: QuoteRecord) => {
    if (!window.confirm('¿Rechazar esta cotización?')) return
    try {
      await rejectQuote(quote.id)
      setStatus('Cotización rechazada.')
      setModal(null)
      setActiveQuote(null)
      await load()
    } catch (error: unknown) {
      setStatus(error instanceof CatalogError ? error.message : 'No se pudo rechazar la cotización.')
    }
  }

  const handleModification = async (quote: QuoteRecord) => {
    try {
      await requestQuoteModification(quote.id, modNotes)
      setStatus('Solicitud de modificación enviada.')
      setModNotes('')
      setModal(null)
      setActiveQuote(null)
      await load()
    } catch (error: unknown) {
      setStatus(error instanceof CatalogError ? error.message : 'No se pudo solicitar la modificación.')
    }
  }

  return (
    <div className="events-hub">
      <header className="eh-hero">
        <div>
          <span className="eyebrow violet">Centro de planificación</span>
          <h2 id={titleId}>Mis eventos</h2>
          <p>Organiza tus eventos, administra tus servicios y mantén el control de tu presupuesto desde un solo lugar.</p>
        </div>
        <button className="search-button eh-primary" type="button" onClick={openCreate}>+ Crear evento</button>
      </header>

      {message ? <p className="mp-status is-error" role="alert">{message}</p> : null}
      {status ? <p className="mp-status" role="status">{status}</p> : null}

      {isLoading ? (
        <div className="eh-skeleton" aria-busy="true" aria-label="Cargando eventos">
          <div className="skeleton-line w-70" />
          <div className="eh-budget-grid">{[0, 1, 2].map((item) => <div className="eh-budget-card skeleton-block" key={item} />)}</div>
          <div className="eh-service-grid">{[0, 1, 2].map((item) => <div className="eh-service-card skeleton-block" key={item} />)}</div>
        </div>
      ) : null}

      {!isLoading && events.length === 0 ? (
        <div className="eh-empty" role="status">
          <h3>Todavía no tienes eventos</h3>
          <p>Crea tu primer evento para empezar a planificar servicios, cotizaciones y contrataciones.</p>
          <button className="search-button" type="button" onClick={openCreate}>Crear mi primer evento</button>
        </div>
      ) : null}

      {!isLoading && events.length > 0 ? (
        <>
          <section className="eh-selector" aria-label="Selector de eventos">
            <div className="eh-selector-head">
              <h3>Tus eventos</h3>
              <button className="outline-button compact" type="button" onClick={() => onNavigate('/inicio')}>+ Explorar y agregar servicios</button>
            </div>
            <div className="eh-event-chips" role="listbox" aria-label="Eventos registrados">
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  role="option"
                  aria-selected={event.id === selectedId}
                  className={event.id === selectedId ? 'eh-event-chip is-active' : 'eh-event-chip'}
                  onClick={() => handleSelectEvent(event.id)}
                >
                  <strong>{event.name}</strong>
                  <span>{event.eventType || 'Evento'} · {formatEventDate(event.eventDate)}</span>
                </button>
              ))}
            </div>
          </section>

          {selectedEvent ? (
            <>
              <section className="eh-summary" aria-label="Resumen del evento">
                <div>
                  <span className="eyebrow violet">Evento activo</span>
                  <h3>{selectedEvent.name}</h3>
                  <ul className="eh-summary-list">
                    <li><span>Fecha</span><strong>{formatEventDate(selectedEvent.eventDate)}</strong></li>
                    <li><span>Horario</span><strong>{selectedEvent.startTime || 'Por definir'}</strong></li>
                    <li><span>Ubicación</span><strong>{selectedEvent.location || 'Por definir'}</strong></li>
                    <li><span>Invitados</span><strong>{selectedEvent.guestCount ? selectedEvent.guestCount.toLocaleString('es-MX') : 'Por definir'}</strong></li>
                    <li><span>Tipo</span><strong>{selectedEvent.eventType || 'Por definir'}</strong></li>
                    <li><span>Presupuesto objetivo</span><strong>{selectedEvent.budgetTargetCents != null ? formatPrice(selectedEvent.budgetTargetCents) : 'Sin definir'}</strong></li>
                  </ul>
                </div>
                <button className="outline-button compact" type="button" onClick={openEdit}>Editar evento</button>
              </section>

              <section className="eh-budget" aria-label="Presupuesto del evento">
                <div className="eh-budget-grid">
                  <article className="eh-budget-card">
                    <span>Presupuesto objetivo</span>
                    <strong>{targetBudget != null ? formatPrice(targetBudget) : 'Sin definir'}</strong>
                  </article>
                  <article className="eh-budget-card">
                    <span>Presupuesto estimado</span>
                    <strong>{selectedPlanner?.items.some((item) => item.estimatedCents !== null) ? formatPrice(estimatedBudget) : 'Sin montos confirmados'}</strong>
                  </article>
                  <article className="eh-budget-card">
                    <span>Presupuesto contratado</span>
                    <strong>{contractedBudget > 0 ? formatPrice(contractedBudget) : formatPrice(0)}</strong>
                  </article>
                </div>
                {progressBase ? (
                  <div className={isOverBudget ? 'eh-progress is-over' : 'eh-progress'}>
                    <div className="eh-progress-meta">
                      <span>Avance vs objetivo</span>
                      <strong>{progressPct}%</strong>
                    </div>
                    <div className="eh-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct} aria-label="Avance del presupuesto">
                      <i style={{ width: `${progressPct}%` }} />
                    </div>
                    {isOverBudget ? <p>El importe actual supera el presupuesto objetivo.</p> : null}
                  </div>
                ) : null}
              </section>

              <section className="eh-services" aria-label="Servicios de mi evento">
                <div className="eh-services-head">
                  <div>
                    <span className="eyebrow violet">Servicios</span>
                    <h3>Servicios de mi evento</h3>
                  </div>
                  <button className="outline-button compact" type="button" onClick={() => onNavigate('/inicio')}>+ Explorar y agregar servicios</button>
                </div>
                <div className="eh-filters" role="toolbar" aria-label="Filtrar servicios">
                  {([
                    ['all', `Todos (${counts.all})`],
                    ['considerado', `Considerados (${counts.considerado})`],
                    ['solicitado', `Solicitudes (${counts.solicitado})`],
                    ['cotizado', `Cotizaciones (${counts.cotizado})`],
                    ['contratado', `Contratados (${counts.contratado})`],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={filter === value ? 'mp-chip is-active' : 'mp-chip'}
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {filteredServices.length === 0 ? (
                  <div className="eh-empty compact" role="status">
                    <p>No hay servicios en este filtro. Explora el marketplace para agregar opciones a tu evento.</p>
                    <button className="outline-button compact" type="button" onClick={() => onNavigate('/inicio')}>Ir al marketplace</button>
                  </div>
                ) : (
                  <div className="eh-service-grid">
                    {filteredServices.map((service) => (
                      <article className="eh-service-card" key={service.key}>
                        <div className="eh-service-media">
                          {service.imageUrl ? <img src={service.imageUrl} alt="" loading="lazy" /> : <span aria-hidden="true">{service.title.charAt(0)}</span>}
                          <em className={`eh-status is-${service.status}`}>{statusLabel(service.status)}</em>
                        </div>
                        <div className="eh-service-body">
                          <p className="mp-provider">{service.providerName || 'Proveedor'}</p>
                          <h4>{service.title}</h4>
                          <p className="mp-meta">{service.categoryTitle || service.slug}</p>
                          {service.selectionSummary ? <p className="mp-copy">{service.selectionSummary}</p> : null}
                          <strong className="mp-price">
                            {service.contractedCents != null
                              ? `Contratado: ${formatPrice(service.contractedCents)}`
                              : service.estimatedCents != null
                                ? `Estimado: ${formatPrice(service.estimatedCents)}`
                                : 'Precio a consultar'}
                          </strong>
                          <div className="mp-card-actions">
                            <button className="outline-button compact" type="button" onClick={() => onNavigate(`/categorias/${service.slug}/servicios/${service.serviceId}`)}>Ver detalle</button>
                            {service.status === 'considerado' ? (
                              <>
                                <button className="outline-button compact" type="button" onClick={() => onNavigate(`/categorias/${service.slug}/servicios/${service.serviceId}?accion=cotizacion`)}>Solicitar cotización</button>
                                <button className="outline-button compact" type="button" onClick={() => void handleRemove(service)}>Eliminar</button>
                              </>
                            ) : null}
                            {service.quote && service.status !== 'contratado' ? (
                              <button className="outline-button compact" type="button" onClick={() => { setActiveQuote(service.quote); setModal('quote') }}>
                                Ver cotización
                              </button>
                            ) : null}
                            {service.contract ? (
                              <button className="outline-button compact" type="button" onClick={() => { setActiveQuote(service.quote); setModal('quote') }}>
                                Ver contratación
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </>
      ) : null}

      {modal === 'create' || modal === 'edit' ? (
        <div className="mp-quickview" role="presentation" onClick={() => setModal(null)}>
          <div
            className="eh-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="eh-event-dialog-title"
            tabIndex={-1}
            ref={dialogRef}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => { if (event.key === 'Escape') setModal(null) }}
          >
            <button className="mp-quickview-close" type="button" aria-label="Cerrar" onClick={() => setModal(null)}>×</button>
            <h3 id="eh-event-dialog-title">{modal === 'create' ? 'Crear evento' : 'Editar evento'}</h3>
            <form className="venue-form" onSubmit={handleSaveEvent}>
              <label htmlFor="eh-name">Nombre del evento</label>
              <input id="eh-name" value={form.name} required onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              <label htmlFor="eh-date">Fecha</label>
              <input id="eh-date" type="date" value={form.eventDate} onChange={(event) => setForm((current) => ({ ...current, eventDate: event.target.value }))} />
              <label htmlFor="eh-time">Horario</label>
              <input id="eh-time" type="time" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} />
              <label htmlFor="eh-location">Ubicación</label>
              <input id="eh-location" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} />
              <label htmlFor="eh-guests">Número de invitados</label>
              <input id="eh-guests" inputMode="numeric" value={form.guestCount} onChange={(event) => setForm((current) => ({ ...current, guestCount: event.target.value }))} />
              <label htmlFor="eh-type">Tipo de celebración</label>
              <input id="eh-type" value={form.eventType} onChange={(event) => setForm((current) => ({ ...current, eventType: event.target.value }))} />
              <label htmlFor="eh-budget">Presupuesto objetivo (MXN)</label>
              <input id="eh-budget" inputMode="numeric" value={form.budgetTargetCents} onChange={(event) => setForm((current) => ({ ...current, budgetTargetCents: event.target.value }))} />
              {message ? <p role="alert">{message}</p> : null}
              <button className="search-button" type="submit" disabled={isSaving}>{isSaving ? 'Guardando…' : 'Guardar'}</button>
            </form>
          </div>
        </div>
      ) : null}

      {modal === 'quote' && (activeQuote || selectedId) ? (
        <div className="mp-quickview" role="presentation" onClick={() => { setModal(null); setActiveQuote(null) }}>
          <div
            className="eh-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="eh-quote-dialog-title"
            tabIndex={-1}
            ref={dialogRef}
            onClick={(event) => event.stopPropagation()}
          >
            <button className="mp-quickview-close" type="button" aria-label="Cerrar" onClick={() => { setModal(null); setActiveQuote(null) }}>×</button>
            {activeQuote ? (
              <>
                <h3 id="eh-quote-dialog-title">{activeQuote.serviceTitle}</h3>
                <p>{activeQuote.providerName} · {activeQuote.eventName || 'Sin evento'}</p>
                <p>{quoteStatusLabel(activeQuote.status)} · {formatEventDate(activeQuote.requestedOn)}</p>
                <p>{activeQuote.notes || 'Sin observaciones.'}</p>
                {activeQuote.selection ? <p>{selectionText(activeQuote.selection)}</p> : null}
                {activeQuote.status !== 'aceptada' && activeQuote.status !== 'rechazada' && activeQuote.status !== 'cancelada' ? (
                  <div className="mp-card-actions">
                    <button className="search-button" type="button" onClick={() => void handleAccept(activeQuote)}>Aceptar y contratar</button>
                    <button className="outline-button compact" type="button" onClick={() => void handleReject(activeQuote)}>Rechazar</button>
                  </div>
                ) : null}
                {activeQuote.status !== 'aceptada' && activeQuote.status !== 'rechazada' && activeQuote.status !== 'cancelada' ? (
                  <div className="eh-mod-box">
                    <label htmlFor="eh-mod-notes">Solicitar modificación</label>
                    <textarea id="eh-mod-notes" rows={3} value={modNotes} onChange={(event) => setModNotes(event.target.value)} placeholder="Describe el cambio que necesitas" />
                    <button className="outline-button compact" type="button" onClick={() => void handleModification(activeQuote)}>Enviar solicitud</button>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <h3 id="eh-quote-dialog-title">Contratación</h3>
                <p>Consulta el detalle del servicio contratado desde su ficha.</p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
