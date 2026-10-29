import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { Logo } from './logo'

type Phase =
  | 'categories'
  | 'approach-category'
  | 'press-category'
  | 'browse'
  | 'approach-type'
  | 'press-type'
  | 'approach-guests'
  | 'press-guests'
  | 'approach-budget'
  | 'press-budget'
  | 'filtered'
  | 'cards'
  | 'approach-card'
  | 'press-card'
  | 'features'
  | 'approach-details'
  | 'press-details'
  | 'detail'
  | 'approach-add'
  | 'press-add'
  | 'added'
  | 'planner'
  | 'reset'

type Point = { x: number; y: number }

type Venue = {
  id: string
  name: string
  type: 'Salón' | 'Jardín' | 'Terraza'
  guests: number
  price: number
  place: string
  services: string
  image: string
  alt: string
}

const beats: { phase: Phase; ms: number }[] = [
  { phase: 'categories', ms: 900 },
  { phase: 'approach-category', ms: 1300 },
  { phase: 'press-category', ms: 420 },
  { phase: 'browse', ms: 1700 },
  { phase: 'approach-type', ms: 1300 },
  { phase: 'press-type', ms: 380 },
  { phase: 'approach-guests', ms: 1200 },
  { phase: 'press-guests', ms: 380 },
  { phase: 'approach-budget', ms: 1200 },
  { phase: 'press-budget', ms: 380 },
  { phase: 'filtered', ms: 1500 },
  { phase: 'cards', ms: 1300 },
  { phase: 'approach-card', ms: 1300 },
  { phase: 'press-card', ms: 420 },
  { phase: 'features', ms: 1700 },
  { phase: 'approach-details', ms: 1200 },
  { phase: 'press-details', ms: 420 },
  { phase: 'detail', ms: 2000 },
  { phase: 'approach-add', ms: 1200 },
  { phase: 'press-add', ms: 420 },
  { phase: 'added', ms: 2400 },
  { phase: 'planner', ms: 3600 },
  { phase: 'reset', ms: 700 },
]

const sideItems = ['Marketplace', 'Categorías', 'Planificador', 'Cotizaciones']

const catalog: Venue[] = [
  { id: 'alba', name: 'Salón Alba', type: 'Salón', guests: 150, price: 38000, place: 'Polanco', services: 'Salón, mesas y servicio de montaje', image: 'https://images.unsplash.com/photo-1643066873594-4df339b2e232?auto=format&fit=crop&w=800&q=80', alt: 'Salón preparado para una comida' },
  { id: 'olivos', name: 'Jardín Los Olivos', type: 'Jardín', guests: 100, price: 22000, place: 'Coyoacán', services: 'Mesas, iluminación cálida y montaje', image: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=800&q=80', alt: 'Jardín con mesas y luz cálida' },
  { id: 'norte', name: 'Terraza Norte', type: 'Terraza', guests: 80, price: 18500, place: 'Roma', services: 'Terraza, luz ambiental y acceso peatonal', image: 'https://images.unsplash.com/photo-1473973916745-60839aebf06b?auto=format&fit=crop&w=800&q=80', alt: 'Mesa de celebración con luz suave' },
  { id: 'lago', name: 'Jardín del Lago', type: 'Jardín', guests: 110, price: 19800, place: 'Xochimilco', services: 'Jardín, sillas y camino de acceso', image: 'https://images.unsplash.com/photo-1536392706976-e486e2ba97af?auto=format&fit=crop&w=800&q=80', alt: 'Celebración al aire libre' },
  { id: 'alto', name: 'Jardín Alto', type: 'Jardín', guests: 90, price: 21400, place: 'Tlalpan', services: 'Jardín, mesas y luz de atardecer', image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80', alt: 'Recepción con mesas decoradas' },
]

const gardens = catalog.filter((venue) => venue.type === 'Jardín')
const selectedVenue = gardens[0]

const categoryPhases = new Set<Phase>(['categories', 'approach-category', 'press-category', 'browse'])
const filterPhases = new Set<Phase>(['approach-type', 'press-type', 'approach-guests', 'press-guests', 'approach-budget', 'press-budget', 'filtered'])
const comparePhases = new Set<Phase>(['cards', 'approach-card', 'press-card', 'features', 'approach-details', 'press-details'])
const detailPhases = new Set<Phase>(['detail', 'approach-add', 'press-add', 'added'])

const formatPrice = (value: number) => `$${value.toLocaleString('es-MX')}`

const phaseRank = (phase: Phase) => beats.findIndex((beat) => beat.phase === phase)

const headingFor = (phase: Phase) => {
  if (categoryPhases.has(phase)) return 'Explora espacios'
  if (filterPhases.has(phase)) return 'Define lo que necesitas'
  if (comparePhases.has(phase)) return 'Compara opciones'
  if (detailPhases.has(phase)) return 'Detalle del espacio'
  return 'Planificación'
}

const CursorMark = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 3.5 19 12.2 11.6 13.4 9.2 20.5 5 3.5Z" fill="#14213d" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
)

const pointInStage = (stage: HTMLElement, element: HTMLElement | null, fallback: Point): Point => {
  if (!element) return fallback
  const stageBox = stage.getBoundingClientRect()
  const box = element.getBoundingClientRect()
  return {
    x: box.left - stageBox.left + Math.min(box.width * 0.72, box.width - 8),
    y: box.top - stageBox.top + box.height * 0.62,
  }
}

const onScreen = (stage: HTMLElement) => {
  const box = stage.getBoundingClientRect()
  const viewport = window.innerHeight || document.documentElement.clientHeight
  const visible = Math.min(box.bottom, viewport) - Math.max(box.top, 0)
  return visible > Math.min(box.height, viewport) * 0.35
}

export const SpaceGuide = ({ onNavigate }: { onNavigate: (path: string) => void }) => {
  const handleExplore = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    onNavigate('/categorias/locacion')
  }

  return (
    <div className="guide-lesson">
      <h4 className="guide-lesson-title">Cómo elegir el espacio perfecto</h4>
      <SpaceDemo />
      <div className="guide-extra">
        <h4>Antes de decidir</h4>
        <ul>
          <li>Define el tipo de espacio, los invitados y un presupuesto máximo antes de comparar.</li>
          <li>Revisa capacidad, ubicación, servicios incluidos y el precio de referencia.</li>
          <li>Agregar el espacio a tu evento lo deja en planificación; no lo contrata.</li>
          <li>La contratación solo queda formalizada cuando aceptas una cotización.</li>
        </ul>
        <a className="guide-explore" href="/categorias/locacion" onClick={handleExplore}>Explorar espacios</a>
      </div>
    </div>
  )
}

export const SpaceDemo = () => {
  const stageRef = useRef<HTMLDivElement>(null)
  const categoryRef = useRef<HTMLDivElement>(null)
  const typeRef = useRef<HTMLButtonElement>(null)
  const guestsRef = useRef<HTMLButtonElement>(null)
  const budgetRef = useRef<HTMLButtonElement>(null)
  const resultRef = useRef<HTMLLIElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const detailsRef = useRef<HTMLButtonElement>(null)
  const capacityRef = useRef<HTMLLIElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const [index, setIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [cursor, setCursor] = useState<Point>({ x: 36, y: 88 })
  const phase: Phase = reducedMotion ? 'planner' : beats[index]?.phase ?? 'categories'
  const categoryOn = phaseRank(phase) >= phaseRank('press-category') && phase !== 'reset'
  const typeOn = phaseRank(phase) >= phaseRank('press-type') && phase !== 'reset'
  const guestsOn = phaseRank(phase) >= phaseRank('press-guests') && phase !== 'reset'
  const budgetOn = phaseRank(phase) >= phaseRank('press-budget') && phase !== 'reset'
  const cardOn = phaseRank(phase) >= phaseRank('press-card') && phaseRank(phase) <= phaseRank('press-details')
  const showFacts = phaseRank(phase) >= phaseRank('features') && phaseRank(phase) <= phaseRank('press-details')
  const isPressing = phase.startsWith('press-')
  const hideCursor = reducedMotion || phase === 'added' || phase === 'planner' || phase === 'reset'
  const activeItem = phase === 'planner' || phase === 'reset' ? 'Planificador' : 'Categorías'
  const view = categoryPhases.has(phase) ? 'categories' : filterPhases.has(phase) ? 'filters' : comparePhases.has(phase) ? 'compare' : detailPhases.has(phase) ? 'detail' : 'planner'
  const matches = (venue: Venue) => {
    if (typeOn && venue.type !== 'Jardín') return false
    if (guestsOn && (venue.guests < 90 || venue.guests > 120)) return false
    if (budgetOn && venue.price > 25000) return false
    return true
  }

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotion = () => setReducedMotion(media.matches)
    syncMotion()
    media.addEventListener('change', syncMotion)
    return () => media.removeEventListener('change', syncMotion)
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry?.isIntersecting ?? false)
    }, { threshold: 0.35 })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (reducedMotion) return
    const beat = beats[index]
    if (!beat) return
    let timer = 0
    const advance = () => setIndex((current) => (current + 1) % beats.length)
    const scheduleBeat = () => {
      timer = window.setTimeout(() => {
        const stage = stageRef.current
        if (!stage || !onScreen(stage)) {
          waitUntilVisible()
          return
        }
        advance()
      }, beat.ms)
    }
    const waitUntilVisible = () => {
      timer = window.setTimeout(() => {
        const stage = stageRef.current
        if (stage && onScreen(stage)) {
          scheduleBeat()
          return
        }
        waitUntilVisible()
      }, 400)
    }
    const stage = stageRef.current
    if (stage && onScreen(stage)) scheduleBeat()
    else waitUntilVisible()
    return () => window.clearTimeout(timer)
  }, [index, isVisible, reducedMotion])

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage || reducedMotion) return
    const resting = { x: Math.max(24, stage.clientWidth - 48), y: 78 }
    if (phase === 'reset' || phase === 'categories' || phase === 'browse' || phase === 'cards') {
      setCursor(resting)
      return
    }
    if (phase === 'added' || phase === 'planner') return
    const target = phase === 'approach-category' || phase === 'press-category' ? categoryRef.current
      : phase === 'approach-type' || phase === 'press-type' ? typeRef.current
        : phase === 'approach-guests' || phase === 'press-guests' ? guestsRef.current
          : phase === 'approach-budget' || phase === 'press-budget' ? budgetRef.current
            : phase === 'filtered' ? resultRef.current
              : phase === 'approach-card' || phase === 'press-card' || phase === 'features' ? cardRef.current
                : phase === 'approach-details' || phase === 'press-details' ? detailsRef.current
                  : phase === 'detail' ? capacityRef.current
                    : phase === 'approach-add' || phase === 'press-add' ? addRef.current
                      : null
    setCursor(pointInStage(stage, target, resting))
  }, [phase, reducedMotion])

  return (
    <div className="quote-demo space-demo">
      <p className="quote-demo-summary">Demostración con datos ficticios. Se explora, compara y agrega un espacio a la planificación, sin contratarlo.</p>
      <div className={`quote-demo-stage ${phase === 'reset' ? 'is-resetting' : ''}`} ref={stageRef} data-scene={phase} inert>
            <aside className="quote-demo-side">
              <Logo />
              <div className="quote-demo-nav">
                {sideItems.map((item) => <div className={item === activeItem ? 'is-active' : ''} key={item}>{item}</div>)}
              </div>
            </aside>
            <div className="quote-demo-main">
              <div className="quote-demo-top">
                <div>
                  <span className="eyebrow">TU ESPACIO</span>
                  <h3>Hola, Valentina</h3>
                </div>
                <span className="quote-demo-avatar" aria-hidden="true">VP</span>
              </div>
              <div className="quote-demo-canvas">
                <p className="space-scene-label">{headingFor(phase)}</p>
                {view === 'categories' ? (
                  <div className="space-view" key="categories">
                    <div className="space-cats">
                      {['Espacios para eventos', 'Fotografía', 'Banquetes', 'Música'].map((item) => (
                        <div className={`space-cat${item === 'Espacios para eventos' && categoryOn ? ' is-selected' : ''}${item === 'Espacios para eventos' && phase === 'press-category' ? ' is-pressed' : ''}`} key={item} ref={item === 'Espacios para eventos' ? categoryRef : undefined}>{item}</div>
                      ))}
                    </div>
                    {phase === 'browse' ? (
                      <div className="space-types">
                        {['Salón', 'Jardín', 'Terraza'].map((item) => <div key={item}>{item}</div>)}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {view === 'filters' ? (
                  <div className="space-view" key="filters">
                    <div className="space-filters">
                      <button className={`space-filter${typeOn ? ' is-on' : ''}${phase === 'press-type' ? ' is-pressed' : ''}`} type="button" tabIndex={-1} ref={typeRef}><span>Tipo de espacio</span><b>{typeOn ? 'Jardín' : 'Todos'}</b></button>
                      <button className={`space-filter${guestsOn ? ' is-on' : ''}${phase === 'press-guests' ? ' is-pressed' : ''}`} type="button" tabIndex={-1} ref={guestsRef}><span>Número de invitados</span><b>{guestsOn ? '100' : 'Cualquiera'}</b></button>
                      <button className={`space-filter${budgetOn ? ' is-on' : ''}${phase === 'press-budget' ? ' is-pressed' : ''}`} type="button" tabIndex={-1} ref={budgetRef}><span>Presupuesto máximo</span><b>{budgetOn ? '$25,000' : 'Sin límite'}</b></button>
                    </div>
                    <p className="space-count">{catalog.filter(matches).length} espacios para revisar</p>
                    <ul className="space-results">
                      {catalog.map((venue) => (
                        <li className={matches(venue) ? '' : 'is-out'} key={venue.id} ref={venue.id === 'olivos' ? resultRef : undefined}>
                          <strong>{venue.name}</strong>
                          <span>{venue.type} · {venue.guests} · {formatPrice(venue.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {view === 'compare' ? (
                  <div className="space-view" key="compare">
                    <div className="space-cards">
                      {gardens.map((venue) => (
                        <article className={`space-card${venue.id === 'olivos' && cardOn ? ' is-selected' : ''}${venue.id === 'olivos' && phase === 'press-card' ? ' is-pressed' : ''}`} key={venue.id} ref={venue.id === 'olivos' ? cardRef : undefined}>
                          <img src={venue.image} alt={venue.alt} loading="lazy" />
                          <div>
                            <strong>{venue.name}</strong>
                            <span>{venue.place}</span>
                            <small>{venue.guests} invitados</small>
                            <b>{formatPrice(venue.price)}</b>
                          </div>
                        </article>
                      ))}
                    </div>
                    {showFacts && selectedVenue ? (
                      <div className="space-feature">
                        <strong>{selectedVenue.name}</strong>
                        <ul>
                          <li><span>Capacidad</span><b>{selectedVenue.guests} invitados</b></li>
                          <li><span>Ubicación</span><b>{selectedVenue.place}</b></li>
                          <li><span>Servicios</span><b>{selectedVenue.services}</b></li>
                          <li><span>Referencia</span><b>{formatPrice(selectedVenue.price)}</b></li>
                        </ul>
                        <button className={`quote-demo-accept${phase === 'press-details' ? ' is-pressed' : ''}`} type="button" tabIndex={-1} ref={detailsRef}>Ver detalles</button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {view === 'detail' && selectedVenue ? (
                  <div className="space-view" key="detail">
                    <article className="quote-demo-card">
                      <img className="space-detail-photo" src={selectedVenue.image} alt={selectedVenue.alt} />
                      <h4>{selectedVenue.name}</h4>
                      <p>Jardín amplio para una celebración, con mesas, luz cálida y espacio para circular.</p>
                      <ul className="space-facts">
                        <li className="is-lit" ref={capacityRef}><span>Capacidad</span><b>{selectedVenue.guests} invitados</b></li>
                        <li className="is-lit"><span>Ubicación</span><b>{selectedVenue.place} · acceso y estacionamiento</b></li>
                        <li className="is-lit"><span>Servicios incluidos</span><b>{selectedVenue.services}</b></li>
                        <li className="is-lit"><span>Precio de referencia</span><b>{formatPrice(selectedVenue.price)}</b></li>
                      </ul>
                      <p className="space-disclaimer">Agregar este espacio a tu evento no lo contrata.</p>
                      <button className={`quote-demo-accept${phase === 'press-add' ? ' is-pressed' : ''}`} type="button" tabIndex={-1} ref={addRef}>Agregar a mi evento</button>
                    </article>
                    <div className={`quote-demo-overlay ${phase === 'added' ? 'is-open' : ''}`}>
                      <div className="quote-demo-dialog">
                        <h4>Espacio agregado a tu planificación</h4>
                        <p>Jardín Los Olivos queda en el evento Mi boda.</p>
                        <div className="space-budget-change"><span>Anterior <b>$0</b></span><span>Estimado <b>$22,000</b></span></div>
                        <p className="space-disclaimer">Agregar un servicio al planificador no lo contrata. La contratación se formaliza al aceptar una cotización.</p>
                      </div>
                    </div>
                  </div>
                ) : null}
                {view === 'planner' ? (
                  <div className="space-view" key="planner">
                    <article className="quote-demo-card">
                      <div className="quote-demo-card-head">
                        <span className="quote-demo-badge">En planificación</span>
                        <small>Evento ficticio</small>
                      </div>
                      <h4>Mi boda</h4>
                      <p>El espacio queda guardado en la planificación. Aún no está contratado.</p>
                      <ul className="space-plan">
                        <li>
                          <img src={selectedVenue?.image} alt="" />
                          <div><strong>Jardín Los Olivos</strong><span>100 invitados · Coyoacán</span></div>
                          <b>$22,000</b>
                        </li>
                      </ul>
                      <div className="quote-demo-total"><span>Presupuesto estimado</span><strong>$22,000</strong></div>
                      <div className="quote-demo-success">
                        <svg className="demo-check" viewBox="0 0 52 52" aria-hidden="true">
                          <circle cx="26" cy="26" r="23" />
                          <path d="M16 27.5 22.5 34 36 19" />
                        </svg>
                        <div>
                          <strong>¡El espacio ideal es el comienzo de un evento inolvidable!</strong>
                          <span>La contratación se formaliza solo cuando aceptas una cotización.</span>
                        </div>
                      </div>
                    </article>
                  </div>
                ) : null}
              </div>
            </div>
            <div className={`demo-cursor ${phase === 'reset' ? 'is-instant' : ''} ${isPressing ? 'is-pressing' : ''} ${hideCursor ? 'is-hidden' : ''}`} style={{ left: cursor.x, top: cursor.y }} aria-hidden="true">
              <CursorMark />
            </div>
          </div>
    </div>
  )
}
