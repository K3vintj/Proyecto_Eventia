import { useEffect, useState, type FormEvent } from 'react'
import { changeAccountPassword, fetchAdminUsers, saveAccountProfile, saveProviderProfile } from './auth-api'
import { roleLabel } from './navigation'
import type { SessionUser } from './session'

export const UserAvatar = ({ user, size = 36 }: { user: Pick<SessionUser, 'name' | 'initials' | 'avatarUrl'>; size?: number }) => {
  if (user.avatarUrl) {
    return (
      <img
        className="user-avatar"
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span className="user-avatar user-avatar-fallback" style={{ width: size, height: size }} aria-hidden="true">
      {user.initials}
    </span>
  )
}

export const ClientProfile = ({ session, onSession }: { session: SessionUser; onSession: (user: SessionUser) => void }) => {
  const [fullName, setFullName] = useState(session.name)
  const [email, setEmail] = useState(session.email)
  const [phone, setPhone] = useState(session.phone || '')
  const [avatarUrl, setAvatarUrl] = useState(session.avatarUrl || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const preview = { name: fullName || session.name, initials: session.initials, avatarUrl: avatarUrl || null }

  useEffect(() => {
    setFullName(session.name)
    setEmail(session.email)
    setPhone(session.phone || '')
    setAvatarUrl(session.avatarUrl || '')
  }, [session])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage('')
    setIsError(false)
    try {
      const result = await saveAccountProfile({ fullName, email, avatarUrl, phone })
      onSession(result.user)
      setMessage('Perfil actualizado.')
    } catch (error) {
      setIsError(true)
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar el perfil.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="service-table auth-form profile-edit" onSubmit={handleSubmit}>
      <div className="card-title">
        <div>
          <span>Mi perfil</span>
          <small>Actualiza tu nombre, correo, teléfono y foto de perfil</small>
        </div>
      </div>
      <div className="profile-preview">
        <UserAvatar user={preview} size={72} />
        <div>
          <strong>{fullName || 'Tu nombre'}</strong>
          <small>{email || 'tu@correo.com'}</small>
        </div>
      </div>
      {message ? <p className={isError ? 'auth-error' : 'auth-success'} role={isError ? 'alert' : 'status'}>{message}</p> : null}
      <label className="auth-field" htmlFor="profile-name"><span>Nombre completo</span><input id="profile-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required autoComplete="name" /></label>
      <label className="auth-field" htmlFor="profile-email"><span>Correo</span><input id="profile-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
      <label className="auth-field" htmlFor="profile-phone"><span>Teléfono</span><input id="profile-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+52 ..." autoComplete="tel" /></label>
      <label className="auth-field" htmlFor="profile-avatar"><span>URL de la foto de perfil</span><input id="profile-avatar" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://..." autoComplete="off" /></label>
      <p className="auth-status">El rol de la cuenta no se puede modificar desde aquí. Usa una imagen pública (https) o deja el campo vacío para mostrar tus iniciales.</p>
      <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando…' : 'Guardar perfil'}</button>
    </form>
  )
}

export const AccountSettings = ({ session }: { session: SessionUser }) => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [fields, setFields] = useState<Record<string, string>>({})

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage('')
    setIsError(false)
    setFields({})
    try {
      const result = await changeAccountPassword({ currentPassword, password, confirmPassword })
      setCurrentPassword('')
      setPassword('')
      setConfirmPassword('')
      setMessage(result.message || 'Contraseña actualizada.')
    } catch (error) {
      setIsError(true)
      const apiError = error as Error & { fields?: Record<string, string> }
      setFields(apiError.fields || {})
      setMessage(apiError.message || 'No se pudo actualizar la contraseña.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="account-settings">
      <section className="service-table auth-form">
        <div className="card-title">
          <div>
            <span>Configuración de cuenta</span>
            <small>Seguridad y preferencias de tu cuenta Eventia</small>
          </div>
        </div>
        <div className="settings-summary">
          <div><span>Correo</span><strong>{session.email}</strong></div>
          <div><span>Usuario</span><strong>@{session.username}</strong></div>
          <div><span>Rol</span><strong>{roleLabel[session.role]}</strong></div>
        </div>
      </section>
      <form className="service-table auth-form" onSubmit={handleSubmit}>
        <div className="card-title">
          <div>
            <span>Cambiar contraseña</span>
            <small>Usa al menos 8 caracteres. La contraseña se guarda cifrada.</small>
          </div>
        </div>
        {message ? <p className={isError ? 'auth-error' : 'auth-success'} role={isError ? 'alert' : 'status'}>{message}</p> : null}
        <label className="auth-field" htmlFor="settings-current">
          <span>Contraseña actual</span>
          <input id="settings-current" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          {fields.currentPassword ? <small className="auth-field-error">{fields.currentPassword}</small> : null}
        </label>
        <label className="auth-field" htmlFor="settings-password">
          <span>Nueva contraseña</span>
          <input id="settings-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          {fields.password ? <small className="auth-field-error">{fields.password}</small> : null}
        </label>
        <label className="auth-field" htmlFor="settings-confirm">
          <span>Confirmar nueva contraseña</span>
          <input id="settings-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          {fields.confirmPassword ? <small className="auth-field-error">{fields.confirmPassword}</small> : null}
        </label>
        <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando…' : 'Actualizar contraseña'}</button>
      </form>
      <section className="service-table auth-form">
        <div className="card-title">
          <div>
            <span>Notificaciones</span>
            <small>Las alertas por correo aún no están activas en Eventia</small>
          </div>
        </div>
        <label className="settings-toggle is-disabled">
          <input type="checkbox" disabled aria-disabled="true" />
          <span>
            <strong>Avisos por correo</strong>
            <small>Disponible cuando el sistema de notificaciones esté habilitado.</small>
          </span>
        </label>
      </section>
    </div>
  )
}

export const BusinessProfile = ({ session, onSession }: { session: SessionUser; onSession: (user: SessionUser) => void }) => {
  const profile = session.providerProfile
  const [businessName, setBusinessName] = useState(profile?.businessName || '')
  const [city, setCity] = useState(profile?.city || '')
  const [description, setDescription] = useState(profile?.description || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage('')
    setIsError(false)
    try {
      const result = await saveProviderProfile({ businessName, city, description })
      onSession(result.user)
      setMessage('Negocio guardado.')
    } catch (error) {
      setIsError(true)
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar el negocio.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="service-table auth-form" onSubmit={handleSubmit}>
      <div className="card-title"><div><span>Mi negocio</span><small>{profile?.isComplete ? 'Perfil comercial publicado' : 'Completa tu perfil para publicar servicios'}</small></div></div>
      {message ? <p className={isError ? 'auth-error' : 'auth-success'} role={isError ? 'alert' : 'status'}>{message}</p> : null}
      <label className="auth-field" htmlFor="business-name"><span>Nombre del negocio</span><input id="business-name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} /></label>
      <label className="auth-field" htmlFor="business-city"><span>Ciudad</span><input id="business-city" value={city} onChange={(event) => setCity(event.target.value)} /></label>
      <label className="auth-field" htmlFor="business-description"><span>Descripción</span><input id="business-description" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando…' : 'Guardar negocio'}</button>
    </form>
  )
}

export const AdminUsers = ({ onlyProviders = false }: { onlyProviders?: boolean }) => {
  const [users, setUsers] = useState<SessionUser[] | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    fetchAdminUsers()
      .then((result) => {
        if (active) setUsers(result.users)
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : 'No se pudieron cargar las cuentas.')
      })
    return () => {
      active = false
    }
  }, [])

  if (message) return <p className="auth-error" role="alert">{message}</p>
  if (!users) return <p className="auth-status">Cargando cuentas…</p>
  const visible = onlyProviders ? users.filter((user) => user.role === 'proveedor') : users
  return (
    <div className="service-table">
      <div className="card-title"><div><span>{onlyProviders ? 'Proveedores' : 'Usuarios'}</span><small>{visible.length} cuentas desde la base de datos</small></div></div>
      {visible.map((user) => (
        <div className="table-row" key={user.id}>
          <div className="service-symbol"><IconMark initials={user.initials} /></div>
          <div><strong>{user.name}</strong><small>{user.email}</small></div>
          <b>{user.username}</b>
          <span className="status">{roleLabel[user.role]}</span>
        </div>
      ))}
    </div>
  )
}

const IconMark = ({ initials }: { initials: string }) => <span>{initials}</span>
