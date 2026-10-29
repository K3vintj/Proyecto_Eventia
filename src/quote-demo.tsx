import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Logo } from './logo'

type Scene = 'quote' | 'approach' | 'press' | 'modal' | 'confirm' | 'processing' | 'success' | 'reset'

type Point = { x: number; y: number }

const beats: { scene: Scene; ms: number }[] = [
  { scene: 'quote', ms: 2800 },
  { scene: 'approach', ms: 1600 },
  { scene: 'press', ms: 500 },
  { scene: 'modal', ms: 1800 },
  { scene: 'confirm', ms: 450 },
  { scene: 'processing', ms: 1800 },
  { scene: 'success', ms: 4200 },
  { scene: 'reset', ms: 900 },
]

const sideItems = ['Marketplace', 'Mis eventos', 'Planificador', 'Cotizaciones', 'Contrataciones']

const quoteLines = [
  ['Ambientación de ceremonia', '$6,400'],
  ['Centros de mesa · 14', '$8,500'],
  ['Ramo y detalles', '$4,000'],
]

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
    x: box.left - stageBox.left + box.width * 0.55,
    y: box.top - stageBox.top + box.height * 0.62,
  }
}

export const QuoteDemo = () => {
  const stageRef = useRef<HTMLDivElement>(null)
  const acceptRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [index, setIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [cursor, setCursor] = useState<Point>({ x: 36, y: 280 })
  const scene: Scene = reducedMotion ? 'success' : beats[index]?.scene ?? 'quote'
  const showOverlay = scene === 'modal' || scene === 'confirm' || scene === 'processing'
  const isContracted = scene === 'success'
  const hideCursor = reducedMotion || scene === 'processing' || scene === 'success' || scene === 'reset'
  const isPressing = scene === 'press' || scene === 'confirm'

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
    if (!isVisible || reducedMotion) return
    const beat = beats[index]
    if (!beat) return
    let timer = 0
    const onScreen = () => {
      const stage = stageRef.current
      if (!stage) return false
      const box = stage.getBoundingClientRect()
      const viewport = window.innerHeight || document.documentElement.clientHeight
      const visible = Math.min(box.bottom, viewport) - Math.max(box.top, 0)
      return visible > Math.min(box.height, viewport) * 0.35
    }
    const advance = () => setIndex((current) => (current + 1) % beats.length)
    const scheduleBeat = () => {
      timer = window.setTimeout(() => {
        if (!onScreen()) {
          waitUntilVisible()
          return
        }
        advance()
      }, beat.ms)
    }
    const waitUntilVisible = () => {
      timer = window.setTimeout(() => {
        if (onScreen()) {
          scheduleBeat()
          return
        }
        waitUntilVisible()
      }, 400)
    }
    if (onScreen()) scheduleBeat()
    else waitUntilVisible()
    return () => window.clearTimeout(timer)
  }, [index, isVisible, reducedMotion])

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage || reducedMotion) return
    const resting = { x: Math.max(24, stage.clientWidth - 40), y: Math.max(96, stage.clientHeight - 36) }
    if (scene === 'quote' || scene === 'reset') {
      setCursor(resting)
      return
    }
    if (scene === 'approach' || scene === 'press') {
      setCursor(pointInStage(stage, acceptRef.current, { x: 220, y: 320 }))
      return
    }
    if (scene === 'modal' || scene === 'confirm') {
      setCursor(pointInStage(stage, confirmRef.current, { x: 250, y: 260 }))
    }
  }, [scene, reducedMotion])

  return (
    <div className="quote-demo">
      <p className="quote-demo-summary">Demostración con datos ficticios. Una cotización de Magnolia Floral se acepta y la contratación queda registrada.</p>
      <div className={`quote-demo-stage ${scene === 'reset' ? 'is-resetting' : ''}`} ref={stageRef} data-scene={scene} inert>
        <aside className="quote-demo-side">
          <Logo />
          <div className="quote-demo-nav">
            {sideItems.map((item) => (
              <div className={item === 'Cotizaciones' ? 'is-active' : ''} key={item}>{item}</div>
            ))}
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
            <article className="quote-demo-card">
              <div className="quote-demo-card-head">
                <span className={`quote-demo-badge ${isContracted ? 'is-contracted' : ''}`}>{isContracted ? 'Contratado' : 'Recibida'}</span>
                <small>Propuesta #EV-2408</small>
              </div>
              <h4>Diseño floral integral</h4>
              <p>Magnolia Floral · Boda del 24 de agosto · Hacienda Los Olivos</p>
              <ul>
                {quoteLines.map(([label, price]) => (
                  <li key={label}><span>{label}</span><b>{price}</b></li>
                ))}
              </ul>
              <div className="quote-demo-total"><span>Total estimado</span><strong>$18,900</strong></div>
              {isContracted ? (
                <div className="quote-demo-success">
                  <svg className="demo-check" viewBox="0 0 52 52" aria-hidden="true">
                    <circle cx="26" cy="26" r="23" />
                    <path d="M16 27.5 22.5 34 36 19" />
                  </svg>
                  <div>
                    <strong>¡Tu evento está un paso más cerca!</strong>
                    <span>Tu cotización fue aceptada y tu contratación quedó registrada</span>
                  </div>
                </div>
              ) : (
                <button className={`quote-demo-accept ${scene === 'press' ? 'is-pressed' : ''}`} type="button" tabIndex={-1} ref={acceptRef}>Aceptar cotización</button>
              )}
            </article>
            <div className={`quote-demo-overlay ${showOverlay ? 'is-open' : ''}`}>
              {scene === 'processing' ? (
                <div className="quote-demo-dialog">
                  <span className="demo-spinner" aria-hidden="true" />
                  <p>Confirmando tu contratación...</p>
                </div>
              ) : (
                <div className="quote-demo-dialog">
                  <h4>¿Confirmas esta contratación?</h4>
                  <p>Diseño floral integral · Magnolia Floral · $18,900</p>
                  <div className="quote-demo-dialog-actions">
                    <button type="button" tabIndex={-1}>Cancelar</button>
                    <button className={scene === 'confirm' ? 'is-pressed' : ''} type="button" tabIndex={-1} ref={confirmRef}>Confirmar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className={`demo-cursor ${scene === 'reset' ? 'is-instant' : ''} ${isPressing ? 'is-pressing' : ''} ${hideCursor ? 'is-hidden' : ''}`} style={{ left: cursor.x, top: cursor.y }} aria-hidden="true">
          <CursorMark />
        </div>
      </div>
    </div>
  )
}
