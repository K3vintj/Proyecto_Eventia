import { CatalogError } from './catalog-api'
import {
  addFurnitureAddon,
  addFurnitureImage,
  addFurnitureItem,
  addFurniturePackage,
  moneyLabel,
  removeFurnitureAddon,
  removeFurnitureItem,
  removeFurniturePackage,
  saveOwnFurniture,
  type FurnitureInfo,
} from './furniture-api'

type Props = {
  serviceId: number
  title: string
  description: string
  priceCents: number | null
  isPublished: boolean
  furniture: FurnitureInfo
  onRefresh: () => Promise<void>
  onError: (value: string) => void
}

const pesos = (cents: number | null) => (cents === null ? '' : String(cents / 100))

export const FurnitureAdmin = ({ serviceId, title, description, priceCents, isPublished, furniture, onRefresh, onError }: Props) => {
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
      <h3>Mobiliario</h3>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => saveOwnFurniture(serviceId, {
          title: String(form.get('title') || ''),
          description: String(form.get('description') || ''),
          coverageArea: String(form.get('coverage') || ''),
          specialties: String(form.get('specialties') || ''),
          furnitureTypes: String(form.get('types') || ''),
          conditions: String(form.get('conditions') || ''),
          priceCents: String(form.get('price') || ''),
          priceMode: String(form.get('priceMode') || ''),
          isPublished: form.get('published') === 'on',
        }))
      }}>
        <label htmlFor="furn-title">Nombre</label>
        <input id="furn-title" name="title" defaultValue={title} required />
        <label htmlFor="furn-description">Descripción</label>
        <textarea id="furn-description" name="description" defaultValue={description} />
        <label htmlFor="furn-types">Tipos de mobiliario</label>
        <input id="furn-types" name="types" defaultValue={furniture.furnitureTypes} />
        <label htmlFor="furn-specialties">Especialidades</label>
        <input id="furn-specialties" name="specialties" defaultValue={furniture.specialties} />
        <label htmlFor="furn-coverage">Cobertura</label>
        <input id="furn-coverage" name="coverage" defaultValue={furniture.coverageArea} />
        <label htmlFor="furn-price">Precio de referencia en pesos</label>
        <input id="furn-price" name="price" inputMode="numeric" defaultValue={pesos(priceCents)} />
        <label htmlFor="furn-mode">Modalidad</label>
        <select id="furn-mode" name="priceMode" defaultValue={furniture.priceMode}>
          <option value="">Sin registrar</option>
          <option value="cotizacion">Sujeto a cotización</option>
          <option value="desde">Desde</option>
          <option value="fijo">Precio fijo</option>
        </select>
        <label htmlFor="furn-conditions">Condiciones</label>
        <textarea id="furn-conditions" name="conditions" defaultValue={furniture.conditions} />
        <label><input name="published" type="checkbox" defaultChecked={isPublished} /> Publicación activa</label>
        <button className="search-button" type="submit">Guardar información</button>
      </form>
      <h3>Galería</h3>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addFurnitureImage(serviceId, { imageUrl: String(form.get('url') || ''), altText: String(form.get('alt') || ''), tag: String(form.get('tag') || '') }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="furn-image-url">Dirección de la fotografía</label>
        <input id="furn-image-url" name="url" type="url" required />
        <label htmlFor="furn-image-alt">Texto alternativo</label>
        <input id="furn-image-alt" name="alt" />
        <label htmlFor="furn-image-tag">Etiqueta</label>
        <input id="furn-image-tag" name="tag" />
        <button className="outline-button compact" type="submit">Agregar fotografía</button>
      </form>
      <h3>Artículos</h3>
      <ul>{furniture.items.map((item) => <li key={item.id}>{item.name} · {item.subcategory || 'Sin subcategoría'} · {moneyLabel(item.priceUnit, item.priceCents)} <button className="outline-button compact" type="button" onClick={() => void run(() => removeFurnitureItem(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addFurnitureItem(serviceId, {
          name: String(form.get('name') || ''),
          description: String(form.get('description') || ''),
          subcategory: String(form.get('subcategory') || ''),
          style: String(form.get('style') || ''),
          capacity: String(form.get('capacity') || ''),
          priceCents: String(form.get('price') || ''),
          priceUnit: String(form.get('unit') || 'cotizacion'),
          minQty: String(form.get('minQty') || ''),
          stock: String(form.get('stock') || ''),
          imageUrl: String(form.get('image') || ''),
          conditions: String(form.get('conditions') || ''),
        }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="item-name">Artículo</label>
        <input id="item-name" name="name" required />
        <label htmlFor="item-subcategory">Subcategoría</label>
        <input id="item-subcategory" name="subcategory" placeholder="Mesas, Sillas…" />
        <label htmlFor="item-style">Estilo</label>
        <input id="item-style" name="style" />
        <label htmlFor="item-description">Descripción</label>
        <textarea id="item-description" name="description" />
        <label htmlFor="item-capacity">Capacidad</label>
        <input id="item-capacity" name="capacity" inputMode="numeric" />
        <label htmlFor="item-price">Precio en pesos</label>
        <input id="item-price" name="price" inputMode="numeric" />
        <label htmlFor="item-unit">Unidad</label>
        <select id="item-unit" name="unit" defaultValue="cotizacion">
          <option value="cotizacion">Sujeto a cotización</option>
          <option value="evento">Por evento</option>
          <option value="dia">Por día</option>
          <option value="jornada">Por jornada</option>
          <option value="unidad">Por unidad</option>
          <option value="fijo">Precio fijo</option>
        </select>
        <label htmlFor="item-min">Cantidad mínima</label>
        <input id="item-min" name="minQty" inputMode="numeric" />
        <label htmlFor="item-stock">Existencias</label>
        <input id="item-stock" name="stock" inputMode="numeric" />
        <label htmlFor="item-image">Fotografía</label>
        <input id="item-image" name="image" type="url" />
        <label htmlFor="item-conditions">Condiciones</label>
        <textarea id="item-conditions" name="conditions" />
        <button className="outline-button compact" type="submit">Agregar artículo</button>
      </form>
      <h3>Paquetes</h3>
      <ul>{furniture.packages.map((item) => <li key={item.id}>{item.name} · {moneyLabel(item.priceUnit, item.priceCents)} <button className="outline-button compact" type="button" onClick={() => void run(() => removeFurniturePackage(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const pair = String(form.get('bundle') || '')
        const [itemId, quantity] = pair.split(':')
        void run(() => addFurniturePackage(serviceId, {
          name: String(form.get('name') || ''),
          description: String(form.get('description') || ''),
          rentalLabel: String(form.get('rental') || ''),
          conditions: String(form.get('conditions') || ''),
          imageUrl: String(form.get('image') || ''),
          priceCents: String(form.get('price') || ''),
          priceUnit: String(form.get('unit') || 'cotizacion'),
          items: itemId ? [{ id: Number(itemId), quantity: Number(quantity || 1) }] : [],
        }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="pack-name">Paquete</label>
        <input id="pack-name" name="name" required />
        <label htmlFor="pack-description">Descripción</label>
        <textarea id="pack-description" name="description" />
        <label htmlFor="pack-rental">Duración de renta</label>
        <input id="pack-rental" name="rental" placeholder="Por evento" />
        <label htmlFor="pack-price">Precio en pesos</label>
        <input id="pack-price" name="price" inputMode="numeric" />
        <label htmlFor="pack-unit">Unidad</label>
        <select id="pack-unit" name="unit" defaultValue="cotizacion">
          <option value="cotizacion">Sujeto a cotización</option>
          <option value="evento">Por evento</option>
          <option value="dia">Por día</option>
          <option value="jornada">Por jornada</option>
          <option value="fijo">Precio fijo</option>
        </select>
        <label htmlFor="pack-bundle">Artículo incluido (id:cantidad)</label>
        <input id="pack-bundle" name="bundle" placeholder="12:10" />
        <label htmlFor="pack-image">Fotografía</label>
        <input id="pack-image" name="image" type="url" />
        <label htmlFor="pack-conditions">Condiciones</label>
        <textarea id="pack-conditions" name="conditions" />
        <button className="outline-button compact" type="submit">Agregar paquete</button>
      </form>
      <h3>Complementos</h3>
      <ul>{furniture.addons.map((item) => <li key={item.id}>{item.name} · {moneyLabel(item.priceUnit, item.priceCents)} <button className="outline-button compact" type="button" onClick={() => void run(() => removeFurnitureAddon(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addFurnitureAddon(serviceId, {
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
          <option value="evento">Por evento</option>
          <option value="dia">Por día</option>
          <option value="unidad">Por unidad</option>
          <option value="fijo">Precio fijo</option>
        </select>
        <button className="outline-button compact" type="submit">Agregar complemento</button>
      </form>
    </div>
  )
}
