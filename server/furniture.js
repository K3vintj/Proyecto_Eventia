import { pool } from './db.js'
import { findOwnedEvent } from './planning.js'

const priceModes = ['fijo', 'desde', 'cotizacion']
const itemUnits = ['evento', 'dia', 'jornada', 'unidad', 'fijo', 'cotizacion']
const packageUnits = ['evento', 'dia', 'jornada', 'fijo', 'cotizacion']
const addonUnits = ['evento', 'dia', 'unidad', 'fijo', 'cotizacion']

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

const readQty = (value, max = 10000) => {
  const qty = Number(value)
  if (!Number.isInteger(qty) || qty < 1 || qty > max) return undefined
  return qty
}

const readOptionalQty = (value, max = 10000) => {
  if (value === undefined || value === null || value === '') return null
  return readQty(value, max)
}

const readGuests = (value) => {
  if (value === undefined || value === null || value === '') return null
  const guests = Number(value)
  if (!Number.isInteger(guests) || guests < 1 || guests > 20000) return undefined
  return guests
}

const readDays = (value) => {
  if (value === undefined || value === null || value === '') return null
  const days = Number(value)
  if (!Number.isInteger(days) || days < 1 || days > 30) return undefined
  return days
}

const readCapacity = (value) => {
  if (value === undefined || value === null || value === '') return null
  const capacity = Number(value)
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) return undefined
  return capacity
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

const toImage = (row) => ({
  id: row.id,
  url: row.image_url,
  alt: row.alt_text || '',
  tag: row.gallery_tag || '',
})

const multiplierForUnit = (unit, rentalDays) => {
  if (unit === 'dia') return rentalDays || 1
  return 1
}

export const recommendFurniture = ({ guests, tableCapacity }) => {
  if (!guests) return { tables: null, chairs: null }
  const tables = tableCapacity ? Math.ceil(guests / tableCapacity) : null
  return { tables, chairs: guests }
}

export const loadFurniture = async (serviceId, { includeInactive = false, connection = pool } = {}) => {
  const [details] = await connection.query('SELECT * FROM furniture_details WHERE service_id = ? LIMIT 1', [serviceId])
  const detail = details[0]
  const active = includeInactive ? '' : 'AND is_active = 1'
  const [items] = await connection.query(`SELECT * FROM furniture_items WHERE service_id = ? ${active} ORDER BY subcategory, sort_order, id`, [serviceId])
  const [packages] = await connection.query(`SELECT * FROM furniture_packages WHERE service_id = ? ${active} ORDER BY sort_order, id`, [serviceId])
  const [packageItems] = await connection.query(
    `SELECT pi.package_id, pi.item_id, pi.quantity
     FROM furniture_package_items pi
     JOIN furniture_packages p ON p.id = pi.package_id
     WHERE p.service_id = ?`,
    [serviceId],
  )
  const [addons] = await connection.query(`SELECT * FROM furniture_addons WHERE service_id = ? ${active} ORDER BY sort_order, id`, [serviceId])
  const [images] = await connection.query(
    'SELECT id, image_url, alt_text, gallery_tag FROM service_images WHERE service_id = ? AND package_id IS NULL AND decoration_package_id IS NULL ORDER BY sort_order, id',
    [serviceId],
  )
  const itemsByPackage = new Map()
  for (const row of packageItems) {
    const list = itemsByPackage.get(row.package_id) || []
    list.push({ itemId: Number(row.item_id), quantity: Number(row.quantity) })
    itemsByPackage.set(row.package_id, list)
  }
  return {
    coverageArea: detail?.coverage_area || '',
    specialties: detail?.specialties || '',
    furnitureTypes: detail?.furniture_types || '',
    priceMode: detail?.price_mode || '',
    conditions: detail?.conditions || '',
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      subcategory: item.subcategory || '',
      style: item.style || '',
      capacity: item.capacity == null ? null : Number(item.capacity),
      priceCents: centsOrNull(item.price_cents),
      priceUnit: item.price_unit,
      minQty: item.min_qty == null ? null : Number(item.min_qty),
      stock: item.stock == null ? null : Number(item.stock),
      imageUrl: item.image_url || '',
      conditions: item.conditions || '',
      isActive: Boolean(item.is_active),
    })),
    packages: packages.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      priceCents: centsOrNull(item.price_cents),
      priceUnit: item.price_unit,
      rentalLabel: item.rental_label || '',
      conditions: item.conditions || '',
      imageUrl: item.image_url || '',
      isActive: Boolean(item.is_active),
      items: itemsByPackage.get(item.id) || [],
    })),
    addons: addons.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      priceCents: centsOrNull(item.price_cents),
      priceUnit: item.price_unit,
      isActive: Boolean(item.is_active),
    })),
    images: images.map(toImage),
  }
}

const addAmount = (total, priceCents, unit, quantity = 1, rentalDays = 1) => {
  if (priceCents === null || unit === 'cotizacion' || unit === 'desde' || unit === '') {
    return {
      ...total,
      pending: true,
      hasAmount: total.hasAmount || (unit === 'desde' && priceCents !== null),
      cents: unit === 'desde' && priceCents !== null ? total.cents + priceCents : total.cents,
    }
  }
  const factor = multiplierForUnit(unit, rentalDays)
  if (unit === 'unidad' || unit === 'evento' || unit === 'jornada' || unit === 'dia' || unit === 'fijo') {
    return { cents: total.cents + priceCents * quantity * factor, pending: total.pending, hasAmount: true }
  }
  return { cents: total.cents + priceCents * quantity * factor, pending: total.pending, hasAmount: true }
}

export const buildFurnitureSelection = (furniture, servicePriceCents, input) => {
  const guests = readGuests(input.guests)
  if (guests === undefined) return { error: 'El número de invitados no es válido.' }
  const rentalDays = readDays(input.rentalDays)
  if (rentalDays === undefined) return { error: 'La duración de renta no es válida.' }
  const days = rentalDays || 1
  const eventLocation = optionalText(input.eventLocation, 200)
  const notes = input.notes === undefined || input.notes === null || String(input.notes).trim() === '' ? '' : cleanText(input.notes, 500)
  if (eventLocation === null || notes === null) return { error: 'Revisa la ubicación o las observaciones.' }

  const packageId = input.packageId ? Number(input.packageId) : null
  const selectedPackage = packageId ? furniture.packages.find((item) => item.id === packageId && item.isActive !== false) : null
  if (packageId && !selectedPackage) return { error: 'El paquete no pertenece a este proveedor de mobiliario.' }

  const packageQty = new Map()
  if (selectedPackage) {
    for (const entry of selectedPackage.items) packageQty.set(entry.itemId, entry.quantity)
  }

  const requested = Array.isArray(input.items) ? input.items : []
  const chosen = []
  for (const entry of requested) {
    const item = furniture.items.find((row) => row.id === Number(entry.id) && row.isActive !== false)
    if (!item) return { error: 'Hay un artículo que este proveedor no ofrece.' }
    const quantity = readQty(entry.quantity ?? item.minQty ?? 1)
    if (quantity === undefined) return { error: `La cantidad de ${item.name} no es válida.` }
    if (item.minQty !== null && quantity < item.minQty) return { error: `${item.name} pide al menos ${item.minQty}.` }
    if (item.stock !== null && quantity > item.stock) return { error: `${item.name} solo tiene ${item.stock} disponibles registrados.` }
    chosen.push({ item, quantity })
  }

  const requestedAddons = Array.isArray(input.addons) ? input.addons : []
  const chosenAddons = []
  for (const entry of requestedAddons) {
    const addon = furniture.addons.find((row) => row.id === Number(entry.id) && row.isActive !== false)
    if (!addon) return { error: 'Hay un complemento que este proveedor no ofrece.' }
    const quantity = readQty(entry.quantity ?? 1)
    if (quantity === undefined) return { error: `La cantidad de ${addon.name} no es válida.` }
    chosenAddons.push({ addon, quantity })
  }

  if (!selectedPackage && chosen.length === 0 && chosenAddons.length === 0) {
    return { error: 'Selecciona al menos un artículo, paquete o complemento.' }
  }

  let total = { cents: 0, pending: false, hasAmount: false }
  if (selectedPackage) total = addAmount(total, selectedPackage.priceCents, selectedPackage.priceUnit, 1, days)
  else if (!chosen.length && (servicePriceCents !== null || furniture.priceMode)) {
    total = addAmount(total, servicePriceCents, furniture.priceMode === 'fijo' ? 'fijo' : furniture.priceMode === 'desde' ? 'desde' : 'cotizacion')
  }

  for (const entry of chosen) {
    const included = packageQty.get(entry.item.id) || 0
    const billable = Math.max(0, entry.quantity - included)
    if (!billable) continue
    total = addAmount(total, entry.item.priceCents, entry.item.priceUnit, billable, days)
  }
  for (const entry of chosenAddons) total = addAmount(total, entry.addon.priceCents, entry.addon.priceUnit, entry.quantity, days)

  const tableItemId = input.calculatorTableItemId ? Number(input.calculatorTableItemId) : null
  const tableItem = tableItemId ? furniture.items.find((item) => item.id === tableItemId) : null
  if (tableItemId && !tableItem) return { error: 'La mesa de la calculadora no pertenece a este proveedor.' }
  const recommendation = recommendFurniture({ guests, tableCapacity: tableItem?.capacity || null })

  const snapshot = {
    package: selectedPackage ? {
      id: selectedPackage.id,
      name: selectedPackage.name,
      priceCents: selectedPackage.priceCents,
      priceUnit: selectedPackage.priceUnit,
      rentalLabel: selectedPackage.rentalLabel,
      conditions: selectedPackage.conditions,
      items: selectedPackage.items,
    } : null,
    items: chosen.map((entry) => ({
      id: entry.item.id,
      name: entry.item.name,
      subcategory: entry.item.subcategory,
      quantity: entry.quantity,
      capacity: entry.item.capacity,
      priceCents: entry.item.priceCents,
      priceUnit: entry.item.priceUnit,
      includedInPackage: Math.min(entry.quantity, packageQty.get(entry.item.id) || 0),
    })),
    addons: chosenAddons.map((entry) => ({
      id: entry.addon.id,
      name: entry.addon.name,
      quantity: entry.quantity,
      priceCents: entry.addon.priceCents,
      priceUnit: entry.addon.priceUnit,
    })),
    rentalDays: days,
    guests,
    recommendation,
    calculatorTableName: tableItem?.name || '',
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

export const saveFurniture = async ({ clientId, serviceId, kind, body }) => {
  const event = await findOwnedEvent(clientId, body?.eventId)
  if (!event) return { status: 404, message: 'El evento no existe o no te pertenece.' }
  return withTransaction(async (connection) => {
    const [services] = await connection.query('SELECT id, price_cents, is_published FROM services WHERE id = ? LIMIT 1 FOR UPDATE', [serviceId])
    if (!services[0]?.is_published) return { status: 404, message: 'No encontramos ese servicio.' }
    const furniture = await loadFurniture(serviceId, { connection })
    const built = buildFurnitureSelection(furniture, centsOrNull(services[0].price_cents), body || {})
    if (built.error) return { status: 400, message: built.error }
    const table = kind === 'quote' ? 'quote_requests' : 'planner_items'
    const [existing] = await connection.query(
      `SELECT id FROM ${table} WHERE client_id = ? AND service_id = ? AND event_id = ? LIMIT 1 FOR UPDATE`,
      [clientId, serviceId, event.id],
    )
    if (existing[0] && kind === 'quote') {
      return {
        created: false,
        event,
        estimatedCents: built.estimatedCents,
        selection: built.snapshot,
        message: 'Ya enviaste una cotización de este mobiliario para ese evento.',
      }
    }
    if (existing[0] && kind === 'planner') {
      await connection.query(
        'UPDATE planner_items SET estimated_cents = ?, selection_json = ? WHERE id = ?',
        [built.estimatedCents, JSON.stringify(built.snapshot), existing[0].id],
      )
      const budgetCents = await eventBudget(connection, clientId, event.id)
      return { created: false, updated: true, event, estimatedCents: built.estimatedCents, budgetCents, selection: built.snapshot }
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

export const registerFurniture = (app, { requireUser, requireRole }) => {
  const providerOnly = [requireUser, requireRole('proveedor')]

  app.post('/api/provider/furniture', ...providerOnly, async (request, response) => {
    const title = cleanText(request.body?.title, 160)
    const description = optionalText(request.body?.description, 500)
    if (!title || title.length < 2 || description === null) return sendError(response, 400, 'Escribe el nombre del servicio.')
    const [categories] = await pool.query(`SELECT id FROM categories WHERE slug = 'mobiliario' LIMIT 1`)
    if (!categories[0]) return sendError(response, 404, 'La categoría de mobiliario no está disponible.')
    const [created] = await pool.query(
      'INSERT INTO services (provider_id, category_id, title, description, price_cents, image_url, is_published) VALUES (?, ?, ?, ?, NULL, NULL, 0)',
      [request.account.id, categories[0].id, title, description || 'Servicio de mobiliario para eventos.'],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.put('/api/provider/furniture/:serviceId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'mobiliario') return sendError(response, 404, 'No encontramos ese servicio de mobiliario.')
    const title = cleanText(request.body?.title, 160)
    const description = optionalText(request.body?.description, 500)
    const coverageArea = optionalText(request.body?.coverageArea, 200)
    const specialties = optionalText(request.body?.specialties, 300)
    const furnitureTypes = optionalText(request.body?.furnitureTypes, 300)
    const conditions = optionalText(request.body?.conditions, 500)
    const priceCents = readCents(request.body?.priceCents)
    const priceMode = request.body?.priceMode || null
    if (!title || description === null || coverageArea === null || specialties === null || furnitureTypes === null || conditions === null || priceCents === undefined || (priceMode && !priceModes.includes(priceMode))) {
      return sendError(response, 400, 'Revisa la información del mobiliario.')
    }
    await withTransaction(async (connection) => {
      await connection.query(
        'UPDATE services SET title = ?, description = ?, price_cents = ?, is_published = ? WHERE id = ? AND provider_id = ?',
        [title, description, priceCents, request.body?.isPublished ? 1 : 0, service.id, request.account.id],
      )
      await connection.query(
        `INSERT INTO furniture_details (service_id, coverage_area, specialties, furniture_types, price_mode, conditions)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE coverage_area = VALUES(coverage_area), specialties = VALUES(specialties),
           furniture_types = VALUES(furniture_types), price_mode = VALUES(price_mode), conditions = VALUES(conditions)`,
        [service.id, coverageArea, specialties, furnitureTypes, priceMode, conditions],
      )
    })
    response.json({ ok: true })
  })

  app.post('/api/provider/furniture/:serviceId/items', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'mobiliario') return sendError(response, 404, 'No encontramos ese servicio de mobiliario.')
    const name = cleanText(request.body?.name, 160)
    const description = optionalText(request.body?.description, 500)
    const subcategory = optionalText(request.body?.subcategory, 80)
    const style = optionalText(request.body?.style, 80)
    const conditions = optionalText(request.body?.conditions, 500)
    const imageUrl = optionalUrl(request.body?.imageUrl)
    const capacity = readCapacity(request.body?.capacity)
    const priceCents = readCents(request.body?.priceCents)
    const priceUnit = request.body?.priceUnit || 'cotizacion'
    const minQty = readOptionalQty(request.body?.minQty)
    const stock = readOptionalQty(request.body?.stock)
    if (!name || description === null || subcategory === null || style === null || conditions === null || imageUrl === undefined || capacity === undefined || priceCents === undefined || !itemUnits.includes(priceUnit) || minQty === undefined || stock === undefined) {
      return sendError(response, 400, 'Revisa el artículo de mobiliario.')
    }
    const [created] = await pool.query(
      `INSERT INTO furniture_items (
        service_id, name, description, subcategory, style, capacity, price_cents, price_unit, min_qty, stock, image_url, conditions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [service.id, name, description, subcategory, style, capacity, priceCents, priceUnit, minQty, stock, imageUrl, conditions],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/furniture/:serviceId/items/:itemId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos ese servicio de mobiliario.')
    const [result] = await pool.query('DELETE FROM furniture_items WHERE id = ? AND service_id = ?', [Number(request.params.itemId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos ese artículo.')
    response.json({ ok: true })
  })

  app.post('/api/provider/furniture/:serviceId/packages', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'mobiliario') return sendError(response, 404, 'No encontramos ese servicio de mobiliario.')
    const name = cleanText(request.body?.name, 120)
    const description = optionalText(request.body?.description, 500)
    const rentalLabel = optionalText(request.body?.rentalLabel, 120)
    const conditions = optionalText(request.body?.conditions, 500)
    const imageUrl = optionalUrl(request.body?.imageUrl)
    const priceCents = readCents(request.body?.priceCents)
    const priceUnit = request.body?.priceUnit || 'cotizacion'
    const entries = Array.isArray(request.body?.items) ? request.body.items : []
    if (!name || description === null || rentalLabel === null || conditions === null || imageUrl === undefined || priceCents === undefined || !packageUnits.includes(priceUnit)) {
      return sendError(response, 400, 'Revisa el paquete de mobiliario.')
    }
    const packageItems = []
    for (const entry of entries) {
      const itemId = Number(entry.id)
      const quantity = readQty(entry.quantity ?? 1)
      if (!Number.isInteger(itemId) || quantity === undefined) return sendError(response, 400, 'Revisa los artículos del paquete.')
      const [rows] = await pool.query('SELECT id FROM furniture_items WHERE id = ? AND service_id = ? LIMIT 1', [itemId, service.id])
      if (!rows[0]) return sendError(response, 404, 'Hay un artículo del paquete que no pertenece a este servicio.')
      packageItems.push({ itemId, quantity })
    }
    const createdId = await withTransaction(async (connection) => {
      const [created] = await connection.query(
        `INSERT INTO furniture_packages (service_id, name, description, price_cents, price_unit, rental_label, conditions, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [service.id, name, description, priceCents, priceUnit, rentalLabel, conditions, imageUrl],
      )
      for (const entry of packageItems) {
        await connection.query(
          'INSERT INTO furniture_package_items (package_id, item_id, quantity) VALUES (?, ?, ?)',
          [created.insertId, entry.itemId, entry.quantity],
        )
      }
      return created.insertId
    })
    response.status(201).json({ id: createdId })
  })

  app.delete('/api/provider/furniture/:serviceId/packages/:packageId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos ese servicio de mobiliario.')
    const [result] = await pool.query('DELETE FROM furniture_packages WHERE id = ? AND service_id = ?', [Number(request.params.packageId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos ese paquete.')
    response.json({ ok: true })
  })

  app.post('/api/provider/furniture/:serviceId/addons', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'mobiliario') return sendError(response, 404, 'No encontramos ese servicio de mobiliario.')
    const name = cleanText(request.body?.name, 120)
    const description = optionalText(request.body?.description, 500)
    const priceCents = readCents(request.body?.priceCents)
    const priceUnit = request.body?.priceUnit || 'cotizacion'
    if (!name || description === null || priceCents === undefined || !addonUnits.includes(priceUnit)) {
      return sendError(response, 400, 'Revisa el complemento.')
    }
    const [created] = await pool.query(
      'INSERT INTO furniture_addons (service_id, name, description, price_cents, price_unit) VALUES (?, ?, ?, ?, ?)',
      [service.id, name, description, priceCents, priceUnit],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/furniture/:serviceId/addons/:addonId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos ese servicio de mobiliario.')
    const [result] = await pool.query('DELETE FROM furniture_addons WHERE id = ? AND service_id = ?', [Number(request.params.addonId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos ese complemento.')
    response.json({ ok: true })
  })

  app.post('/api/provider/furniture/:serviceId/images', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'mobiliario') return sendError(response, 404, 'No encontramos ese servicio de mobiliario.')
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
