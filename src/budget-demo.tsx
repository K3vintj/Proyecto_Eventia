import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { Logo } from './logo'

type Phase =
  | 'overview'
  | 'approach-locacion'
  | 'press-locacion'
  | 'approach-banquetes'
  | 'press-banquetes'
  | 'approach-flores'
  | 'press-flores'
  | 'approach-musica'
  | 'press-musica'
  | 'review'
  | 'approach-details'
  | 'press-details'
  | 'detail'
  | 'approach-add'
  | 'press-add'
  | 'added'
  | 'planner'
  | 'reset'

type Point = { x: number; y: number }

type Line = {
  id: 'locacion' | 'banquetes' | 'flores' | 'musica'
  name: string
  note: string
  amount: number
  color: string
}

const beats: { phase: Phase; ms: number }[] = [
  { phase: 'overview', ms: 900 },
  { phase: 'approach-locacion', ms: 1100 },
  { phase: 'press-locacion', ms: 380 },
  { phase: 'approach-banquetes', ms: 1000 },
  { phase: 'press-banquetes', ms: 380 },
  { phase: 'approach-flores', ms: 1000 },
  { phase: 'press-flores', ms: 380 },
  { phase: 'approach-musica', ms: 1000 },
  { phase: 'press-musica', ms: 380 },
  { phase: 'review', ms: 1400 },
  { phase: 'approach-details', ms: 1100 },
  { phase: 'press-details', ms: 420 },
  { phase: 'detail', ms: 1800 },
  { phase: 'approach-add', ms: 1100 },
  { phase: 'press-add', ms: 420 },
  { phase: 'added', ms: 2300 },
  { phase: 'planner', ms: 3400 },
  { phase: 'reset', ms: 700 },
]

const sideItems = ['Marketplace', 'Categorías', 'Planificador', 'Cotizaciones']

const lines: Line[] = [
  { id: 'locacion', name: 'Locación', note: 'Espacio del evento', amount: 28000, color: 'var(--violet)' },
  { id: 'banquetes', name: 'Banquetes', note: 'Comida y servicio', amount: 24000, color: 'var(--navy)' },
  { id: 'flores', name: 'Flores y decoración', note: 'Flores y mesa', amount: 12000, color: 'var(--coral)' },
  { id: 'musica', name: 'Música y DJ', note: 'Sonido de la celebración', amount: 8000, color: 'var(--navy-soft)' },
]

const total = 80000
const margin = 8000

const splitPhases = new Set<Phase>(['overview', 'approach-locacion', 'press-locacion', 'approach-banquetes', 'press-banquetes', 'approach-flores', 'press-flores', 'approach-musica', 'press-musica', 'review', 'approach-details', 'press-details'])
const detailPhases = new Set<Phase>(['detail', 'approach-add', 'press-add', 'added'])

const formatPrice = (value: number) => `$${value.toLocaleString('es-MX')}`

const phaseRank = (phase: Phase) => beats.findIndex((beat) => beat.phase === phase)

const headingFor = (phase: Phase) => {
  if (phaseRank(phase) < phaseRank('review')) return 'Separa el monto'
  if (splitPhases.has(phase)) return 'Revisa las partidas'
  if (detailPhases.has(phase)) return 'Confirma cada partida'
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

export const BudgetGuide = () => {
  const handleExplore = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    document.getElementById('explorar')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="guide-lesson">
      <h4 className="guide-lesson-title">Presupuesto sin complicaciones</h4>
      <BudgetDemo />
      <div className="guide-extra">
        <h4>Antes de confirmar</h4>
        <ul>
          <li>Anota locación, banquetes, flores y música por separado.</li>
          <li>Deja un margen para lo que aparezca al final.</li>
          <li>Confirmar las partidas no contrata ningún servicio.</li>
          <li>La contratación se formaliza al aceptar una cotización.</li>
        </ul>
        <a className="guide-explore" href="#explorar" onClick={handleExplore}>Ver las categorías</a>
      </div>
    </div>
  )
}

export const BudgetDemo = () => {
  const stageRef = useRef<HTMLDivElement>(null)
  const locacionRef = useRef<HTMLButtonElement>(null)
  const banquetesRef = useRef<HTMLButtonElement>(null)
  const floresRef = useRef<HTMLButtonElement>(null)
  const musicaRef = useRef<HTMLButtonElement>(null)
  const detailsRef = useRef<HTMLButtonElement>(null)
  const marginRef = useRef<HTMLLIElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const [index, setIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [cursor, setCursor] = useState<Point>({ x: 36, y: 88 })
  const phase: Phase = reducedMotion ? 'planner' : beats[index]?.phase ?? 'overview'
  const locacionOn = phaseRank(phase) >= phaseRank('press-locacion') && phase !== 'reset'
  const banquetesOn = phaseRank(phase) >= phaseRank('press-banquetes') && phase !== 'reset'
  const floresOn = phaseRank(phase) >= phaseRank('press-flores') && phase !== 'reset'
  const musicaOn = phaseRank(phase) >= phaseRank('press-musica') && phase !== 'reset'
  const showFacts = phaseRank(phase) >= phaseRank('review') && phaseRank(phase) <= phaseRank('press-details')
  const isPressing = phase.startsWith('press-')
  const hideCursor = reducedMotion || phase === 'added' || phase === 'planner' || phase === 'reset'
  const view = splitPhases.has(phase) ? 'split' : detailPhases.has(phase) ? 'detail' : 'planner'
  const lineOn = (id: Line['id']) => id === 'locacion' ? locacionOn : id === 'banquetes' ? banquetesOn : id === 'flores' ? floresOn : musicaOn
  const assigned = lines.reduce((sum, line) => sum + (lineOn(line.id) ? line.amount : 0), 0)
  const available = total - assigned

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
    if (phase === 'reset' || phase === 'overview' || phase === 'review') {
      setCursor(resting)
      return
    }
    if (phase === 'added' || phase === 'planner') return
    const target = phase === 'approach-locacion' || phase === 'press-locacion' ? locacionRef.current
      : phase === 'approach-banquetes' || phase === 'press-banquetes' ? banquetesRef.current
        : phase === 'approach-flores' || phase === 'press-flores' ? floresRef.current
          : phase === 'approach-musica' || phase === 'press-musica' ? musicaRef.current
            : phase === 'approach-details' || phase === 'press-details' ? detailsRef.current
              : phase === 'detail' ? marginRef.current
                : phase === 'approach-add' || phase === 'press-add' ? addRef.current
                  : null
    setCursor(pointInStage(stage, target, resting))
  }, [phase, reducedMotion])

  return (
    <div className="quote-demo space-demo budget-demo">
      <p className="quote-demo-summary">Demostración con datos ficticios. El monto se separa por categoría y se confirma en la planificación, sin contratar.</p>
      <div className={`quote-demo-stage ${phase === 'reset' ? 'is-resetting' : ''}`} ref={stageRef} data-scene={phase} inert>
        <aside className="quote-demo-side">
          <Logo />
          <div className="quote-demo-nav">
            {sideItems.map((item) => <div className={item === 'Planificador' ? 'is-active' : ''} key={item}>{item}</div>)}
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
            {view === 'split' ? (
              <div className="space-view" key="split">
                <div className="budget-head">
                  <span>Mi boda</span>
                  <strong>{formatPrice(total)}</strong>
                </div>
                <div className="budget-meter" aria-hidden="true">
                  {lines.map((line) => <span className={lineOn(line.id) ? 'is-on' : ''} key={line.id} style={{ width: `${(line.amount / total) * 100}%`, background: lineOn(line.id) ? line.color : 'transparent' }} />)}
                  <span className={musicaOn ? 'is-on' : ''} style={{ width: `${(margin / total) * 100}%`, background: musicaOn ? 'var(--line)' : 'transparent' }} />
                </div>
                <p className="budget-readout"><span>Asignado <b>{formatPrice(assigned)}</b></span><span>{musicaOn ? 'Margen' : 'Disponible'} <b>{formatPrice(available)}</b></span></p>
                <div className="space-filters">
                  {lines.map((line) => (
                    <button className={`space-filter budget-line${lineOn(line.id) ? ' is-on' : ''}${phase === `press-${line.id}` ? ' is-pressed' : ''}`} type="button" tabIndex={-1} key={line.id} ref={line.id === 'locacion' ? locacionRef : line.id === 'banquetes' ? banquetesRef : line.id === 'flores' ? floresRef : musicaRef}>
                      <span><i style={{ background: line.color }} />{line.name}</span>
                      <b>{lineOn(line.id) ? formatPrice(line.amount) : 'Por asignar'}</b>
                    </button>
                  ))}
                </div>
                {showFacts ? (
                  <div className="space-feature">
                    <strong>Mi boda</strong>
                    <ul>
                      <li><span>Total</span><b>{formatPrice(total)}</b></li>
                      <li><span>Asignado</span><b>{formatPrice(total - margin)}</b></li>
                      <li><span>Margen</span><b>{formatPrice(margin)}</b></li>
                    </ul>
                    <button className={`quote-demo-accept${phase === 'press-details' ? ' is-pressed' : ''}`} type="button" tabIndex={-1} ref={detailsRef}>Ver partidas</button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {view === 'detail' ? (
              <div className="space-view" key="detail">
                <article className="quote-demo-card">
                  <h4>Mi boda</h4>
                  <p>Cuatro partidas y un margen. Cada monto queda visible antes de contratar.</p>
                  <ul className="space-facts">
                    {lines.map((line) => <li className="is-lit" key={line.id}><span>{line.name}</span><b>{formatPrice(line.amount)}</b></li>)}
                    <li className="is-lit" ref={marginRef}><span>Margen</span><b>{formatPrice(margin)}</b></li>
                  </ul>
                  <p className="space-disclaimer">Confirmar estas partidas no contrata ningún servicio.</p>
                  <button className={`quote-demo-accept${phase === 'press-add' ? ' is-pressed' : ''}`} type="button" tabIndex={-1} ref={addRef}>Confirmar partidas</button>
                </article>
                <div className={`quote-demo-overlay ${phase === 'added' ? 'is-open' : ''}`}>
                  <div className="quote-demo-dialog">
                    <h4>Partidas confirmadas en tu planificación</h4>
                    <p>El monto de Mi boda queda separado por categoría.</p>
                    <div className="space-budget-change"><span>Junto <b>{formatPrice(total)}</b></span><span>Separado <b>{formatPrice(total)}</b></span></div>
                    <p className="space-disclaimer">Confirmar las partidas no contrata ningún servicio. La contratación se formaliza al aceptar una cotización.</p>
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
                  <p>Las partidas quedan guardadas. Aún no hay servicios contratados.</p>
                  <ul className="space-plan">
                    {lines.map((line) => (
                      <li key={line.id}>
                        <span className="budget-swatch" style={{ background: line.color }} aria-hidden="true" />
                        <div><strong>{line.name}</strong><span>{line.note}</span></div>
                        <b>{formatPrice(line.amount)}</b>
                      </li>
                    ))}
                    <li>
                      <span className="budget-swatch is-margin" aria-hidden="true" />
                      <div><strong>Margen</strong><span>Para lo que aparezca al final</span></div>
                      <b>{formatPrice(margin)}</b>
                    </li>
                  </ul>
                  <div className="quote-demo-total"><span>Presupuesto estimado</span><strong>{formatPrice(total)}</strong></div>
                  <div className="quote-demo-success">
                    <svg className="demo-check" viewBox="0 0 52 52" aria-hidden="true">
                      <circle cx="26" cy="26" r="23" />
                      <path d="M16 27.5 22.5 34 36 19" />
                    </svg>
                    <div>
                      <strong>Cada partida queda clara antes de contratar.</strong>
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
