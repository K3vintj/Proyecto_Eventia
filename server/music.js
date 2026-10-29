import { pool } from './db.js'
import { findOwnedEvent } from './planning.js'

const priceUnits = ['fijo', 'desde', 'cotizacion']
const addonUnits = ['unidad', 'fijo', 'cotizacion']

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
  if (!Number.isInteger(qty) || qty < 1 || qty > 100) return undefined
  return qty
}

const readGuests = (value) => {
  if (value === undefined || value === null || value === '') return null
  const guests = Number(value)
  if (!Number.isInteger(guests) || guests < 1 || guests > 20000) return undefined
  return guests
}

const readMinutes = (value) => {
  if (value === undefined || value === null || value === '') return null
  const minutes = Number(value)
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 720) return undefined
  return minutes
}

const readMembers = (value) => {
  if (value === undefined || value === null || value === '') return null
  const count = Number(value)
  if (!Number.isInteger(count) || count < 1 || count > 100) return undefined
  return count
}

const readSeconds = (value) => {
  if (value === undefined || value === null || value === '') return null
  const seconds = Number(value)
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 36000) return undefined
  return seconds
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

const readDurationOptions = (value) => {
  const text = optionalText(value, 80)
  if (text === null) return undefined
  if (!text) return ''
  const parts = text.split(',').map((item) => item.trim()).filter(Boolean)
  if (parts.length > 8) return undefined
  const minutes = []
  for (const part of parts) {
    const valueMinutes = Number(part)
    if (!Number.isInteger(valueMinutes) || valueMinutes < 15 || valueMinutes > 720) return undefined
    minutes.push(String(valueMinutes))
  }
  return minutes.join(',')
}

const centsOrNull = (value) => (value === null || value === undefined ? null : Number(value))

const packageDurations = (item) => {
  if (item.durationOptions) {
    return item.durationOptions.split(',').map(Number).filter((minutes) => Number.isInteger(minutes) && minutes >= 15)
  }
  return item.durationMinutes ? [item.durationMinutes] : []
}

const toImage = (row) => ({
  id: row.id,
  url: row.image_url,
  alt: row.alt_text || '',
  tag: row.gallery_tag || '',
})

export const loadMusic = async (serviceId, { includeInactive = false, connection = pool } = {}) => {
  const [details] = await connection.query('SELECT * FROM music_details WHERE service_id = ? LIMIT 1', [serviceId])
  const detail = details[0]
  const active = includeInactive ? '' : 'AND is_active = 1'
  const [genres] = await connection.query('SELECT * FROM music_genres WHERE service_id = ? ORDER BY sort_order, id', [serviceId])
  const [tracks] = await connection.query(`SELECT * FROM music_tracks WHERE service_id = ? ${active} ORDER BY sort_order, id`, [serviceId])
  const [videos] = await connection.query(`SELECT * FROM music_videos WHERE service_id = ? ${active} ORDER BY sort_order, id`, [serviceId])
  const [repertoire] = await connection.query(`SELECT * FROM music_repertoire WHERE service_id = ? ${active} ORDER BY sort_order, id`, [serviceId])
  const [packages] = await connection.query(`SELECT * FROM music_packages WHERE service_id = ? ${active} ORDER BY sort_order, id`, [serviceId])
  const [addons] = await connection.query(`SELECT * FROM music_addons WHERE service_id = ? ${active} ORDER BY sort_order, id`, [serviceId])
  const [images] = await connection.query(
    'SELECT id, image_url, alt_text, gallery_tag FROM service_images WHERE service_id = ? AND package_id IS NULL AND decoration_package_id IS NULL ORDER BY sort_order, id',
    [serviceId],
  )
  return {
    artistName: detail?.artist_name || '',
    serviceType: detail?.service_type || '',
    coverageArea: detail?.coverage_area || '',
    presentation: detail?.presentation || '',
    priceMode: detail?.price_mode || '',
    technical: {
      minSpace: detail?.min_space || '',
      electricalRequirements: detail?.electrical_requirements || '',
      needsStage: detail?.needs_stage || '',
      soundIncluded: detail?.sound_included || '',
      lightingIncluded: detail?.lighting_included || '',
      setupTime: detail?.setup_time || '',
      teardownTime: detail?.teardown_time || '',
      accessRequirements: detail?.access_requirements || '',
      restrictions: detail?.restrictions || '',
      travelNotes: detail?.travel_notes || '',
    },
    genres: genres.map((item) => ({ id: item.id, name: item.name, description: item.description || '' })),
    tracks: tracks.map((item) => ({
      id: item.id,
      title: item.title,
      audioUrl: item.audio_url,
      durationSeconds: item.duration_seconds == null ? null : Number(item.duration_seconds),
      isActive: Boolean(item.is_active),
    })),
    videos: videos.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description || '',
      videoUrl: item.video_url,
      thumbnailUrl: item.thumbnail_url || '',
      isActive: Boolean(item.is_active),
    })),
    repertoire: repertoire.map((item) => ({
      id: item.id,
      title: item.title,
      genre: item.genre || '',
      notes: item.notes || '',
      isActive: Boolean(item.is_active),
    })),
    packages: packages.map((item) => {
      const durationMinutes = item.duration_minutes == null ? null : Number(item.duration_minutes)
      const durationOptions = item.duration_options || ''
      const mapped = {
        id: item.id,
        name: item.name,
        description: item.description || '',
        durationMinutes,
        durationOptions,
        durations: packageDurations({ durationMinutes, durationOptions }),
        memberCount: item.member_count == null ? null : Number(item.member_count),
        presentationType: item.presentation_type || '',
        equipmentIncluded: item.equipment_included || '',
        priceCents: centsOrNull(item.price_cents),
        priceUnit: item.price_unit,
        conditions: item.conditions || '',
        extras: item.extras || '',
        isActive: Boolean(item.is_active),
      }
      return mapped
    }),
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

const addAmount = (total, priceCents, unit, quantity = 1) => {
  if (priceCents === null || unit === 'cotizacion' || unit === 'desde' || unit === '') {
    return {
      ...total,
      pending: true,
      hasAmount: total.hasAmount || (unit === 'desde' && priceCents !== null),
      cents: unit === 'desde' && priceCents !== null ? total.cents + priceCents : total.cents,
    }
  }
  if (unit === 'unidad') return { cents: total.cents + priceCents * quantity, pending: total.pending, hasAmount: true }
  return { cents: total.cents + priceCents, pending: total.pending, hasAmount: true }
}

export const buildMusicSelection = (music, servicePriceCents, input) => {
  const guests = readGuests(input.guests)
  if (guests === undefined) return { error: 'El número de invitados no es válido.' }
  const eventTime = readTime(input.eventTime)
  if (eventTime === undefined) return { error: 'El horario debe usar el formato HH:MM.' }
  const eventLocation = optionalText(input.eventLocation, 200)
  const preferredGenres = optionalText(input.preferredGenres, 200)
  const songRequests = optionalText(input.songRequests, 500)
  const moments = optionalText(input.moments, 500)
  const notes = input.notes === undefined || input.notes === null || String(input.notes).trim() === '' ? '' : cleanText(input.notes, 500)
  if (eventLocation === null || preferredGenres === null || songRequests === null || moments === null || notes === null) {
    return { error: 'Revisa la ubicación, las preferencias musicales o las observaciones.' }
  }
  const packageId = input.packageId ? Number(input.packageId) : null
  const selectedPackage = packageId ? music.packages.find((item) => item.id === packageId && item.isActive !== false) : null
  if (packageId && !selectedPackage) return { error: 'El paquete no pertenece a este servicio musical.' }
  const availableDurations = selectedPackage ? selectedPackage.durations : []
  let durationMinutes = readMinutes(input.durationMinutes)
  if (durationMinutes === undefined) return { error: 'La duración no es válida.' }
  if (availableDurations.length > 0) {
    if (durationMinutes === null) durationMinutes = availableDurations[0]
    if (!availableDurations.includes(durationMinutes)) return { error: 'Esa duración no está disponible en el paquete elegido.' }
  } else if (durationMinutes !== null && selectedPackage) {
    return { error: 'Este paquete no publica duraciones seleccionables.' }
  }
  const requested = Array.isArray(input.addons) ? input.addons : []
  const chosen = []
  for (const entry of requested) {
    const addon = music.addons.find((item) => item.id === Number(entry.id) && item.isActive !== false)
    if (!addon) return { error: 'Hay un complemento que este proveedor no ofrece.' }
    const quantity = readQty(entry.quantity ?? 1)
    if (quantity === undefined) return { error: `La cantidad de ${addon.name} no es válida.` }
    chosen.push({ addon, quantity })
  }
  let total = { cents: 0, pending: false, hasAmount: false }
  if (selectedPackage) total = addAmount(total, selectedPackage.priceCents, selectedPackage.priceUnit)
  else if (servicePriceCents !== null || music.priceMode) {
    total = addAmount(total, servicePriceCents, music.priceMode === 'fijo' ? 'fijo' : music.priceMode === 'desde' ? 'desde' : 'cotizacion')
  } else total = { ...total, pending: true }
  for (const item of chosen) total = addAmount(total, item.addon.priceCents, item.addon.priceUnit, item.quantity)
  const snapshot = {
    package: selectedPackage ? {
      id: selectedPackage.id,
      name: selectedPackage.name,
      priceCents: selectedPackage.priceCents,
      priceUnit: selectedPackage.priceUnit,
      presentationType: selectedPackage.presentationType,
      equipmentIncluded: selectedPackage.equipmentIncluded,
      conditions: selectedPackage.conditions,
    } : null,
    durationMinutes,
    preferredGenres,
    songRequests,
    moments,
    addons: chosen.map((item) => ({
      id: item.addon.id,
      name: item.addon.name,
      quantity: item.quantity,
      priceCents: item.addon.priceCents,
      priceUnit: item.addon.priceUnit,
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

export const saveMusic = async ({ clientId, serviceId, kind, body }) => {
  const event = await findOwnedEvent(clientId, body?.eventId)
  if (!event) return { status: 404, message: 'El evento no existe o no te pertenece.' }
  return withTransaction(async (connection) => {
    const [services] = await connection.query('SELECT id, price_cents, is_published FROM services WHERE id = ? LIMIT 1 FOR UPDATE', [serviceId])
    if (!services[0]?.is_published) return { status: 404, message: 'No encontramos ese servicio.' }
    const music = await loadMusic(serviceId, { connection })
    const built = buildMusicSelection(music, centsOrNull(services[0].price_cents), body || {})
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
          ? 'Ya enviaste una cotización de este servicio musical para ese evento.'
          : 'Este servicio musical ya está en el presupuesto de ese evento.',
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

export const registerMusic = (app, { requireUser, requireRole }) => {
  const providerOnly = [requireUser, requireRole('proveedor')]

  app.post('/api/provider/music', ...providerOnly, async (request, response) => {
    const title = cleanText(request.body?.title, 160)
    const description = optionalText(request.body?.description, 500)
    if (!title || title.length < 2 || description === null) {
      sendError(response, 400, 'Escribe el nombre del servicio.')
      return
    }
    const [categories] = await pool.query(`SELECT id FROM categories WHERE slug = 'musica' LIMIT 1`)
    if (!categories[0]) {
      sendError(response, 404, 'La categoría de música no está disponible.')
      return
    }
    const [created] = await pool.query(
      'INSERT INTO services (provider_id, category_id, title, description, price_cents, image_url, is_published) VALUES (?, ?, ?, ?, NULL, NULL, 0)',
      [request.account.id, categories[0].id, title, description || 'Servicio de música y entretenimiento.'],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.put('/api/provider/music/:serviceId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'musica') return sendError(response, 404, 'No encontramos ese servicio musical.')
    const title = cleanText(request.body?.title, 160)
    const description = optionalText(request.body?.description, 500)
    const artistName = optionalText(request.body?.artistName, 160)
    const serviceType = optionalText(request.body?.serviceType, 80)
    const coverageArea = optionalText(request.body?.coverageArea, 200)
    const presentation = optionalText(request.body?.presentation, 800)
    const priceCents = readCents(request.body?.priceCents)
    const priceMode = request.body?.priceMode || null
    const technical = {
      minSpace: optionalText(request.body?.minSpace, 200),
      electricalRequirements: optionalText(request.body?.electricalRequirements, 300),
      needsStage: optionalText(request.body?.needsStage, 120),
      soundIncluded: optionalText(request.body?.soundIncluded, 300),
      lightingIncluded: optionalText(request.body?.lightingIncluded, 300),
      setupTime: optionalText(request.body?.setupTime, 120),
      teardownTime: optionalText(request.body?.teardownTime, 120),
      accessRequirements: optionalText(request.body?.accessRequirements, 300),
      restrictions: optionalText(request.body?.restrictions, 500),
      travelNotes: optionalText(request.body?.travelNotes, 300),
    }
    if (!title || description === null || artistName === null || serviceType === null || coverageArea === null || presentation === null || priceCents === undefined || (priceMode && !priceUnits.includes(priceMode)) || Object.values(technical).some((item) => item === null)) {
      return sendError(response, 400, 'Revisa la información del servicio musical.')
    }
    await withTransaction(async (connection) => {
      await connection.query(
        'UPDATE services SET title = ?, description = ?, price_cents = ?, is_published = ? WHERE id = ? AND provider_id = ?',
        [title, description, priceCents, request.body?.isPublished ? 1 : 0, service.id, request.account.id],
      )
      await connection.query(
        `INSERT INTO music_details (
          service_id, artist_name, service_type, coverage_area, presentation, price_mode,
          min_space, electrical_requirements, needs_stage, sound_included, lighting_included,
          setup_time, teardown_time, access_requirements, restrictions, travel_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          artist_name = VALUES(artist_name), service_type = VALUES(service_type), coverage_area = VALUES(coverage_area),
          presentation = VALUES(presentation), price_mode = VALUES(price_mode), min_space = VALUES(min_space),
          electrical_requirements = VALUES(electrical_requirements), needs_stage = VALUES(needs_stage),
          sound_included = VALUES(sound_included), lighting_included = VALUES(lighting_included),
          setup_time = VALUES(setup_time), teardown_time = VALUES(teardown_time),
          access_requirements = VALUES(access_requirements), restrictions = VALUES(restrictions),
          travel_notes = VALUES(travel_notes)`,
        [
          service.id, artistName, serviceType, coverageArea, presentation, priceMode,
          technical.minSpace, technical.electricalRequirements, technical.needsStage, technical.soundIncluded,
          technical.lightingIncluded, technical.setupTime, technical.teardownTime, technical.accessRequirements,
          technical.restrictions, technical.travelNotes,
        ],
      )
    })
    response.json({ ok: true })
  })

  app.post('/api/provider/music/:serviceId/genres', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'musica') return sendError(response, 404, 'No encontramos ese servicio musical.')
    const name = cleanText(request.body?.name, 80)
    const description = optionalText(request.body?.description, 300)
    if (!name || description === null) return sendError(response, 400, 'Revisa el género.')
    const [created] = await pool.query('INSERT INTO music_genres (service_id, name, description) VALUES (?, ?, ?)', [service.id, name, description])
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/music/:serviceId/genres/:genreId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos ese servicio musical.')
    const [result] = await pool.query('DELETE FROM music_genres WHERE id = ? AND service_id = ?', [Number(request.params.genreId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos ese género.')
    response.json({ ok: true })
  })

  app.post('/api/provider/music/:serviceId/tracks', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'musica') return sendError(response, 404, 'No encontramos ese servicio musical.')
    const title = cleanText(request.body?.title, 160)
    const audioUrl = readUrl(request.body?.audioUrl)
    const durationSeconds = readSeconds(request.body?.durationSeconds)
    if (!title || !audioUrl || durationSeconds === undefined) return sendError(response, 400, 'La demostración necesita título y una dirección http o https válida.')
    const [created] = await pool.query(
      'INSERT INTO music_tracks (service_id, title, audio_url, duration_seconds) VALUES (?, ?, ?, ?)',
      [service.id, title, audioUrl, durationSeconds],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/music/:serviceId/tracks/:trackId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos ese servicio musical.')
    const [result] = await pool.query('DELETE FROM music_tracks WHERE id = ? AND service_id = ?', [Number(request.params.trackId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos esa demostración.')
    response.json({ ok: true })
  })

  app.post('/api/provider/music/:serviceId/videos', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'musica') return sendError(response, 404, 'No encontramos ese servicio musical.')
    const title = cleanText(request.body?.title, 160)
    const description = optionalText(request.body?.description, 500)
    const videoUrl = readUrl(request.body?.videoUrl)
    const thumbnailUrl = optionalUrl(request.body?.thumbnailUrl)
    if (!title || description === null || !videoUrl || thumbnailUrl === undefined) return sendError(response, 400, 'Revisa el video de presentación.')
    const [created] = await pool.query(
      'INSERT INTO music_videos (service_id, title, description, video_url, thumbnail_url) VALUES (?, ?, ?, ?, ?)',
      [service.id, title, description, videoUrl, thumbnailUrl],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/music/:serviceId/videos/:videoId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos ese servicio musical.')
    const [result] = await pool.query('DELETE FROM music_videos WHERE id = ? AND service_id = ?', [Number(request.params.videoId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos ese video.')
    response.json({ ok: true })
  })

  app.post('/api/provider/music/:serviceId/repertoire', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'musica') return sendError(response, 404, 'No encontramos ese servicio musical.')
    const title = cleanText(request.body?.title, 160)
    const genre = optionalText(request.body?.genre, 80)
    const notes = optionalText(request.body?.notes, 300)
    if (!title || genre === null || notes === null) return sendError(response, 400, 'Revisa la pieza del repertorio.')
    const [created] = await pool.query(
      'INSERT INTO music_repertoire (service_id, title, genre, notes) VALUES (?, ?, ?, ?)',
      [service.id, title, genre, notes],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/music/:serviceId/repertoire/:itemId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos ese servicio musical.')
    const [result] = await pool.query('DELETE FROM music_repertoire WHERE id = ? AND service_id = ?', [Number(request.params.itemId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos esa pieza.')
    response.json({ ok: true })
  })

  app.post('/api/provider/music/:serviceId/packages', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'musica') return sendError(response, 404, 'No encontramos ese servicio musical.')
    const name = cleanText(request.body?.name, 120)
    const description = optionalText(request.body?.description, 500)
    const durationMinutes = readMinutes(request.body?.durationMinutes)
    const durationOptions = readDurationOptions(request.body?.durationOptions)
    const memberCount = readMembers(request.body?.memberCount)
    const presentationType = optionalText(request.body?.presentationType, 120)
    const equipmentIncluded = optionalText(request.body?.equipmentIncluded, 500)
    const conditions = optionalText(request.body?.conditions, 500)
    const extras = optionalText(request.body?.extras, 500)
    const priceCents = readCents(request.body?.priceCents)
    const priceUnit = request.body?.priceUnit || 'cotizacion'
    if (!name || description === null || durationMinutes === undefined || durationOptions === undefined || memberCount === undefined || presentationType === null || equipmentIncluded === null || conditions === null || extras === null || priceCents === undefined || !priceUnits.includes(priceUnit)) {
      return sendError(response, 400, 'Revisa el paquete musical.')
    }
    const [created] = await pool.query(
      `INSERT INTO music_packages (
        service_id, name, description, duration_minutes, duration_options, member_count,
        presentation_type, equipment_included, price_cents, price_unit, conditions, extras
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [service.id, name, description, durationMinutes, durationOptions, memberCount, presentationType, equipmentIncluded, priceCents, priceUnit, conditions, extras],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/music/:serviceId/packages/:packageId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos ese servicio musical.')
    const [result] = await pool.query('DELETE FROM music_packages WHERE id = ? AND service_id = ?', [Number(request.params.packageId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos ese paquete.')
    response.json({ ok: true })
  })

  app.post('/api/provider/music/:serviceId/addons', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'musica') return sendError(response, 404, 'No encontramos ese servicio musical.')
    const name = cleanText(request.body?.name, 120)
    const description = optionalText(request.body?.description, 500)
    const priceCents = readCents(request.body?.priceCents)
    const priceUnit = request.body?.priceUnit || 'cotizacion'
    if (!name || description === null || priceCents === undefined || !addonUnits.includes(priceUnit)) {
      return sendError(response, 400, 'Revisa el complemento.')
    }
    const [created] = await pool.query(
      'INSERT INTO music_addons (service_id, name, description, price_cents, price_unit) VALUES (?, ?, ?, ?, ?)',
      [service.id, name, description, priceCents, priceUnit],
    )
    response.status(201).json({ id: created.insertId })
  })

  app.delete('/api/provider/music/:serviceId/addons/:addonId', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service) return sendError(response, 404, 'No encontramos ese servicio musical.')
    const [result] = await pool.query('DELETE FROM music_addons WHERE id = ? AND service_id = ?', [Number(request.params.addonId), service.id])
    if (!result.affectedRows) return sendError(response, 404, 'No encontramos ese complemento.')
    response.json({ ok: true })
  })

  app.post('/api/provider/music/:serviceId/images', ...providerOnly, async (request, response) => {
    const service = await ownService(request.account.id, request.params.serviceId)
    if (!service || service.slug !== 'musica') return sendError(response, 404, 'No encontramos ese servicio musical.')
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
