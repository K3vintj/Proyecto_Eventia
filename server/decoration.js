import { pool } from './db.js'
import { findOwnedEvent } from './planning.js'

const priceUnits = ['fijo', 'desde', 'cotizacion']
const elementUnits = ['unidad', 'fijo', 'cotizacion']
const hexColor = /^#[0-9a-fA-F]{6}$/

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

const readQty = (value) => {
  const qty = Number(value)
  if (!Number.isInteger(qty) || qty < 1 || qty > 10000) return undefined
  return qty
}

const readGuests = (value) => {
  if (value === undefined || value === null || value === '') return null
  const guests = Number(value)
  if (!Number.isInteger(guests) || guests < 1 || guests > 20000) return undefined
  return guests
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

const readColors = (value) => {
  const text = optionalText(value, 80)
  if (text === null) return undefined
  if (!text) return ''
  const colors = text.split(',').map((item) => item.trim())
  if (colors.length > 6 || colors.some((color) => !hexColor.test(color))) return undefined
  return colors.join(',')
}

const centsOrNull = (value) => (value === null || value === undefined ? null : Number(value))

const toImage = (row) => ({
  id: row.id,
  url: row.image_url,
  alt: row.alt_text || '',
  tag: row.gallery_tag || '',
  styleId: row.style_id == null ? null : Number(row.style_id),
  packageId: row.decoration_package_id == null ? null : Number(row.decoration_package_id),
})

export const loadDecoration = async (serviceId, { includeInactive = false, connection = pool } = {}) => {
  const [details] = await connection.query('SELECT * FROM decoration_details WHERE service_id = ? LIMIT 1', [serviceId])
  const detail = details[0]
  const active = includeInactive ? '' : 'AND is_active = 1'
  const [styles] = await connection.query(`SELECT * FROM decoration_styles WHERE service_id = ? ${active} ORDER BY sort_order, id`, [serviceId])
  const [palettes] = await connection.query('SELECT * FROM decoration_palettes WHERE service_id = ? ORDER BY sort_order, id', [serviceId])
  const [elements] = await connection.query('SELECT * FROM decoration_elements WHERE service_id = ? ORDER BY sort_order, id', [serviceId])
  const [packages] = await connection.query(`SELECT * FROM decoration_packages WHERE service_id = ? ${active} ORDER BY sort_order, id`, [serviceId])
  const [images] = await connection.query(
    'SELECT id, image_url, alt_text, gallery_tag, style_id, decoration_package_id FROM service_images WHERE service_id = ? ORDER BY sort_order, id',
    [serviceId],
  )
  const gallery = images.map(toImage)
  return {
    coverageArea: detail?.coverage_area || '',
    specialties: detail?.specialties || '',
    priceMode: detail?.price_mode || '',
    styles: styles.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      isActive: Boolean(item.is_active),
      images: gallery.filter((image) => image.styleId === item.id && image.packageId === null),
    })),
    palettes: palettes.map((item) => ({
      id: item.id,
      name: item.name,
      colors: item.colors ? item.colors.split(',') : [],
      description: item.description || '',
    })),
    elements: elements.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      priceCents: centsOrNull(item.price_cents),
      priceUnit: item.price_unit,
      minQty: item.min_qty == null ? null : Number(item.min_qty),
      maxQty: item.max_qty == null ? null : Number(item.max_qty),
      isAddon: Boolean(item.is_addon),
    })),
    packages: packages.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      priceCents: centsOrNull(item.price_cents),
      priceUnit: item.price_unit,
      includedItems: item.included_items || '',
      coverage: item.coverage || '',
      conditions: item.conditions || '',
      isActive: Boolean(item.is_active),
      images: gallery.filter((image) => image.packageId === item.id),
    })),
    images: gallery.filter((image) => image.packageId === null),
  }
}

const addAmount = (total, priceCents, unit, quantity = 1) => {
  if (priceCents === null || unit === 'cotizacion' || unit === 'desde') return { ...total, pending: true, hasAmount: total.hasAmount || (unit === 'desde' && priceCents !== null), cents: unit === 'desde' && priceCents !== null ? total.cents + priceCents : total.cents }
  if (unit === 'unidad') return { cents: total.cents + priceCents * quantity, pending: total.pending, hasAmount: true }
  return { cents: total.cents + priceCents, pending: total.pending, hasAmount: true }
}

export const buildDecorationSelection = (decoration, servicePriceCents, input) => {
  const guests = readGuests(input.guests)
  if (guests === undefined) return { error: 'El número de invitados no es válido.' }
  const eventTime = readTime(input.eventTime)
  if (eventTime === undefined) return { error: 'El horario debe usar el formato HH:MM.' }
  const eventLocation = optionalText(input.eventLocation, 200)
  const colorNote = optionalText(input.colorNote, 120)
  const notes = input.notes === undefined || input.notes === null || String(input.notes).trim() === '' ? '' : cleanText(input.notes, 500)
  if (eventLocation === null || colorNote === null || notes === null) return { error: 'Revisa la ubicación, los colores o las observaciones.' }
  const styleId = input.styleId ? Number(input.styleId) : null
  const style = styleId ? decoration.styles.find((item) => item.id === styleId && item.isActive !== false) : null
  if (styleId && !style) return { error: 'El estilo no pertenece a este decorador.' }
  const paletteId = input.paletteId ? Number(input.paletteId) : null
  const palette = paletteId ? decoration.palettes.find((item) => item.id === paletteId) : null
  if (paletteId && !palette) return { error: 'La paleta no pertenece a este decorador.' }
  const packageId = input.packageId ? Number(input.packageId) : null
  const selectedPackage = packageId ? decoration.packages.find((item) => item.id === packageId && item.isActive !== false) : null
  if (packageId && !selectedPackage) return { error: 'El paquete no pertenece a este decorador.' }
  const requested = Array.isArray(input.elements) ? input.elements : []
  const chosen = []
  for (const entry of requested) {
    const element = decoration.elements.find((item) => item.id === Number(entry.id))
    if (!element) return { error: 'Hay un elemento que este decorador no ofrece.' }
    const quantity = readQty(entry.quantity ?? element.minQty ?? 1)
    if (quantity === undefined) return { error: `La cantidad de ${element.name} no es válida.` }
    if (element.minQty !== null && quantity < element.minQty) return { error: `${element.name} pide al menos ${element.minQty}.` }
    if (element.maxQty !== null && quantity > element.maxQty) return { error: `${element.name} admite hasta ${element.maxQty}.` }
    chosen.push({ element, quantity })
  }
  let total = { cents: 0, pending: false, hasAmount: false }
  if (selectedPackage) total = addAmount(total, selectedPackage.priceCents, selectedPackage.priceUnit)
  else if (servicePriceCents !== null || decoration.priceMode) total = addAmount(total, servicePriceCents, decoration.priceMode === 'fijo' ? 'fijo' : decoration.priceMode === 'desde' ? 'desde' : 'cotizacion')
  else total = { ...total, pending: true }
  for (const item of chosen) total = addAmount(total, item.element.priceCents, item.element.priceUnit, item.quantity)
  const snapshot = {
    style: style ? { id: style.id, name: style.name } : null,
    palette: palette ? { id: palette.id, name: palette.name, colors: palette.colors } : null,
    colorNote,
    package: selectedPackage ? {
      id: selectedPackage.id,
      name: selectedPackage.name,
      priceCents: selectedPackage.priceCents,
      priceUnit: selectedPackage.priceUnit,
      includedItems: selectedPackage.includedItems,
      conditions: selectedPackage.conditions,
    } : null,
    elements: chosen.map((item) => ({
      id: item.element.id,
      name: item.element.name,
      quantity: item.quantity,
      priceCents: item.element.priceCents,
      priceUnit: item.element.priceUnit,
      isAddon: item.element.isAddon,
    })),
    guests,
    eventTime,
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

export const saveDecoration = async ({ clientId, serviceId, kind, body }) => {
  const event = await findOwnedEvent(clientId, body?.eventId)
  if (!event) return { status: 404, message: 'El evento no existe o no te pertenece.' }
  return withTransaction(async (connection) => {
    const [services] = await connection.query('SELECT id, price_cents, is_published FROM services WHERE id = ? LIMIT 1 FOR UPDATE', [serviceId])
    if (!services[0]?.is_published) return { status: 404, message: 'No encontramos ese servicio.' }
    const decoration = await loadDecoration(serviceId, { connection })
    const built = buildDecorationSelection(decoration, centsOrNull(services[0].price_cents), body || {})
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
          ? 'Ya enviaste una cotización de esta decoración para ese evento.'
          : 'Esta decoración ya está en el presupuesto de ese evento.',
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

export const registerDecoration = (app, { requireUser, requireRole }) => {
  const providerOnly = [requireUser, requireRole('proveedor')]

  app.post('/api/provider/decorations', ...providerOnly, async (request, response) => {
    const title = cleanText(request.body?.title, 160)
    const description = optionalText(request.body?.description, 500)
    if (!title || title.length < 2 || description === null) {
      sendError(response, 400, 'Escribe el nombre del servicio.')
      return
    }
    const [categories] = await pool.query(`SELECT id FROM categories WHERE slug = 'flores-decoracion' LIMIT 1`)
    if (!categories[0]) {
      sendError(response, 404, 'La categoría de decoración no está disponible.')
      return
    }
    const [created] = await pool.query(
      'INSERT INTO services (provider_id, category_id, title, description, price_cents, image_url, is_published) VALUES (?, ?, ?, ?, NULL, NULL, 0)',
      [request.account.id, categories[0].id, title, description || 'Servicio de decoración.'],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.put('/api/provider/decorations/:serviceId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'flores-decoracion') {
      sendError(response, 404, 'No encontramos esa decoración.')
      return
    }
    const title = cleanText(request.body?.title, 160)
    const description = optionalText(request.body?.description, 500)
    const coverageArea = optionalText(request.body?.coverageArea, 200)
    const specialties = optionalText(request.body?.specialties, 300)
    const priceCents = readCents(request.body?.priceCents)
    const priceMode = request.body?.priceMode || null
    if (!title || description === null || coverageArea === null || specialties === null || priceCents === undefined || (priceMode && !priceUnits.includes(priceMode))) {
      sendError(response, 400, 'Revisa la información de la decoración.')
      return
    }
    await withTransaction(async (connection) => {
      await connection.query(
        'UPDATE services SET title = ?, description = ?, price_cents = ?, is_published = ? WHERE id = ? AND provider_id = ?',
        [title, description, priceCents, request.body?.isPublished ? 1 : 0, service.id, request.account.id],
      )
      await connection.query(
        `INSERT INTO decoration_details (service_id, coverage_area, specialties, price_mode)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE coverage_area = VALUES(coverage_area), specialties = VALUES(specialties), price_mode = VALUES(price_mode)`,
        [service.id, coverageArea, specialties, priceMode],
      )
    })
    response.json({ ok: true })
  })

  app.post('/api/provider/decorations/:serviceId/styles', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'flores-decoracion') return sendError(response, 404, 'No encontramos esa decoración.')
    const name = cleanText(request.body?.name, 80)
    const description = optionalText(request.body?.description, 500)
    if (!name || description === null) return sendError(response, 400, 'Revisa el estilo.')
    const [created] = await pool.query('INSERT INTO decoration_styles (service_id, name, description) VALUES (?, ?, ?)', [service.id, name, description])
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/decorations/:serviceId/styles/:styleId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos esa decoración.')
    const [result] = await pool.query('DELETE FROM decoration_styles WHERE id = ? AND service_id = ?', [Number(request.params.styleId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos ese estilo.')
    response.json({ ok: true })
  })

  app.post('/api/provider/decorations/:serviceId/palettes', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'flores-decoracion') return sendError(response, 404, 'No encontramos esa decoración.')
    const name = cleanText(request.body?.name, 80)
    const colors = readColors(request.body?.colors)
    const description = optionalText(request.body?.description, 300)
    if (!name || colors === undefined || description === null) return sendError(response, 400, 'La paleta necesita un nombre y hasta seis colores hexadecimales.')
    const [created] = await pool.query('INSERT INTO decoration_palettes (service_id, name, colors, description) VALUES (?, ?, ?, ?)', [service.id, name, colors, description])
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/decorations/:serviceId/palettes/:paletteId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos esa decoración.')
    const [result] = await pool.query('DELETE FROM decoration_palettes WHERE id = ? AND service_id = ?', [Number(request.params.paletteId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos esa paleta.')
    response.json({ ok: true })
  })

  app.post('/api/provider/decorations/:serviceId/elements', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'flores-decoracion') return sendError(response, 404, 'No encontramos esa decoración.')
    const name = cleanText(request.body?.name, 120)
    const description = optionalText(request.body?.description, 500)
    const priceCents = readCents(request.body?.priceCents)
    const priceUnit = request.body?.priceUnit || 'cotizacion'
    const minQty = request.body?.minQty === '' || request.body?.minQty == null ? null : readQty(request.body.minQty)
    const maxQty = request.body?.maxQty === '' || request.body?.maxQty == null ? null : readQty(request.body.maxQty)
    if (!name || description === null || priceCents === undefined || !elementUnits.includes(priceUnit) || minQty === undefined || maxQty === undefined) {
      return sendError(response, 400, 'Revisa el elemento decorativo.')
    }
    if (minQty !== null && maxQty !== null && minQty > maxQty) return sendError(response, 400, 'La cantidad mínima no puede superar la máxima.')
    const [created] = await pool.query(
      'INSERT INTO decoration_elements (service_id, name, description, price_cents, price_unit, min_qty, max_qty, is_addon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [service.id, name, description, priceCents, priceUnit, minQty, maxQty, request.body?.isAddon ? 1 : 0],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/decorations/:serviceId/elements/:elementId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos esa decoración.')
    const [result] = await pool.query('DELETE FROM decoration_elements WHERE id = ? AND service_id = ?', [Number(request.params.elementId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos ese elemento.')
    response.json({ ok: true })
  })

  app.post('/api/provider/decorations/:serviceId/packages', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'flores-decoracion') return sendError(response, 404, 'No encontramos esa decoración.')
    const name = cleanText(request.body?.name, 120)
    const description = optionalText(request.body?.description, 500)
    const includedItems = optionalText(request.body?.includedItems, 500)
    const coverage = optionalText(request.body?.coverage, 200)
    const conditions = optionalText(request.body?.conditions, 500)
    const priceCents = readCents(request.body?.priceCents)
    const priceUnit = request.body?.priceUnit || 'cotizacion'
    if (!name || description === null || includedItems === null || coverage === null || conditions === null || priceCents === undefined || !priceUnits.includes(priceUnit)) {
      return sendError(response, 400, 'Revisa el paquete.')
    }
    const [created] = await pool.query(
      `INSERT INTO decoration_packages (service_id, name, description, price_cents, price_unit, included_items, coverage, conditions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [service.id, name, description, priceCents, priceUnit, includedItems, coverage, conditions],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/decorations/:serviceId/packages/:packageId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos esa decoración.')
    const [result] = await pool.query('DELETE FROM decoration_packages WHERE id = ? AND service_id = ?', [Number(request.params.packageId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos ese paquete.')
    response.json({ ok: true })
  })

  app.post('/api/provider/decorations/:serviceId/images', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'flores-decoracion') return sendError(response, 404, 'No encontramos esa decoración.')
    const imageUrl = readUrl(request.body?.imageUrl)
    const altText = optionalText(request.body?.altText, 160)
    const tag = optionalText(request.body?.tag, 80)
    if (!imageUrl || altText === null || tag === null) return sendError(response, 400, 'La fotografía necesita una dirección http o https válida.')
    let styleId = null
    if (request.body?.styleId) {
      const [styles] = await pool.query('SELECT id FROM decoration_styles WHERE id = ? AND service_id = ? LIMIT 1', [Number(request.body.styleId), service.id])
      if (!styles[0]) return sendError(response, 404, 'No encontramos ese estilo.')
      styleId = styles[0].id
    }
    let packageId = null
    if (request.body?.packageId) {
      const [packages] = await pool.query('SELECT id FROM decoration_packages WHERE id = ? AND service_id = ? LIMIT 1', [Number(request.body.packageId), service.id])
      if (!packages[0]) return sendError(response, 404, 'No encontramos ese paquete.')
      packageId = packages[0].id
    }
    const [created] = await pool.query(
      'INSERT INTO service_images (service_id, image_url, alt_text, gallery_tag, style_id, decoration_package_id) VALUES (?, ?, ?, ?, ?, ?)',
      [service.id, imageUrl, altText, tag, styleId, packageId],
    )
    response.status(201).json({ id: created.insertId })
  })
}
