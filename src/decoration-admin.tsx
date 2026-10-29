import { CatalogError } from './catalog-api'
import {
  addDecorElement,
  addDecorImage,
  addDecorPackage,
  addDecorPalette,
  addDecorStyle,
  moneyLabel,
  removeDecorElement,
  removeDecorPackage,
  removeDecorPalette,
  removeDecorStyle,
  saveOwnDecoration,
  type DecorInfo,
} from './decoration-api'

type Props = {
  serviceId: number
  title: string
  description: string
  priceCents: number | null
  isPublished: boolean
  decoration: DecorInfo
  onRefresh: () => Promise<void>
  onError: (value: string) => void
}

const pesos = (cents: number | null) => (cents === null ? '' : String(cents / 100))

export const DecorationAdmin = ({ serviceId, title, description, priceCents, isPublished, decoration, onRefresh, onError }: Props) => {
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
      <h3>Decoración</h3>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => saveOwnDecoration(serviceId, {
          title: String(form.get('title') || ''),
          description: String(form.get('description') || ''),
          coverageArea: String(form.get('coverage') || ''),
          specialties: String(form.get('specialties') || ''),
          priceCents: String(form.get('price') || ''),
          priceMode: String(form.get('priceMode') || ''),
          isPublished: form.get('published') === 'on',
        }))
      }}>
        <label htmlFor="decor-title">Nombre</label>
        <input id="decor-title" name="title" defaultValue={title} required />
        <label htmlFor="decor-description">Descripción</label>
        <textarea id="decor-description" name="description" defaultValue={description} />
        <label htmlFor="decor-specialties">Especialidades</label>
        <input id="decor-specialties" name="specialties" defaultValue={decoration.specialties} />
        <label htmlFor="decor-coverage">Cobertura</label>
        <input id="decor-coverage" name="coverage" defaultValue={decoration.coverageArea} />
        <label htmlFor="decor-price">Precio de referencia en pesos</label>
        <input id="decor-price" name="price" inputMode="numeric" defaultValue={pesos(priceCents)} />
        <label htmlFor="decor-mode">Modalidad</label>
        <select id="decor-mode" name="priceMode" defaultValue={decoration.priceMode}>
          <option value="">Sin registrar</option>
          <option value="cotizacion">Sujeto a cotización</option>
          <option value="desde">Desde</option>
          <option value="fijo">Precio fijo</option>
        </select>
        <label><input name="published" type="checkbox" defaultChecked={isPublished} /> Publicación activa</label>
        <button className="search-button" type="submit">Guardar información</button>
      </form>
      <h3>Galería</h3>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addDecorImage(serviceId, {
          imageUrl: String(form.get('url') || ''),
          altText: String(form.get('alt') || ''),
          tag: String(form.get('tag') || ''),
          styleId: String(form.get('styleId') || ''),
          packageId: String(form.get('packageId') || ''),
        }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="decor-image-url">Dirección de la fotografía</label>
        <input id="decor-image-url" name="url" type="url" required />
        <label htmlFor="decor-image-alt">Texto alternativo</label>
        <input id="decor-image-alt" name="alt" />
        <label htmlFor="decor-image-tag">Etiqueta de la galería</label>
        <input id="decor-image-tag" name="tag" placeholder="Bodas, XV años…" />
        <label htmlFor="decor-image-style">Id del estilo, si aplica</label>
        <input id="decor-image-style" name="styleId" inputMode="numeric" />
        <label htmlFor="decor-image-package">Id del paquete, si aplica</label>
        <input id="decor-image-package" name="packageId" inputMode="numeric" />
        <button className="outline-button compact" type="submit">Agregar fotografía</button>
      </form>
      <h3>Estilos</h3>
      <ul>{decoration.styles.map((item) => <li key={item.id}>{item.name} <button className="outline-button compact" type="button" onClick={() => void run(() => removeDecorStyle(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addDecorStyle(serviceId, { name: String(form.get('name') || ''), description: String(form.get('description') || '') }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="style-name">Nuevo estilo</label>
        <input id="style-name" name="name" required />
        <label htmlFor="style-description">Descripción</label>
        <textarea id="style-description" name="description" />
        <button className="outline-button compact" type="submit">Agregar estilo</button>
      </form>
      <h3>Paletas</h3>
      <ul>{decoration.palettes.map((item) => <li key={item.id}>{item.name} · {item.colors.join(', ')} <button className="outline-button compact" type="button" onClick={() => void run(() => removeDecorPalette(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addDecorPalette(serviceId, { name: String(form.get('name') || ''), colors: String(form.get('colors') || ''), description: String(form.get('description') || '') }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="palette-name">Nueva paleta</label>
        <input id="palette-name" name="name" required />
        <label htmlFor="palette-colors">Colores hexadecimales separados por coma</label>
        <input id="palette-colors" name="colors" placeholder="#14213d,#7665e8" />
        <label htmlFor="palette-description">Descripción</label>
        <textarea id="palette-description" name="description" />
        <button className="outline-button compact" type="submit">Agregar paleta</button>
      </form>
      <h3>Paquetes</h3>
      <ul>{decoration.packages.map((item) => <li key={item.id}>{item.name} · {moneyLabel(item.priceUnit, item.priceCents)} <button className="outline-button compact" type="button" onClick={() => void run(() => removeDecorPackage(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addDecorPackage(serviceId, {
          name: String(form.get('name') || ''),
          description: String(form.get('description') || ''),
          priceCents: String(form.get('price') || ''),
          priceUnit: String(form.get('unit') || 'cotizacion'),
          includedItems: String(form.get('included') || ''),
          coverage: String(form.get('coverage') || ''),
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
          <option value="desde">Desde</option>
          <option value="fijo">Precio fijo</option>
        </select>
        <label htmlFor="package-included">Elementos incluidos</label>
        <textarea id="package-included" name="included" />
        <label htmlFor="package-coverage">Cobertura</label>
        <input id="package-coverage" name="coverage" />
        <label htmlFor="package-conditions">Condiciones</label>
        <textarea id="package-conditions" name="conditions" />
        <button className="outline-button compact" type="submit">Agregar paquete</button>
      </form>
      <h3>Elementos y complementos</h3>
      <ul>{decoration.elements.map((item) => <li key={item.id}>{item.name} · {moneyLabel(item.priceUnit, item.priceCents)}{item.isAddon ? ' · complemento' : ''} <button className="outline-button compact" type="button" onClick={() => void run(() => removeDecorElement(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addDecorElement(serviceId, {
          name: String(form.get('name') || ''),
          description: String(form.get('description') || ''),
          priceCents: String(form.get('price') || ''),
          priceUnit: String(form.get('unit') || 'cotizacion'),
          minQty: String(form.get('min') || ''),
          maxQty: String(form.get('max') || ''),
          isAddon: form.get('addon') === 'on',
        }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="element-name">Nuevo elemento</label>
        <input id="element-name" name="name" required />
        <label htmlFor="element-description">Descripción</label>
        <textarea id="element-description" name="description" />
        <label htmlFor="element-price">Precio en pesos</label>
        <input id="element-price" name="price" inputMode="numeric" />
        <label htmlFor="element-unit">Unidad</label>
        <select id="element-unit" name="unit" defaultValue="cotizacion">
          <option value="cotizacion">Sujeto a cotización</option>
          <option value="unidad">Por unidad</option>
          <option value="fijo">Precio fijo</option>
        </select>
        <label htmlFor="element-min">Cantidad mínima</label>
        <input id="element-min" name="min" inputMode="numeric" />
        <label htmlFor="element-max">Cantidad máxima</label>
        <input id="element-max" name="max" inputMode="numeric" />
        <label><input name="addon" type="checkbox" /> Complemento opcional</label>
        <button className="outline-button compact" type="submit">Agregar elemento</button>
      </form>
    </div>
  )
}
