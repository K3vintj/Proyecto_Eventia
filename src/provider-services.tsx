import { useEffect, useState, type FormEvent } from 'react'
import { CatalogError } from './catalog-api'
import {
  addOwnDish,
  addOwnImage,
  addOwnOffering,
  addOwnPackage,
  createOwnBanquet,
  fetchOwnService,
  fetchOwnServices,
  removeOwnDish,
  removeOwnImage,
  removeOwnOffering,
  removeOwnPackage,
  saveOwnBanquet,
  type BanquetInfo,
  type BanquetImage,
  type ProviderServiceSummary,
} from './banquet-api'
import { createOwnDecoration, type DecorInfo } from './decoration-api'
import { DecorationAdmin } from './decoration-admin'
import { createOwnMusic, type MusicInfo } from './music-api'
import { MusicAdmin } from './music-admin'
import { createOwnWaitstaff, type WaitstaffInfo } from './waitstaff-api'
import { WaitstaffAdmin } from './waitstaff-admin'
import { createOwnFurniture, type FurnitureInfo } from './furniture-api'
import { FurnitureAdmin } from './furniture-admin'

type OwnedService = {
  id: number
  title: string
  description: string
  priceCents: number | null
  isPublished: boolean
  slug: string
  categoryTitle: string
  images: BanquetImage[]
  banquet: BanquetInfo | null
  decoration: DecorInfo | null
  music: MusicInfo | null
  waitstaff: WaitstaffInfo | null
  furniture: FurnitureInfo | null
}

const pesos = (cents: number | null) => (cents === null ? '' : String(cents / 100))

export const ProviderServices = () => {
  const [services, setServices] = useState<ProviderServiceSummary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [service, setService] = useState<OwnedService | null>(null)
  const [title, setTitle] = useState('')
  const [decorTitle, setDecorTitle] = useState('')
  const [musicTitle, setMusicTitle] = useState('')
  const [waitstaffTitle, setWaitstaffTitle] = useState('')
  const [furnitureTitle, setFurnitureTitle] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const loadList = () => fetchOwnServices().then((result) => setServices(result.services))

  const loadService = (serviceId: number) => {
    setError('')
    setSelectedId(serviceId)
    return fetchOwnService(serviceId)
      .then((result) => setService(result.service))
      .catch((reason: unknown) => setError(reason instanceof CatalogError ? reason.message : 'No se pudo abrir el servicio.'))
  }

  useEffect(() => {
    loadList()
      .catch((reason: unknown) => setError(reason instanceof CatalogError ? reason.message : 'No se pudieron cargar tus servicios.'))
      .finally(() => setIsLoading(false))
  }, [])

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const created = await createOwnBanquet(title)
      setTitle('')
      await loadList()
      await loadService(created.id)
      setMessage('El banquete se creó sin publicar. Actívalo cuando tenga la información lista.')
    } catch (reason: unknown) {
      setError(reason instanceof CatalogError ? reason.message : 'No se pudo crear el banquete.')
    }
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!service?.banquet) return
    const form = new FormData(event.currentTarget)
    setError('')
    try {
      await saveOwnBanquet(service.id, {
        title: String(form.get('title') || ''),
        description: String(form.get('description') || ''),
        priceCents: String(form.get('price') || ''),
        priceMode: String(form.get('priceMode') || 'cotizacion'),
        serviceType: String(form.get('serviceType') || ''),
        coverageArea: String(form.get('coverage') || ''),
        guestMin: String(form.get('guestMin') || ''),
        guestMax: String(form.get('guestMax') || ''),
        isPublished: form.get('published') === 'on',
      })
      await loadList()
      await loadService(service.id)
      setMessage('Los cambios del banquete quedaron guardados.')
    } catch (reason: unknown) {
      setError(reason instanceof CatalogError ? reason.message : 'No se pudo guardar el banquete.')
    }
  }

  const refresh = async () => {
    if (selectedId) await loadService(selectedId)
  }

  return (
    <section className="planning-panel" aria-labelledby="own-services">
      <div className="planning-heading"><h2 id="own-services">Servicios</h2><p>Publicaciones de tu negocio. Solo puedes editar las tuyas.</p></div>
      {isLoading ? <p>Cargando servicios…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {!isLoading && services.length === 0 ? <p>Todavía no publicas servicios.</p> : null}
      <ul className="banquet-menu">
        {services.map((item) => (
          <li key={item.id}>
            <button className="outline-button compact" type="button" onClick={() => void loadService(item.id)}>{item.title}</button>
            <span>{item.categoryTitle} · {item.isPublished ? 'Publicado' : 'No publicado'}</span>
          </li>
        ))}
      </ul>
      <form className="venue-form" onSubmit={handleCreate}>
        <label htmlFor="new-banquet">Nuevo servicio de banquetes</label>
        <input id="new-banquet" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <button className="outline-button compact" type="submit">Crear banquete</button>
      </form>
      {service && service.slug !== 'banquetes' && service.slug !== 'flores-decoracion' && service.slug !== 'musica' && service.slug !== 'meseros' && service.slug !== 'mobiliario' ? <p>{service.title} pertenece a {service.categoryTitle}.</p> : null}
      {service?.banquet ? <BanquetEditor service={service} onRefresh={refresh} onError={setError} onSave={handleSave} /> : null}
      {service?.decoration ? <DecorationAdmin serviceId={service.id} title={service.title} description={service.description} priceCents={service.priceCents} isPublished={service.isPublished} decoration={service.decoration} onRefresh={refresh} onError={setError} /> : null}
      {service?.music ? <MusicAdmin serviceId={service.id} title={service.title} description={service.description} priceCents={service.priceCents} isPublished={service.isPublished} music={service.music} onRefresh={refresh} onError={setError} /> : null}
      {service?.waitstaff ? <WaitstaffAdmin serviceId={service.id} title={service.title} description={service.description} priceCents={service.priceCents} isPublished={service.isPublished} waitstaff={service.waitstaff} onRefresh={refresh} onError={setError} /> : null}
      {service?.furniture ? <FurnitureAdmin serviceId={service.id} title={service.title} description={service.description} priceCents={service.priceCents} isPublished={service.isPublished} furniture={service.furniture} onRefresh={refresh} onError={setError} /> : null}
      <form className="venue-form" onSubmit={async (event) => {
        event.preventDefault()
        setError('')
        try {
          const created = await createOwnDecoration(decorTitle)
          setDecorTitle('')
          await loadList()
          await loadService(created.id)
          setMessage('La decoración se creó sin publicar.')
        } catch (reason: unknown) {
          setError(reason instanceof CatalogError ? reason.message : 'No se pudo crear la decoración.')
        }
      }}>
        <label htmlFor="new-decor">Nuevo servicio de decoración</label>
        <input id="new-decor" value={decorTitle} onChange={(event) => setDecorTitle(event.target.value)} required />
        <button className="outline-button compact" type="submit">Crear decoración</button>
      </form>
      <form className="venue-form" onSubmit={async (event) => {
        event.preventDefault()
        setError('')
        try {
          const created = await createOwnMusic(musicTitle)
          setMusicTitle('')
          await loadList()
          await loadService(created.id)
          setMessage('El servicio musical se creó sin publicar.')
        } catch (reason: unknown) {
          setError(reason instanceof CatalogError ? reason.message : 'No se pudo crear el servicio musical.')
        }
      }}>
        <label htmlFor="new-music">Nuevo servicio de música</label>
        <input id="new-music" value={musicTitle} onChange={(event) => setMusicTitle(event.target.value)} required />
        <button className="outline-button compact" type="submit">Crear música</button>
      </form>
      <form className="venue-form" onSubmit={async (event) => {
        event.preventDefault()
        setError('')
        try {
          const created = await createOwnWaitstaff(waitstaffTitle)
          setWaitstaffTitle('')
          await loadList()
          await loadService(created.id)
          setMessage('El servicio de meseros se creó sin publicar.')
        } catch (reason: unknown) {
          setError(reason instanceof CatalogError ? reason.message : 'No se pudo crear el servicio de meseros.')
        }
      }}>
        <label htmlFor="new-waitstaff">Nuevo servicio de meseros</label>
        <input id="new-waitstaff" value={waitstaffTitle} onChange={(event) => setWaitstaffTitle(event.target.value)} required />
        <button className="outline-button compact" type="submit">Crear meseros</button>
      </form>
      <form className="venue-form" onSubmit={async (event) => {
        event.preventDefault()
        setError('')
        try {
          const created = await createOwnFurniture(furnitureTitle)
          setFurnitureTitle('')
          await loadList()
          await loadService(created.id)
          setMessage('El servicio de mobiliario se creó sin publicar.')
        } catch (reason: unknown) {
          setError(reason instanceof CatalogError ? reason.message : 'No se pudo crear el servicio de mobiliario.')
        }
      }}>
        <label htmlFor="new-furniture">Nuevo servicio de mobiliario</label>
        <input id="new-furniture" value={furnitureTitle} onChange={(event) => setFurnitureTitle(event.target.value)} required />
        <button className="outline-button compact" type="submit">Crear mobiliario</button>
      </form>
    </section>
  )
}

const BanquetEditor = ({ service, onRefresh, onError, onSave }: { service: OwnedService; onRefresh: () => Promise<void>; onError: (value: string) => void; onSave: (event: FormEvent<HTMLFormElement>) => Promise<void> }) => {
  const banquet = service.banquet as BanquetInfo
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
      <form className="venue-form" onSubmit={(event) => void onSave(event)}>
        <label htmlFor="banquet-title">Nombre</label>
        <input id="banquet-title" name="title" defaultValue={service.title} required />
        <label htmlFor="banquet-description">Descripción</label>
        <textarea id="banquet-description" name="description" defaultValue={service.description} />
        <label htmlFor="banquet-type">Tipo de servicio</label>
        <input id="banquet-type" name="serviceType" defaultValue={banquet.serviceType} />
        <label htmlFor="banquet-coverage">Zona de cobertura</label>
        <input id="banquet-coverage" name="coverage" defaultValue={banquet.coverageArea} />
        <label htmlFor="banquet-price">Precio de referencia en pesos</label>
        <input id="banquet-price" name="price" inputMode="numeric" defaultValue={pesos(service.priceCents)} />
        <label htmlFor="banquet-mode">Modalidad</label>
        <select id="banquet-mode" name="priceMode" defaultValue={banquet.priceMode}>
          <option value="">Sin registrar</option>
          <option value="cotizacion">Sujeto a cotización</option>
          <option value="persona">Por persona</option>
          <option value="fijo">Precio fijo</option>
        </select>
        <label htmlFor="guest-min">Mínimo de invitados</label>
        <input id="guest-min" name="guestMin" inputMode="numeric" defaultValue={banquet.guestMin ?? ''} />
        <label htmlFor="guest-max">Máximo de invitados</label>
        <input id="guest-max" name="guestMax" inputMode="numeric" defaultValue={banquet.guestMax ?? ''} />
        <label><input name="published" type="checkbox" defaultChecked={service.isPublished} /> Publicación activa</label>
        <button className="search-button" type="submit">Guardar información</button>
      </form>
      <h3>Fotografías</h3>
      <ul>{service.images.map((image) => <li key={image.id}>{image.alt || image.url} <button className="outline-button compact" type="button" onClick={() => void run(() => removeOwnImage(service.id, image.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addOwnImage(service.id, { imageUrl: String(form.get('url') || ''), altText: String(form.get('alt') || '') }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="image-url">Dirección de la fotografía</label>
        <input id="image-url" name="url" type="url" required />
        <label htmlFor="image-alt">Texto alternativo</label>
        <input id="image-alt" name="alt" />
        <button className="outline-button compact" type="submit">Agregar fotografía</button>
      </form>
      <h3>Paquetes</h3>
      {banquet.packages.length === 0 ? <p>No hay paquetes registrados.</p> : null}
      {banquet.packages.map((item) => (
        <article className="planning-event" key={item.id}>
          <h3>{item.name}</h3>
          <p>{item.description}</p>
          <button className="outline-button compact" type="button" onClick={() => void run(() => removeOwnPackage(service.id, item.id))}>Eliminar paquete</button>
          <ul>{item.dishes.map((dish) => <li key={dish.id}>{dish.name} <button className="outline-button compact" type="button" onClick={() => void run(() => removeOwnDish(service.id, item.id, dish.id))}>Quitar</button></li>)}</ul>
          <form className="venue-form" onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            void run(() => addOwnDish(service.id, item.id, { name: String(form.get('dish') || ''), course: String(form.get('course') || 'otro'), optionGroup: String(form.get('group') || '') }))
            event.currentTarget.reset()
          }}>
            <label htmlFor={`dish-${item.id}`}>Platillo</label>
            <input id={`dish-${item.id}`} name="dish" required />
            <label htmlFor={`course-${item.id}`}>Tiempo</label>
            <select id={`course-${item.id}`} name="course" defaultValue="otro">
              <option value="entrada">Entrada</option>
              <option value="fuerte">Plato fuerte</option>
              <option value="guarnicion">Guarnición</option>
              <option value="postre">Postre</option>
              <option value="bebida">Bebida</option>
              <option value="otro">Otro</option>
            </select>
            <label htmlFor={`group-${item.id}`}>Grupo de alternativa</label>
            <input id={`group-${item.id}`} name="group" placeholder="Vacío si va incluido siempre" />
            <button className="outline-button compact" type="submit">Agregar platillo</button>
          </form>
        </article>
      ))}
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addOwnPackage(service.id, {
          name: String(form.get('name') || ''),
          description: String(form.get('description') || ''),
          priceCents: String(form.get('price') || ''),
          priceUnit: String(form.get('unit') || 'cotizacion'),
          minGuests: String(form.get('min') || ''),
          conditions: String(form.get('conditions') || ''),
        }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="package-name">Nuevo paquete</label>
        <input id="package-name" name="name" required />
        <label htmlFor="package-description">Descripción</label>
        <textarea id="package-description" name="description" />
        <label htmlFor="package-price">Precio en pesos</label>
        <input id="package-price" name="price" inputMode="numeric" />
        <label htmlFor="package-unit">Unidad</label>
        <select id="package-unit" name="unit" defaultValue="cotizacion">
          <option value="cotizacion">Sujeto a cotización</option>
          <option value="persona">Por persona</option>
          <option value="fijo">Precio fijo</option>
        </select>
        <label htmlFor="package-min">Mínimo de invitados</label>
        <input id="package-min" name="min" inputMode="numeric" />
        <label htmlFor="package-conditions">Condiciones</label>
        <textarea id="package-conditions" name="conditions" />
        <button className="outline-button compact" type="submit">Agregar paquete</button>
      </form>
      <h3>Características y complementos</h3>
      <ul>{banquet.offerings.map((item) => <li key={item.id}>{item.name} · {item.inclusion} <button className="outline-button compact" type="button" onClick={() => void run(() => removeOwnOffering(service.id, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addOwnOffering(service.id, {
          name: String(form.get('name') || ''),
          inclusion: String(form.get('inclusion') || 'incluido'),
          priceCents: String(form.get('price') || ''),
          priceUnit: String(form.get('unit') || 'cotizacion'),
        }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="offering-name">Característica</label>
        <input id="offering-name" name="name" required />
        <label htmlFor="offering-inclusion">Tipo</label>
        <select id="offering-inclusion" name="inclusion" defaultValue="incluido">
          <option value="incluido">Incluido</option>
          <option value="opcional">Opcional con costo</option>
          <option value="no_incluido">No incluido</option>
        </select>
        <label htmlFor="offering-price">Precio en pesos, si es opcional</label>
        <input id="offering-price" name="price" inputMode="numeric" />
        <label htmlFor="offering-unit">Unidad</label>
        <select id="offering-unit" name="unit" defaultValue="cotizacion">
          <option value="cotizacion">Sujeto a cotización</option>
          <option value="persona">Por persona</option>
          <option value="fijo">Precio fijo</option>
        </select>
        <button className="outline-button compact" type="submit">Agregar característica</button>
      </form>
    </div>
  )
}
