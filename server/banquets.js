import { pool } from './db.js'
import { findOwnedEvent } from './planning.js'
import { loadDecoration } from './decoration.js'
import { loadMusic } from './music.js'
import { loadWaitstaff } from './waitstaff.js'
import { loadFurniture } from './furniture.js'

const courses = ['entrada', 'fuerte', 'guarnicion', 'postre', 'bebida', 'otro']
const priceUnits = ['persona', 'fijo', 'cotizacion']
const inclusions = ['incluido', 'opcional', 'no_incluido']

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

const readGuests = (value) => {
  if (value === undefined || value === null || value === '') return null
  const guests = Number(value)
  if (!Number.isInteger(guests) || guests < 1 || guests > 20000) return undefined
  return guests
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

const readTime = (value) => {
  const text = optionalText(value, 5)
  if (text === null) return undefined
  if (!text) return ''
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : undefined
}

const centsOrNull = (value) => (value === null || value === undefined ? null : Number(value))

const toPackage = (row, dishes, images) => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  priceCents: centsOrNull(row.price_cents),
  priceUnit: row.price_unit,
  minGuests: row.min_guests === null ? null : Number(row.min_guests),
  conditions: row.conditions || '',
  isActive: Boolean(row.is_active),
  dishes,
  images,
})

const toDish = (row) => ({
  id: row.id,
  course: row.course,
  name: row.name,
  optionGroup: row.option_group || '',
})

const toOffering = (row) => ({
  id: row.id,
  name: row.name,
  inclusion: row.inclusion,
  priceCents: centsOrNull(row.price_cents),
  priceUnit: row.price_unit,
})

const toImage = (row) => ({
  id: row.id,
  url: row.image_url,
  alt: row.alt_text || '',
  packageId: row.package_id === null ? null : Number(row.package_id),
})

export const loadBanquet = async (serviceId, { includeInactive = false, connection = pool } = {}) => {
  const [details] = await connection.query('SELECT * FROM banquet_details WHERE service_id = ? LIMIT 1', [serviceId])
  const detail = details[0]
  const [packages] = await connection.query(
    `SELECT * FROM banquet_packages WHERE service_id = ? ${includeInactive ? '' : 'AND is_active = 1'} ORDER BY sort_order, id`,
    [serviceId],
  )
  const packageIds = packages.map((item) => item.id)
  const [menu] = packageIds.length
    ? await connection.query('SELECT * FROM banquet_menu_items WHERE package_id IN (?) ORDER BY sort_order, id', [packageIds])
    : [[]]
  const [images] = packageIds.length
    ? await connection.query('SELECT id, package_id, image_url, alt_text FROM service_images WHERE package_id IN (?) ORDER BY sort_order, id', [packageIds])
    : [[]]
  const [offerings] = await connection.query(
    'SELECT * FROM banquet_offerings WHERE service_id = ? ORDER BY sort_order, id',
    [serviceId],
  )
  return {
    serviceType: detail?.service_type || '',
    coverageArea: detail?.coverage_area || '',
    priceMode: detail?.price_mode || '',
    guestMin: detail?.guest_min == null ? null : Number(detail.guest_min),
    guestMax: detail?.guest_max == null ? null : Number(detail.guest_max),
    packages: packages.map((item) => toPackage(
      item,
      menu.filter((dish) => dish.package_id === item.id).map(toDish),
      images.filter((image) => image.package_id === item.id).map(toImage),
    )),
    offerings: offerings.map(toOffering),
  }
}

const addAmount = (total, priceCents, unit, guests) => {
  if (priceCents === null || unit === 'cotizacion') return { ...total, pending: true }
  if (unit === 'persona') {
    if (!guests) return { ...total, pending: true }
    return { cents: total.cents + priceCents * guests, pending: total.pending, hasAmount: true }
  }
  return { cents: total.cents + priceCents, pending: total.pending, hasAmount: true }
}

export const buildBanquetSelection = (banquet, servicePriceCents, input) => {
  const guests = readGuests(input.guests)
  if (guests === undefined) return { error: 'El número de invitados no es válido.' }
  const eventTime = readTime(input.eventTime)
  if (eventTime === undefined) return { error: 'El horario debe usar el formato HH:MM.' }
  const eventLocation = optionalText(input.eventLocation, 200)
  if (eventLocation === null) return { error: 'La ubicación admite hasta 200 caracteres.' }
  const notes = input.notes === undefined || input.notes === null || String(input.notes).trim() === '' ? '' : cleanText(input.notes, 500)
  if (notes === null) return { error: 'Las observaciones admiten hasta 500 caracteres.' }
  if (banquet.guestMin !== null && guests !== null && guests < banquet.guestMin) {
    return { error: `Este banquete atiende desde ${banquet.guestMin} invitados.` }
  }
  if (banquet.guestMax !== null && guests !== null && guests > banquet.guestMax) {
    return { error: `Este banquete atiende hasta ${banquet.guestMax} invitados.` }
  }
  const packageId = input.packageId === undefined || input.packageId === null || input.packageId === '' ? null : Number(input.packageId)
  const selectedPackage = packageId === null ? null : banquet.packages.find((item) => item.id === packageId && item.isActive !== false)
  if (packageId !== null && !selectedPackage) return { error: 'El paquete no pertenece a este banquete.' }
  if (selectedPackage?.minGuests && (guests === null || guests < selectedPackage.minGuests)) {
    return { error: `Este paquete pide al menos ${selectedPackage.minGuests} invitados.` }
  }
  if ((selectedPackage?.priceUnit === 'persona' || (!selectedPackage && banquet.priceMode === 'persona')) && guests === null) {
    return { error: 'Indica el número de invitados.' }
  }
  const chosenIds = Array.isArray(input.menuOptionIds) ? input.menuOptionIds.map(Number) : []
  const dishes = selectedPackage?.dishes || []
  const groups = [...new Set(dishes.map((dish) => dish.optionGroup).filter(Boolean))]
  const chosenDishes = []
  for (const group of groups) {
    const options = dishes.filter((dish) => dish.optionGroup === group)
    const picked = options.filter((dish) => chosenIds.includes(dish.id))
    if (picked.length !== 1) return { error: `Elige una opción de ${group}.` }
    chosenDishes.push(picked[0])
  }
  if (chosenIds.some((id) => !chosenDishes.some((dish) => dish.id === id))) {
    return { error: 'Hay una opción de menú que este paquete no ofrece.' }
  }
  const addonIds = Array.isArray(input.addonIds) ? [...new Set(input.addonIds.map(Number))] : []
  const addons = addonIds.map((id) => banquet.offerings.find((item) => item.id === id && item.inclusion === 'opcional'))
  if (addons.some((item) => !item)) return { error: 'Hay un complemento que este proveedor no ofrece.' }
  let total = { cents: 0, pending: false, hasAmount: false }
  if (selectedPackage) total = addAmount(total, selectedPackage.priceCents, selectedPackage.priceUnit, guests)
  else total = addAmount(total, servicePriceCents, banquet.priceMode === 'persona' ? 'persona' : banquet.priceMode === 'fijo' ? 'fijo' : 'cotizacion', guests)
  for (const addon of addons) total = addAmount(total, addon.priceCents, addon.priceUnit, guests)
  const snapshot = {
    package: selectedPackage ? {
      id: selectedPackage.id,
      name: selectedPackage.name,
      priceCents: selectedPackage.priceCents,
      priceUnit: selectedPackage.priceUnit,
      minGuests: selectedPackage.minGuests,
      conditions: selectedPackage.conditions,
    } : null,
    guests,
    menu: [
      ...dishes.filter((dish) => !dish.optionGroup).map((dish) => ({ course: dish.course, name: dish.name, chosen: false })),
      ...chosenDishes.map((dish) => ({ course: dish.course, name: dish.name, group: dish.optionGroup, chosen: true })),
    ],
    addons: addons.map((item) => ({ id: item.id, name: item.name, priceCents: item.priceCents, priceUnit: item.priceUnit })),
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
    `SELECT COALESCE(SUM(estimated_cents), 0) AS total
     FROM planner_items
     WHERE client_id = ? AND event_id = ? AND estimated_cents IS NOT NULL`,
    [clientId, eventId],
  )
  return Number(rows[0]?.total || 0)
}

export const saveBanquet = async ({ clientId, serviceId, kind, body }) => {
  const event = await findOwnedEvent(clientId, body?.eventId)
  if (!event) return { status: 404, message: 'El evento no existe o no te pertenece.' }
  return withTransaction(async (connection) => {
    const [services] = await connection.query(
      'SELECT id, price_cents, is_published FROM services WHERE id = ? LIMIT 1 FOR UPDATE',
      [serviceId],
    )
    if (!services[0]?.is_published) return { status: 404, message: 'No encontramos ese servicio.' }
    const banquet = await loadBanquet(serviceId, { connection })
    const built = buildBanquetSelection(banquet, centsOrNull(services[0].price_cents), body || {})
    if (built.error) return { status: 400, message: built.error }
    const table = kind === 'quote' ? 'quote_requests' : 'planner_items'
    const [existing] = await connection.query(
      `SELECT id FROM ${table} WHERE client_id = ? AND service_id = ? AND event_id = ? LIMIT 1 FOR UPDATE`,
      [clientId, serviceId, event.id],
    )
    if (existing[0]) {
      const budgetCents = kind === 'planner' ? await eventBudget(connection, clientId, event.id) : undefined
      return {
        created: false,
        event,
        budgetCents,
        estimatedCents: built.estimatedCents,
        selection: built.snapshot,
        message: kind === 'quote'
          ? 'Ya enviaste una cotización de este banquete para ese evento.'
          : 'Este banquete ya está en el presupuesto de ese evento.',
      }
    }
    if (kind === 'quote') {
      await connection.query(
        `INSERT INTO quote_requests (client_id, service_id, event_id, notes, status, selection_json)
         VALUES (?, ?, ?, ?, 'recibida', ?)`,
        [clientId, serviceId, event.id, built.notes, JSON.stringify(built.snapshot)],
      )
      return { created: true, event, estimatedCents: built.estimatedCents, selection: built.snapshot }
    }
    await connection.query(
      `INSERT INTO planner_items (client_id, service_id, event_id, estimated_cents, selection_json)
       VALUES (?, ?, ?, ?, ?)`,
      [clientId, serviceId, event.id, built.estimatedCents, JSON.stringify(built.snapshot)],
    )
    const budgetCents = await eventBudget(connection, clientId, event.id)
    return { created: true, event, estimatedCents: built.estimatedCents, budgetCents, selection: built.snapshot }
  })
}

const ownService = async (providerId, serviceId) => {
  const id = Number(serviceId)
  if (!Number.isInteger(id) || id < 1) return null
  const [rows] = await pool.query(
    `SELECT s.id, s.title, s.description, s.price_cents, s.is_published, c.slug, c.title AS category_title
     FROM services s
     JOIN categories c ON c.id = s.category_id
     WHERE s.id = ? AND s.provider_id = ? LIMIT 1`,
    [id, providerId],
  )
  return rows[0] || null
}

const ownPackage = async (providerId, serviceId, packageId) => {
  const [rows] = await pool.query(
    `SELECT p.id FROM banquet_packages p
     JOIN services s ON s.id = p.service_id
     WHERE p.id = ? AND p.service_id = ? AND s.provider_id = ? LIMIT 1`,
    [Number(packageId), Number(serviceId), providerId],
  )
  return rows[0] || null
}

const sendError = (response, status, message) => {
  response.status(status).json({ message })
}

export const registerBanquets = (app, { requireUser, requireRole }) => {
  const providerOnly = [requireUser, requireRole('proveedor')]

  app.get('/api/provider/services', ...providerOnly, async (request, response) => {
    const [rows] = await pool.query(
      `SELECT s.id, s.title, s.is_published, c.slug, c.title AS category_title
       FROM services s
       JOIN categories c ON c.id = s.category_id
       WHERE s.provider_id = ?
       ORDER BY c.sort_order, s.id`,
      [request.account.id],
    )
    response.json({
      services: rows.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        categoryTitle: row.category_title,
        isPublished: Boolean(row.is_published),
      })),
    })
  })

  app.post('/api/provider/banquets', ...providerOnly, async (request, response) => {
    const title = cleanText(request.body?.title, 160)
    const description = optionalText(request.body?.description, 500)
    if (!title || title.length < 2) {
      sendError(response, 400, 'Escribe el nombre del servicio.')
      return
    }
    if (description === null) {
      sendError(response, 400, 'La descripción admite hasta 500 caracteres.')
      return
    }
    const [categories] = await pool.query('SELECT id FROM categories WHERE slug = ? LIMIT 1', ['banquetes'])
    if (!categories[0]) {
      sendError(response, 404, 'La categoría de banquetes no está disponible.')
      return
    }
    const [created] = await pool.query(
      `INSERT INTO services (provider_id, category_id, title, description, price_cents, image_url, is_published)
       VALUES (?, ?, ?, ?, NULL, NULL, 0)`,
      [request.account.id, categories[0].id, title, description || 'Servicio de banquetes.'],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.get('/api/provider/services/:serviceId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) {
      sendError(response, 404, 'No encontramos ese servicio.')
      return
    }
    const [images] = await pool.query(
      'SELECT id, package_id, image_url, alt_text FROM service_images WHERE service_id = ? ORDER BY sort_order, id',
      [service.id],
    )
    response.json({
      service: {
        id: service.id,
        title: service.title,
        description: service.description,
        priceCents: centsOrNull(service.price_cents),
        isPublished: Boolean(service.is_published),
        slug: service.slug,
        categoryTitle: service.category_title,
        images: images.map(toImage),
        banquet: service.slug === 'banquetes' ? await loadBanquet(service.id, { includeInactive: true }) : null,
        decoration: service.slug === 'flores-decoracion' ? await loadDecoration(service.id, { includeInactive: true }) : null,
        music: service.slug === 'musica' ? await loadMusic(service.id, { includeInactive: true }) : null,
        waitstaff: service.slug === 'meseros' ? await loadWaitstaff(service.id, { includeInactive: true }) : null,
        furniture: service.slug === 'mobiliario' ? await loadFurniture(service.id, { includeInactive: true }) : null,
      },
    })
  })

  app.put('/api/provider/services/:serviceId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'banquetes') {
      sendError(response, 404, 'No encontramos ese banquete.')
      return
    }
    const title = cleanText(request.body?.title, 160)
    const description = optionalText(request.body?.description, 500)
    const priceCents = readCents(request.body?.priceCents)
    const serviceType = optionalText(request.body?.serviceType, 80)
    const coverageArea = optionalText(request.body?.coverageArea, 200)
    const priceMode = request.body?.priceMode || null
    const guestMin = readGuests(request.body?.guestMin)
    const guestMax = readGuests(request.body?.guestMax)
    if (!title || description === null || priceCents === undefined || serviceType === null || coverageArea === null) {
      sendError(response, 400, 'Revisa la información del banquete.')
      return
    }
    if ((priceMode !== null && !priceUnits.includes(priceMode)) || guestMin === undefined || guestMax === undefined) {
      sendError(response, 400, 'Revisa el precio o el rango de invitados.')
      return
    }
    if (guestMin !== null && guestMax !== null && guestMin > guestMax) {
      sendError(response, 400, 'El mínimo de invitados no puede ser mayor que el máximo.')
      return
    }
    const published = request.body?.isPublished ? 1 : 0
    await withTransaction(async (connection) => {
      await connection.query(
        'UPDATE services SET title = ?, description = ?, price_cents = ?, is_published = ? WHERE id = ? AND provider_id = ?',
        [title, description, priceCents, published, service.id, request.account.id],
      )
      await connection.query(
        `INSERT INTO banquet_details (service_id, service_type, coverage_area, price_mode, guest_min, guest_max)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE service_type = VALUES(service_type), coverage_area = VALUES(coverage_area),
           price_mode = VALUES(price_mode), guest_min = VALUES(guest_min), guest_max = VALUES(guest_max)`,
        [service.id, serviceType, coverageArea, priceMode, guestMin, guestMax],
      )
    })
    response.json({ ok: true })
  })

  app.post('/api/provider/services/:serviceId/images', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) {
      sendError(response, 404, 'No encontramos ese servicio.')
      return
    }
    const imageUrl = readUrl(request.body?.imageUrl)
    const altText = optionalText(request.body?.altText, 160)
    if (!imageUrl || altText === null) {
      sendError(response, 400, 'La fotografía necesita una dirección http o https válida.')
      return
    }
    let packageId = null
    if (request.body?.packageId) {
      const owned = await ownPackage(request.account.id, service.id, request.body.packageId)
      if (!owned) {
        sendError(response, 404, 'No encontramos ese paquete.')
        return
      }
      packageId = owned.id
    }
    const [created] = await pool.query(
      'INSERT INTO service_images (service_id, package_id, image_url, alt_text) VALUES (?, ?, ?, ?)',
      [service.id, packageId, imageUrl, altText],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/services/:serviceId/images/:imageId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) {
      sendError(response, 404, 'No encontramos ese servicio.')
      return
    }
    const [result] = await pool.query(
      'DELETE FROM service_images WHERE id = ? AND service_id = ?',
      [Number(request.params.imageId), service.id],
    )
    if (!result.affectedRows) {
      sendError(response, 404, 'No encontramos esa fotografía.')
      return
    }
    response.json({ ok: true })
  })

  app.post('/api/provider/services/:serviceId/packages', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'banquetes') {
      sendError(response, 404, 'No encontramos ese banquete.')
      return
    }
    const name = cleanText(request.body?.name, 120)
    const description = optionalText(request.body?.description, 500)
    const conditions = optionalText(request.body?.conditions, 500)
    const priceCents = readCents(request.body?.priceCents)
    const priceUnit = request.body?.priceUnit
    const minGuests = readGuests(request.body?.minGuests)
    if (!name || description === null || conditions === null || priceCents === undefined || minGuests === undefined || !priceUnits.includes(priceUnit)) {
      sendError(response, 400, 'Revisa los datos del paquete.')
      return
    }
    const [created] = await pool.query(
      `INSERT INTO banquet_packages (service_id, name, description, price_cents, price_unit, min_guests, conditions, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [service.id, name, description, priceCents, priceUnit, minGuests, conditions, request.body?.isActive === false ? 0 : 1],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.put('/api/provider/services/:serviceId/packages/:packageId', ...providerOnly, async (request, response) => {
    const owned = await ownPackage(request.account.id, request.params.serviceId, request.params.packageId)
    if (!owned) {
      sendError(response, 404, 'No encontramos ese paquete.')
      return
    }
    const name = cleanText(request.body?.name, 120)
    const description = optionalText(request.body?.description, 500)
    const conditions = optionalText(request.body?.conditions, 500)
    const priceCents = readCents(request.body?.priceCents)
    const priceUnit = request.body?.priceUnit
    const minGuests = readGuests(request.body?.minGuests)
    if (!name || description === null || conditions === null || priceCents === undefined || minGuests === undefined || !priceUnits.includes(priceUnit)) {
      sendError(response, 400, 'Revisa los datos del paquete.')
      return
    }
    await pool.query(
      `UPDATE banquet_packages
       SET name = ?, description = ?, price_cents = ?, price_unit = ?, min_guests = ?, conditions = ?, is_active = ?
       WHERE id = ?`,
      [name, description, priceCents, priceUnit, minGuests, conditions, request.body?.isActive === false ? 0 : 1, owned.id],
    )
    response.json({ ok: true })
  })

  app.delete('/api/provider/services/:serviceId/packages/:packageId', ...providerOnly, async (request, response) => {
    const owned = await ownPackage(request.account.id, request.params.serviceId, request.params.packageId)
    if (!owned) {
      sendError(response, 404, 'No encontramos ese paquete.')
      return
    }
    await pool.query('DELETE FROM banquet_packages WHERE id = ?', [owned.id])
    response.json({ ok: true })
  })

  app.post('/api/provider/services/:serviceId/packages/:packageId/menu', ...providerOnly, async (request, response) => {
    const owned = await ownPackage(request.account.id, request.params.serviceId, request.params.packageId)
    if (!owned) {
      sendError(response, 404, 'No encontramos ese paquete.')
      return
    }
    const name = cleanText(request.body?.name, 160)
    const course = request.body?.course
    const optionGroup = optionalText(request.body?.optionGroup, 80)
    if (!name || !courses.includes(course) || optionGroup === null) {
      sendError(response, 400, 'Revisa el platillo del menú.')
      return
    }
    const [created] = await pool.query(
      'INSERT INTO banquet_menu_items (package_id, course, name, option_group) VALUES (?, ?, ?, ?)',
      [owned.id, course, name, optionGroup],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/services/:serviceId/packages/:packageId/menu/:itemId', ...providerOnly, async (request, response) => {
    const owned = await ownPackage(request.account.id, request.params.serviceId, request.params.packageId)
    if (!owned) {
      sendError(response, 404, 'No encontramos ese paquete.')
      return
    }
    const [result] = await pool.query(
      'DELETE FROM banquet_menu_items WHERE id = ? AND package_id = ?',
      [Number(request.params.itemId), owned.id],
    )
    if (!result.affectedRows) {
      sendError(response, 404, 'No encontramos ese platillo.')
      return
    }
    response.json({ ok: true })
  })

  app.post('/api/provider/services/:serviceId/offerings', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'banquetes') {
      sendError(response, 404, 'No encontramos ese banquete.')
      return
    }
    const name = cleanText(request.body?.name, 120)
    const inclusion = request.body?.inclusion
    const priceCents = readCents(request.body?.priceCents)
    const priceUnit = request.body?.priceUnit || 'cotizacion'
    if (!name || !inclusions.includes(inclusion) || priceCents === undefined || !priceUnits.includes(priceUnit)) {
      sendError(response, 400, 'Revisa la característica del servicio.')
      return
    }
    const [created] = await pool.query(
      'INSERT INTO banquet_offerings (service_id, name, inclusion, price_cents, price_unit) VALUES (?, ?, ?, ?, ?)',
      [service.id, name, inclusion, inclusion === 'opcional' ? priceCents : null, inclusion === 'opcional' ? priceUnit : 'cotizacion'],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/services/:serviceId/offerings/:offeringId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) {
      sendError(response, 404, 'No encontramos ese servicio.')
      return
    }
    const [result] = await pool.query(
      'DELETE FROM banquet_offerings WHERE id = ? AND service_id = ?',
      [Number(request.params.offeringId), service.id],
    )
    if (!result.affectedRows) {
      sendError(response, 404, 'No encontramos esa característica.')
      return
    }
    response.json({ ok: true })
  })
}
