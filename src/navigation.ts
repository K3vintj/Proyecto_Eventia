export type Role = 'cliente' | 'proveedor' | 'admin'

export type NavIcon = 'grid' | 'calendar' | 'message' | 'check' | 'home' | 'layers' | 'people' | 'wallet' | 'sparkle'

export type NavItem = {
  id: string
  label: string
  path: string
  icon: NavIcon
  role: Role
  navHidden?: boolean
}

export const navigation: NavItem[] = [
  { id: 'marketplace', label: 'Marketplace', path: '/inicio', icon: 'home', role: 'cliente' },
  { id: 'eventos', label: 'Mis eventos', path: '/eventos', icon: 'calendar', role: 'cliente' },
  { id: 'perfil', label: 'Mi perfil', path: '/perfil', icon: 'people', role: 'cliente', navHidden: true },
  { id: 'configuracion', label: 'Configuración', path: '/configuracion', icon: 'sparkle', role: 'cliente', navHidden: true },
  { id: 'negocio', label: 'Mi negocio', path: '/proveedor/negocio', icon: 'home', role: 'proveedor' },
  { id: 'servicios', label: 'Servicios', path: '/proveedor/servicios', icon: 'layers', role: 'proveedor' },
  { id: 'solicitudes', label: 'Solicitudes', path: '/proveedor/solicitudes', icon: 'calendar', role: 'proveedor' },
  { id: 'cotizaciones-proveedor', label: 'Cotizaciones', path: '/proveedor/cotizaciones', icon: 'message', role: 'proveedor' },
  { id: 'contrataciones-proveedor', label: 'Contrataciones', path: '/proveedor/contrataciones', icon: 'check', role: 'proveedor' },
  { id: 'perfil-proveedor', label: 'Mi perfil', path: '/proveedor/perfil', icon: 'people', role: 'proveedor', navHidden: true },
  { id: 'configuracion-proveedor', label: 'Configuración', path: '/proveedor/configuracion', icon: 'sparkle', role: 'proveedor', navHidden: true },
  { id: 'dashboard', label: 'Dashboard', path: '/admin', icon: 'grid', role: 'admin' },
  { id: 'usuarios', label: 'Usuarios', path: '/admin/usuarios', icon: 'people', role: 'admin' },
  { id: 'proveedores', label: 'Proveedores', path: '/admin/proveedores', icon: 'wallet', role: 'admin' },
  { id: 'categorias', label: 'Categorías', path: '/admin/categorias', icon: 'layers', role: 'admin' },
  { id: 'reportes', label: 'Reportes', path: '/admin/reportes', icon: 'calendar', role: 'admin' },
  { id: 'perfil-admin', label: 'Mi perfil', path: '/admin/perfil', icon: 'people', role: 'admin', navHidden: true },
  { id: 'configuracion-admin', label: 'Configuración', path: '/admin/configuracion', icon: 'sparkle', role: 'admin', navHidden: true },
]

export const profilePathFor = (role: Role) => {
  if (role === 'proveedor') return '/proveedor/perfil'
  if (role === 'admin') return '/admin/perfil'
  return '/perfil'
}

export const settingsPathFor = (role: Role) => {
  if (role === 'proveedor') return '/proveedor/configuracion'
  if (role === 'admin') return '/admin/configuracion'
  return '/configuracion'
}

export const clientLegacyRedirects: Record<string, string> = {
  '/planificador': '/eventos',
  '/cotizaciones': '/eventos',
  '/contrataciones': '/eventos',
}

export const roleLabel: Record<Role, string> = {
  cliente: 'Cliente',
  proveedor: 'Proveedor',
  admin: 'Administrador',
}

export const normalizePath = (path: string) => {
  const bare = path.split('?')[0]?.split('#')[0] || '/'
  if (bare.length > 1 && bare.endsWith('/')) return bare.slice(0, -1)
  return bare || '/'
}

export const navigationFor = (role: Role) => navigation.filter((item) => item.role === role)

export const visibleNavigationFor = (role: Role) => navigationFor(role).filter((item) => !item.navHidden)

export const findRoute = (path: string) => navigation.find((item) => item.path === normalizePath(path))

export const parseCategoryPath = (path: string) => {
  const match = normalizePath(path).match(/^\/categorias\/([a-z0-9-]+)(?:\/servicios\/([1-9]\d*))?$/)
  if (!match?.[1]) return null
  return { slug: match[1], serviceId: match[2] ? Number(match[2]) : null }
}

export const parseBusinessPath = (path: string) => {
  const match = normalizePath(path).match(/^\/negocios\/([1-9]\d*)$/)
  return match?.[1] ? Number(match[1]) : null
}

export const safeCategoryReturn = (value: string | null) => {
  if (!value || value.startsWith('//') || value.includes('\\') || value.includes('://')) return null
  const [path, query] = value.split('?')
  if (!path || !parseCategoryPath(path)) return null
  const action = new URLSearchParams(query || '').get('accion')
  if (action === 'planificador' || action === 'cotizacion') return `${path}?accion=${action}`
  return path
}

export const homeFor = (role: Role) => navigationFor(role)[0]?.path ?? '/'
