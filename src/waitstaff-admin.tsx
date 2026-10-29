import { CatalogError } from './catalog-api'
import {
  addWaitstaffDuty,
  addWaitstaffImage,
  addWaitstaffModality,
  addWaitstaffPackage,
  addWaitstaffRole,
  addWaitstaffUniform,
  moneyLabel,
  removeWaitstaffDuty,
  removeWaitstaffModality,
  removeWaitstaffPackage,
  removeWaitstaffRole,
  removeWaitstaffUniform,
  saveOwnWaitstaff,
  type WaitstaffInfo,
} from './waitstaff-api'

type Props = {
  serviceId: number
  title: string
  description: string
  priceCents: number | null
  isPublished: boolean
  waitstaff: WaitstaffInfo
  onRefresh: () => Promise<void>
  onError: (value: string) => void
}

const pesos = (cents: number | null) => (cents === null ? '' : String(cents / 100))

export const WaitstaffAdmin = ({ serviceId, title, description, priceCents, isPublished, waitstaff, onRefresh, onError }: Props) => {
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
      <h3>Meseros y personal</h3>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => saveOwnWaitstaff(serviceId, {
          title: String(form.get('title') || ''),
          description: String(form.get('description') || ''),
          coverageArea: String(form.get('coverage') || ''),
          specialties: String(form.get('specialties') || ''),
          conditions: String(form.get('conditions') || ''),
          priceCents: String(form.get('price') || ''),
          priceMode: String(form.get('priceMode') || ''),
          guestsPerServer: String(form.get('ratio') || ''),
          minServers: String(form.get('minServers') || ''),
          maxServers: String(form.get('maxServers') || ''),
          minHours: String(form.get('minHours') || ''),
          overtimeCents: String(form.get('overtime') || ''),
          overtimeUnit: String(form.get('overtimeUnit') || 'cotizacion'),
          isPublished: form.get('published') === 'on',
        }))
      }}>
        <label htmlFor="wait-title">Nombre</label>
        <input id="wait-title" name="title" defaultValue={title} required />
        <label htmlFor="wait-description">Descripción</label>
        <textarea id="wait-description" name="description" defaultValue={description} />
        <label htmlFor="wait-specialties">Especialidades</label>
        <input id="wait-specialties" name="specialties" defaultValue={waitstaff.specialties} />
        <label htmlFor="wait-coverage">Cobertura</label>
        <input id="wait-coverage" name="coverage" defaultValue={waitstaff.coverageArea} />
        <label htmlFor="wait-price">Precio de referencia en pesos</label>
        <input id="wait-price" name="price" inputMode="numeric" defaultValue={pesos(priceCents)} />
        <label htmlFor="wait-mode">Modalidad</label>
        <select id="wait-mode" name="priceMode" defaultValue={waitstaff.priceMode}>
          <option value="">Sin registrar</option>
          <option value="cotizacion">Sujeto a cotización</option>
          <option value="desde">Desde</option>
          <option value="fijo">Precio fijo</option>
        </select>
        <label htmlFor="wait-ratio">Invitados por mesero (calculadora)</label>
        <input id="wait-ratio" name="ratio" inputMode="numeric" defaultValue={waitstaff.guestsPerServer ?? ''} />
        <label htmlFor="wait-min-servers">Mínimo de meseros</label>
        <input id="wait-min-servers" name="minServers" inputMode="numeric" defaultValue={waitstaff.minServers ?? ''} />
        <label htmlFor="wait-max-servers">Máximo de meseros</label>
        <input id="wait-max-servers" name="maxServers" inputMode="numeric" defaultValue={waitstaff.maxServers ?? ''} />
        <label htmlFor="wait-min-hours">Jornada mínima en horas</label>
        <input id="wait-min-hours" name="minHours" inputMode="numeric" defaultValue={waitstaff.minHours ?? ''} />
        <label htmlFor="wait-overtime">Hora adicional en pesos</label>
        <input id="wait-overtime" name="overtime" inputMode="numeric" defaultValue={pesos(waitstaff.overtimeCents)} />
        <label htmlFor="wait-overtime-unit">Unidad de hora adicional</label>
        <select id="wait-overtime-unit" name="overtimeUnit" defaultValue={waitstaff.overtimeUnit}>
          <option value="cotizacion">Sujeto a cotización</option>
          <option value="hora">Por hora</option>
        </select>
        <label htmlFor="wait-conditions">Condiciones comerciales</label>
        <textarea id="wait-conditions" name="conditions" defaultValue={waitstaff.conditions} />
        <label><input name="published" type="checkbox" defaultChecked={isPublished} /> Publicación activa</label>
        <button className="search-button" type="submit">Guardar información</button>
      </form>
      <h3>Galería</h3>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addWaitstaffImage(serviceId, { imageUrl: String(form.get('url') || ''), altText: String(form.get('alt') || ''), tag: String(form.get('tag') || '') }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="wait-image-url">Dirección de la fotografía</label>
        <input id="wait-image-url" name="url" type="url" required />
        <label htmlFor="wait-image-alt">Texto alternativo</label>
        <input id="wait-image-alt" name="alt" />
        <label htmlFor="wait-image-tag">Etiqueta</label>
        <input id="wait-image-tag" name="tag" placeholder="Bodas, Uniformes…" />
        <button className="outline-button compact" type="submit">Agregar fotografía</button>
      </form>
      <h3>Puestos</h3>
      <ul>{waitstaff.roles.map((item) => <li key={item.id}>{item.name}{item.isPrimary ? ' · principal' : ''} · {moneyLabel(item.priceUnit, item.priceCents)} <button className="outline-button compact" type="button" onClick={() => void run(() => removeWaitstaffRole(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addWaitstaffRole(serviceId, {
          name: String(form.get('name') || ''),
          description: String(form.get('description') || ''),
          priceCents: String(form.get('price') || ''),
          priceUnit: String(form.get('unit') || 'cotizacion'),
          minHours: String(form.get('minHours') || ''),
          minQty: String(form.get('minQty') || ''),
          maxQty: String(form.get('maxQty') || ''),
          imageUrl: String(form.get('image') || ''),
          conditions: String(form.get('conditions') || ''),
          isPrimary: form.get('primary') === 'on',
        }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="role-name">Puesto</label>
        <input id="role-name" name="name" required />
        <label htmlFor="role-description">Funciones</label>
        <textarea id="role-description" name="description" />
        <label htmlFor="role-price">Precio en pesos</label>
        <input id="role-price" name="price" inputMode="numeric" />
        <label htmlFor="role-unit">Unidad</label>
        <select id="role-unit" name="unit" defaultValue="cotizacion">
          <option value="cotizacion">Sujeto a cotización</option>
          <option value="hora">Por hora</option>
          <option value="jornada">Por jornada</option>
          <option value="persona">Por persona</option>
          <option value="fijo">Precio fijo</option>
        </select>
        <label htmlFor="role-min-hours">Horas mínimas</label>
        <input id="role-min-hours" name="minHours" inputMode="numeric" />
        <label htmlFor="role-min-qty">Cantidad mínima</label>
        <input id="role-min-qty" name="minQty" inputMode="numeric" />
        <label htmlFor="role-max-qty">Cantidad máxima</label>
        <input id="role-max-qty" name="maxQty" inputMode="numeric" />
        <label htmlFor="role-image">Fotografía ilustrativa</label>
        <input id="role-image" name="image" type="url" />
        <label htmlFor="role-conditions">Condiciones</label>
        <textarea id="role-conditions" name="conditions" />
        <label><input name="primary" type="checkbox" /> Puesto principal de meseros</label>
        <button className="outline-button compact" type="submit">Agregar puesto</button>
      </form>
      <h3>Modalidades</h3>
      <ul>{waitstaff.modalities.map((item) => <li key={item.id}>{item.name} <button className="outline-button compact" type="button" onClick={() => void run(() => removeWaitstaffModality(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addWaitstaffModality(serviceId, { name: String(form.get('name') || ''), description: String(form.get('description') || '') }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="modality-name">Modalidad</label>
        <input id="modality-name" name="name" required />
        <label htmlFor="modality-description">Descripción</label>
        <textarea id="modality-description" name="description" />
        <button className="outline-button compact" type="submit">Agregar modalidad</button>
      </form>
      <h3>Uniformes</h3>
      <ul>{waitstaff.uniforms.map((item) => <li key={item.id}>{item.name} <button className="outline-button compact" type="button" onClick={() => void run(() => removeWaitstaffUniform(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addWaitstaffUniform(serviceId, { name: String(form.get('name') || ''), description: String(form.get('description') || '') }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="uniform-name">Uniforme</label>
        <input id="uniform-name" name="name" required />
        <label htmlFor="uniform-description">Descripción</label>
        <textarea id="uniform-description" name="description" />
        <button className="outline-button compact" type="submit">Agregar uniforme</button>
      </form>
      <h3>Funciones</h3>
      <ul>{waitstaff.duties.map((item) => <li key={item.id}>{item.name} · {item.inclusion} <button className="outline-button compact" type="button" onClick={() => void run(() => removeWaitstaffDuty(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addWaitstaffDuty(serviceId, { name: String(form.get('name') || ''), description: String(form.get('description') || ''), inclusion: String(form.get('inclusion') || 'incluido') }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="duty-name">Función</label>
        <input id="duty-name" name="name" required />
        <label htmlFor="duty-description">Descripción</label>
        <textarea id="duty-description" name="description" />
        <label htmlFor="duty-inclusion">Tipo</label>
        <select id="duty-inclusion" name="inclusion" defaultValue="incluido">
          <option value="incluido">Incluida</option>
          <option value="adicional">Adicional</option>
        </select>
        <button className="outline-button compact" type="submit">Agregar función</button>
      </form>
      <h3>Paquetes</h3>
      <ul>{waitstaff.packages.map((item) => <li key={item.id}>{item.name} · {moneyLabel(item.priceUnit, item.priceCents)} <button className="outline-button compact" type="button" onClick={() => void run(() => removeWaitstaffPackage(serviceId, item.id))}>Quitar</button></li>)}</ul>
      <form className="venue-form" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void run(() => addWaitstaffPackage(serviceId, {
          name: String(form.get('name') || ''),
          description: String(form.get('description') || ''),
          serverCount: String(form.get('servers') || ''),
          hoursIncluded: String(form.get('hours') || ''),
          includedStaff: String(form.get('staff') || ''),
          modalityName: String(form.get('modality') || ''),
          priceCents: String(form.get('price') || ''),
          priceUnit: String(form.get('unit') || 'cotizacion'),
          conditions: String(form.get('conditions') || ''),
          servicesIncluded: String(form.get('services') || ''),
        }))
        event.currentTarget.reset()
      }}>
        <label htmlFor="pack-name">Paquete</label>
        <input id="pack-name" name="name" required />
        <label htmlFor="pack-description">Descripción</label>
        <textarea id="pack-description" name="description" />
        <label htmlFor="pack-servers">Cantidad de meseros</label>
        <input id="pack-servers" name="servers" inputMode="numeric" />
        <label htmlFor="pack-hours">Horas incluidas</label>
        <input id="pack-hours" name="hours" inputMode="numeric" />
        <label htmlFor="pack-staff">Personal complementario</label>
        <input id="pack-staff" name="staff" />
        <label htmlFor="pack-modality">Modalidad</label>
        <input id="pack-modality" name="modality" />
        <label htmlFor="pack-price">Precio en pesos</label>
        <input id="pack-price" name="price" inputMode="numeric" />
        <label htmlFor="pack-unit">Unidad</label>
        <select id="pack-unit" name="unit" defaultValue="cotizacion">
          <option value="cotizacion">Sujeto a cotización</option>
          <option value="desde">Desde</option>
          <option value="fijo">Precio fijo</option>
        </select>
        <label htmlFor="pack-services">Servicios incluidos</label>
        <textarea id="pack-services" name="services" />
        <label htmlFor="pack-conditions">Condiciones</label>
        <textarea id="pack-conditions" name="conditions" />
        <button className="outline-button compact" type="submit">Agregar paquete</button>
      </form>
    </div>
  )
}
