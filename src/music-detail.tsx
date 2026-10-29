import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { setLoginNotice } from './auth-api'
import { CatalogError, formatPrice } from './catalog-api'
import {
  createEvent,
  estimateMusic,
  fetchEvents,
  fetchMusic,
  isDirectVideo,
  moneyLabel,
  saveMusic,
  videoEmbedUrl,
  type ClientEvent,
  type MusicService,
  type MusicTrack,
  type MusicVideo,
} from './music-api'
import { preferEventId, writeActiveEventId } from './venue-api'
import { safeCategoryReturn } from './navigation'
import type { SessionUser } from './session'
import { Dialog } from './venue-detail'

type MusicAction = 'planificador' | 'cotizacion' | ''

const missing = (value: string) => value.trim() || 'Sin registrar'

const readAction = (): MusicAction => {
  const action = new URLSearchParams(window.location.search).get('accion')
  return action === 'planificador' || action === 'cotizacion' ? action : ''
}

const formatClock = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const mins = Math.floor(total / 60)
  const secs = String(total % 60).padStart(2, '0')
  return `${mins}:${secs}`
}

const DemoPlayer = ({ tracks }: { tracks: MusicTrack[] }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [trackId, setTrackId] = useState(tracks[0]?.id || 0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [error, setError] = useState('')
  const track = tracks.find((item) => item.id === trackId) || tracks[0]

  useEffect(() => {
    if (!tracks.length) return
    if (!tracks.some((item) => item.id === trackId)) setTrackId(tracks[0].id)
  }, [tracks, trackId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track) return
    audio.pause()
    setIsPlaying(false)
    setCurrent(0)
    setDuration(track.durationSeconds || 0)
    setError('')
    setIsLoading(true)
    audio.src = track.audioUrl
    audio.load()
  }, [track?.id, track?.audioUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = volume
  }, [volume])

  if (!tracks.length || !track) {
    return <p>Este proveedor todavía no publica demostraciones de audio.</p>
  }

  const handlePlay = async () => {
    const audio = audioRef.current
    if (!audio) return
    setError('')
    try {
      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
        return
      }
      setIsLoading(true)
      await audio.play()
      setIsPlaying(true)
    } catch {
      setError('No se pudo reproducir esta demostración.')
      setIsPlaying(false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="music-player">
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={() => {
          const audio = audioRef.current
          setDuration(audio?.duration || track.durationSeconds || 0)
          setIsLoading(false)
        }}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime || 0)}
        onEnded={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false)
          setIsPlaying(false)
          setError('No se pudo cargar el audio.')
        }}
      />
      <div className="music-player-main">
        <button className="search-button compact" type="button" aria-label={isPlaying ? 'Pausar demostración' : 'Reproducir demostración'} onClick={() => void handlePlay()}>
          {isLoading ? 'Cargando…' : isPlaying ? 'Pausar' : 'Reproducir'}
        </button>
        <div>
          <strong>{track.title}</strong>
          <p aria-live="polite">{formatClock(current)} / {formatClock(duration || track.durationSeconds || 0)}</p>
        </div>
      </div>
      <label className="music-progress">
        <span className="visually-hidden">Progreso de la demostración</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(duration || track.durationSeconds || 1))}
          value={Math.floor(current)}
          aria-valuetext={`${formatClock(current)} de ${formatClock(duration || track.durationSeconds || 0)}`}
          onChange={(event) => {
            const audio = audioRef.current
            const next = Number(event.target.value)
            if (audio) audio.currentTime = next
            setCurrent(next)
          }}
        />
      </label>
      <label className="music-volume">
        Volumen
        <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
      </label>
      <div className="banquet-menu" role="listbox" aria-label="Demostraciones musicales">
        {tracks.map((item) => (
          <button className={item.id === track.id ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-selected={item.id === track.id} key={item.id} onClick={() => setTrackId(item.id)}>
            {item.title}
          </button>
        ))}
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  )
}

const VideoShelf = ({ videos }: { videos: MusicVideo[] }) => {
  const [activeId, setActiveId] = useState<number | null>(null)
  if (!videos.length) return <p>Este proveedor todavía no publica videos de presentaciones.</p>
  const active = videos.find((item) => item.id === activeId) || null
  const embed = active ? videoEmbedUrl(active.videoUrl) : null
  return (
    <div className="music-videos">
      <div className="banquet-grid">
        {videos.map((item) => (
          <button className={item.id === activeId ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={item.id === activeId} key={item.id} onClick={() => setActiveId(item.id === activeId ? null : item.id)}>
            {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : null}
            <strong>{item.title}</strong>
            {item.description ? <span>{item.description}</span> : null}
          </button>
        ))}
      </div>
      {active ? (
        <div className="music-video-stage">
          {embed ? (
            <iframe title={active.title} src={embed} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          ) : isDirectVideo(active.videoUrl) ? (
            <video controls preload="metadata" src={active.videoUrl}>
              Tu navegador no puede reproducir este video.
            </video>
          ) : (
            <p>
              Video disponible en enlace autorizado:{' '}
              <a href={active.videoUrl} target="_blank" rel="noreferrer noopener">{active.title}</a>
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

export const MusicDetail = ({ serviceId, session, onNavigate }: { serviceId: number; session: SessionUser | null; onNavigate: (path: string) => void }) => {
  const [categoryTitle, setCategoryTitle] = useState('')
  const [categoryImage, setCategoryImage] = useState('')
  const [service, setService] = useState<MusicService | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isUnpublished, setIsUnpublished] = useState(false)
  const [tag, setTag] = useState('')
  const [photoIndex, setPhotoIndex] = useState(0)
  const [imageReady, setImageReady] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [isZoomed, setIsZoomed] = useState(false)
  const [packageId, setPackageId] = useState<number | null>(null)
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null)
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [preferredGenres, setPreferredGenres] = useState('')
  const [songRequests, setSongRequests] = useState('')
  const [moments, setMoments] = useState('')
  const [genreFilter, setGenreFilter] = useState('')
  const [events, setEvents] = useState<ClientEvent[]>([])
  const [eventId, setEventId] = useState('')
  const [guestsEdited, setGuestsEdited] = useState(false)
  const [guests, setGuests] = useState('')
  const [action, setAction] = useState<MusicAction>('')
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
    fetchMusic(serviceId)
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
        setLoadError(catalogError?.status === 404 ? 'No encontramos ese servicio musical.' : catalogError?.message || 'No se pudo cargar el servicio musical.')
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [serviceId])

  useEffect(() => {
    if (session?.role !== 'cliente') return
    fetchEvents().then((result) => setEvents(result.events)).catch(() => setEvents([]))
  }, [session])

  const photos = useMemo(() => {
    const own = (service?.music.images || []).filter((image) => !tag || image.tag === tag)
    if (own.length > 0) return own
    return categoryImage ? [{ id: 0, url: categoryImage, alt: `Imagen de respaldo de la categoría ${categoryTitle}`, tag: '' }] : []
  }, [categoryImage, categoryTitle, service, tag])
  const photo = photos[photoIndex] || photos[0]
  const isFallback = Boolean(service && service.music.images.length === 0)
  const tags = [...new Set((service?.music.images || []).map((image) => image.tag).filter(Boolean))]
  const selectedEvent = events.find((item) => String(item.id) === eventId) || null
  const estimate = service ? estimateMusic(service, { packageId, durationMinutes, quantities }) : { cents: null, pending: true, error: '' }
  const estimateText = estimate.cents === null ? 'Sujeto a cotización' : formatPrice(estimate.cents)

  const chooseEvent = (id: string) => {
    setEventId(id)
    const chosen = events.find((item) => String(item.id) === id)
    if (!guestsEdited && guests === '' && chosen?.guestCount) setGuests(String(chosen.guestCount))
  }

  const askLogin = (nextAction: MusicAction) => {
    const next = safeCategoryReturn(`/categorias/musica/servicios/${serviceId}?accion=${nextAction}`)
    setLoginNotice('Inicia sesión con una cuenta de cliente para continuar con este servicio musical.')
    onNavigate(`/ingresar?next=${encodeURIComponent(next || `/categorias/musica/servicios/${serviceId}`)}`)
  }

  const openAction = async (nextAction: Exclude<MusicAction, ''>) => {
    setFormError('')
    setConfirmation('')
    if (!session) return askLogin(nextAction)
    if (session.role !== 'cliente') {
      setFormError('Solo una cuenta de cliente puede agregar música o solicitar cotizaciones.')
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
    const selected = service?.music.packages.find((item) => item.id === next) || null
    setDurationMinutes(selected?.durations[0] ?? null)
  }

  const toggleAddon = (id: number) => {
    setQuantities((current) => {
      if (current[id]) {
        const next = { ...current }
        delete next[id]
        return next
      }
      return { ...current, [id]: 1 }
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
      const result = await saveMusic(action === 'cotizacion' ? 'quote' : 'planner', service.id, {
        eventId: Number(eventId),
        packageId,
        durationMinutes,
        preferredGenres,
        songRequests,
        moments,
        guests: guests || null,
        addons: Object.entries(quantities).map(([id, quantity]) => ({ id: Number(id), quantity })),
        notes,
        eventTime: eventTime || '',
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
        ? 'La solicitud quedó registrada para el proveedor. Pedir cotización no contrata el servicio musical.'
        : `La música quedó en la planificación del evento. Agregarla no la contrata.${budget}`)
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
        <p className="venue-loading">Cargando el servicio musical…</p>
        <div className="decor-layout">
          <div className="venue-skeleton venue-skeleton-hero" />
          <div className="venue-skeleton venue-skeleton-block" />
        </div>
      </div>
    )
  }
  if (isUnpublished) return <section className="category-empty"><h1>Servicio musical no disponible</h1><p>Esta publicación está desactivada y no se puede consultar.</p></section>
  if (loadError || !service || !photo) return <section className="category-empty"><h1>No se pudo abrir el servicio musical</h1><p role="alert">{loadError || 'No encontramos ese servicio musical.'}</p></section>

  const music = service.music
  const selectedPackage = music.packages.find((item) => item.id === packageId) || null
  const selectedAddons = music.addons.filter((item) => quantities[item.id])
  const displayName = music.artistName || service.provider.businessName
  const coverage = music.coverageArea || service.provider.city
  const tech = music.technical
  const hasTech = Object.values(tech).some((value) => value.trim())
  const repertoire = music.repertoire.filter((item) => !genreFilter || item.genre === genreFilter)

  return (
    <article className="venue-page">
      <div className="decor-layout">
        <div className="venue-copy">
          <section className="venue-gallery" aria-label="Portada del artista">
            <div className="venue-stage">
              {!imageReady && !imageFailed ? <div className="venue-skeleton venue-skeleton-hero" /> : null}
              {imageFailed ? <p className="venue-note">No se pudo cargar la fotografía.</p> : <img src={photo.url} alt={photo.alt || displayName} onLoad={() => setImageReady(true)} onError={() => { setImageReady(true); setImageFailed(true) }} />}
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
          <h1>{displayName}</h1>
          <p className="venue-lead">{[music.serviceType, service.title !== displayName ? service.title : ''].filter(Boolean).join(' · ') || missing(music.serviceType)}</p>
          <p>{music.presentation || service.description || 'Sin presentación.'}</p>
          <dl className="venue-facts">
            <div><dt>Tipo de servicio</dt><dd>{missing(music.serviceType)}</dd></div>
            <div><dt>Géneros</dt><dd>{music.genres.length ? music.genres.map((item) => item.name).join(', ') : 'Sin registrar'}</dd></div>
            <div><dt>Cobertura</dt><dd>{missing(coverage)}</dd></div>
            <div><dt>Precio de referencia</dt><dd>{moneyLabel(music.priceMode, service.priceCents)}</dd></div>
          </dl>
          <section className="venue-provider" aria-labelledby="music-provider">
            <h2 id="music-provider">Proveedor</h2>
            <div className="venue-provider-card">
              <span className="venue-mark" aria-hidden="true">{service.provider.businessName.trim().charAt(0).toUpperCase() || 'M'}</span>
              <div>
                <strong>{service.provider.businessName}</strong>
                <p>{service.provider.description || 'Este negocio todavía no escribe una descripción.'}</p>
                <a className="outline-button compact" href={`/negocios/${service.providerId}`} onClick={(event) => { event.preventDefault(); onNavigate(`/negocios/${service.providerId}`) }}>Ver perfil del proveedor</a>
              </div>
            </div>
          </section>
          <section className="venue-block" aria-labelledby="music-demos">
            <h2 id="music-demos">Demostraciones</h2>
            <DemoPlayer tracks={music.tracks} />
          </section>
          <section className="venue-block" aria-labelledby="music-videos">
            <h2 id="music-videos">Videos de presentaciones</h2>
            <VideoShelf videos={music.videos} />
          </section>
          <section className="venue-block" aria-labelledby="music-genres">
            <h2 id="music-genres">Géneros musicales</h2>
            {music.genres.length === 0 ? <p>Este proveedor todavía no publica géneros.</p> : (
              <div className="banquet-grid">
                {music.genres.map((item) => (
                  <div className="banquet-choice" key={item.id}>
                    <strong>{item.name}</strong>
                    {item.description ? <span>{item.description}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="venue-block" aria-labelledby="music-repertoire">
            <h2 id="music-repertoire">Repertorio</h2>
            {music.repertoire.length === 0 ? <p>Este proveedor todavía no publica repertorio.</p> : (
              <>
                {[...new Set(music.repertoire.map((item) => item.genre).filter(Boolean))].length > 0 ? (
                  <div className="banquet-menu" role="group" aria-label="Filtrar repertorio por género">
                    <button className={genreFilter === '' ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={genreFilter === ''} onClick={() => setGenreFilter('')}>Todos</button>
                    {[...new Set(music.repertoire.map((item) => item.genre).filter(Boolean))].map((item) => (
                      <button className={genreFilter === item ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={genreFilter === item} key={item} onClick={() => setGenreFilter(item)}>{item}</button>
                    ))}
                  </div>
                ) : null}
                <ul className="banquet-menu">
                  {repertoire.map((item) => (
                    <li key={item.id}>
                      <strong>{item.title}</strong>
                      {item.genre ? <span> · {item.genre}</span> : null}
                      {item.notes ? <small> · {item.notes}</small> : null}
                    </li>
                  ))}
                </ul>
                <p>Las piezas listadas son las publicadas por el proveedor. Pedir una canción no garantiza su interpretación.</p>
              </>
            )}
          </section>
          <section className="venue-block" aria-labelledby="music-event">
            <h2 id="music-event">Evento</h2>
            {session?.role === 'cliente' ? (
              events.length > 0 ? (
                <>
                  <label htmlFor="music-event-select">Evento</label>
                  <select id="music-event-select" value={eventId} onChange={(event) => chooseEvent(event.target.value)}>
                    <option value="">Sin elegir</option>
                    {events.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                  </select>
                  <p>{selectedEvent ? `${selectedEvent.eventType || 'Sin tipo registrado'} · ${selectedEvent.eventDate || 'Sin fecha'} · ${selectedEvent.guestCount ? `${selectedEvent.guestCount.toLocaleString('es-MX')} invitados` : 'Sin invitados'}` : 'Elige un evento para usar su fecha e invitados.'}</p>
                </>
              ) : <p>Todavía no tienes eventos. Puedes crear uno al agregar el servicio.</p>
            ) : <p>Al iniciar sesión podrás vincular este servicio a uno de tus eventos.</p>}
          </section>
          <section className="venue-block" aria-labelledby="music-packages">
            <h2 id="music-packages">Paquetes</h2>
            {music.packages.length === 0 ? <p>No hay paquetes publicados. Puedes solicitar una presentación personalizada.</p> : (
              <div className="banquet-grid">
                {music.packages.map((item) => (
                  <button className={item.id === packageId ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={item.id === packageId} key={item.id} onClick={() => choosePackage(item.id)}>
                    <strong>{item.name}</strong>
                    {item.description ? <span>{item.description}</span> : null}
                    <b>{moneyLabel(item.priceUnit, item.priceCents)}</b>
                    {item.durations.length ? <small>Duraciones: {item.durations.map((minutes) => `${minutes} min`).join(', ')}</small> : null}
                    {item.memberCount ? <small>Integrantes: {item.memberCount}</small> : null}
                    {item.presentationType ? <small>{item.presentationType}</small> : null}
                    {item.equipmentIncluded ? <small>Equipo: {item.equipmentIncluded}</small> : null}
                    {item.conditions ? <small>{item.conditions}</small> : null}
                    {item.extras ? <small>{item.extras}</small> : null}
                  </button>
                ))}
              </div>
            )}
          </section>
          {selectedPackage?.durations.length ? (
            <section className="venue-block" aria-labelledby="music-duration">
              <h2 id="music-duration">Duración</h2>
              <div className="banquet-menu" role="group" aria-label="Duraciones disponibles">
                {selectedPackage.durations.map((minutes) => (
                  <button className={durationMinutes === minutes ? 'banquet-choice is-selected' : 'banquet-choice'} type="button" aria-pressed={durationMinutes === minutes} key={minutes} onClick={() => setDurationMinutes(minutes)}>
                    {minutes} minutos
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          <section className="venue-block" aria-labelledby="music-prefs">
            <h2 id="music-prefs">Preferencias musicales</h2>
            <label htmlFor="music-pref-genres">Géneros preferidos</label>
            <input id="music-pref-genres" value={preferredGenres} maxLength={200} onChange={(event) => setPreferredGenres(event.target.value)} />
            <label htmlFor="music-pref-songs">Canciones especiales</label>
            <textarea id="music-pref-songs" maxLength={500} value={songRequests} onChange={(event) => setSongRequests(event.target.value)} />
            <label htmlFor="music-pref-moments">Momentos importantes</label>
            <textarea id="music-pref-moments" maxLength={500} value={moments} onChange={(event) => setMoments(event.target.value)} />
            <p>Estas preferencias se envían al proveedor. No confirman repertorio ni disponibilidad.</p>
          </section>
          <section className="venue-block" aria-labelledby="music-addons">
            <h2 id="music-addons">Complementos</h2>
            {music.addons.length === 0 ? <p>Este proveedor no publicó complementos.</p> : (
              <ul className="banquet-menu">
                {music.addons.map((item) => (
                  <li key={item.id}>
                    <label>
                      <input type="checkbox" checked={Boolean(quantities[item.id])} onChange={() => toggleAddon(item.id)} />
                      <span><strong>{item.name}</strong> · {moneyLabel(item.priceUnit, item.priceCents)}{item.description ? ` · ${item.description}` : ''}</span>
                    </label>
                    {quantities[item.id] && item.priceUnit === 'unidad' ? (
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
          <section className="venue-block" aria-labelledby="music-tech">
            <h2 id="music-tech">Requerimientos técnicos</h2>
            {!hasTech ? <p>Este proveedor todavía no registra requerimientos técnicos.</p> : (
              <dl className="venue-facts">
                <div><dt>Espacio mínimo</dt><dd>{missing(tech.minSpace)}</dd></div>
                <div><dt>Requerimientos eléctricos</dt><dd>{missing(tech.electricalRequirements)}</dd></div>
                <div><dt>Escenario</dt><dd>{missing(tech.needsStage)}</dd></div>
                <div><dt>Sonido incluido</dt><dd>{missing(tech.soundIncluded)}</dd></div>
                <div><dt>Iluminación incluida</dt><dd>{missing(tech.lightingIncluded)}</dd></div>
                <div><dt>Montaje</dt><dd>{missing(tech.setupTime)}</dd></div>
                <div><dt>Desmontaje</dt><dd>{missing(tech.teardownTime)}</dd></div>
                <div><dt>Acceso</dt><dd>{missing(tech.accessRequirements)}</dd></div>
                <div><dt>Restricciones</dt><dd>{missing(tech.restrictions)}</dd></div>
                <div><dt>Traslado</dt><dd>{missing(tech.travelNotes)}</dd></div>
              </dl>
            )}
          </section>
        </div>
        <aside className="venue-price" aria-label="Resumen del servicio musical">
          <span>Presupuesto estimado</span>
          <strong>{estimateText}</strong>
          {estimate.pending ? <p>Hay conceptos sujetos a cotización. El importe no es definitivo.</p> : null}
          <p>El costo mostrado es una estimación. El precio final será definido mediante la cotización del proveedor.</p>
          <dl className="venue-facts">
            <div><dt>Paquete</dt><dd>{selectedPackage?.name || 'Presentación personalizada'}</dd></div>
            <div><dt>Duración</dt><dd>{durationMinutes ? `${durationMinutes} min` : 'Sin elegir'}</dd></div>
            <div><dt>Horario solicitado</dt><dd>{eventTime || 'Sin indicar'}</dd></div>
            <div><dt>Preferencias</dt><dd>{[preferredGenres, songRequests, moments].filter(Boolean).join(' · ') || 'Sin indicar'}</dd></div>
            <div><dt>Complementos</dt><dd>{selectedAddons.length ? selectedAddons.map((item) => quantities[item.id] > 1 ? `${item.name} × ${quantities[item.id]}` : item.name).join(', ') : 'Sin elegir'}</dd></div>
          </dl>
          <label htmlFor="music-time">Horario de presentación</label>
          <input id="music-time" type="time" value={eventTime} onChange={(event) => setEventTime(event.target.value)} />
          <label htmlFor="music-guests">Número de invitados</label>
          <input id="music-guests" inputMode="numeric" value={guests} onChange={(event) => { setGuestsEdited(true); setGuests(event.target.value) }} />
          {estimate.error ? <p role="alert">{estimate.error}</p> : null}
          <button className="search-button" type="button" onClick={() => void openAction('planificador')}>Agregar a mi evento</button>
          <button className="outline-button" type="button" onClick={() => void openAction('cotizacion')}>Solicitar cotización</button>
          {formError && !action ? <p role="alert">{formError}</p> : null}
        </aside>
      </div>
      {isZoomed && !imageFailed ? <Dialog title={displayName} onClose={() => setIsZoomed(false)}><img className="venue-zoom" src={photo.url} alt={photo.alt || displayName} /></Dialog> : null}
      {action ? (
        <Dialog title={action === 'cotizacion' ? 'Solicitar cotización' : 'Agregar a mi evento'} onClose={() => { setAction(''); setConfirmation(''); setFormError('') }}>
          <p className="venue-note">{displayName} · {selectedPackage?.name || 'Personalizada'} · {estimateText}</p>
          {confirmation ? (
            <div>
              <p role="status">{confirmation}</p>
              <a className="search-button" href={action === 'cotizacion' ? '/cotizaciones' : '/planificador'} onClick={(event) => { event.preventDefault(); onNavigate(action === 'cotizacion' ? '/cotizaciones' : '/planificador') }}>{action === 'cotizacion' ? 'Ver solicitudes' : 'Ver planificación'}</a>
            </div>
          ) : null}
          {!confirmation && session?.role === 'cliente' && isCreating ? (
            <form className="venue-form" onSubmit={handleCreateEvent}>
              <p>{events.length === 0 ? 'Todavía no tienes eventos. Crea el primero para continuar.' : 'Crea un evento nuevo para continuar.'}</p>
              <label htmlFor="music-new-name">Nombre del evento</label>
              <input id="music-new-name" value={eventName} onChange={(event) => setEventName(event.target.value)} required />
              <label htmlFor="music-new-type">Tipo de celebración</label>
              <input id="music-new-type" value={eventType} onChange={(event) => setEventType(event.target.value)} />
              <label htmlFor="music-new-date">Fecha</label>
              <input id="music-new-date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
              <label htmlFor="music-new-guests">Número de invitados</label>
              <input id="music-new-guests" inputMode="numeric" value={newGuests} onChange={(event) => setNewGuests(event.target.value)} />
              {formError ? <p role="alert">{formError}</p> : null}
              <button className="search-button" type="submit" disabled={isSaving}>{isSaving ? 'Creando…' : events.length === 0 ? 'Crear mi primer evento' : 'Crear evento'}</button>
            </form>
          ) : null}
          {!confirmation && session?.role === 'cliente' && !isCreating ? (
            <form className="venue-form" onSubmit={(event) => { event.preventDefault(); void handleConfirm() }}>
              <label htmlFor="music-modal-event">Evento</label>
              <select id="music-modal-event" value={eventId} onChange={(event) => chooseEvent(event.target.value)}>
                {events.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
              <p>Resumen: {selectedPackage?.name || 'Personalizada'} · {durationMinutes ? `${durationMinutes} min` : 'Sin duración'} · {eventTime || 'Sin horario'} · {estimateText}</p>
              {selectedEvent ? <p>{selectedEvent.eventType || 'Sin tipo registrado'} · {selectedEvent.eventDate || 'Sin fecha'}</p> : null}
              {action === 'cotizacion' ? (
                <>
                  <label htmlFor="music-place">Lugar del evento</label>
                  <input id="music-place" value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} />
                  <label htmlFor="music-notes">Observaciones</label>
                  <textarea id="music-notes" maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
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
