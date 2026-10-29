import crypto from 'node:crypto'
import express from 'express'
import session from 'express-session'
import MySQLStoreFactory from 'express-mysql-session'
import bcrypt from 'bcryptjs'
import mysql from 'mysql2'
import { registerCatalog } from './catalog.js'
import { registerPlanning } from './planning.js'
import { registerBanquets } from './banquets.js'
import { registerDecoration } from './decoration.js'
import { registerMusic } from './music.js'
import { registerWaitstaff } from './waitstaff.js'
import { registerFurniture } from './furniture.js'
import { pool, prepareDatabase, publicUserSelect, toPublicUser } from './db.js'

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET debe existir y tener al menos 32 caracteres.')
}
if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'production') {
  throw new Error('NODE_ENV debe ser development o production.')
}

const databaseName = process.env.MYSQL_DATABASE || 'eventia'
const databaseConfig = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: databaseName,
}
const dummyHash = bcrypt.hashSync('eventia-invalid-password', 12)

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 'loopback')
app.use(express.json({ limit: '32kb' }))

let attachSession = (_request, response) => {
  response.status(503).json({ message: 'El servidor está arrancando.' })
}
app.use((request, response, next) => attachSession(request, response, next))

for (const method of ['get', 'post', 'put', 'delete']) {
  const register = app[method].bind(app)
  app[method] = (path, ...handlers) => register(path, ...handlers.map((handler) => {
    if (handler.length > 3) return handler
    return (request, response, next) => {
      try {
        const result = handler(request, response, next)
        if (result && typeof result.catch === 'function') result.catch(next)
        return
      } catch (error) {
        next(error)
      }
    }
  }))
}

const attempts = new Map()

const recentAttempts = (key) => {
  const now = Date.now()
  const recent = (attempts.get(key) || []).filter((time) => now - time < 15 * 60 * 1000)
  attempts.set(key, recent)
  return recent
}

const isLimited = (key) => recentAttempts(key).length >= 8

const recordAttempt = (key) => {
  recentAttempts(key).push(Date.now())
}

const clientKey = (request, action) => `${action}:${request.ip}`

const regenerateSession = (request) => new Promise((resolve, reject) => {
  request.session.regenerate((error) => (error ? reject(error) : resolve()))
})

const saveSession = (request) => new Promise((resolve, reject) => {
  request.session.save((error) => (error ? reject(error) : resolve()))
})

const destroySession = (request) => new Promise((resolve) => {
  if (!request.session) {
    resolve()
    return
  }
  request.session.destroy(() => resolve())
})

const findUser = async (where, value) => {
  const [rows] = await pool.query(`${publicUserSelect} WHERE ${where} LIMIT 1`, [value])
  return rows[0] || null
}

const requireUser = (request, response, next) => {
  if (!request.session?.userId) {
    response.status(401).json({ message: 'Inicia sesión para continuar.' })
    return
  }
  findUser('u.id = ?', request.session.userId)
    .then((row) => {
      if (!row) {
        response.status(401).json({ message: 'La sesión ya no es válida.' })
        return
      }
      request.account = toPublicUser(row)
      next()
    })
    .catch(next)
}

const requireRole = (...roles) => (request, response, next) => {
  if (!roles.includes(request.account.role)) {
    response.status(403).json({ message: 'No tienes permiso para ver esta información.' })
    return
  }
  next()
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const usernamePattern = /^[a-zA-Z0-9._]{3,40}$/

app.get('/api/health', (_request, response) => {
  response.json({ ok: true })
})

app.get('/api/auth/me', async (request, response) => {
  if (!request.session.userId) {
    response.json({ user: null })
    return
  }
  const row = await findUser('u.id = ?', request.session.userId)
  response.json({ user: row ? toPublicUser(row) : null })
})

app.post('/api/auth/login', async (request, response) => {
  const loginKey = clientKey(request, 'login')
  if (isLimited(loginKey)) {
    response.status(429).json({ message: 'Demasiados intentos. Espera unos minutos.' })
    return
  }
  const identifier = String(request.body?.identifier || '').trim()
  const password = String(request.body?.password || '')
  const remember = Boolean(request.body?.remember)
  if (!identifier || !password) {
    response.status(400).json({ message: 'Escribe tu correo o usuario y tu contraseña.' })
    return
  }
  const [rows] = await pool.query(
    'SELECT id, password_hash FROM users WHERE email = ? OR username = ? LIMIT 1',
    [identifier.toLowerCase(), identifier],
  )
  const account = rows[0]
  const matches = await bcrypt.compare(password, account?.password_hash || dummyHash) && Boolean(account)
  if (!matches) {
    recordAttempt(loginKey)
    response.status(401).json({ message: 'Correo, usuario o contraseña incorrectos.' })
    return
  }
  await regenerateSession(request)
  request.session.userId = account.id
  if (remember) request.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000
  await saveSession(request)
  const row = await findUser('u.id = ?', account.id)
  response.json({ user: toPublicUser(row) })
})

app.post('/api/auth/logout', async (request, response) => {
  await destroySession(request)
  response.clearCookie('eventia.sid', { path: '/' })
  response.json({ ok: true })
})

app.post('/api/auth/register', async (request, response) => {
  const registerKey = clientKey(request, 'register')
  if (isLimited(registerKey)) {
    response.status(429).json({ message: 'Demasiados intentos. Espera unos minutos.' })
    return
  }
  recordAttempt(registerKey)
  const fullName = String(request.body?.fullName || '').trim()
  const email = String(request.body?.email || '').trim().toLowerCase()
  const username = String(request.body?.username || '').trim()
  const password = String(request.body?.password || '')
  const confirmPassword = String(request.body?.confirmPassword || '')
  const role = request.body?.role
  const acceptedTerms = request.body?.acceptedTerms === true
  const fields = {}
  if (fullName.length < 3) fields.fullName = 'Escribe tu nombre completo.'
  if (!emailPattern.test(email)) fields.email = 'Escribe un correo válido.'
  if (!usernamePattern.test(username)) fields.username = 'Usa de 3 a 40 letras, números, puntos o guion bajo.'
  if (password.length < 8) fields.password = 'La contraseña debe tener al menos 8 caracteres.'
  if (password !== confirmPassword) fields.confirmPassword = 'Las contraseñas no coinciden.'
  if (role !== 'cliente' && role !== 'proveedor') fields.role = 'Elige Cliente o Proveedor.'
  if (!acceptedTerms) fields.acceptedTerms = 'Acepta los términos para crear la cuenta.'
  if (Object.keys(fields).length > 0) {
    response.status(400).json({ message: 'Revisa los datos del formulario.', fields })
    return
  }
  const [duplicates] = await pool.query('SELECT email, username FROM users WHERE email = ? OR username = ?', [email, username])
  for (const duplicate of duplicates) {
    if (duplicate.email === email) fields.email = 'Ese correo ya está registrado.'
    if (duplicate.username === username) fields.username = 'Ese nombre de usuario ya está registrado.'
  }
  if (Object.keys(fields).length > 0) {
    response.status(409).json({ message: 'Esa cuenta ya existe.', fields })
    return
  }
  const passwordHash = await bcrypt.hash(password, 12)
  const [created] = await pool.query(
    'INSERT INTO users (full_name, email, username, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [fullName, email, username, passwordHash, role],
  )
  if (role === 'proveedor') {
    await pool.query('INSERT INTO provider_profiles (user_id) VALUES (?)', [created.insertId])
  }
  await regenerateSession(request)
  request.session.userId = created.insertId
  await saveSession(request)
  const row = await findUser('u.id = ?', created.insertId)
  response.status(201).json({ user: toPublicUser(row) })
})

app.post('/api/auth/forgot-password', async (request, response) => {
  const forgotKey = clientKey(request, 'forgot')
  if (isLimited(forgotKey)) {
    response.status(429).json({ message: 'Demasiados intentos. Espera unos minutos.' })
    return
  }
  recordAttempt(forgotKey)
  const email = String(request.body?.email || '').trim().toLowerCase()
  if (!emailPattern.test(email)) {
    response.status(400).json({ message: 'Escribe el correo de tu cuenta.', fields: { email: 'Escribe un correo válido.' } })
    return
  }
  if (process.env.NODE_ENV !== 'development') {
    response.status(503).json({ message: 'El servicio de correo no está configurado. No se envió ningún mensaje.' })
    return
  }
  const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
  const user = rows[0]
  if (!user) {
    response.status(404).json({ message: 'No hay una cuenta registrada con ese correo.' })
    return
  }
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
  await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [user.id])
  await pool.query('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [user.id, tokenHash, expiresAt])
  response.json({
    delivery: 'development',
    message: 'No hay un servicio de correo configurado. Este enlace es solo para el entorno local, caduca en 30 minutos y sirve una sola vez.',
    recoveryPath: `/restablecer/${token}`,
  })
})

const findReset = async (token) => {
  const tokenHash = crypto.createHash('sha256').update(String(token || '')).digest('hex')
  const [rows] = await pool.query(
    'SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ? LIMIT 1',
    [tokenHash],
  )
  const reset = rows[0]
  if (!reset || reset.used_at || new Date(reset.expires_at).getTime() < Date.now()) return null
  return reset
}

app.get('/api/auth/reset-password/:token', async (request, response) => {
  const reset = await findReset(request.params.token)
  response.json({ valid: Boolean(reset) })
})

app.post('/api/auth/reset-password', async (request, response) => {
  const reset = await findReset(request.body?.token)
  const password = String(request.body?.password || '')
  const confirmPassword = String(request.body?.confirmPassword || '')
  if (!reset) {
    response.status(400).json({ message: 'El enlace caducó o ya se usó. Solicita uno nuevo.' })
    return
  }
  if (password.length < 8) {
    response.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres.', fields: { password: 'Usa al menos 8 caracteres.' } })
    return
  }
  if (password !== confirmPassword) {
    response.status(400).json({ message: 'Las contraseñas no coinciden.', fields: { confirmPassword: 'Las contraseñas no coinciden.' } })
    return
  }
  const passwordHash = await bcrypt.hash(password, 12)
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, reset.user_id])
  await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [reset.user_id])
  await destroySession(request)
  response.clearCookie('eventia.sid', { path: '/' })
  response.json({ ok: true, message: 'Tu contraseña se actualizó. Ya puedes iniciar sesión.' })
})

app.put('/api/account/profile', requireUser, async (request, response) => {
  const fullName = String(request.body?.fullName || '').replace(/[\u0000-\u001f]/g, '').trim()
  const email = String(request.body?.email || '').trim().toLowerCase()
  const avatarUrl = String(request.body?.avatarUrl || '').trim()
  const phone = String(request.body?.phone || '').replace(/[\u0000-\u001f]/g, '').trim()
  const fields = {}
  if (fullName.length < 2 || fullName.length > 120) fields.fullName = 'Escribe tu nombre completo.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190) fields.email = 'Escribe un correo válido.'
  if (phone && (phone.length < 7 || phone.length > 40 || !/^[0-9+\s()-]+$/.test(phone))) {
    fields.phone = 'Escribe un teléfono válido de 7 a 40 caracteres.'
  }
  if (avatarUrl && (avatarUrl.length > 500 || !/^https?:\/\//i.test(avatarUrl))) {
    fields.avatarUrl = 'La foto debe ser una URL http(s) válida de hasta 500 caracteres.'
  }
  if (Object.keys(fields).length > 0) {
    response.status(400).json({ message: 'Revisa tu perfil.', fields })
    return
  }
  const [taken] = await pool.query('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [email, request.account.id])
  if (taken[0]) {
    response.status(409).json({ message: 'Ese correo ya está en uso.', fields: { email: 'Ese correo ya está en uso.' } })
    return
  }
  await pool.query('UPDATE users SET full_name = ?, email = ?, avatar_url = ?, phone = ? WHERE id = ?', [
    fullName,
    email,
    avatarUrl || null,
    phone || null,
    request.account.id,
  ])
  const row = await findUser('u.id = ?', request.account.id)
  response.json({ user: toPublicUser(row) })
})

app.put('/api/account/password', requireUser, async (request, response) => {
  const currentPassword = String(request.body?.currentPassword || '')
  const password = String(request.body?.password || '')
  const confirmPassword = String(request.body?.confirmPassword || '')
  const fields = {}
  if (!currentPassword) fields.currentPassword = 'Escribe tu contraseña actual.'
  if (password.length < 8) fields.password = 'La nueva contraseña debe tener al menos 8 caracteres.'
  if (password !== confirmPassword) fields.confirmPassword = 'Las contraseñas no coinciden.'
  if (Object.keys(fields).length > 0) {
    response.status(400).json({ message: 'Revisa el cambio de contraseña.', fields })
    return
  }
  const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [request.account.id])
  const account = rows[0]
  if (!account || !(await bcrypt.compare(currentPassword, account.password_hash))) {
    response.status(400).json({
      message: 'La contraseña actual no es correcta.',
      fields: { currentPassword: 'La contraseña actual no es correcta.' },
    })
    return
  }
  const passwordHash = await bcrypt.hash(password, 12)
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, request.account.id])
  response.json({ ok: true, message: 'Contraseña actualizada.' })
})

app.put('/api/provider/profile', requireUser, requireRole('proveedor'), async (request, response) => {
  const businessName = String(request.body?.businessName || '').trim()
  const city = String(request.body?.city || '').trim()
  const description = String(request.body?.description || '').trim()
  const fields = {}
  if (businessName.length < 2) fields.businessName = 'Escribe el nombre del negocio.'
  if (city.length < 2) fields.city = 'Escribe la ciudad donde trabajas.'
  if (description.length > 500) fields.description = 'La descripción admite hasta 500 caracteres.'
  if (Object.keys(fields).length > 0) {
    response.status(400).json({ message: 'Revisa el perfil del negocio.', fields })
    return
  }
  await pool.query(
    `INSERT INTO provider_profiles (user_id, business_name, city, description, is_complete)
     VALUES (?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE business_name = VALUES(business_name), city = VALUES(city), description = VALUES(description), is_complete = 1`,
    [request.account.id, businessName, city, description],
  )
  const row = await findUser('u.id = ?', request.account.id)
  response.json({ user: toPublicUser(row) })
})

registerCatalog(app, { requireUser, requireRole })
registerPlanning(app, { requireUser, requireRole })
registerBanquets(app, { requireUser, requireRole })
registerDecoration(app, { requireUser, requireRole })
registerMusic(app, { requireUser, requireRole })
registerWaitstaff(app, { requireUser, requireRole })
registerFurniture(app, { requireUser, requireRole })

app.get('/api/admin/users', requireUser, requireRole('admin'), async (_request, response) => {
  const [rows] = await pool.query(`${publicUserSelect} ORDER BY u.id ASC`)
  response.json({ users: rows.map(toPublicUser) })
})

const port = Number(process.env.PORT || 3001)

app.use((error, _request, response, next) => {
  if (response.headersSent) {
    next(error)
    return
  }
  console.error(error)
  response.status(500).json({ message: 'No se pudo completar la solicitud.' })
})

prepareDatabase()
  .then(() => {
    const MySQLStore = MySQLStoreFactory(session)
    const sessionStore = new MySQLStore({
      ...databaseConfig,
      createDatabaseTable: true,
      schema: { tableName: 'sessions' },
    }, mysql.createPool(databaseConfig))
    attachSession = session({
      name: 'eventia.sid',
      secret: process.env.SESSION_SECRET,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      },
    })
    app.listen(port, '127.0.0.1', () => {
      console.log(`Eventia API en http://127.0.0.1:${port}`)
    })
  })
  .catch((error) => {
    console.error('No se pudo preparar MySQL.', error.message)
    process.exit(1)
  })
