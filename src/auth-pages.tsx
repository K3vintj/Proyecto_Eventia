import { useEffect, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { forgotPassword, login, register, resetPassword, takeLoginNotice, validateResetToken, setLoginNotice } from './auth-api'
import { Logo } from './logo'
import { safeCategoryReturn } from './navigation'
import type { SessionUser } from './session'

type Navigate = (path: string, options?: { replace?: boolean }) => void

type AuthPagesProps = {
  path: string
  onNavigate: Navigate
  onAuthenticated: (user: SessionUser) => void
  onSignedOut: () => void
}

const go = (event: MouseEvent<HTMLAnchorElement>, path: string, onNavigate: Navigate) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  onNavigate(path)
}

const withReturn = (path: string) => {
  const next = safeCategoryReturn(new URLSearchParams(window.location.search).get('next'))
  if (!next) return path
  return `${path}?next=${encodeURIComponent(next)}`
}

const AuthShell = ({ title, children, onNavigate }: { title: string; children: ReactNode; onNavigate: Navigate }) => (
  <main className="login-screen">
    <div className="login-card">
      <a href="/" onClick={(event) => go(event, '/', onNavigate)}><Logo /></a>
      <h1>{title}</h1>
      {children}
    </div>
  </main>
)

const PasswordField = ({ id, label, value, onChange, error, autoComplete = 'current-password' }: { id: string; label: string; value: string; onChange: (value: string) => void; error?: string; autoComplete?: string }) => {
  const [isVisible, setIsVisible] = useState(false)
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password">
        <input id={id} type={isVisible ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} />
        <button type="button" aria-label={isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={isVisible} onClick={() => setIsVisible((current) => !current)}>{isVisible ? 'Ocultar' : 'Mostrar'}</button>
      </div>
      {error ? <small className="auth-field-error">{error}</small> : null}
    </div>
  )
}

const TextField = ({ id, label, type = 'text', value, autoComplete, onChange, error }: { id: string; label: string; type?: string; value: string; autoComplete?: string; onChange: (value: string) => void; error?: string }) => (
  <label className="auth-field" htmlFor={id}>
    <span>{label}</span>
    <input id={id} type={type} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} />
    {error ? <small className="auth-field-error">{error}</small> : null}
  </label>
)

export const AuthPages = ({ path, onNavigate, onAuthenticated, onSignedOut }: AuthPagesProps) => {
  if (path === '/registro') return <RegisterPage onNavigate={onNavigate} onAuthenticated={onAuthenticated} />
  if (path === '/recuperar') return <ForgotPage onNavigate={onNavigate} />
  if (path.startsWith('/restablecer/')) return <ResetPage token={decodeURIComponent(path.slice('/restablecer/'.length))} onNavigate={onNavigate} onSignedOut={onSignedOut} />
  return <LoginPage onNavigate={onNavigate} onAuthenticated={onAuthenticated} />
}

const LoginPage = ({ onNavigate, onAuthenticated }: { onNavigate: Navigate; onAuthenticated: (user: SessionUser) => void }) => {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setNotice(takeLoginNotice())
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage('')
    try {
      const result = await login({ identifier, password, remember })
      onAuthenticated(result.user)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesión.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell title="Iniciar sesión" onNavigate={onNavigate}>
      <p>Entra a tu espacio. El menú se arma con el rol de tu cuenta.</p>
      {notice ? <p className="auth-success" role="status">{notice}</p> : null}
      {message ? <p className="auth-error" role="alert">{message}</p> : null}
      <form className="auth-form" onSubmit={handleSubmit}>
        <TextField id="login-identifier" label="Correo o usuario" autoComplete="username" value={identifier} onChange={setIdentifier} />
        <PasswordField id="login-password" label="Contraseña" value={password} onChange={setPassword} />
        <div className="auth-row">
          <label className="auth-check"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Recordarme</label>
          <a className="auth-link" href="/recuperar" onClick={(event) => go(event, '/recuperar', onNavigate)}>¿Olvidaste tu contraseña?</a>
        </div>
        <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Entrando…' : 'Iniciar sesión'}</button>
      </form>
      <p className="auth-switch">¿No tienes cuenta? <a className="auth-link" href={withReturn('/registro')} onClick={(event) => go(event, withReturn('/registro'), onNavigate)}>Regístrate</a></p>
    </AuthShell>
  )
}

const RegisterPage = ({ onNavigate, onAuthenticated }: { onNavigate: Navigate; onAuthenticated: (user: SessionUser) => void }) => {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<'cliente' | 'proveedor'>(() => new URLSearchParams(window.location.search).get('tipo') === 'proveedor' ? 'proveedor' : 'cliente')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage('')
    setFields({})
    try {
      const result = await register({ fullName, email, username, password, confirmPassword, role, acceptedTerms })
      onAuthenticated(result.user)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear la cuenta.')
      setFields((error as Error & { fields?: Record<string, string> }).fields || {})
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell title="Crear cuenta" onNavigate={onNavigate}>
      <p>Regístrate como cliente o proveedor. Las cuentas de administración no se crean desde aquí.</p>
      {message ? <p className="auth-error" role="alert">{message}</p> : null}
      <form className="auth-form" onSubmit={handleSubmit}>
        <TextField id="register-name" label="Nombre completo" autoComplete="name" value={fullName} onChange={setFullName} error={fields.fullName} />
        <TextField id="register-email" label="Correo electrónico" type="email" autoComplete="email" value={email} onChange={setEmail} error={fields.email} />
        <TextField id="register-username" label="Nombre de usuario" autoComplete="username" value={username} onChange={setUsername} error={fields.username} />
        <PasswordField id="register-password" label="Contraseña" autoComplete="new-password" value={password} onChange={setPassword} error={fields.password} />
        <PasswordField id="register-confirm" label="Confirmar contraseña" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} error={fields.confirmPassword} />
        <div className="auth-field">
          <span>Tipo de cuenta</span>
          <div className="auth-choice" role="group" aria-label="Tipo de cuenta">
            <button type="button" className={role === 'cliente' ? 'active' : ''} aria-pressed={role === 'cliente'} onClick={() => setRole('cliente')}>Cliente</button>
            <button type="button" className={role === 'proveedor' ? 'active' : ''} aria-pressed={role === 'proveedor'} onClick={() => setRole('proveedor')}>Proveedor</button>
          </div>
          {fields.role ? <small className="auth-field-error">{fields.role}</small> : null}
        </div>
        <label className="auth-check"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} /> Acepto los términos y condiciones</label>
        {fields.acceptedTerms ? <small className="auth-field-error">{fields.acceptedTerms}</small> : null}
        <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}</button>
      </form>
      <p className="auth-switch">¿Ya tienes cuenta? <a className="auth-link" href={withReturn('/ingresar')} onClick={(event) => go(event, withReturn('/ingresar'), onNavigate)}>Iniciar sesión</a></p>
    </AuthShell>
  )
}

const ForgotPage = ({ onNavigate }: { onNavigate: Navigate }) => {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [recoveryPath, setRecoveryPath] = useState('')
  const [isError, setIsError] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage('')
    setRecoveryPath('')
    setIsError(false)
    try {
      const result = await forgotPassword(email)
      setMessage(result.message)
      setRecoveryPath(result.recoveryPath)
    } catch (error) {
      setIsError(true)
      setMessage(error instanceof Error ? error.message : 'No se pudo preparar la recuperación.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell title="Recuperar contraseña" onNavigate={onNavigate}>
      <p>Escribe el correo de tu cuenta para generar un enlace de un solo uso.</p>
      {message ? <p className={isError ? 'auth-error' : 'auth-success'} role={isError ? 'alert' : 'status'}>{message}</p> : null}
      {recoveryPath ? <a className="auth-recovery" href={recoveryPath} onClick={(event) => go(event, recoveryPath, onNavigate)}>Abrir enlace de recuperación</a> : null}
      <form className="auth-form" onSubmit={handleSubmit}>
        <TextField id="forgot-email" label="Correo electrónico" type="email" autoComplete="email" value={email} onChange={setEmail} />
        <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Generando enlace…' : 'Solicitar enlace'}</button>
      </form>
      <p className="auth-switch"><a className="auth-link" href="/ingresar" onClick={(event) => go(event, '/ingresar', onNavigate)}>Volver a iniciar sesión</a></p>
    </AuthShell>
  )
}

const ResetPage = ({ token, onNavigate, onSignedOut }: { token: string; onNavigate: Navigate; onSignedOut: () => void }) => {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChecking, setIsChecking] = useState(true)
  const [isValid, setIsValid] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true
    validateResetToken(token)
      .then((result) => {
        if (!active) return
        setIsValid(result.valid)
        if (!result.valid) setMessage('El enlace caducó o ya se usó. Solicita uno nuevo.')
      })
      .catch(() => {
        if (!active) return
        setMessage('No se pudo comprobar el enlace.')
      })
      .finally(() => {
        if (active) setIsChecking(false)
      })
    return () => {
      active = false
    }
  }, [token])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage('')
    setFields({})
    try {
      const result = await resetPassword({ token, password, confirmPassword })
      setLoginNotice(result.message)
      onSignedOut()
      onNavigate('/ingresar', { replace: true })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.')
      setFields((error as Error & { fields?: Record<string, string> }).fields || {})
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell title="Nueva contraseña" onNavigate={onNavigate}>
      {isChecking ? <p>Comprobando el enlace…</p> : null}
      {message ? <p className="auth-error" role="alert">{message}</p> : null}
      {isValid ? (
        <form className="auth-form" onSubmit={handleSubmit}>
          <PasswordField id="reset-password" label="Nueva contraseña" autoComplete="new-password" value={password} onChange={setPassword} error={fields.password} />
          <PasswordField id="reset-confirm" label="Confirmar contraseña" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} error={fields.confirmPassword} />
          <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando…' : 'Guardar contraseña'}</button>
        </form>
      ) : null}
      {!isChecking && !isValid ? <p className="auth-switch"><a className="auth-link" href="/recuperar" onClick={(event) => go(event, '/recuperar', onNavigate)}>Solicitar otro enlace</a></p> : null}
    </AuthShell>
  )
}
