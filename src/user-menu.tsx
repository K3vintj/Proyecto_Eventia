import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { UserAvatar } from './account-panels'
import { profilePathFor, settingsPathFor, type Role } from './navigation'
import type { SessionUser } from './session'

type MenuIcon = 'people' | 'calendar' | 'settings' | 'home' | 'grid' | 'chevron'

type MenuAction = {
  id: string
  label: string
  icon: MenuIcon
  path?: string
  tone?: 'default' | 'danger'
  separatorBefore?: boolean
}

type UserMenuProps = {
  session: SessionUser
  onNavigate: (path: string) => void
  onLogout: () => void
}

const roleSubtitleFor = (role: Role) => {
  if (role === 'proveedor') return 'Proveedor de Eventia'
  if (role === 'admin') return 'Administrador de Eventia'
  return 'Cliente de Eventia'
}

const menuActionsFor = (role: Role): MenuAction[] => {
  const profile = { id: 'perfil', label: 'Mi perfil', icon: 'people' as const, path: profilePathFor(role) }
  const settings = { id: 'config', label: 'Configuración de cuenta', icon: 'settings' as const, path: settingsPathFor(role) }
  const logout = { id: 'logout', label: 'Cerrar sesión', icon: 'settings' as const, tone: 'danger' as const, separatorBefore: true }
  if (role === 'proveedor') {
    return [profile, { id: 'negocio', label: 'Mi negocio', icon: 'home', path: '/proveedor/negocio' }, settings, logout]
  }
  if (role === 'admin') {
    return [profile, { id: 'admin', label: 'Panel de administración', icon: 'grid', path: '/admin' }, settings, logout]
  }
  return [profile, { id: 'eventos', label: 'Mis eventos', icon: 'calendar', path: '/eventos' }, settings, logout]
}

const MenuGlyph = ({ name }: { name: MenuIcon }) => {
  const paths: Record<MenuIcon, React.ReactNode> = {
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4m8-4v4M3 10h18" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10M9 21v-7h6v7" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

export const UserMenu = ({ session, onNavigate, onLogout }: UserMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const actions = menuActionsFor(session.role)

  const handleClose = (restoreFocus = false) => {
    setIsOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!isOpen) return
    const handlePointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) handleClose()
    }
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleClose(true)
      }
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !menuRef.current) return
    const menu = menuRef.current
    menu.style.right = '0px'
    menu.style.left = 'auto'
    menu.style.top = ''
    const rect = menu.getBoundingClientRect()
    if (rect.right > window.innerWidth - 12) {
      menu.style.right = `${Math.max(0, rect.right - window.innerWidth + 12)}px`
    }
    if (rect.bottom > window.innerHeight - 12) {
      menu.style.top = `${Math.min(-8, window.innerHeight - rect.bottom - 12)}px`
    }
    const firstItem = menu.querySelector<HTMLButtonElement>('[role="menuitem"]')
    firstItem?.focus()
  }, [isOpen])

  const handleToggle = () => setIsOpen((current) => !current)

  const handleSelect = (action: MenuAction) => {
    handleClose()
    if (action.id === 'logout') {
      onLogout()
      return
    }
    if (action.path) onNavigate(action.path)
  }

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || [])
    if (items.length === 0) return
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      items[(index + 1 + items.length) % items.length]?.focus()
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      items[(index - 1 + items.length) % items.length]?.focus()
    }
    if (event.key === 'Home') {
      event.preventDefault()
      items[0]?.focus()
    }
    if (event.key === 'End') {
      event.preventDefault()
      items[items.length - 1]?.focus()
    }
  }

  return (
    <div className={`user-menu ${isOpen ? 'is-open' : ''}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={`Menú de cuenta de ${session.name}`}
        onClick={handleToggle}
      >
        <UserAvatar user={session} size={40} />
        <span className="user-menu-trigger-name">{session.name}</span>
      </button>
      {isOpen ? (
        <div
          id={menuId}
          className="user-menu-panel"
          role="menu"
          aria-label="Opciones de cuenta"
          ref={menuRef}
          onKeyDown={handleMenuKeyDown}
        >
          <button
            type="button"
            className="user-menu-header"
            role="menuitem"
            onClick={() => handleSelect({ id: 'perfil-header', label: 'Mi perfil', icon: 'people', path: profilePathFor(session.role) })}
          >
            <UserAvatar user={session} size={44} />
            <div className="user-menu-header-copy">
              <strong>{session.name}</strong>
              <small>{roleSubtitleFor(session.role)}</small>
            </div>
            <span className="user-menu-header-chevron" aria-hidden="true">
              <MenuGlyph name="chevron" />
            </span>
          </button>
          <div className="user-menu-list">
            {actions.map((action) => (
              <div key={action.id}>
                {action.separatorBefore ? <div className="user-menu-separator" role="separator" /> : null}
                <button
                  type="button"
                  role="menuitem"
                  className={`user-menu-item${action.tone === 'danger' ? ' is-danger' : ''}`}
                  onClick={() => handleSelect(action)}
                >
                  {action.tone === 'danger' ? null : (
                    <span className="user-menu-item-icon" aria-hidden="true">
                      <MenuGlyph name={action.icon} />
                    </span>
                  )}
                  <span>{action.label}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
