import { pool } from './db.js'
import { findOwnedEvent } from './planning.js'

const priceUnits = ['fijo', 'desde', 'cotizacion']
const roleUnits = ['hora', 'jornada', 'persona', 'fijo', 'cotizacion']
const overtimeUnits = ['hora', 'cotizacion']
const dutyInclusions = ['incluido', 'adicional']

const cleanText = (value, max) => {
  const text = String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim()
  if (!text || text.length > max) return null
  return text
}

const optionalText = (value, max) => {
  const text = String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim()
  if (text.length > max) return null
  return text
}

const readCents = (value) => {
  if (value === undefined || value === null || value === '') return null
  const pesos = Number(value)
  if (!Number.isInteger(pesos) || pesos < 0 || pesos > 10000000) return undefined
  return pesos * 100
}

const readQty = (value, max = 500) => {
  const qty = Number(value)
  if (!Number.isInteger(qty) || qty < 1 || qty > max) return undefined
  return qty
}

const readOptionalQty = (value, max = 500) => {
  if (value === undefined || value === null || value === '') return null
  return readQty(value, max)
}

const readGuests = (value) => {
  if (value === undefined || value === null || value === '') return null
  const guests = Number(value)
  if (!Number.isInteger(guests) || guests < 1 || guests > 20000) return undefined
  return guests
}

const readHours = (value) => {
  if (value === undefined || value === null || value === '') return null
  const hours = Number(value)
  if (!Number.isInteger(hours) || hours < 1 || hours > 24) return undefined
  return hours
}

const readTime = (value) => {
  const text = optionalText(value, 5)
  if (text === null) return undefined
  if (!text) return ''
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : undefined
}

const readUrl = (value) => {
  const text = cleanText(value, 500)
  if (!text) return null
  try {
    const url = new URL(text)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return text
  } catch {
    return null
  }
}

const optionalUrl = (value) => {
  const text = optionalText(value, 500)
  if (text === null) return undefined
  if (!text) return ''
  return readUrl(text) || undefined
}

const centsOrNull = (value) => (value === null || value === undefined ? null : Number(value))

const minutesFromClock = (value) => {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export const durationHoursFromSchedule = (startTime, endTime) => {
  if (!startTime || !endTime) return null
  let start = minutesFromClock(startTime)
  let end = minutesFromClock(endTime)
  if (end <= start) end += 24 * 60
  return Math.max(1, Math.ceil((end - start) / 60))
}

const toImage = (row) => ({
  id: row.id,
  url: row.image_url,
  alt: row.alt_text || '',
  tag: row.gallery_tag || '',
})

export const loadWaitstaff = async (serviceId, { includeInactive = false, connection = pool } = {}) => {
  const [details] = await connection.query('SELECT * FROM waitstaff_details WHERE service_id = ? LIMIT 1', [serviceId])
  const detail = details[0]
  const active = includeInactive ? '' : 'AND is_active = 1'
  const [roles] = await connection.query(`SELECT * FROM waitstaff_roles WHERE service_id = ? ${active} ORDER BY is_primary DESC, sort_order, id`, [serviceId])
  const [modalities] = await connection.query(`SELECT * FROM waitstaff_modalities WHERE service_id = ? ${active} ORDER BY sort_order, id`, [serviceId])
  const [uniforms] = await connection.query(`SELECT * FROM waitstaff_uniforms WHERE service_id = ? ${active} ORDER BY sort_order, id`, [serviceId])
  const [duties] = await connection.query(`SELECT * FROM waitstaff_duties WHERE service_id = ? ${active} ORDER BY inclusion, sort_order, id`, [serviceId])
  const [packages] = await connection.query(`SELECT * FROM waitstaff_packages WHERE service_id = ? ${active} ORDER BY sort_order, id`, [serviceId])
  const [images] = await connection.query(
    'SELECT id, image_url, alt_text, gallery_tag FROM service_images WHERE service_id = ? AND package_id IS NULL AND decoration_package_id IS NULL ORDER BY sort_order, id',
    [serviceId],
  )
  return {
    coverageArea: detail?.coverage_area || '',
    specialties: detail?.specialties || '',
    priceMode: detail?.price_mode || '',
    guestsPerServer: detail?.guests_per_server == null ? null : Number(detail.guests_per_server),
    minServers: detail?.min_servers == null ? null : Number(detail.min_servers),
    maxServers: detail?.max_servers == null ? null : Number(detail.max_servers),
    minHours: detail?.min_hours == null ? null : Number(detail.min_hours),
    overtimeCents: centsOrNull(detail?.overtime_cents),
    overtimeUnit: detail?.overtime_unit || 'cotizacion',
    conditions: detail?.conditions || '',
    roles: roles.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      priceCents: centsOrNull(item.price_cents),
      priceUnit: item.price_unit,
      minHours: item.min_hours == null ? null : Number(item.min_hours),
      minQty: item.min_qty == null ? null : Number(item.min_qty),
      maxQty: item.max_qty == null ? null : Number(item.max_qty),
      isPrimary: Boolean(item.is_primary),
      imageUrl: item.image_url || '',
      conditions: item.conditions || '',
      isActive: Boolean(item.is_active),
    })),
    modalities: modalities.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      isActive: Boolean(item.is_active),
    })),
    uniforms: uniforms.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      isActive: Boolean(item.is_active),
    })),
    duties: duties.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      inclusion: item.inclusion,
      isActive: Boolean(item.is_active),
    })),
    packages: packages.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      serverCount: item.server_count == null ? null : Number(item.server_count),
      hoursIncluded: item.hours_included == null ? null : Number(item.hours_included),
      includedStaff: item.included_staff || '',
      modalityName: item.modality_name || '',
      priceCents: centsOrNull(item.price_cents),
      priceUnit: item.price_unit,
      conditions: item.conditions || '',
      servicesIncluded: item.services_included || '',
      isActive: Boolean(item.is_active),
    })),
    images: images.map(toImage),
  }
}

const addAmount = (total, priceCents, unit, quantity = 1, hours = 1) => {
  if (priceCents === null || unit === 'cotizacion' || unit === 'desde' || unit === '') {
    return {
      ...total,
      pending: true,
      hasAmount: total.hasAmount || (unit === 'desde' && priceCents !== null),
      cents: unit === 'desde' && priceCents !== null ? total.cents + priceCents : total.cents,
    }
  }
  if (unit === 'hora') return { cents: total.cents + priceCents * quantity * hours, pending: total.pending, hasAmount: true }
  if (unit === 'persona' || unit === 'jornada') return { cents: total.cents + priceCents * quantity, pending: total.pending, hasAmount: true }
  return { cents: total.cents + priceCents, pending: total.pending, hasAmount: true }
}

export const recommendServers = (guests, guestsPerServer) => {
  if (!guests || !guestsPerServer) return null
  return Math.max(1, Math.ceil(guests / guestsPerServer))
}

export const buildWaitstaffSelection = (waitstaff, servicePriceCents, input) => {
  const guests = readGuests(input.guests)
  if (guests === undefined) return { error: 'El número de invitados no es válido.' }
  const startTime = readTime(input.startTime)
  const endTime = readTime(input.endTime)
  if (startTime === undefined || endTime === undefined) return { error: 'El horario debe usar el formato HH:MM.' }
  const eventLocation = optionalText(input.eventLocation, 200)
  const uniformNote = optionalText(input.uniformNote, 200)
  const notes = input.notes === undefined || input.notes === null || String(input.notes).trim() === '' ? '' : cleanText(input.notes, 500)
  if (eventLocation === null || uniformNote === null || notes === null) return { error: 'Revisa la ubicación, el uniforme o las observaciones.' }

  const packageId = input.packageId ? Number(input.packageId) : null
  const selectedPackage = packageId ? waitstaff.packages.find((item) => item.id === packageId && item.isActive !== false) : null
  if (packageId && !selectedPackage) return { error: 'El paquete no pertenece a este proveedor de meseros.' }

  let durationHours = durationHoursFromSchedule(startTime, endTime)
  if (durationHours === null) {
    durationHours = readHours(input.durationHours)
    if (durationHours === undefined) return { error: 'La duración del servicio no es válida.' }
  }
  if (durationHours === null) durationHours = waitstaff.minHours || selectedPackage?.hoursIncluded || null
  if (waitstaff.minHours && durationHours !== null && durationHours < waitstaff.minHours) {
    return { error: `La jornada mínima de este proveedor es de ${waitstaff.minHours} horas.` }
  }
  if (selectedPackage?.hoursIncluded && durationHours !== null && durationHours < selectedPackage.hoursIncluded) {
    return { error: `El paquete incluye ${selectedPackage.hoursIncluded} horas como mínimo.` }
  }

  let serverCount = readOptionalQty(input.serverCount, 500)
  if (serverCount === undefined) return { error: 'La cantidad de meseros no es válida.' }
  if (selectedPackage?.serverCount != null) {
    if (serverCount === null) serverCount = selectedPackage.serverCount
    if (serverCount !== selectedPackage.serverCount) {
      return { error: `Este paquete requiere exactamente ${selectedPackage.serverCount} meseros.` }
    }
  }
  if (serverCount !== null) {
    if (waitstaff.minServers !== null && serverCount < waitstaff.minServers) return { error: `Este proveedor pide al menos ${waitstaff.minServers} meseros.` }
    if (waitstaff.maxServers !== null && serverCount > waitstaff.maxServers) return { error: `Este proveedor admite hasta ${waitstaff.maxServers} meseros.` }
  }

  const modalityId = input.modalityId ? Number(input.modalityId) : null
  const modality = modalityId ? waitstaff.modalities.find((item) => item.id === modalityId && item.isActive !== false) : null
  if (modalityId && !modality) return { error: 'La modalidad de atención no pertenece a este proveedor.' }
  if (selectedPackage?.modalityName && modality && modality.name !== selectedPackage.modalityName) {
    return { error: 'La modalidad elegida no coincide con el paquete seleccionado.' }
  }

  const uniformId = input.uniformId ? Number(input.uniformId) : null
  const uniform = uniformId ? waitstaff.uniforms.find((item) => item.id === uniformId && item.isActive !== false) : null
  if (uniformId && !uniform) return { error: 'La opción de uniforme no pertenece a este proveedor.' }

  const primaryRole = waitstaff.roles.find((item) => item.isPrimary && item.isActive !== false) || null
  const requested = Array.isArray(input.roles) ? input.roles : []
  const chosen = []
  for (const entry of requested) {
    const role = waitstaff.roles.find((item) => item.id === Number(entry.id) && item.isActive !== false)
    if (!role) return { error: 'Hay un puesto que este proveedor no ofrece.' }
    if (role.isPrimary) continue
    const quantity = readQty(entry.quantity ?? role.minQty ?? 1, role.maxQty || 500)
    if (quantity === undefined) return { error: `La cantidad de ${role.name} no es válida.` }
    if (role.minQty !== null && quantity < role.minQty) return { error: `${role.name} pide al menos ${role.minQty}.` }
    if (role.maxQty !== null && quantity > role.maxQty) return { error: `${role.name} admite hasta ${role.maxQty}.` }
    if (role.minHours !== null && durationHours !== null && durationHours < role.minHours) {
      return { error: `${role.name} requiere al menos ${role.minHours} horas.` }
    }
    chosen.push({ role, quantity })
  }

  if (primaryRole && serverCount !== null) {
    if (primaryRole.minQty !== null && serverCount < primaryRole.minQty) return { error: `${primaryRole.name} pide al menos ${primaryRole.minQty}.` }
    if (primaryRole.maxQty !== null && serverCount > primaryRole.maxQty) return { error: `${primaryRole.name} admite hasta ${primaryRole.maxQty}.` }
    if (primaryRole.minHours !== null && durationHours !== null && durationHours < primaryRole.minHours) {
      return { error: `${primaryRole.name} requiere al menos ${primaryRole.minHours} horas.` }
    }
  }

  const billableHours = durationHours || 1
  let total = { cents: 0, pending: false, hasAmount: false }
  if (selectedPackage) {
    total = addAmount(total, selectedPackage.priceCents, selectedPackage.priceUnit)
    if (selectedPackage.hoursIncluded && durationHours && durationHours > selectedPackage.hoursIncluded) {
      const extra = durationHours - selectedPackage.hoursIncluded
      total = addAmount(total, waitstaff.overtimeCents, waitstaff.overtimeUnit === 'hora' ? 'hora' : 'cotizacion', 1, extra)
    }
  } else if (primaryRole && serverCount !== null) {
    total = addAmount(total, primaryRole.priceCents, primaryRole.priceUnit, serverCount, billableHours)
  } else if (servicePriceCents !== null || waitstaff.priceMode) {
    total = addAmount(total, servicePriceCents, waitstaff.priceMode === 'fijo' ? 'fijo' : waitstaff.priceMode === 'desde' ? 'desde' : 'cotizacion')
  } else {
    total = { ...total, pending: true }
  }
  for (const item of chosen) total = addAmount(total, item.role.priceCents, item.role.priceUnit, item.quantity, billableHours)

  const recommendedServers = recommendServers(guests, waitstaff.guestsPerServer)
  const snapshot = {
    package: selectedPackage ? {
      id: selectedPackage.id,
      name: selectedPackage.name,
      serverCount: selectedPackage.serverCount,
      hoursIncluded: selectedPackage.hoursIncluded,
      priceCents: selectedPackage.priceCents,
      priceUnit: selectedPackage.priceUnit,
      conditions: selectedPackage.conditions,
    } : null,
    serverCount,
    guests,
    startTime,
    endTime,
    durationHours,
    recommendedServers,
    modality: modality ? { id: modality.id, name: modality.name } : (selectedPackage?.modalityName ? { id: null, name: selectedPackage.modalityName } : null),
    uniform: uniform ? { id: uniform.id, name: uniform.name } : null,
    uniformNote,
    primaryRole: primaryRole && serverCount !== null ? {
      id: primaryRole.id,
      name: primaryRole.name,
      quantity: serverCount,
      priceCents: primaryRole.priceCents,
      priceUnit: primaryRole.priceUnit,
    } : null,
    roles: chosen.map((item) => ({
      id: item.role.id,
      name: item.role.name,
      quantity: item.quantity,
      priceCents: item.role.priceCents,
      priceUnit: item.role.priceUnit,
    })),
    eventLocation,
    estimatedCents: total.hasAmount ? total.cents : null,
    pendingQuote: total.pending || !total.hasAmount,
  }
  return { snapshot, notes, estimatedCents: snapshot.estimatedCents }
}

const withTransaction = async (work) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const result = await work(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

const eventBudget = async (connection, clientId, eventId) => {
  const [rows] = await connection.query(
    'SELECT COALESCE(SUM(estimated_cents), 0) AS total FROM planner_items WHERE client_id = ? AND event_id = ? AND estimated_cents IS NOT NULL',
    [clientId, eventId],
  )
  return Number(rows[0]?.total || 0)
}

export const saveWaitstaff = async ({ clientId, serviceId, kind, body }) => {
  const event = await findOwnedEvent(clientId, body?.eventId)
  if (!event) return { status: 404, message: 'El evento no existe o no te pertenece.' }
  return withTransaction(async (connection) => {
    const [services] = await connection.query('SELECT id, price_cents, is_published FROM services WHERE id = ? LIMIT 1 FOR UPDATE', [serviceId])
    if (!services[0]?.is_published) return { status: 404, message: 'No encontramos ese servicio.' }
    const waitstaff = await loadWaitstaff(serviceId, { connection })
    const built = buildWaitstaffSelection(waitstaff, centsOrNull(services[0].price_cents), body || {})
    if (built.error) return { status: 400, message: built.error }
    const table = kind === 'quote' ? 'quote_requests' : 'planner_items'
    const [existing] = await connection.query(
      `SELECT id FROM ${table} WHERE client_id = ? AND service_id = ? AND event_id = ? LIMIT 1 FOR UPDATE`,
      [clientId, serviceId, event.id],
    )
    if (existing[0]) {
      return {
        created: false,
        event,
        budgetCents: kind === 'planner' ? await eventBudget(connection, clientId, event.id) : undefined,
        estimatedCents: built.estimatedCents,
        selection: built.snapshot,
        message: kind === 'quote'
          ? 'Ya enviaste una cotización de este servicio de meseros para ese evento.'
          : 'Este servicio de meseros ya está en el presupuesto de ese evento.',
      }
    }
    if (kind === 'quote') {
      await connection.query(
        `INSERT INTO quote_requests (client_id, service_id, event_id, notes, status, selection_json) VALUES (?, ?, ?, ?, 'recibida', ?)`,
        [clientId, serviceId, event.id, built.notes, JSON.stringify(built.snapshot)],
      )
    } else {
      await connection.query(
        'INSERT INTO planner_items (client_id, service_id, event_id, estimated_cents, selection_json) VALUES (?, ?, ?, ?, ?)',
        [clientId, serviceId, event.id, built.estimatedCents, JSON.stringify(built.snapshot)],
      )
    }
    const budgetCents = kind === 'planner' ? await eventBudget(connection, clientId, event.id) : undefined
    return { created: true, event, estimatedCents: built.estimatedCents, budgetCents, selection: built.snapshot }
  })
}

const ownService = async (providerId, serviceId) => {
  const id = Number(serviceId)
  if (!Number.isInteger(id) || id < 1) return null
  const [rows] = await pool.query(
    `SELECT s.id, c.slug FROM services s JOIN categories c ON c.id = s.category_id
     WHERE s.id = ? AND s.provider_id = ? LIMIT 1`,
    [id, providerId],
  )
  return rows[0] || null
}

const sendError = (response, status, message) => response.status(status).json({ message })

export const registerWaitstaff = (app, { requireUser, requireRole }) => {
  const providerOnly = [requireUser, requireRole('proveedor')]

  app.post('/api/provider/waitstaff', ...providerOnly, async (request, response) => {
    const title = cleanText(request.body?.title, 160)
    const description = optionalText(request.body?.description, 500)
    if (!title || title.length < 2 || description === null) {
      sendError(response, 400, 'Escribe el nombre del servicio.')
      return
    }
    const [categories] = await pool.query(`SELECT id FROM categories WHERE slug = 'meseros' LIMIT 1`)
    if (!categories[0]) return sendError(response, 404, 'La categoría de meseros no está disponible.')
    const [created] = await pool.query(
      'INSERT INTO services (provider_id, category_id, title, description, price_cents, image_url, is_published) VALUES (?, ?, ?, ?, NULL, NULL, 0)',
      [request.account.id, categories[0].id, title, description || 'Servicio de meseros y personal para eventos.'],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.put('/api/provider/waitstaff/:serviceId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'meseros') return sendError(response, 404, 'No encontramos ese servicio de meseros.')
    const title = cleanText(request.body?.title, 160)
    const description = optionalText(request.body?.description, 500)
    const coverageArea = optionalText(request.body?.coverageArea, 200)
    const specialties = optionalText(request.body?.specialties, 300)
    const conditions = optionalText(request.body?.conditions, 500)
    const priceCents = readCents(request.body?.priceCents)
    const priceMode = request.body?.priceMode || null
    const guestsPerServer = readOptionalQty(request.body?.guestsPerServer, 200)
    const minServers = readOptionalQty(request.body?.minServers, 500)
    const maxServers = readOptionalQty(request.body?.maxServers, 500)
    const minHours = readHours(request.body?.minHours)
    const overtimeCents = readCents(request.body?.overtimeCents)
    const overtimeUnit = request.body?.overtimeUnit || 'cotizacion'
    if (!title || description === null || coverageArea === null || specialties === null || conditions === null || priceCents === undefined || guestsPerServer === undefined || minServers === undefined || maxServers === undefined || minHours === undefined || overtimeCents === undefined || (priceMode && !priceUnits.includes(priceMode)) || !overtimeUnits.includes(overtimeUnit)) {
      return sendError(response, 400, 'Revisa la información del servicio de meseros.')
    }
    if (minServers !== null && maxServers !== null && minServers > maxServers) return sendError(response, 400, 'La cantidad mínima de meseros no puede superar la máxima.')
    await withTransaction(async (connection) => {
      await connection.query(
        'UPDATE services SET title = ?, description = ?, price_cents = ?, is_published = ? WHERE id = ? AND provider_id = ?',
        [title, description, priceCents, request.body?.isPublished ? 1 : 0, service.id, request.account.id],
      )
      await connection.query(
        `INSERT INTO waitstaff_details (
          service_id, coverage_area, specialties, price_mode, guests_per_server, min_servers, max_servers,
          min_hours, overtime_cents, overtime_unit, conditions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          coverage_area = VALUES(coverage_area), specialties = VALUES(specialties), price_mode = VALUES(price_mode),
          guests_per_server = VALUES(guests_per_server), min_servers = VALUES(min_servers), max_servers = VALUES(max_servers),
          min_hours = VALUES(min_hours), overtime_cents = VALUES(overtime_cents), overtime_unit = VALUES(overtime_unit),
          conditions = VALUES(conditions)`,
        [service.id, coverageArea, specialties, priceMode, guestsPerServer, minServers, maxServers, minHours, overtimeCents, overtimeUnit, conditions],
      )
    })
    response.json({ ok: true })
  })

  app.post('/api/provider/waitstaff/:serviceId/roles', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'meseros') return sendError(response, 404, 'No encontramos ese servicio de meseros.')
    const name = cleanText(request.body?.name, 120)
    const description = optionalText(request.body?.description, 500)
    const conditions = optionalText(request.body?.conditions, 500)
    const imageUrl = optionalUrl(request.body?.imageUrl)
    const priceCents = readCents(request.body?.priceCents)
    const priceUnit = request.body?.priceUnit || 'cotizacion'
    const minHours = readHours(request.body?.minHours)
    const minQty = readOptionalQty(request.body?.minQty, 500)
    const maxQty = readOptionalQty(request.body?.maxQty, 500)
    if (!name || description === null || conditions === null || imageUrl === undefined || priceCents === undefined || !roleUnits.includes(priceUnit) || minHours === undefined || minQty === undefined || maxQty === undefined) {
      return sendError(response, 400, 'Revisa el puesto de personal.')
    }
    if (minQty !== null && maxQty !== null && minQty > maxQty) return sendError(response, 400, 'La cantidad mínima no puede superar la máxima.')
    const [created] = await pool.query(
      `INSERT INTO waitstaff_roles (
        service_id, name, description, price_cents, price_unit, min_hours, min_qty, max_qty, is_primary, image_url, conditions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [service.id, name, description, priceCents, priceUnit, minHours, minQty, maxQty, request.body?.isPrimary ? 1 : 0, imageUrl, conditions],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/waitstaff/:serviceId/roles/:roleId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos ese servicio de meseros.')
    const [result] = await pool.query('DELETE FROM waitstaff_roles WHERE id = ? AND service_id = ?', [Number(request.params.roleId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos ese puesto.')
    response.json({ ok: true })
  })

  app.post('/api/provider/waitstaff/:serviceId/modalities', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'meseros') return sendError(response, 404, 'No encontramos ese servicio de meseros.')
    const name = cleanText(request.body?.name, 120)
    const description = optionalText(request.body?.description, 300)
    if (!name || description === null) return sendError(response, 400, 'Revisa la modalidad de atención.')
    const [created] = await pool.query('INSERT INTO waitstaff_modalities (service_id, name, description) VALUES (?, ?, ?)', [service.id, name, description])
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/waitstaff/:serviceId/modalities/:modalityId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos ese servicio de meseros.')
    const [result] = await pool.query('DELETE FROM waitstaff_modalities WHERE id = ? AND service_id = ?', [Number(request.params.modalityId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos esa modalidad.')
    response.json({ ok: true })
  })

  app.post('/api/provider/waitstaff/:serviceId/uniforms', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'meseros') return sendError(response, 404, 'No encontramos ese servicio de meseros.')
    const name = cleanText(request.body?.name, 120)
    const description = optionalText(request.body?.description, 300)
    if (!name || description === null) return sendError(response, 400, 'Revisa la opción de uniforme.')
    const [created] = await pool.query('INSERT INTO waitstaff_uniforms (service_id, name, description) VALUES (?, ?, ?)', [service.id, name, description])
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/waitstaff/:serviceId/uniforms/:uniformId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos ese servicio de meseros.')
    const [result] = await pool.query('DELETE FROM waitstaff_uniforms WHERE id = ? AND service_id = ?', [Number(request.params.uniformId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos esa opción de uniforme.')
    response.json({ ok: true })
  })

  app.post('/api/provider/waitstaff/:serviceId/duties', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'meseros') return sendError(response, 404, 'No encontramos ese servicio de meseros.')
    const name = cleanText(request.body?.name, 160)
    const description = optionalText(request.body?.description, 400)
    const inclusion = request.body?.inclusion || 'incluido'
    if (!name || description === null || !dutyInclusions.includes(inclusion)) return sendError(response, 400, 'Revisa la función del personal.')
    const [created] = await pool.query(
      'INSERT INTO waitstaff_duties (service_id, name, description, inclusion) VALUES (?, ?, ?, ?)',
      [service.id, name, description, inclusion],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/waitstaff/:serviceId/duties/:dutyId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos ese servicio de meseros.')
    const [result] = await pool.query('DELETE FROM waitstaff_duties WHERE id = ? AND service_id = ?', [Number(request.params.dutyId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos esa función.')
    response.json({ ok: true })
  })

  app.post('/api/provider/waitstaff/:serviceId/packages', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'meseros') return sendError(response, 404, 'No encontramos ese servicio de meseros.')
    const name = cleanText(request.body?.name, 120)
    const description = optionalText(request.body?.description, 500)
    const includedStaff = optionalText(request.body?.includedStaff, 500)
    const modalityName = optionalText(request.body?.modalityName, 120)
    const conditions = optionalText(request.body?.conditions, 500)
    const servicesIncluded = optionalText(request.body?.servicesIncluded, 500)
    const serverCount = readOptionalQty(request.body?.serverCount, 500)
    const hoursIncluded = readHours(request.body?.hoursIncluded)
    const priceCents = readCents(request.body?.priceCents)
    const priceUnit = request.body?.priceUnit || 'cotizacion'
    if (!name || description === null || includedStaff === null || modalityName === null || conditions === null || servicesIncluded === null || serverCount === undefined || hoursIncluded === undefined || priceCents === undefined || !priceUnits.includes(priceUnit)) {
      return sendError(response, 400, 'Revisa el paquete de personal.')
    }
    const [created] = await pool.query(
      `INSERT INTO waitstaff_packages (
        service_id, name, description, server_count, hours_included, included_staff, modality_name,
        price_cents, price_unit, conditions, services_included
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [service.id, name, description, serverCount, hoursIncluded, includedStaff, modalityName, priceCents, priceUnit, conditions, servicesIncluded],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/waitstaff/:serviceId/packages/:packageId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos ese servicio de meseros.')
    const [result] = await pool.query('DELETE FROM waitstaff_packages WHERE id = ? AND service_id = ?', [Number(request.params.packageId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos ese paquete.')
    response.json({ ok: true })
  })

  app.post('/api/provider/waitstaff/:serviceId/images', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'meseros') return sendError(response, 404, 'No encontramos ese servicio de meseros.')
    const imageUrl = readUrl(request.body?.imageUrl)
    const altText = optionalText(request.body?.altText, 160)
    const tag = optionalText(request.body?.tag, 80)
    if (!imageUrl || altText === null || tag === null) return sendError(response, 400, 'La fotografía necesita una dirección http o https válida.')
    const [created] = await pool.query(
      'INSERT INTO service_images (service_id, image_url, alt_text, gallery_tag) VALUES (?, ?, ?, ?)',
      [service.id, imageUrl, altText, tag],
    )
    response.status(201).json({ id: created.insertId })
  })
}
