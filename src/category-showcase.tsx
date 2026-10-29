import { useEffect, useRef, type MouseEvent } from 'react'
import { beginCategoryTransition } from './category-transition'

export type ShowcaseCategory = {
  slug: string
  title: string
  description: string
  image: string
  href: string
  serviceCount: number
}

const clips = [
  'polygon(12% 0, 100% 0, 88% 100%, 0 100%)',
  'polygon(0 7%, 100% 0, 100% 93%, 0 100%)',
  'polygon(0 0, 100% 8%, 86% 100%, 8% 92%)',
  'polygon(9% 0, 100% 0, 100% 100%, 0 90%)',
  'polygon(0 5%, 92% 0, 100% 95%, 8% 100%)',
  'polygon(6% 0, 100% 6%, 94% 100%, 0 94%)',
  'polygon(0 0, 94% 0, 100% 100%, 8% 100%)',
]

const serviceCountLabel = (count: number) => (count === 1 ? '1 servicio publicado' : `${count} servicios publicados`)

const prefersStaticGallery = () => window.matchMedia('(max-width: 899px)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches

const wheelPixels = (delta: number, mode: number, page: number) => delta * (mode === 1 ? 16 : mode === 2 ? page : 1)

const handleOpen = (event: MouseEvent<HTMLAnchorElement>, category: ShowcaseCategory, clipPath: string, onNavigate: (path: string) => void) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  const frame = event.currentTarget.querySelector<HTMLElement>('.category-frame')
  if (frame && !prefersStaticGallery()) {
    const rect = frame.getBoundingClientRect()
    beginCategoryTransition({
      slug: category.slug,
      title: category.title,
      description: category.description,
      imageUrl: category.image,
      serviceCount: category.serviceCount,
      clipPath,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    })
  }
  onNavigate(category.href)
}

export const CategoryShowcase = ({ categories, isLoading, onNavigate, revealToken = 0 }: { categories: ShowcaseCategory[]; isLoading: boolean; onNavigate: (path: string) => void; revealToken?: number }) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)

  const moveStrip = (next: number) => {
    const viewport = viewportRef.current
    const strip = stripRef.current
    if (!viewport || !strip) return
    const maxOffset = Math.max(0, strip.scrollWidth - viewport.clientWidth)
    const offset = Math.min(maxOffset, Math.max(0, next))
    offsetRef.current = offset
    strip.style.transform = `translate3d(${-offset}px, 0, 0)`
  }

  const handleStep = (direction: number) => {
    const panel = stripRef.current?.querySelector<HTMLElement>('.category-panel')
    const step = panel ? panel.getBoundingClientRect().width + 48 : window.innerWidth * 0.7
    moveStrip(offsetRef.current + direction * step)
  }

  useEffect(() => {
    const root = rootRef.current
    const viewport = viewportRef.current
    const strip = stripRef.current
    if (!root || !viewport || !strip || categories.length === 0) return
    let pointerOrigin = 0
    let offsetOrigin = 0
    let trackingPointer = false
    let dragging = false
    let suppressClick = false
    const placeFromPointer = (clientX: number) => {
      const rect = viewport.getBoundingClientRect()
      const progress = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      moveStrip(progress * Math.max(0, strip.scrollWidth - viewport.clientWidth))
    }
    const handleWheel = (event: WheelEvent) => {
      const horizontal = wheelPixels(event.deltaX, event.deltaMode, window.innerWidth)
      const vertical = wheelPixels(event.deltaY, event.deltaMode, window.innerHeight)
      const sideways = event.shiftKey ? vertical : horizontal
      if (!event.shiftKey && Math.abs(horizontal) <= Math.abs(vertical) * 0.65) return
      if (sideways === 0) return
      event.preventDefault()
      moveStrip(offsetRef.current + sideways)
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      trackingPointer = true
      dragging = false
      pointerOrigin = event.clientX
      offsetOrigin = offsetRef.current
    }
    const handlePointerMove = (event: PointerEvent) => {
      if (!trackingPointer) {
        if (event.pointerType !== 'mouse') return
        placeFromPointer(event.clientX)
        return
      }
      const delta = event.clientX - pointerOrigin
      if (!dragging && Math.abs(delta) < 6) return
      if (!dragging) viewport.setPointerCapture(event.pointerId)
      dragging = true
      root.classList.add('is-dragging')
      moveStrip(offsetOrigin - delta)
    }
    const handlePointerEnd = () => {
      if (!trackingPointer) return
      trackingPointer = false
      root.classList.remove('is-dragging')
      if (!dragging) return
      suppressClick = true
      dragging = false
    }
    const handleClickCapture = (event: MouseEvent) => {
      if (!suppressClick) return
      suppressClick = false
      event.preventDefault()
      event.stopPropagation()
    }
    const handleResize = () => moveStrip(offsetRef.current)
    viewport.addEventListener('wheel', handleWheel, { passive: false })
    viewport.addEventListener('pointerdown', handlePointerDown)
    viewport.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
    root.addEventListener('click', handleClickCapture, true)
    window.addEventListener('resize', handleResize)
    return () => {
      viewport.removeEventListener('wheel', handleWheel)
      viewport.removeEventListener('pointerdown', handlePointerDown)
      viewport.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
      root.removeEventListener('click', handleClickCapture, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [categories.length])

  useEffect(() => {
    if (revealToken === 0) return
    moveStrip(0)
  }, [revealToken])

  return (
    <div className="category-pin" ref={rootRef} aria-busy={isLoading}>
      {isLoading ? <p className="category-rail-empty">Cargando categorías…</p> : null}
      {!isLoading && categories.length === 0 ? <p className="category-rail-empty">No se pudieron cargar las categorías.</p> : null}
      {categories.length > 1 ? <button className="category-nav prev" type="button" aria-label="Categoría anterior" onClick={() => handleStep(-1)}>‹</button> : null}
      <div className="category-track" ref={viewportRef}>
        <div className="category-strip" ref={stripRef}>
        {categories.map((category, index) => (
          <a
            className="category-panel"
            href={category.href}
            key={category.slug}
            style={{ ['--clip' as string]: clips[index % clips.length] }}
            onClick={(event) => handleOpen(event, category, clips[index % clips.length], onNavigate)}
          >
            <span className="category-frame">
              <img src={category.image} alt="" />
            </span>
            <div className="category-copy">
              <div className="category-reveal">
                {category.serviceCount > 0 ? <span className="eyebrow violet">{serviceCountLabel(category.serviceCount)}</span> : null}
                <h3>{category.title}</h3>
              </div>
              <p className="category-reveal">{category.description}</p>
              <span className="category-reveal category-explore">Explorar categoría</span>
            </div>
          </a>
        ))}
        </div>
      </div>
      {categories.length > 1 ? <button className="category-nav next" type="button" aria-label="Siguiente categoría" onClick={() => handleStep(1)}>›</button> : null}
    </div>
  )
}
