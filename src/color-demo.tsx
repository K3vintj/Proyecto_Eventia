import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { Logo } from './logo'

type Phase =
  | 'categories'
  | 'approach-category'
  | 'press-category'
  | 'moods'
  | 'approach-mood'
  | 'press-mood'
  | 'tones'
  | 'approach-blush'
  | 'press-blush'
  | 'approach-sage'
  | 'press-sage'
  | 'approach-ivory'
  | 'press-ivory'
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

type Tone = { name: string; hex: string }

type Palette = {
  id: string
  name: string
  mood: string
  price: number
  colors: Tone[]
}

const beats: { phase: Phase; ms: number }[] = [
  { phase: 'categories', ms: 900 },
  { phase: 'approach-category', ms: 1300 },
  { phase: 'press-category', ms: 420 },
  { phase: 'moods', ms: 1500 },
  { phase: 'approach-mood', ms: 1200 },
  { phase: 'press-mood', ms: 420 },
  { phase: 'tones', ms: 700 },
  { phase: 'approach-blush', ms: 1100 },
  { phase: 'press-blush', ms: 380 },
  { phase: 'approach-sage', ms: 1100 },
  { phase: 'press-sage', ms: 380 },
  { phase: 'approach-ivory', ms: 1100 },
  { phase: 'press-ivory', ms: 380 },
  { phase: 'cards', ms: 1300 },
  { phase: 'approach-card', ms: 1200 },
  { phase: 'press-card', ms: 420 },
  { phase: 'features', ms: 1600 },
  { phase: 'approach-details', ms: 1100 },
  { phase: 'press-details', ms: 420 },
  { phase: 'detail', ms: 1900 },
  { phase: 'approach-add', ms: 1100 },
  { phase: 'press-add', ms: 420 },
  { phase: 'added', ms: 2300 },
  { phase: 'planner', ms: 3400 },
  { phase: 'reset', ms: 700 },
]

const sideItems = ['Marketplace', 'Categorías', 'Planificador', 'Cotizaciones']

const palettes: Palette[] = [
  { id: 'alba', name: 'Alba suave', mood: 'Romántica', price: 8400, colors: [{ name: 'Blush', hex: '#f3c1b8' }, { name: 'Salvia', hex: '#c5d0c1' }, { name: 'Marfil', hex: '#f6f1e8' }] },
  { id: 'noche', name: 'Noche ciruela', mood: 'Moderna', price: 11200, colors: [{ name: 'Ciruela', hex: '#6d4c6a' }, { name: 'Arena', hex: '#e6d3c4' }, { name: 'Crema', hex: '#f7f3ee' }] },
  { id: 'limon', name: 'Jardín limón', mood: 'Jardín', price: 7600, colors: [{ name: 'Limón', hex: '#d7e08a' }, { name: 'Hoja', hex: '#7f9a78' }, { name: 'Blanco', hex: '#f8f6f2' }] },
]

const selectedPalette = palettes[0]
const tones = selectedPalette.colors

const browsePhases = new Set<Phase>(['categories', 'approach-category', 'press-category', 'moods', 'approach-mood', 'press-mood'])
const tonePhases = new Set<Phase>(['tones', 'approach-blush', 'press-blush', 'approach-sage', 'press-sage', 'approach-ivory', 'press-ivory'])
const comparePhases = new Set<Phase>(['cards', 'approach-card', 'press-card', 'features', 'approach-details', 'press-details'])
const detailPhases = new Set<Phase>(['detail', 'approach-add', 'press-add', 'added'])

const formatPrice = (value: number) => `$${value.toLocaleString('es-MX')}`

const phaseRank = (phase: Phase) => beats.findIndex((beat) => beat.phase === phase)

const headingFor = (phase: Phase) => {
  if (browsePhases.has(phase)) return 'Elige la atmósfera'
  if (tonePhases.has(phase)) return 'Arma la paleta'
  if (comparePhases.has(phase)) return 'Compara paletas'
  if (detailPhases.has(phase)) return 'La paleta en el evento'
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

const Swatches = ({ colors }: { colors: Tone[] }) => (
  <div className="palette-band" aria-hidden="true">
    {colors.map((color) => <span key={color.name} style={{ background: color.hex }} />)}
  </div>
)

export const ColorGuide = ({ onNavigate }: { onNavigate: (path: string) => void }) => {
  const handleExplore = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    onNavigate('/categorias/flores-decoracion')
  }

  return (
    <div className="guide-lesson">
      <h4 className="guide-lesson-title">Paletas de color que amamos</h4>
      <ColorDemo />
      <div className="guide-extra">
        <h4>Antes de elegir</h4>
        <ul>
          <li>Define dos o tres tonos y repítelos en flores, mantel y papelería.</li>
          <li>Mira la paleta junta antes de decidir cada detalle.</li>
          <li>Agregar la paleta al planificador no contrata el servicio.</li>
          <li>La contratación se formaliza al aceptar una cotización.</li>
        </ul>
        <a className="guide-explore" href="/categorias/flores-decoracion" onClick={handleExplore}>Explorar flores y decoración</a>
      </div>
    </div>
  )
}

export const ColorDemo = () => {
  const stageRef = useRef<HTMLDivElement>(null)
  const categoryRef = useRef<HTMLDivElement>(null)
  const moodRef = useRef<HTMLDivElement>(null)
  const blushRef = useRef<HTMLButtonElement>(null)
  const sageRef = useRef<HTMLButtonElement>(null)
  const ivoryRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const detailsRef = useRef<HTMLButtonElement>(null)
  const repeatRef = useRef<HTMLLIElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const [index, setIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [cursor, setCursor] = useState<Point>({ x: 36, y: 88 })
  const phase: Phase = reducedMotion ? 'planner' : beats[index]?.phase ?? 'categories'
  const categoryOn = phaseRank(phase) >= phaseRank('press-category') && phase !== 'reset'
  const showMoods = phaseRank(phase) >= phaseRank('moods') && phaseRank(phase) <= phaseRank('press-mood')
  const moodOn = phaseRank(phase) >= phaseRank('press-mood') && phase !== 'reset'
  const blushOn = phaseRank(phase) >= phaseRank('press-blush') && phase !== 'reset'
  const sageOn = phaseRank(phase) >= phaseRank('press-sage') && phase !== 'reset'
  const ivoryOn = phaseRank(phase) >= phaseRank('press-ivory') && phase !== 'reset'
  const cardOn = phaseRank(phase) >= phaseRank('press-card') && phaseRank(phase) <= phaseRank('press-details')
  const showFacts = phaseRank(phase) >= phaseRank('features') && phaseRank(phase) <= phaseRank('press-details')
  const toneOn = (name: string) => name === 'Blush' ? blushOn : name === 'Salvia' ? sageOn : ivoryOn
  const isPressing = phase.startsWith('press-')
  const hideCursor = reducedMotion || phase === 'added' || phase === 'planner' || phase === 'reset'
  const activeItem = phase === 'planner' || phase === 'reset' ? 'Planificador' : 'Categorías'
  const view = browsePhases.has(phase) ? 'browse' : tonePhases.has(phase) ? 'tones' : comparePhases.has(phase) ? 'compare' : detailPhases.has(phase) ? 'detail' : 'planner'

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
    if (phase === 'reset' || phase === 'categories' || phase === 'moods' || phase === 'tones' || phase === 'cards') {
      setCursor(resting)
      return
    }
    if (phase === 'added' || phase === 'planner') return
    const target = phase === 'approach-category' || phase === 'press-category' ? categoryRef.current
      : phase === 'approach-mood' || phase === 'press-mood' ? moodRef.current
        : phase === 'approach-blush' || phase === 'press-blush' ? blushRef.current
          : phase === 'approach-sage' || phase === 'press-sage' ? sageRef.current
            : phase === 'approach-ivory' || phase === 'press-ivory' ? ivoryRef.current
              : phase === 'approach-card' || phase === 'press-card' || phase === 'features' ? cardRef.current
                : phase === 'approach-details' || phase === 'press-details' ? detailsRef.current
                  : phase === 'detail' ? repeatRef.current
                    : phase === 'approach-add' || phase === 'press-add' ? addRef.current
                      : null
    setCursor(pointInStage(stage, target, resting))
  }, [phase, reducedMotion])

  return (
    <div className="quote-demo space-demo color-demo">
      <p className="quote-demo-summary">Demostración con datos ficticios. Se arma una paleta y se agrega a la planificación, sin contratarla.</p>
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
            {view === 'browse' ? (
              <div className="space-view" key="browse">
                <div className="space-cats">
                  {['Flores y decoración', 'Locación', 'Banquetes', 'Mobiliario'].map((item) => (
                    <div className={`space-cat${item === 'Flores y decoración' && categoryOn ? ' is-selected' : ''}${item === 'Flores y decoración' && phase === 'press-category' ? ' is-pressed' : ''}`} key={item} ref={item === 'Flores y decoración' ? categoryRef : undefined}>{item}</div>
                  ))}
                </div>
                {showMoods ? (
                  <div className="space-types">
                    {['Romántica', 'Jardín', 'Moderna'].map((item) => (
                      <div className={`${item === 'Romántica' && moodOn ? 'is-selected' : ''} ${item === 'Romántica' && phase === 'press-mood' ? 'is-pressed' : ''}`} key={item} ref={item === 'Romántica' ? moodRef : undefined}>{item}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {view === 'tones' ? (
              <div className="space-view" key="tones">
                <div className="space-filters">
                  {tones.map((tone) => (
                    <button className={`space-filter${toneOn(tone.name) ? ' is-on' : ''}${phase === `press-${tone.name === 'Blush' ? 'blush' : tone.name === 'Salvia' ? 'sage' : 'ivory'}` ? ' is-pressed' : ''}`} type="button" tabIndex={-1} key={tone.name} ref={tone.name === 'Blush' ? blushRef : tone.name === 'Salvia' ? sageRef : ivoryRef}>
                      <span><span className="palette-dot" style={{ background: tone.hex }} />{tone.name}</span>
                      <b>{toneOn(tone.name) ? 'Elegido' : 'Tono'}</b>
                    </button>
                  ))}
                </div>
                <div className="palette-band palette-build" aria-hidden="true">
                  {tones.map((tone) => <span key={tone.name} style={{ background: tone.hex, opacity: toneOn(tone.name) ? 1 : .28 }} />)}
                </div>
              </div>
            ) : null}
            {view === 'compare' ? (
              <div className="space-view" key="compare">
                <div className="space-cards">
                  {palettes.map((palette) => (
                    <article className={`palette-card${palette.id === 'alba' && cardOn ? ' is-selected' : ''}${palette.id === 'alba' && phase === 'press-card' ? ' is-pressed' : ''}`} key={palette.id} ref={palette.id === 'alba' ? cardRef : undefined}>
                      <Swatches colors={palette.colors} />
                      <div>
                        <strong>{palette.name}</strong>
                        <span>{palette.mood}</span>
                        <small>{palette.colors.map((color) => color.name).join(' · ')}</small>
                        <b>{formatPrice(palette.price)}</b>
                      </div>
                    </article>
                  ))}
                </div>
                {showFacts ? (
                  <div className="space-feature">
                    <strong>{selectedPalette.name}</strong>
                    <ul>
                      <li><span>Tonos</span><b>Blush, salvia y marfil</b></li>
                      <li><span>Se repite en</span><b>Flores, mantel y papelería</b></li>
                      <li><span>Referencia</span><b>{formatPrice(selectedPalette.price)}</b></li>
                    </ul>
                    <button className={`quote-demo-accept${phase === 'press-details' ? ' is-pressed' : ''}`} type="button" tabIndex={-1} ref={detailsRef}>Ver paleta</button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {view === 'detail' ? (
              <div className="space-view" key="detail">
                <article className="quote-demo-card">
                  <Swatches colors={selectedPalette.colors} />
                  <h4>{selectedPalette.name}</h4>
                  <p>Tres tonos, repetidos para que flores, mesa y papelería se sientan de una sola pieza.</p>
                  <ul className="space-facts">
                    <li className="is-lit" ref={repeatRef}><span>Flores</span><b>Blush</b></li>
                    <li className="is-lit"><span>Mantel</span><b>Marfil</b></li>
                    <li className="is-lit"><span>Papelería</span><b>Salvia</b></li>
                    <li className="is-lit"><span>Precio de referencia</span><b>{formatPrice(selectedPalette.price)}</b></li>
                  </ul>
                  <p className="space-disclaimer">Agregar esta paleta a tu evento no contrata el servicio.</p>
                  <button className={`quote-demo-accept${phase === 'press-add' ? ' is-pressed' : ''}`} type="button" tabIndex={-1} ref={addRef}>Agregar a mi evento</button>
                </article>
                <div className={`quote-demo-overlay ${phase === 'added' ? 'is-open' : ''}`}>
                  <div className="quote-demo-dialog">
                    <h4>Paleta agregada a tu planificación</h4>
                    <p>Alba suave queda en el evento Mi boda.</p>
                    <div className="space-budget-change"><span>Anterior <b>$0</b></span><span>Estimado <b>{formatPrice(selectedPalette.price)}</b></span></div>
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
                  <p>La paleta queda guardada en la planificación. Aún no está contratada.</p>
                  <ul className="space-plan">
                    <li>
                      <span className="palette-mini" aria-hidden="true">{selectedPalette.colors.map((color) => <i key={color.name} style={{ background: color.hex }} />)}</span>
                      <div><strong>Alba suave</strong><span>Blush · Salvia · Marfil</span></div>
                      <b>{formatPrice(selectedPalette.price)}</b>
                    </li>
                  </ul>
                  <div className="quote-demo-total"><span>Presupuesto estimado</span><strong>{formatPrice(selectedPalette.price)}</strong></div>
                  <div className="quote-demo-success">
                    <svg className="demo-check" viewBox="0 0 52 52" aria-hidden="true">
                      <circle cx="26" cy="26" r="23" />
                      <path d="M16 27.5 22.5 34 36 19" />
                    </svg>
                    <div>
                      <strong>La paleta ya recorre flores, mesa y papelería.</strong>
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
