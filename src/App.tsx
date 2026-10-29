import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { AccountSettings, AdminUsers, BusinessProfile, ClientProfile, UserAvatar } from './account-panels'
import { UserMenu } from './user-menu'
import { fetchSession, logout, setLoginNotice } from './auth-api'
import { AuthPages } from './auth-pages'
import { fetchCategories, type CatalogCategory } from './catalog-api'
import { Logo } from './logo'
import { CategoryPage } from './category-page'
import { CategoryShowcase, type ShowcaseCategory } from './category-showcase'
import { hasCategoryArrival } from './category-transition'
import { QuoteDemo } from './quote-demo'
import { BudgetGuide } from './budget-demo'
import { ColorGuide } from './color-demo'
import { SpaceGuide } from './space-demo'
import { ProviderQuotes } from './client-planning'
import { EventsHub } from './events-hub'
import { ProviderServices } from './provider-services'
import { clientLegacyRedirects, findRoute, homeFor, normalizePath, parseBusinessPath, parseCategoryPath, profilePathFor, safeCategoryReturn, visibleNavigationFor, type NavItem, type Role } from './navigation'
import { ProviderPublic } from './provider-public'
import { MarketplaceFeed } from './marketplace-feed'
import type { SessionUser } from './session'

const images = {
  hero: 'https://images.unsplash.com/photo-1536392706976-e486e2ba97af?auto=format&fit=crop&w=1800&q=88',
  flowers: 'https://images.unsplash.com/photo-1562050147-fda1cc9a6378?auto=format&fit=crop&w=1000&q=85',
  table: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=85',
  wedding: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1200&q=85',
  dinner: 'https://images.unsplash.com/photo-1643066873594-4df339b2e232?auto=format&fit=crop&w=1200&q=85',
  music: 'https://images.unsplash.com/photo-1566808907623-51b8fc382454?auto=format&fit=crop&w=1200&q=85',
  dj: 'https://images.unsplash.com/photo-1553190842-24c3f93ba116?auto=format&fit=crop&w=1000&q=85',
  concert: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1000&q=85',
  details: 'https://images.unsplash.com/photo-1473973916745-60839aebf06b?auto=format&fit=crop&w=1000&q=85',
}

type IconName =
  | 'arrow'
  | 'calendar'
  | 'check'
  | 'chevron'
  | 'clock'
  | 'close'
  | 'grid'
  | 'heart'
  | 'home'
  | 'layers'
  | 'menu'
  | 'message'
  | 'people'
  | 'pin'
  | 'plus'
  | 'search'
  | 'settings'
  | 'sparkle'
  | 'star'
  | 'wallet'

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4m8-4v4M3 10h18" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <path d="M6 6 18 18M18 6 6 18" />,
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10M9 21v-7h6v7" /></>,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    message: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />,
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    sparkle: <path d="m12 3 1.4 4.1L17.5 9l-4.1 1.9L12 15l-1.4-4.1L6.5 9l4.1-1.9L12 3Zm6 11 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z" />,
    star: <path d="m12 2.8 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9L6.4 20l1.1-6.2L3 9.4l6.2-.9L12 2.8Z" />,
    wallet: <><path d="M4 6h15a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h13" /><path d="M16 11h5v5h-5a2.5 2.5 0 0 1 0-5Z" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const categories = [
  { title: 'Locación', count: 'Sin servicios' },
  { title: 'Fotografía', count: 'Sin servicios' },
  { title: 'Servicios de banquetes', count: 'Sin servicios' },
  { title: 'Música y DJ', count: 'Sin servicios' },
  { title: 'Flores y decoración', count: 'Sin servicios' },
  { title: 'Servicio de meseros', count: 'Sin servicios' },
  { title: 'Mobiliario', count: 'Sin servicios' },
]

const categoryTerms: Record<string, string[]> = {
  locacion: ['locacion', 'espacio', 'espacios', 'salon', 'salones', 'lugar'],
  fotografia: ['fotografia', 'foto', 'fotos'],
  banquetes: ['banquete', 'banquetes', 'catering', 'gastronomia', 'comida'],
  musica: ['musica', 'dj'],
  'flores-decoracion': ['flores', 'flor', 'decoracion', 'decoraciones'],
  meseros: ['mesero', 'meseros'],
  mobiliario: ['mobiliario', 'mueble', 'muebles', 'sillas'],
}

const normalizeSearch = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

const toShowcaseCategories = (categories: CatalogCategory[]): ShowcaseCategory[] => categories.map((category) => ({
  slug: category.slug,
  title: category.title,
  description: category.description,
  image: category.imageUrl,
  href: `/categorias/${category.slug}`,
  serviceCount: category.serviceCount ?? 0,
}))

const findCatalogCategory = (catalog: ShowcaseCategory[], query: string) => {
  const normalized = normalizeSearch(query)
  if (!normalized) return null
  const byTitle = catalog.find((category) => {
    const title = normalizeSearch(category.title)
    return title.includes(normalized) || normalized.includes(title)
  })
  if (byTitle) return byTitle
  const slug = Object.entries(categoryTerms).find(([, terms]) => terms.some((term) => normalized.includes(term)))?.[0]
  return catalog.find((category) => category.slug === slug) ?? null
}

const popularCategories = [
  { title: 'Locación', href: '/categorias/locacion' },
  { title: 'Fotografía', href: '/categorias/fotografia' },
  { title: 'Banquetes', href: '/categorias/banquetes' },
  { title: 'Música y DJ', href: '/categorias/musica' },
  { title: 'Flores y decoración', href: '/categorias/flores-decoracion' },
  { title: 'Meseros', href: '/categorias/meseros' },
  { title: 'Mobiliario', href: '/categorias/mobiliario' },
]

const guides = [
  { id: 'espacio', number: '01', kicker: 'GUÍA', title: 'Cómo elegir el espacio perfecto', kind: 'lesson' as const },
  { id: 'color', number: '02', kicker: 'GUÍA', title: 'Paletas de color que amamos', kind: 'palette' as const },
  { id: 'presupuesto', number: '03', kicker: 'GUÍA', title: 'Presupuesto sin complicaciones', kind: 'budget' as const },
  { id: 'cotizacion', number: '04', kicker: 'DEMOSTRACIÓN', title: 'Planifica con claridad', note: 'Una demostración pública, con datos ficticios, de cómo se ve aceptar una cotización.', kind: 'demo' as const },
]

const tips = [
  { id: 'invitados', number: '01', title: 'Recorre el lugar con tus invitados', body: 'Camina el espacio a la hora del evento. Mira la luz, el acceso y si la mesa cabe sin apretar a la gente. El ritmo del día importa tanto como el tamaño del salón.' },
  { id: 'paleta', number: '02', title: 'Elige la paleta antes que los detalles', body: 'El color de las flores y de la mesa se nota desde la entrada. Define dos o tres tonos y repítelos en mantel, flores y papelería para que todo se sienta de una sola pieza.' },
  { id: 'partidas', number: '03', title: 'Separa el monto por categoría', body: 'Anota locación, banquetes, música, flores, meseros y mobiliario por separado. Confirma cada partida antes de contratar y deja un margen para lo que aparezca al final.' },
]

const handleAppLink = (event: MouseEvent<HTMLAnchorElement>, path: string, onNavigate: (path: string) => void) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  onNavigate(path)
}


function DashboardShell({ session, spacious = false, onNavigate, children }: { session?: SessionUser | null; spacious?: boolean; onNavigate?: (path: string) => void; children: React.ReactNode }) {
  const greeting = session?.name ?? 'Valentina'
  const profilePath = session ? profilePathFor(session.role) : null
  return (
    <div className={spacious ? 'dashboard-shell marketplace-shell' : 'dashboard-shell'}>
      <div className="dashboard-main">
        <div className="dashboard-topbar">
          <div>
            <span className="eyebrow">TU ESPACIO</span>
            <h3>Hola, {greeting}</h3>
          </div>
          <div className="avatar-stack">
            {session && profilePath && onNavigate ? (
              <a
                className="workspace-profile-link"
                href={profilePath}
                aria-label={`Editar perfil de ${session.name}`}
                onClick={(event) => handleAppLink(event, profilePath, onNavigate)}
              >
                <UserAvatar user={session} size={40} />
              </a>
            ) : session ? (
              <UserAvatar user={session} size={40} />
            ) : (
              <div className="demo-avatar">VP</div>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function OverviewView({ mode }: { mode: Role }) {
  const isAdmin = mode === 'admin'
  const isProvider = mode === 'proveedor'
  const stats = isAdmin
    ? [['Usuarios activos', '8,492', '+12.4%'], ['Proveedores', '1,286', '+8.1%'], ['Eventos creados', '3,840', '+16.8%']]
    : isProvider
      ? [['Ingresos este mes', '$84,240', '+18.2%'], ['Solicitudes', '32', '+12 nuevas'], ['Conversión', '28.4%', '+4.2%']]
      : [['Presupuesto', '$185,000', '68% asignado'], ['Proveedores', '8', '5 confirmados'], ['Tareas', '24', '18 completadas']]
  return (
    <>
      <div className="stat-grid">
        {stats.map(([label, value, meta], index) => (
          <div className="stat-card" key={label}>
            <div className={`stat-icon stat-${index}`}><Icon name={index === 0 ? 'wallet' : index === 1 ? 'people' : 'check'} size={18} /></div>
            <span>{label}</span><strong>{value}</strong><small>{meta}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <div className="chart-card">
          <div className="card-title"><div><span>{isAdmin ? 'Actividad en la plataforma' : isProvider ? 'Rendimiento comercial' : 'Distribución del presupuesto'}</span><small>Últimos 6 meses</small></div><button>Mensual <Icon name="chevron" size={13} /></button></div>
          <div className="chart">
            {[42, 57, 49, 74, 65, 88, 70, 94, 84, 108, 97, 122].map((height, index) => <i key={index} style={{ height }} className={index === 11 ? 'last' : ''} />)}
          </div>
          <div className="chart-labels"><span>Ene</span><span>Mar</span><span>May</span><span>Jul</span><span>Sep</span><span>Nov</span></div>
        </div>
        <div className="next-card">
          <div className="card-title"><div><span>{isAdmin ? 'Actividad reciente' : isProvider ? 'Próximas solicitudes' : 'Próximo evento'}</span><small>Actualizado ahora</small></div><button className="icon-btn"><Icon name="arrow" size={16} /></button></div>
          <div className="event-visual" style={{ backgroundImage: `url(${images.table})` }}><span className="date-tile"><b>24</b>AGO</span></div>
          <h4>{isAdmin ? 'Nuevos proveedores verificados' : isProvider ? 'Boda · Camila & Javier' : 'Boda de Valentina & Daniel'}</h4>
          <p><Icon name="pin" size={14} /> Hacienda Los Olivos · 120 invitados</p>
          <div className="progress-label"><span>Progreso</span><strong>72%</strong></div>
          <div className="progress"><i /></div>
        </div>
      </div>
    </>
  )
}

function RoleNav({ items, activePath, onNavigate }: { items: NavItem[]; activePath: string; onNavigate: (path: string) => void }) {
  return (
    <nav className="tour-tabs" aria-label="Secciones de tu cuenta">
      {items.map((item) => (
        <a href={item.path} key={item.id} className={item.path === activePath ? 'active' : ''} aria-current={item.path === activePath ? 'page' : undefined} onClick={(event) => handleAppLink(event, item.path, onNavigate)}>{item.label}</a>
      ))}
    </nav>
  )
}

function RecordView({ title, hint, rows }: { title: string; hint: string; rows: [string, string, string, string][] }) {
  return (
    <div className="service-table workspace-records">
      <div className="card-title"><div><span>{title}</span><small>{hint}</small></div></div>
      {rows.map(([primary, secondary, meta, status]) => (
        <div className="table-row" key={`${primary}-${secondary}`}>
          <div className="service-symbol"><Icon name="check" size={22} /></div>
          <div><strong>{primary}</strong><small>{secondary}</small></div>
          <b>{meta}</b>
          <span className={`status ${status === 'Pendiente' ? 'pending' : ''}`}>{status}</span>
        </div>
      ))}
    </div>
  )
}

function RouteBody({ routeId, role, session, onSession, onNavigate }: { routeId: string; role: Role; session: SessionUser; onSession: (user: SessionUser) => void; onNavigate: (path: string) => void }) {
  if (routeId === 'marketplace') return <MarketplaceFeed session={session} onNavigate={onNavigate} />
  if (routeId === 'eventos') return <EventsHub onNavigate={onNavigate} />
  if (routeId === 'perfil' || routeId === 'perfil-proveedor' || routeId === 'perfil-admin') return <ClientProfile session={session} onSession={onSession} />
  if (routeId === 'configuracion' || routeId === 'configuracion-proveedor' || routeId === 'configuracion-admin') return <AccountSettings session={session} />
  if (routeId === 'solicitudes' || routeId === 'cotizaciones-proveedor') return <ProviderQuotes />
  if (routeId === 'dashboard') return <OverviewView mode={role} />
  if (routeId === 'negocio') return <BusinessProfile session={session} onSession={onSession} />
  if (routeId === 'servicios') return <ProviderServices />
  if (routeId === 'contrataciones-proveedor') return <RecordView title="Contrataciones" hint="Eventos confirmados contigo" rows={[['Camila & Javier', 'Boda · 24 ago', '$18,900', 'Vigente'], ['Casa Oliva', 'Cena privada', '$12,400', 'Pendiente']]} />
  if (routeId === 'usuarios') return <AdminUsers />
  if (routeId === 'proveedores') return <AdminUsers onlyProviders />
  if (routeId === 'categorias') return <RecordView title="Categorías" hint="Marketplace" rows={categories.map((category): [string, string, string, string] => [category.title, category.count, 'Visible', 'Vigente'])} />
  return <RecordView title="Reportes" hint="Actividad de los últimos meses" rows={[['Agosto', 'Eventos creados', '640', 'Vigente'], ['Septiembre', 'Nuevos proveedores', '86', 'Vigente'], ['Octubre', 'Cotizaciones', '1,240', 'Vigente']]} />
}

function Workspace({ session, route, onNavigate, onLogout, onSession }: { session: SessionUser; route: NavItem; onNavigate: (path: string) => void; onLogout: () => void; onSession: (user: SessionUser) => void }) {
  const items = visibleNavigationFor(session.role)
  return (
    <main className="workspace">
      <header className="workspace-top">
        <a href="/" aria-label="Ir al inicio de Eventia" onClick={(event) => handleAppLink(event, '/', onNavigate)}><Logo /></a>
        <div className="workspace-user">
          <UserMenu session={session} onNavigate={onNavigate} onLogout={onLogout} />
        </div>
      </header>
      <section className="product-tour section workspace-section">
        <RoleNav items={items} activePath={route.path} onNavigate={onNavigate} />
        <DashboardShell session={session} spacious onNavigate={onNavigate}>
          <RouteBody routeId={route.id} role={session.role} session={session} onSession={onSession} onNavigate={onNavigate} />
        </DashboardShell>
      </section>
    </main>
  )
}

const usePath = () => {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname))
  useEffect(() => {
    const handlePop = () => setPath(normalizePath(window.location.pathname))
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])
  const navigate = useCallback((next: string, options?: { replace?: boolean }) => {
    const url = new URL(next, window.location.origin)
    const target = normalizePath(url.pathname)
    const nextLocation = `${target}${url.search}`
    const currentLocation = `${normalizePath(window.location.pathname)}${window.location.search}`
    if (nextLocation === currentLocation) {
      setPath(target)
      return
    }
    if (options?.replace) window.history.replaceState({}, '', nextLocation)
    else window.history.pushState({}, '', nextLocation)
    setPath(target)
  }, [])
  return { path, navigate }
}

const isAuthScreen = (path: string) => path === '/ingresar' || path === '/registro' || path === '/recuperar' || path.startsWith('/restablecer/')

const resolveDestination = (path: string, session: SessionUser | null) => {
  if (parseCategoryPath(path) || parseBusinessPath(path)) return null
  if (path === '/ingresar' || path === '/registro' || path === '/recuperar') return session ? homeFor(session.role) : null
  if (path.startsWith('/restablecer/')) return null
  const legacy = clientLegacyRedirects[normalizePath(path)]
  if (legacy && session?.role === 'cliente') return legacy
  const route = findRoute(path)
  if (!route) return path === '/' ? null : session ? homeFor(session.role) : '/'
  if (!session) return '/ingresar'
  if (session.role !== route.role) return homeFor(session.role)
  return null
}

export default function App() {
  const { path, navigate } = usePath()
  const [session, setSession] = useState<SessionUser | null | undefined>(undefined)
  const destination = session === undefined ? null : resolveDestination(path, session)

  useEffect(() => {
    let active = true
    fetchSession()
      .then((result) => {
        if (active) setSession(result.user)
      })
      .catch(() => {
        if (active) setSession(null)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!destination || destination === path) return
    navigate(destination, { replace: true })
  }, [destination, navigate, path])

  useEffect(() => {
    const root = document.documentElement
    const previous = root.style.scrollBehavior
    if (hasCategoryArrival()) root.style.scrollBehavior = 'auto'
    window.scrollTo(0, 0)
    root.style.scrollBehavior = previous
  }, [path])

  const handleAuthenticated = (user: SessionUser) => {
    setSession(user)
    if (user.role === 'proveedor' && !user.providerProfile?.isComplete) {
      navigate('/proveedor/negocio', { replace: true })
      return
    }
    const next = safeCategoryReturn(new URLSearchParams(window.location.search).get('next'))
    if (user.role === 'cliente' && next) {
      navigate(next, { replace: true })
      return
    }
    navigate(homeFor(user.role), { replace: true })
  }

  const handleLogout = () => {
    logout()
      .catch(() => undefined)
      .finally(() => {
        setSession(null)
        setLoginNotice('')
        navigate('/')
      })
  }

  if (session === undefined) return <main className="login-screen"><p className="auth-status">Cargando sesión…</p></main>
  if (destination) return null
  const route = findRoute(path)
  if (route && session && session.role === route.role) {
    return <Workspace session={session} route={route} onNavigate={navigate} onLogout={handleLogout} onSession={setSession} />
  }
  if (isAuthScreen(path)) return <AuthPages path={path} onNavigate={navigate} onAuthenticated={handleAuthenticated} onSignedOut={() => setSession(null)} />
  const categoryRoute = parseCategoryPath(path)
  if (categoryRoute) return <CategoryPage slug={categoryRoute.slug} serviceId={categoryRoute.serviceId} session={session} onNavigate={navigate} />
  const businessId = parseBusinessPath(path)
  if (businessId) return <ProviderPublic providerId={businessId} onNavigate={navigate} />
  return <Landing session={session} onNavigate={navigate} onLogout={handleLogout} />
}

function Landing({ session, onNavigate, onLogout }: { session: SessionUser | null; onNavigate: (path: string) => void; onLogout: () => void }) {
  const [mobileMenu, setMobileMenu] = useState(false)
  const [catalog, setCatalog] = useState<ShowcaseCategory[]>([])
  const [isCatalogLoading, setIsCatalogLoading] = useState(true)
  const [revealToken, setRevealToken] = useState(0)
  const [guideId, setGuideId] = useState(() => window.location.hash === '#planificador' ? 'cotizacion' : '')
  const [openTipId, setOpenTipId] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)
  const popularLinks = catalog.length > 0 ? catalog.map((category) => ({ title: category.title, href: category.href })) : popularCategories

  useEffect(() => {
    const syncGuideFromHash = () => {
      if (window.location.hash === '#planificador') setGuideId('cotizacion')
    }
    window.addEventListener('hashchange', syncGuideFromHash)
    return () => window.removeEventListener('hashchange', syncGuideFromHash)
  }, [])

  useEffect(() => {
    let active = true
    fetchCategories()
      .then((result) => {
        if (!active) return
        setCatalog(toShowcaseCategories(result.categories))
      })
      .catch(() => {
        if (active) setCatalog([])
      })
      .finally(() => {
        if (active) setIsCatalogLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const handleSelectGuide = (id: string) => setGuideId((current) => current === id ? '' : id)
  const handleToggleTip = (id: string) => setOpenTipId((current) => current === id ? null : id)
  const handleCloseMenu = () => setMobileMenu(false)
  const handleToggleMenu = () => setMobileMenu((isOpen) => !isOpen)
  const handleShowCategories = () => {
    setRevealToken((value) => value + 1)
    document.getElementById('explorar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  useEffect(() => {
    if (!mobileMenu) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenu(false)
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setMobileMenu(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [mobileMenu])

  return (
    <main>
      <section className="hero" id="inicio">
        <nav className="navbar" ref={navRef} aria-label="Principal">
          <a href="#inicio" aria-label="Ir al inicio de Eventia"><Logo light /></a>
          <div id="nav-principal" className={`nav-links ${mobileMenu ? 'open' : ''}`}>
            <a href="#explorar" onClick={handleCloseMenu}>Explorar</a>
            <a href="#inspiracion" onClick={handleCloseMenu}>Inspiración</a>
            <a href="#planificador" onClick={handleCloseMenu}>Planifica tu evento</a>
            <a className="nav-drawer-link" href="/registro" onClick={(event) => { handleCloseMenu(); handleAppLink(event, '/registro', onNavigate) }}>Crear cuenta</a>
            {session ? <a className="nav-drawer-link" href={homeFor(session.role)} onClick={(event) => { handleCloseMenu(); handleAppLink(event, homeFor(session.role), onNavigate) }}>Mi espacio</a> : null}
            {session ? <button className="nav-login nav-drawer-login" type="button" onClick={() => { handleCloseMenu(); onLogout() }}>Salir</button> : <button className="nav-login nav-drawer-login" type="button" onClick={() => { handleCloseMenu(); onNavigate('/ingresar') }}>Ingresar</button>}
          </div>
          <div className="nav-actions">
            {session ? null : <a href="/registro" onClick={(event) => handleAppLink(event, '/registro', onNavigate)}>Crear cuenta</a>}
            {session ? <a href={homeFor(session.role)} onClick={(event) => handleAppLink(event, homeFor(session.role), onNavigate)}>Mi espacio</a> : null}
            {session ? <button className="nav-login" type="button" onClick={onLogout}>Salir</button> : <button className="nav-login" type="button" onClick={() => onNavigate('/ingresar')}>Ingresar</button>}
            <button className="mobile-toggle" type="button" aria-expanded={mobileMenu} aria-controls="nav-principal" aria-label={mobileMenu ? 'Cerrar menú' : 'Abrir menú'} onClick={handleToggleMenu}>
              <Icon name={mobileMenu ? 'close' : 'menu'} />
            </button>
          </div>
        </nav>
        <div className="hero-bg" style={{ backgroundImage: `url(${images.hero})` }} />
        <div className="hero-overlay" />
        <div className="hero-glow" />
        <div className="hero-content">
          <div className="hero-pill"><Icon name="sparkle" size={15} /> Tu celebración, extraordinaria</div>
          <h1>Tu evento perfecto<br />comienza <em>aquí</em></h1>
          <p>Descubre espacios, talentos y experiencias únicas para crear un día que se sienta completamente tuyo.</p>
          <div className="popular" role="group" aria-label="Populares"><span>Popular:</span>{popularLinks.map((item) => <a key={item.href} href={item.href} onClick={(event) => handleAppLink(event, item.href, onNavigate)}>{item.title}</a>)}</div>
        </div>
        <div className="hero-proof"><div className="proof-avatars"><span>MC</span><span>AR</span><span>LP</span></div><div><strong>4.9 <Icon name="star" size={12} /></strong><small>+2,400 eventos creados</small></div></div>
        <a className="scroll-cue" href="#explorar"><span>Descubre</span><i /></a>
      </section>

      <section className="section categories-section" id="explorar">
        <div className="section-heading">
          <div><span className="eyebrow coral">EXPLORA SIN LÍMITES</span><h2>Todo lo que imaginas,<br /><em>en un solo lugar.</em></h2></div>
          <p>Una selección curada de profesionales que convierten ideas en experiencias memorables.</p>
        </div>
        <CategoryShowcase categories={catalog} isLoading={isCatalogLoading} onNavigate={onNavigate} revealToken={revealToken} />
        <div className="center-action"><button className="text-button" type="button" onClick={handleShowCategories}>Ver todas las categorías <Icon name="arrow" /></button></div>
      </section>

      <section className="editorial" id="inspiracion">
        <div className="editorial-copy">
          <span className="eyebrow coral">JOURNAL · GUÍAS & CONSEJOS</span>
          <h2>Planea cada detalle.<br /><em>Disfruta cada instante.</em></h2>
          <p>Abre una guía para ver la demostración debajo, o un consejo para leerlo.</p>
          <div className="journal-lists">
            <div>
              <h3 id="planificador">Guías</h3>
              <div className="article-links" role="group" aria-label="Guías">{guides.map((guide) => {
                const isOpen = guideId === guide.id
                return <div className="tip guide-item" key={guide.id}><button type="button" aria-expanded={isOpen} aria-controls={`guia-${guide.id}`} onClick={() => handleSelectGuide(guide.id)}><span>{guide.number}</span><div><small>{guide.kicker}</small><strong>{guide.title}</strong></div><Icon name="chevron" /></button>{isOpen ? <div className={`guide-media${guide.kind === 'demo' ? '' : ' is-lesson'}`} id={`guia-${guide.id}`}>{guide.kind === 'lesson' ? <SpaceGuide onNavigate={onNavigate} /> : guide.kind === 'palette' ? <ColorGuide onNavigate={onNavigate} /> : guide.kind === 'budget' ? <BudgetGuide /> : <QuoteDemo />}{guide.kind === 'demo' ? <p>{guide.note}</p> : null}</div> : null}</div>
              })}</div>
            </div>
            <div>
              <h3>Consejos</h3>
              <div className="article-links">{tips.map((tip) => {
                const isOpen = openTipId === tip.id
                return <div className="tip" key={tip.id}><button type="button" aria-expanded={isOpen} aria-controls={`consejo-${tip.id}`} onClick={() => handleToggleTip(tip.id)}><span>{tip.number}</span><div><small>CONSEJO</small><strong>{tip.title}</strong></div><Icon name="chevron" /></button>{isOpen ? <p id={`consejo-${tip.id}`}>{tip.body}</p> : <p id={`consejo-${tip.id}`} hidden>{tip.body}</p>}</div>
              })}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="how-section section" id="como-funciona">
        <div className="how-heading"><span className="eyebrow coral">ASÍ DE SIMPLE</span><h2>De la idea al<br /><em>gran día.</em></h2></div>
        <div className="steps">
          {[
            ['01', 'Inspírate y descubre', 'Explora una selección de espacios, servicios y profesionales verificados.', 'search'],
            ['02', 'Compara y conecta', 'Solicita propuestas visuales y encuentra el equipo ideal para tu evento.', 'message'],
            ['03', 'Planifica y disfruta', 'Organiza cada detalle en un solo lugar y vive el proceso sin estrés.', 'calendar'],
          ].map(([number, title, copy, icon], index) => <div className="step" key={number}><div className={`step-icon step-${index}`}><Icon name={icon as IconName} size={25} /></div><span>{number}</span><h3>{title}</h3><p>{copy}</p>{index < 2 && <i className="step-line" />}</div>)}
        </div>
      </section>

      <section className="provider-banner" id="proveedores">
        <div className="provider-bg" style={{ backgroundImage: `url(${images.concert})` }} />
        <div className="provider-overlay" />
        <div className="provider-copy"><span className="eyebrow light">CRECE CON EVENTIA</span><h2>Tu talento merece<br /><em>ser descubierto.</em></h2><p>Únete a una comunidad de profesionales creativos y conecta con clientes que valoran lo extraordinario.</p><button className="light-button" type="button" onClick={() => onNavigate('/registro?tipo=proveedor')}>Publica tus servicios <Icon name="arrow" /></button></div>
        <div className="provider-stats"><div><strong>12k+</strong><span>clientes activos</span></div><div><strong>1.2k</strong><span>proveedores</span></div><div><strong>38</strong><span>ciudades</span></div></div>
      </section>

      <footer id="contacto">
        <div className="footer-main"><div className="footer-brand"><a href="#inicio" aria-label="Ir al inicio de Eventia"><Logo light /></a><p>Eventos extraordinarios,<br />hechos simples.</p><div className="socials"><button type="button" aria-label="LinkedIn">in</button><button type="button" aria-label="Instagram">ig</button><button type="button" aria-label="Pinterest">p</button></div></div><div className="footer-links"><div><strong>Descubre</strong><a href="/categorias/locacion" onClick={(event) => handleAppLink(event, '/categorias/locacion', onNavigate)}>Locación</a><a href="#proveedores">Proveedores</a><a href="#inspiracion">Inspiración</a><a href="#planificador">Planificador</a></div><div><strong>Eventia</strong><a href="#inicio">Sobre nosotros</a><a href="#como-funciona">Cómo funciona</a><a href="#proveedores">Para proveedores</a><a href="#contacto">Contacto</a></div><div><strong>Recibe inspiración</strong><p>Ideas y tendencias, directo a tu correo.</p><div className="subscribe"><input aria-label="Correo electrónico" placeholder="tu@email.com" /><button type="button" aria-label="Suscribirme"><Icon name="arrow" /></button></div></div></div></div>
        <div className="footer-bottom"><span>© 2025 Eventia. Todos los derechos reservados.</span><div><span>Privacidad</span><span>Términos</span><span>Cookies</span></div></div>
      </footer>
    </main>
  )
}
