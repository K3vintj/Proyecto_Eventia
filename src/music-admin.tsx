import { CatalogError } from './catalog-api'
import {
  addMusicAddon,
  addMusicGenre,
  addMusicImage,
  addMusicPackage,
  addMusicRepertoire,
  addMusicTrack,
  addMusicVideo,
  moneyLabel,
  removeMusicAddon,
  removeMusicGenre,
  removeMusicPackage,
  removeMusicRepertoire,
  removeMusicTrack,
  removeMusicVideo,
  saveOwnMusic,
  type MusicInfo,
} from './music-api'

type Props = {
  serviceId: number
  title: string
  description: string
  priceCents: number | null
  isPublished: boolean
  music: MusicInfo
  onRefresh: () => Promise<void>
  onError: (value: string) => void
}

const pesos = (cents: number | null) => (cents === null ? '' : String(cents / 100))

export const MusicAdmin = ({ serviceId, title, description, priceCents, isPublished, music, onRefresh, onError }: Props) => {
  const run = async (work: () => Promise<unknown>) => {
    try {
      await work()
      await onRefresh()
    } catch (reason: unknown) {
      onError(reason instanceof CatalogError ? reason.message : 'No se pudo guardar el cambio.')
    }
  }

  return (
    <div className="venue-block">
      <h3>Música y entretenimiento</h3>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => saveOwnMusic(serviceId, {
          title: String(form.get('title') || ''),
          description: String(form.get('description') || ''),
          artistName: String(form.get('artistName') || ''),
          serviceType: String(form.get('serviceType') || ''),
          coverageArea: String(form.get('coverage') || ''),
          presentation: String(form.get('presentation') || ''),
          priceCents: String(form.get('price') || ''),
          priceMode: String(form.get('priceMode') || ''),
          isPublished: form.get('published') === 'on',
          minSpace: String(form.get('minSpace') || ''),
          electricalRequirements: String(form.get('electrical') || ''),
          needsStage: String(form.get('stage') || ''),
          soundIncluded: String(form.get('sound') || ''),
          lightingIncluded: String(form.get('lighting') || ''),
          setupTime: String(form.get('setup') || ''),
          teardownTime: String(form.get('teardown') || ''),
          accessRequirements: String(form.get('access') || ''),
          restrictions: String(form.get('restrictions') || ''),
          travelNotes: String(form.get('travel') || ''),
        }))
      }}>
        <label htmlFor="music-title">Nombre del servicio</label>
        <input id="music-title" name="title" defaultValue={title} required />
        <label htmlFor="music-artist">Nombre artístico</label>
        <input id="music-artist" name="artistName" defaultValue={music.artistName} />
        <label htmlFor="music-type">Tipo de servicio</label>
        <input id="music-type" name="serviceType" defaultValue={music.serviceType} placeholder="Grupo, DJ, Solista…" />
        <label htmlFor="music-description">Descripción</label>
        <textarea id="music-description" name="description" defaultValue={description} />
        <label htmlFor="music-presentation">Presentación</label>
        <textarea id="music-presentation" name="presentation" defaultValue={music.presentation} />
        <label htmlFor="music-coverage">Cobertura</label>
        <input id="music-coverage" name="coverage" defaultValue={music.coverageArea} />
        <label htmlFor="music-price">Precio de referencia en pesos</label>
        <input id="music-price" name="price" inputMode="numeric" defaultValue={pesos(priceCents)} />
        <label htmlFor="music-mode">Modalidad</label>
        <select id="music-mode" name="priceMode" defaultValue={music.priceMode}>
          <option value="">Sin registrar</option>
          <option value="cotizacion">Sujeto a cotización</option>
          <option value="desde">Desde</option>
          <option value="fijo">Precio fijo</option>
        </select>
        <label htmlFor="music-min-space">Espacio mínimo</label>
        <input id="music-min-space" name="minSpace" defaultValue={music.technical.minSpace} />
        <label htmlFor="music-electrical">Requerimientos eléctricos</label>
        <input id="music-electrical" name="electrical" defaultValue={music.technical.electricalRequirements} />
        <label htmlFor="music-stage">Escenario</label>
        <input id="music-stage" name="stage" defaultValue={music.technical.needsStage} />
        <label htmlFor="music-sound">Sonido incluido</label>
        <input id="music-sound" name="sound" defaultValue={music.technical.soundIncluded} />
        <label htmlFor="music-lighting">Iluminación incluida</label>
        <input id="music-lighting" name="lighting" defaultValue={music.technical.lightingIncluded} />
        <label htmlFor="music-setup">Tiempo de montaje</label>
        <input id="music-setup" name="setup" defaultValue={music.technical.setupTime} />
        <label htmlFor="music-teardown">Tiempo de desmontaje</label>
        <input id="music-teardown" name="teardown" defaultValue={music.technical.teardownTime} />
        <label htmlFor="music-access">Requerimientos de acceso</label>
        <input id="music-access" name="access" defaultValue={music.technical.accessRequirements} />
        <label htmlFor="music-restrictions">Restricciones</label>
        <textarea id="music-restrictions" name="restrictions" defaultValue={music.technical.restrictions} />
        <label htmlFor="music-travel">Notas de traslado</label>
        <input id="music-travel" name="travel" defaultValue={music.technical.travelNotes} />
        <label><input name="published" type="checkbox" defaultChecked={isPublished} /> Publicación activa</label>
        <button className="search-button" type="submit">Guardar información</button>
      </form>
      <h3>Galería</h3>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addMusicImage(serviceId, { imageUrl: String(form.get('url') || ''), altText: String(form.get('alt') || ''), tag: String(form.get('tag') || '') }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="music-image-url">Dirección de la fotografía</label>
        <input id="music-image-url" name="url" type="url" required />
        <label htmlFor="music-image-alt">Texto alternativo</label>
        <input id="music-image-alt" name="alt" />
        <label htmlFor="music-image-tag">Etiqueta</label>
        <input id="music-image-tag" name="tag" placeholder="Presentaciones, Escenarios…" />
        <button className="outline-button compact" type="submit">Agregar fotografía</button>
      </form>
      <h3>Demostraciones de audio</h3>
      <ul>{music.tracks.map((item) => <li key={item.id}>{item.title} <button className="outline-button compact" type="button" onClick={() => void run(() => removeMusicTrack(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addMusicTrack(serviceId, { title: String(form.get('title') || ''), audioUrl: String(form.get('url') || ''), durationSeconds: String(form.get('duration') || '') }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="track-title">Título</label>
        <input id="track-title" name="title" required />
        <label htmlFor="track-url">Enlace de audio autorizado</label>
        <input id="track-url" name="url" type="url" required />
        <label htmlFor="track-duration">Duración en segundos</label>
        <input id="track-duration" name="duration" inputMode="numeric" />
        <button className="outline-button compact" type="submit">Agregar demostración</button>
      </form>
      <h3>Videos</h3>
      <ul>{music.videos.map((item) => <li key={item.id}>{item.title} <button className="outline-button compact" type="button" onClick={() => void run(() => removeMusicVideo(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addMusicVideo(serviceId, { title: String(form.get('title') || ''), description: String(form.get('description') || ''), videoUrl: String(form.get('url') || ''), thumbnailUrl: String(form.get('thumb') || '') }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="video-title">Título</label>
        <input id="video-title" name="title" required />
        <label htmlFor="video-url">Enlace del video</label>
        <input id="video-url" name="url" type="url" required />
        <label htmlFor="video-thumb">Miniatura</label>
        <input id="video-thumb" name="thumb" type="url" />
        <label htmlFor="video-description">Descripción</label>
        <textarea id="video-description" name="description" />
        <button className="outline-button compact" type="submit">Agregar video</button>
      </form>
      <h3>Géneros</h3>
      <ul>{music.genres.map((item) => <li key={item.id}>{item.name} <button className="outline-button compact" type="button" onClick={() => void run(() => removeMusicGenre(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addMusicGenre(serviceId, { name: String(form.get('name') || ''), description: String(form.get('description') || '') }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="genre-name">Género</label>
        <input id="genre-name" name="name" required />
        <label htmlFor="genre-description">Descripción</label>
        <textarea id="genre-description" name="description" />
        <button className="outline-button compact" type="submit">Agregar género</button>
      </form>
      <h3>Repertorio</h3>
      <ul>{music.repertoire.map((item) => <li key={item.id}>{item.title}{item.genre ? ` · ${item.genre}` : ''} <button className="outline-button compact" type="button" onClick={() => void run(() => removeMusicRepertoire(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addMusicRepertoire(serviceId, { title: String(form.get('title') || ''), genre: String(form.get('genre') || ''), notes: String(form.get('notes') || '') }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="rep-title">Pieza o bloque</label>
        <input id="rep-title" name="title" required />
        <label htmlFor="rep-genre">Género</label>
        <input id="rep-genre" name="genre" />
        <label htmlFor="rep-notes">Notas</label>
        <input id="rep-notes" name="notes" />
        <button className="outline-button compact" type="submit">Agregar al repertorio</button>
      </form>
      <h3>Paquetes</h3>
      <ul>{music.packages.map((item) => <li key={item.id}>{item.name} · {moneyLabel(item.priceUnit, item.priceCents)} <button className="outline-button compact" type="button" onClick={() => void run(() => removeMusicPackage(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addMusicPackage(serviceId, {
          name: String(form.get('name') || ''),
          description: String(form.get('description') || ''),
          durationMinutes: String(form.get('duration') || ''),
          durationOptions: String(form.get('options') || ''),
          memberCount: String(form.get('members') || ''),
          presentationType: String(form.get('presentationType') || ''),
          equipmentIncluded: String(form.get('equipment') || ''),
          priceCents: String(form.get('price') || ''),
          priceUnit: String(form.get('unit') || 'cotizacion'),
          conditions: String(form.get('conditions') || ''),
          extras: String(form.get('extras') || ''),
        }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="pack-name">Nombre del paquete</label>
        <input id="pack-name" name="name" required />
        <label htmlFor="pack-description">Descripción</label>
        <textarea id="pack-description" name="description" />
        <label htmlFor="pack-duration">Duración principal en minutos</label>
        <input id="pack-duration" name="duration" inputMode="numeric" />
        <label htmlFor="pack-options">Duraciones disponibles separadas por coma</label>
        <input id="pack-options" name="options" placeholder="60,120,180" />
        <label htmlFor="pack-members">Integrantes</label>
        <input id="pack-members" name="members" inputMode="numeric" />
        <label htmlFor="pack-type">Tipo de presentación</label>
        <input id="pack-type" name="presentationType" />
        <label htmlFor="pack-equipment">Equipo incluido</label>
        <textarea id="pack-equipment" name="equipment" />
        <label htmlFor="pack-price">Precio en pesos</label>
        <input id="pack-price" name="price" inputMode="numeric" />
        <label htmlFor="pack-unit">Unidad</label>
        <select id="pack-unit" name="unit" defaultValue="cotizacion">
          <option value="cotizacion">Sujeto a cotización</option>
          <option value="desde">Desde</option>
          <option value="fijo">Precio fijo</option>
        </select>
        <label htmlFor="pack-conditions">Condiciones</label>
        <textarea id="pack-conditions" name="conditions" />
        <label htmlFor="pack-extras">Servicios adicionales</label>
        <textarea id="pack-extras" name="extras" />
        <button className="outline-button compact" type="submit">Agregar paquete</button>
      </form>
      <h3>Complementos</h3>
      <ul>{music.addons.map((item) => <li key={item.id}>{item.name} · {moneyLabel(item.priceUnit, item.priceCents)} <button className="outline-button compact" type="button" onClick={() => void run(() => removeMusicAddon(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addMusicAddon(serviceId, {
          name: String(form.get('name') || ''),
          description: String(form.get('description') || ''),
          priceCents: String(form.get('price') || ''),
          priceUnit: String(form.get('unit') || 'cotizacion'),
        }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="addon-name">Complemento</label>
        <input id="addon-name" name="name" required />
        <label htmlFor="addon-description">Descripción</label>
        <textarea id="addon-description" name="description" />
        <label htmlFor="addon-price">Precio en pesos</label>
        <input id="addon-price" name="price" inputMode="numeric" />
        <label htmlFor="addon-unit">Unidad</label>
        <select id="addon-unit" name="unit" defaultValue="cotizacion">
          <option value="cotizacion">Sujeto a cotización</option>
          <option value="unidad">Por unidad</option>
          <option value="fijo">Precio fijo</option>
        </select>
        <button className="outline-button compact" type="submit">Agregar complemento</button>
      </form>
    </div>
  )
}
