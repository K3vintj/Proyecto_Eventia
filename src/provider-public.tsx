import { useEffect, useState } from 'react'
import { CatalogError } from './catalog-api'
import { Logo } from './logo'
import { fetchProvider, type PublicProvider, type VenueServiceLink } from './venue-api'

export const ProviderPublic = ({ providerId, onNavigate }: { providerId: number; onNavigate: (path: string) => void }) => {
  const [provider, setProvider] = useState<PublicProvider | null>(null)
  const [services, setServices] = useState<VenueServiceLink[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    setIsLoading(true)
    fetchProvider(providerId)
      .then((result) => {
        if (!active) return
        setProvider(result.provider)
        setServices(result.services)
      })
      .catch((error: unknown) => {
        if (!active) return
        setMessage(error instanceof CatalogError ? error.message : 'No se pudo cargar el proveedor.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [providerId])

  return (
    <main className="category-page">
      <header className="category-topbar">
        <a href="/" aria-label="Ir al inicio de Eventia" onClick={(event) => { event.preventDefault(); onNavigate('/') }}><Logo /></a>
        <button className="outline-button compact" type="button" onClick={() => onNavigate('/')}>Volver</button>
      </header>
      {isLoading ? (
        <section className="venue-page" aria-busy="true">
          <div className="venue-skeleton venue-skeleton-title" />
          <div className="venue-skeleton venue-skeleton-block" />
        </section>
      ) : null}
      {!isLoading && message ? <section className="category-empty"><h1>Proveedor no disponible</h1><p role="alert">{message}</p></section> : null}
      {provider ? (
        <section className="venue-page">
          <div className="venue-provider-card">
            <span className="venue-mark" aria-hidden="true">{provider.businessName.trim().charAt(0).toUpperCase() || 'E'}</span>
            <div>
              <h1>{provider.businessName}</h1>
              <p>{provider.city || 'Ubicación sin registrar'}</p>
              <p>{provider.description || 'Este negocio todavía no escribe una descripción.'}</p>
            </div>
          </div>
          <h2>Servicios publicados</h2>
          {services.length === 0 ? <p>Este negocio no tiene servicios publicados.</p> : null}
          <ul className="venue-other">
            {services.map((service) => (
              <li key={`${service.slug}-${service.id}`}>
                <a href={`/categorias/${service.slug}/servicios/${service.id}`} onClick={(event) => { event.preventDefault(); onNavigate(`/categorias/${service.slug}/servicios/${service.id}`) }}>{service.title}</a>
                <span>{service.categoryTitle}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
