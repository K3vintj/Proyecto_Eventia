import { pool } from './db.js'

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

const readGuests = (value) => {
  if (value === undefined || value === null || value === '') return null
  const guests = Number(value)
  if (!Number.isInteger(guests) || guests < 1 || guests > 20000) return undefined
  return guests
}

const readDate = (value) => {
  if (value === undefined || value === null || value === '') return null
  const text = String(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined
  const [year, month, day] = text.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined
  return text
}

const dateLabel = (value) => {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

const selectionSummary = (value) => {
  if (!value) return null
  try {
    const data = typeof value === 'string' ? JSON.parse(value) : value
    return {
      packageName: data.package?.name || '',
      guests: data.guests ?? null,
      pendingQuote: Boolean(data.pendingQuote),
      menuNames: Array.isArray(data.menu) ? data.menu.map((item) => item.name).filter(Boolean) : [],
      addonNames: Array.isArray(data.addons)
        ? data.addons.map((item) => item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name).filter(Boolean)
        : [],
      styleName: data.style?.name || '',
      paletteName: data.palette?.name || '',
      colorNote: data.colorNote || '',
      elementNames: Array.isArray(data.elements) ? data.elements.map((item) => item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name).filter(Boolean) : [],
      durationMinutes: data.durationMinutes ?? null,
      preferredGenres: data.preferredGenres || '',
      songRequests: data.songRequests || '',
      moments: data.moments || '',
      serverCount: data.serverCount ?? null,
      durationHours: data.durationHours ?? null,
      startTime: data.startTime || '',
      endTime: data.endTime || '',
      modalityName: data.modality?.name || '',
      uniformName: data.uniform?.name || '',
      uniformNote: data.uniformNote || '',
      roleNames: Array.isArray(data.roles)
        ? data.roles.map((item) => item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name).filter(Boolean)
        : [],
      rentalDays: data.rentalDays ?? null,
      furnitureItemNames: Array.isArray(data.items)
        ? data.items.map((item) => item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name).filter(Boolean)
        : [],
      eventTime: data.eventTime || data.startTime || '',
      eventLocation: data.eventLocation || '',
    }
  } catch {
    return null
  }
}

export const findOwnedEvent = async (clientId, eventId) => {
  const id = Number(eventId)
  if (!Number.isInteger(id) || id < 1) return null
  const [rows] = await pool.query(
    `SELECT id, name, DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date, guest_count, event_type,
      budget_target_cents, location, start_time
     FROM client_events WHERE id = ? AND client_id = ? LIMIT 1`,
    [id, clientId],
  )
  return rows[0] || null
}

const readMoney = (value) => {
  if (value === undefined || value === null || value === '') return null
  const amount = Number(value)
  if (!Number.isInteger(amount) || amount < 0 || amount > 1000000000) return undefined
  return amount
}

const readIssuedAmount = (value) => {
  const amount = Number(value)
  if (!Number.isInteger(amount) || amount < 1 || amount > 1000000000) return undefined
  return amount
}

const todayLabel = () => {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

const canIssueQuote = (status) => status === 'recibida' || status === 'modificacion_solicitada' || status === 'emitida'

const toQuote = (row) => ({
  id: row.id,
  notes: row.notes || '',
  status: row.status || 'recibida',
  requestedOn: dateLabel(row.requested_on),
  eventId: row.event_id === null || row.event_id === undefined ? null : Number(row.event_id),
  eventName: row.event_name || '',
  eventDate: dateLabel(row.event_date),
  guestCount: row.guest_count === null ? null : Number(row.guest_count),
  serviceId: row.service_id,
  serviceTitle: row.service_title,
  slug: row.slug,
  clientName: row.client_name,
  providerName: row.business_name || row.provider_name,
  selection: selectionSummary(row.selection_json),
  issuedCents: row.issued_cents === null || row.issued_cents === undefined ? null : Number(row.issued_cents),
  currency: row.currency || 'MXN',
  conditions: row.conditions_text || '',
  validUntil: dateLabel(row.valid_until),
  issuedDetail: row.issued_detail || '',
  issuedOn: dateLabel(row.issued_on),
  currentVersion: row.current_version === null || row.current_version === undefined ? null : Number(row.current_version),
  versions: [],
})

const toVersion = (row, currentVersion) => ({
  id: Number(row.id),
  number: Number(row.version_number),
  issuedCents: Number(row.issued_cents),
  currency: row.currency || 'MXN',
  conditions: row.conditions_text || '',
  validUntil: dateLabel(row.valid_until),
  issuedDetail: row.issued_detail || '',
  issuedOn: dateLabel(row.issued_on),
  isCurrent: Number(row.version_number) === Number(currentVersion),
})

const attachVersions = async (quotes) => {
  if (!quotes.length) return quotes
  const ids = quotes.map((quote) => quote.id)
  const [rows] = await pool.query(
    `SELECT id, quote_id, version_number, issued_cents, currency, conditions_text, issued_detail,
      DATE_FORMAT(valid_until, '%Y-%m-%d') AS valid_until,
      DATE_FORMAT(created_at, '%Y-%m-%d') AS issued_on
     FROM quote_versions
     WHERE quote_id IN (${ids.map(() => '?').join(',')})
     ORDER BY quote_id, version_number DESC`,
    ids,
  )
  const grouped = new Map()
  for (const row of rows) {
    const list = grouped.get(row.quote_id) || []
    list.push(row)
    grouped.set(row.quote_id, list)
  }
  return quotes.map((quote) => {
    const versions = (grouped.get(quote.id) || []).map((row) => toVersion(row, quote.currentVersion))
    const current = versions.find((version) => version.isCurrent) || versions[0] || null
    return {
      ...quote,
      currentVersion: current ? current.number : quote.currentVersion,
      versions,
    }
  })
}

const readTime = (value) => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (!/^\d{2}:\d{2}$/.test(text)) return null
  return text
}

const eventBudget = async (connection, clientId, eventId) => {
  const [rows] = await connection.query(
    `SELECT COALESCE(SUM(estimated_cents), 0) AS total
     FROM planner_items
     WHERE client_id = ? AND event_id = ? AND estimated_cents IS NOT NULL`,
    [clientId, eventId],
  )
  return Number(rows[0]?.total || 0)
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

export const addServiceToEvent = async ({ clientId, serviceId, eventId }) => {
  const event = await findOwnedEvent(clientId, eventId)
  if (!event) return { status: 404, message: 'El evento no existe o no te pertenece.' }
  return withTransaction(async (connection) => {
    const [locked] = await connection.query(
      'SELECT id FROM client_events WHERE id = ? AND client_id = ? LIMIT 1 FOR UPDATE',
      [event.id, clientId],
    )
    if (!locked[0]) return { status: 404, message: 'El evento no existe o no te pertenece.' }
    const [services] = await connection.query(
      'SELECT price_cents FROM services WHERE id = ? AND is_published = 1 LIMIT 1 FOR UPDATE',
      [serviceId],
    )
    if (!services[0]) return { status: 404, message: 'No encontramos ese servicio.' }
    const [existing] = await connection.query(
      'SELECT id FROM planner_items WHERE client_id = ? AND service_id = ? AND event_id = ? LIMIT 1 FOR UPDATE',
      [clientId, serviceId, event.id],
    )
    if (existing[0]) {
      const budgetCents = await eventBudget(connection, clientId, event.id)
      return { created: false, event, budgetCents, message: 'Este lugar ya está en el presupuesto de ese evento.' }
    }
    const estimatedCents = services[0].price_cents === null ? null : Number(services[0].price_cents)
    await connection.query(
      'INSERT INTO planner_items (client_id, service_id, event_id, estimated_cents) VALUES (?, ?, ?, ?)',
      [clientId, serviceId, event.id, estimatedCents],
    )
    const budgetCents = await eventBudget(connection, clientId, event.id)
    return { created: true, event, estimatedCents, budgetCents }
  })
}

export const requestServiceQuote = async ({ clientId, serviceId, eventId, notes }) => {
  const event = await findOwnedEvent(clientId, eventId)
  if (!event) return { status: 404, message: 'El evento no existe o no te pertenece.' }
  const observation = notes === undefined || notes === null || String(notes).trim() === '' ? '' : cleanText(notes, 500)
  if (observation === null) return { status: 400, message: 'Las observaciones admiten hasta 500 caracteres.' }
  return withTransaction(async (connection) => {
    const [locked] = await connection.query(
      'SELECT id FROM client_events WHERE id = ? AND client_id = ? LIMIT 1 FOR UPDATE',
      [event.id, clientId],
    )
    if (!locked[0]) return { status: 404, message: 'El evento no existe o no te pertenece.' }
    const [existing] = await connection.query(
      'SELECT id FROM quote_requests WHERE client_id = ? AND service_id = ? AND event_id = ? LIMIT 1 FOR UPDATE',
      [clientId, serviceId, event.id],
    )
    if (existing[0]) return { created: false, event, message: 'Ya enviaste una cotización de este lugar para ese evento.' }
    await connection.query(
      `INSERT INTO quote_requests (client_id, service_id, event_id, notes, status) VALUES (?, ?, ?, ?, 'recibida')`,
      [clientId, serviceId, event.id, observation],
    )
    return { created: true, event }
  })
}

const toEvent = (row) => ({
  id: row.id,
  name: row.name,
  eventDate: dateLabel(row.event_date),
  guestCount: row.guest_count === null ? null : Number(row.guest_count),
  eventType: row.event_type || '',
  budgetTargetCents: row.budget_target_cents === null || row.budget_target_cents === undefined ? null : Number(row.budget_target_cents),
  location: row.location || '',
  startTime: row.start_time || '',
})

export const registerPlanning = (app, { requireUser, requireRole }) => {
  app.get('/api/events', requireUser, requireRole('cliente'), async (request, response) => {
    const [rows] = await pool.query(
      `SELECT id, name, DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date, guest_count, event_type,
        budget_target_cents, location, start_time
       FROM client_events WHERE client_id = ? ORDER BY event_date IS NULL, event_date, id`,
      [request.account.id],
    )
    response.json({ events: rows.map(toEvent) })
  })

  app.post('/api/events', requireUser, requireRole('cliente'), async (request, response) => {
    const name = cleanText(request.body?.name, 120)
    const eventDate = readDate(request.body?.eventDate)
    const guestCount = readGuests(request.body?.guestCount)
    const eventType = optionalText(request.body?.eventType, 80)
    const budgetTargetCents = readMoney(request.body?.budgetTargetCents)
    const location = optionalText(request.body?.location, 200)
    const startTime = readTime(request.body?.startTime)
    if (!name || name.length < 2) {
      response.status(400).json({ message: 'Escribe el nombre del evento.' })
      return
    }
    if (eventDate === undefined) {
      response.status(400).json({ message: 'La fecha del evento no es válida.' })
      return
    }
    if (guestCount === undefined || eventType === null || budgetTargetCents === undefined || location === null || startTime === null) {
      response.status(400).json({ message: 'Revisa los datos del evento.' })
      return
    }
    const [result] = await pool.query(
      `INSERT INTO client_events (client_id, name, event_date, guest_count, event_type, budget_target_cents, location, start_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [request.account.id, name, eventDate, guestCount, eventType, budgetTargetCents, location, startTime],
    )
    response.status(201).json({
      event: {
        id: result.insertId,
        name,
        eventDate,
        guestCount,
        eventType,
        budgetTargetCents,
        location,
        startTime,
      },
    })
  })

  app.put('/api/events/:eventId', requireUser, requireRole('cliente'), async (request, response) => {
    const event = await findOwnedEvent(request.account.id, request.params.eventId)
    if (!event) {
      response.status(404).json({ message: 'El evento no existe o no te pertenece.' })
      return
    }
    const name = cleanText(request.body?.name, 120)
    const eventDate = readDate(request.body?.eventDate)
    const guestCount = readGuests(request.body?.guestCount)
    const eventType = optionalText(request.body?.eventType, 80)
    const budgetTargetCents = readMoney(request.body?.budgetTargetCents)
    const location = optionalText(request.body?.location, 200)
    const startTime = readTime(request.body?.startTime)
    if (!name || name.length < 2) {
      response.status(400).json({ message: 'Escribe el nombre del evento.' })
      return
    }
    if (eventDate === undefined || guestCount === undefined || eventType === null || budgetTargetCents === undefined || location === null || startTime === null) {
      response.status(400).json({ message: 'Revisa los datos del evento.' })
      return
    }
    await pool.query(
      `UPDATE client_events
       SET name = ?, event_date = ?, guest_count = ?, event_type = ?, budget_target_cents = ?, location = ?, start_time = ?
       WHERE id = ? AND client_id = ?`,
      [name, eventDate, guestCount, eventType, budgetTargetCents, location, startTime, event.id, request.account.id],
    )
    response.json({
      event: {
        id: event.id,
        name,
        eventDate,
        guestCount,
        eventType,
        budgetTargetCents,
        location,
        startTime,
      },
    })
  })

  app.get('/api/planner', requireUser, requireRole('cliente'), async (request, response) => {
    const [rows] = await pool.query(
      `SELECT e.id AS event_id, e.name, DATE_FORMAT(e.event_date, '%Y-%m-%d') AS event_date, e.guest_count, e.event_type,
        e.budget_target_cents, e.location, e.start_time,
        pi.id AS planner_item_id, pi.estimated_cents, pi.selection_json,
        s.id AS service_id, s.title, s.image_url, c.slug, c.title AS category_title, c.image_url AS category_image,
        p.business_name, owner.full_name AS provider_name
       FROM client_events e
       LEFT JOIN planner_items pi ON pi.event_id = e.id AND pi.client_id = e.client_id
       LEFT JOIN services s ON s.id = pi.service_id
       LEFT JOIN categories c ON c.id = s.category_id
       LEFT JOIN users owner ON owner.id = s.provider_id
       LEFT JOIN provider_profiles p ON p.user_id = owner.id
       WHERE e.client_id = ?
       ORDER BY e.id, pi.id`,
      [request.account.id],
    )
    const events = new Map()
    for (const row of rows) {
      const current = events.get(row.event_id) || {
        id: row.event_id,
        name: row.name,
        eventDate: dateLabel(row.event_date),
        guestCount: row.guest_count === null ? null : Number(row.guest_count),
        eventType: row.event_type || '',
        budgetTargetCents: row.budget_target_cents === null ? null : Number(row.budget_target_cents),
        location: row.location || '',
        startTime: row.start_time || '',
        budgetCents: 0,
        items: [],
      }
      if (row.service_id) {
        const estimatedCents = row.estimated_cents === null ? null : Number(row.estimated_cents)
        if (estimatedCents !== null) current.budgetCents += estimatedCents
        current.items.push({
          plannerItemId: row.planner_item_id,
          serviceId: row.service_id,
          title: row.title,
          slug: row.slug,
          categoryTitle: row.category_title,
          imageUrl: row.image_url || row.category_image || null,
          providerName: row.business_name || row.provider_name || '',
          estimatedCents,
          selection: selectionSummary(row.selection_json),
        })
      }
      events.set(row.event_id, current)
    }
    response.json({ events: [...events.values()] })
  })

  app.delete('/api/planner/items/:serviceId', requireUser, requireRole('cliente'), async (request, response) => {
    const serviceId = Number(request.params.serviceId)
    const eventId = Number(request.query.eventId || request.body?.eventId)
    if (!Number.isInteger(serviceId) || serviceId < 1 || !Number.isInteger(eventId) || eventId < 1) {
      response.status(400).json({ message: 'El servicio o el evento no son válidos.' })
      return
    }
    const event = await findOwnedEvent(request.account.id, eventId)
    if (!event) {
      response.status(404).json({ message: 'El evento no existe o no te pertenece.' })
      return
    }
    const [contracts] = await pool.query(
      'SELECT id FROM service_contracts WHERE client_id = ? AND event_id = ? AND service_id = ? LIMIT 1',
      [request.account.id, eventId, serviceId],
    )
    if (contracts[0]) {
      response.status(409).json({ message: 'No puedes eliminar un servicio ya contratado.' })
      return
    }
    const [result] = await pool.query(
      'DELETE FROM planner_items WHERE client_id = ? AND event_id = ? AND service_id = ?',
      [request.account.id, eventId, serviceId],
    )
    if (!result.affectedRows) {
      response.status(404).json({ message: 'Ese servicio no está en el planificador.' })
      return
    }
    const budgetCents = await eventBudget(pool, request.account.id, eventId)
    response.json({ ok: true, budgetCents })
  })

  app.get('/api/quotes', requireUser, requireRole('cliente', 'proveedor', 'admin'), async (request, response) => {
    const filters = []
    const params = []
    if (request.account.role === 'cliente') {
      filters.push('q.client_id = ?')
      params.push(request.account.id)
    } else if (request.account.role === 'proveedor') {
      filters.push('s.provider_id = ?')
      params.push(request.account.id)
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
    const [rows] = await pool.query(
      `SELECT q.id, q.notes, q.status, q.selection_json, q.event_id, q.current_version, DATE_FORMAT(q.created_at, '%Y-%m-%d') AS requested_on,
        q.issued_cents, q.currency, q.conditions_text, q.issued_detail,
        DATE_FORMAT(q.valid_until, '%Y-%m-%d') AS valid_until,
        DATE_FORMAT(q.issued_at, '%Y-%m-%d') AS issued_on,
        e.name AS event_name, DATE_FORMAT(e.event_date, '%Y-%m-%d') AS event_date, e.guest_count,
        s.id AS service_id, s.title AS service_title, c.slug,
        client.full_name AS client_name, p.business_name, owner.full_name AS provider_name
       FROM quote_requests q
       JOIN services s ON s.id = q.service_id
       JOIN categories c ON c.id = s.category_id
       JOIN users client ON client.id = q.client_id
       JOIN users owner ON owner.id = s.provider_id
       LEFT JOIN provider_profiles p ON p.user_id = owner.id
       LEFT JOIN client_events e ON e.id = q.event_id
       ${where}
       ORDER BY q.id DESC`,
      params,
    )
    response.json({ quotes: await attachVersions(rows.map(toQuote)) })
  })

  app.post('/api/quotes/:quoteId/issue', requireUser, requireRole('proveedor'), async (request, response) => {
    const quoteId = Number(request.params.quoteId)
    if (!Number.isInteger(quoteId) || quoteId < 1) {
      response.status(400).json({ message: 'La cotización no es válida.' })
      return
    }
    const issuedCents = readIssuedAmount(request.body?.amountCents)
    if (issuedCents === undefined) {
      response.status(400).json({ message: 'Escribe un monto mayor a cero, en pesos mexicanos.' })
      return
    }
    const conditions = optionalText(request.body?.conditions, 500)
    const detail = optionalText(request.body?.detail, 500)
    const validUntil = readDate(request.body?.validUntil)
    const currency = String(request.body?.currency || 'MXN').trim().toUpperCase()
    if (conditions === null || detail === null) {
      response.status(400).json({ message: 'Las condiciones y el detalle admiten hasta 500 caracteres.' })
      return
    }
    if (validUntil === undefined) {
      response.status(400).json({ message: 'La vigencia no es una fecha válida.' })
      return
    }
    if (currency !== 'MXN') {
      response.status(400).json({ message: 'Por ahora las cotizaciones se emiten en pesos mexicanos.' })
      return
    }
    if (validUntil && validUntil < todayLabel()) {
      response.status(400).json({ message: 'La vigencia no puede ser una fecha pasada.' })
      return
    }
    const result = await withTransaction(async (connection) => {
      const [rows] = await connection.query(
        `SELECT q.id, q.status, s.provider_id
         FROM quote_requests q
         JOIN services s ON s.id = q.service_id
         WHERE q.id = ?
         LIMIT 1 FOR UPDATE`,
        [quoteId],
      )
      const quote = rows[0]
      if (!quote) return { status: 404, message: 'No encontramos esa cotización.' }
      if (Number(quote.provider_id) !== Number(request.account.id)) {
        return { status: 403, message: 'No puedes emitir cotizaciones de servicios de otro proveedor.' }
      }
      if (!canIssueQuote(quote.status)) return { status: 409, message: 'Esta cotización ya no se puede emitir.' }
      const [counts] = await connection.query(
        'SELECT COALESCE(MAX(version_number), 0) AS latest FROM quote_versions WHERE quote_id = ?',
        [quote.id],
      )
      const versionNumber = Number(counts[0]?.latest || 0) + 1
      const [created] = await connection.query(
        `INSERT INTO quote_versions (quote_id, version_number, issued_cents, currency, conditions_text, valid_until, issued_detail, author_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [quote.id, versionNumber, issuedCents, currency, conditions, validUntil, detail, request.account.id],
      )
      await connection.query(
        `UPDATE quote_requests
         SET status = 'emitida', issued_cents = ?, currency = ?, conditions_text = ?, valid_until = ?, issued_detail = ?, issued_at = CURRENT_TIMESTAMP, current_version = ?
         WHERE id = ?`,
        [issuedCents, currency, conditions, validUntil, detail, versionNumber, quote.id],
      )
      return {
        ok: true,
        quote: {
          id: quote.id,
          status: 'emitida',
          issuedCents,
          currency,
          conditions,
          validUntil,
          issuedDetail: detail,
          issuedOn: todayLabel(),
          currentVersion: versionNumber,
          versionId: created.insertId,
        },
      }
    })
    if (typeof result.status === 'number') {
      response.status(result.status).json({ message: result.message })
      return
    }
    response.json(result)
  })

  app.post('/api/quotes/:quoteId/accept', requireUser, requireRole('cliente'), async (request, response) => {
    const quoteId = Number(request.params.quoteId)
    if (!Number.isInteger(quoteId) || quoteId < 1) {
      response.status(400).json({ message: 'La cotización no es válida.' })
      return
    }
    try {
      const result = await withTransaction(async (connection) => {
        const requestedVersion = request.body?.versionNumber
        const [rows] = await connection.query(
          `SELECT q.id, q.status, q.event_id, q.service_id, q.client_id, q.current_version
           FROM quote_requests q
           WHERE q.id = ? AND q.client_id = ?
           LIMIT 1 FOR UPDATE`,
          [quoteId, request.account.id],
        )
        const quote = rows[0]
        if (!quote) return { status: 404, message: 'No encontramos esa cotización.' }
        if (!quote.event_id) return { status: 400, message: 'La cotización no está asociada a un evento.' }
        if (quote.status === 'aceptada') return { status: 409, message: 'Esta cotización ya fue aceptada.' }
        if (quote.status === 'rechazada' || quote.status === 'cancelada') {
          return { status: 409, message: 'No puedes aceptar una cotización rechazada o cancelada.' }
        }
        if (quote.status === 'recibida') {
          return { status: 409, message: 'El proveedor todavía no emite la cotización. Espera su respuesta antes de contratar.' }
        }
        if (quote.status === 'modificacion_solicitada') {
          return { status: 409, message: 'Pediste cambios. Espera la nueva cotización del proveedor antes de contratar.' }
        }
        const isIssued = quote.status === 'emitida' || quote.status === 'cotizada'
        if (!isIssued) {
          return { status: 409, message: 'Solo puedes contratar una cotización emitida, con monto formal del proveedor.' }
        }
        const [versions] = await connection.query(
          `SELECT id, version_number, issued_cents, conditions_text, DATE_FORMAT(valid_until, '%Y-%m-%d') AS valid_until
           FROM quote_versions
           WHERE quote_id = ?
           ORDER BY version_number DESC
           LIMIT 1`,
          [quote.id],
        )
        const current = versions[0]
        if (!current || quote.current_version === null || Number(current.version_number) !== Number(quote.current_version)) {
          return { status: 409, message: 'Esta cotización no tiene una versión vigente.' }
        }
        if (requestedVersion !== undefined && requestedVersion !== null && requestedVersion !== '' && Number(requestedVersion) !== Number(current.version_number)) {
          return { status: 409, message: 'Esa versión ya no está vigente. Solo puedes aceptar la versión actual.' }
        }
        const issuedCents = Number(current.issued_cents)
        const validUntil = dateLabel(current.valid_until)
        if (validUntil && validUntil < todayLabel()) {
          return { status: 409, message: 'Esta cotización venció. Pide al proveedor que emita una vigencia nueva.' }
        }
        const amountCents = issuedCents
        const conditions = String(current.conditions_text || '').trim().slice(0, 500)
        const [existing] = await connection.query(
          'SELECT id FROM service_contracts WHERE client_id = ? AND event_id = ? AND service_id = ? LIMIT 1 FOR UPDATE',
          [request.account.id, quote.event_id, quote.service_id],
        )
        if (existing[0]) return { status: 409, message: 'Este servicio ya está contratado en el evento.' }
        await connection.query(
          `INSERT INTO service_contracts (client_id, event_id, service_id, quote_id, quote_version_id, amount_cents, conditions_text, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'vigente')`,
          [request.account.id, quote.event_id, quote.service_id, quote.id, current.id, amountCents, conditions],
        )
        await connection.query(`UPDATE quote_requests SET status = 'aceptada' WHERE id = ?`, [quote.id])
        return { ok: true, amountCents, versionNumber: Number(current.version_number), eventId: Number(quote.event_id), serviceId: Number(quote.service_id) }
      })
      if (result.status) {
        response.status(result.status).json({ message: result.message })
        return
      }
      response.json(result)
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        response.status(409).json({ message: 'Este servicio ya está contratado en el evento.' })
        return
      }
      throw error
    }
  })

  app.post('/api/quotes/:quoteId/reject', requireUser, requireRole('cliente'), async (request, response) => {
    const quoteId = Number(request.params.quoteId)
    if (!Number.isInteger(quoteId) || quoteId < 1) {
      response.status(400).json({ message: 'La cotización no es válida.' })
      return
    }
    const [rows] = await pool.query(
      'SELECT id, status FROM quote_requests WHERE id = ? AND client_id = ? LIMIT 1',
      [quoteId, request.account.id],
    )
    const quote = rows[0]
    if (!quote) {
      response.status(404).json({ message: 'No encontramos esa cotización.' })
      return
    }
    if (quote.status === 'aceptada') {
      response.status(409).json({ message: 'Una cotización aceptada no puede rechazarse desde aquí.' })
      return
    }
    await pool.query(`UPDATE quote_requests SET status = 'rechazada' WHERE id = ?`, [quote.id])
    response.json({ ok: true })
  })

  app.post('/api/quotes/:quoteId/request-modification', requireUser, requireRole('cliente'), async (request, response) => {
    const quoteId = Number(request.params.quoteId)
    const notes = optionalText(request.body?.notes, 500)
    if (!Number.isInteger(quoteId) || quoteId < 1) {
      response.status(400).json({ message: 'La cotización no es válida.' })
      return
    }
    if (notes === null) {
      response.status(400).json({ message: 'Las observaciones admiten hasta 500 caracteres.' })
      return
    }
    const [rows] = await pool.query(
      'SELECT id, status, notes FROM quote_requests WHERE id = ? AND client_id = ? LIMIT 1',
      [quoteId, request.account.id],
    )
    const quote = rows[0]
    if (!quote) {
      response.status(404).json({ message: 'No encontramos esa cotización.' })
      return
    }
    if (quote.status === 'aceptada' || quote.status === 'rechazada' || quote.status === 'cancelada') {
      response.status(409).json({ message: 'Esta cotización ya no admite modificaciones.' })
      return
    }
    const mergedNotes = notes
      ? `${quote.notes || ''}${quote.notes ? '\n' : ''}[Modificación solicitada] ${notes}`.slice(0, 500)
      : quote.notes
    await pool.query(`UPDATE quote_requests SET status = 'modificacion_solicitada', notes = ? WHERE id = ?`, [mergedNotes, quote.id])
    response.json({ ok: true })
  })

  app.get('/api/contracts', requireUser, requireRole('cliente'), async (request, response) => {
    const [rows] = await pool.query(
      `SELECT sc.id, sc.amount_cents, sc.status, sc.conditions_text, DATE_FORMAT(sc.created_at, '%Y-%m-%d') AS hired_on,
        sc.event_id, e.name AS event_name, DATE_FORMAT(e.event_date, '%Y-%m-%d') AS event_date,
        s.id AS service_id, s.title AS service_title, s.image_url, c.slug, c.title AS category_title, c.image_url AS category_image,
        p.business_name, owner.full_name AS provider_name, sc.quote_id
       FROM service_contracts sc
       JOIN client_events e ON e.id = sc.event_id
       JOIN services s ON s.id = sc.service_id
       JOIN categories c ON c.id = s.category_id
       JOIN users owner ON owner.id = s.provider_id
       LEFT JOIN provider_profiles p ON p.user_id = owner.id
       WHERE sc.client_id = ?
       ORDER BY sc.id DESC`,
      [request.account.id],
    )
    response.json({
      contracts: rows.map((row) => ({
        id: row.id,
        amountCents: row.amount_cents === null ? null : Number(row.amount_cents),
        status: row.status || 'vigente',
        hiredOn: dateLabel(row.hired_on),
        eventId: Number(row.event_id),
        eventName: row.event_name || '',
        eventDate: dateLabel(row.event_date),
        serviceId: Number(row.service_id),
        serviceTitle: row.service_title,
        slug: row.slug,
        categoryTitle: row.category_title,
        imageUrl: row.image_url || row.category_image || null,
        providerName: row.business_name || row.provider_name || '',
        quoteId: row.quote_id === null ? null : Number(row.quote_id),
        conditions: row.conditions_text || '',
      })),
    })
  })

  app.get('/api/providers/:providerId', async (request, response) => {
    const providerId = Number(request.params.providerId)
    if (!Number.isInteger(providerId) || providerId < 1) {
      response.status(404).json({ message: 'No encontramos ese proveedor.' })
      return
    }
    const [providers] = await pool.query(
      `SELECT u.id, u.full_name, p.business_name, p.city, p.description
       FROM users u
       LEFT JOIN provider_profiles p ON p.user_id = u.id
       WHERE u.id = ? AND u.role = 'proveedor' LIMIT 1`,
      [providerId],
    )
    const provider = providers[0]
    if (!provider) {
      response.status(404).json({ message: 'No encontramos ese proveedor.' })
      return
    }
    const [services] = await pool.query(
      `SELECT s.id, s.title, c.slug, c.title AS category_title
       FROM services s
       JOIN categories c ON c.id = s.category_id
       WHERE s.provider_id = ? AND s.is_published = 1
       ORDER BY c.sort_order, s.id`,
      [providerId],
    )
    response.json({
      provider: {
        id: provider.id,
        businessName: provider.business_name || provider.full_name,
        city: provider.city || '',
        description: provider.description || '',
      },
      services: services.map((service) => ({
        id: service.id,
        title: service.title,
        slug: service.slug,
        categoryTitle: service.category_title,
      })),
    })
  })
}
