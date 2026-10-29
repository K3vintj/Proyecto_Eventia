import { pool } from './db.js'
import { loadBanquet, saveBanquet } from './banquets.js'
import { loadDecoration, saveDecoration } from './decoration.js'
import { loadMusic, saveMusic } from './music.js'
import { loadWaitstaff, saveWaitstaff } from './waitstaff.js'
import { loadFurniture, saveFurniture } from './furniture.js'
import { addServiceToEvent, requestServiceQuote } from './planning.js'

const slugPattern = /^[a-z0-9-]{1,40}$/

const cleanFeature = (value) => {
  const text = String(value ?? '').trim()
  if (!text || text.length > 80 || /[\u0000-\u001f]/.test(text)) return null
  return text
}

const readPrice = (value) => {
  if (value === undefined || value === '') return null
  const price = Number(value)
  if (!Number.isInteger(price) || price < 0 || price > 10000000) return undefined
  return price
}

const readFeatures = (value) => {
  const list = Array.isArray(value) ? value : value ? [value] : []
  return list.map(cleanFeature)
}

const findCategory = async (slug) => {
  if (!slugPattern.test(slug)) return null
  const [rows] = await pool.query(
    'SELECT id, slug, title, description, image_url FROM categories WHERE slug = ? LIMIT 1',
    [slug],
  )
  return rows[0] || null
}

const toCategory = (row) => ({
  slug: row.slug,
  title: row.title,
  description: row.description,
  imageUrl: row.image_url,
})

const loadFeatures = async (serviceIds) => {
  const grouped = new Map()
  if (serviceIds.length === 0) return grouped
  const [rows] = await pool.query(
    `SELECT service_id, feature FROM service_features WHERE service_id IN (${serviceIds.map(() => '?').join(',')}) ORDER BY feature`,
    serviceIds,
  )
  for (const row of rows) {
    const current = grouped.get(row.service_id) || []
    current.push(row.feature)
    grouped.set(row.service_id, current)
  }
  return grouped
}

const toService = (row, features) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  priceCents: row.price_cents === null ? null : Number(row.price_cents),
  imageUrl: row.image_url || null,
  features: features.get(row.id) || [],
  provider: {
    businessName: row.business_name || row.full_name,
    city: row.city || '',
    description: row.provider_description || '',
  },
})

const selectServices = async (categoryId, minPrice, maxPrice, features) => {
  const filters = ['s.category_id = ?', 's.is_published = 1', "u.role = 'proveedor'"]
  const params = [categoryId]
  if (minPrice !== null) {
    filters.push('s.price_cents IS NOT NULL AND s.price_cents >= ?')
    params.push(minPrice * 100)
  }
  if (maxPrice !== null) {
    filters.push('s.price_cents IS NOT NULL AND s.price_cents <= ?')
    params.push(maxPrice * 100)
  }
  if (features.length > 0) {
    filters.push(`s.id IN (SELECT service_id FROM service_features WHERE feature IN (${features.map(() => '?').join(',')}))`)
    params.push(...features)
  }
  const [rows] = await pool.query(
    `SELECT s.id, s.title, s.description, s.price_cents, s.image_url,
      u.full_name, p.business_name, p.city, p.description AS provider_description
     FROM services s
     JOIN users u ON u.id = s.provider_id
     LEFT JOIN provider_profiles p ON p.user_id = u.id
     WHERE ${filters.join(' AND ')}
     ORDER BY s.id DESC`,
    params,
  )
  const featureMap = await loadFeatures(rows.map((row) => row.id))
  return rows.map((row) => toService(row, featureMap))
}

const categoryFeatures = async (categoryId) => {
  const [rows] = await pool.query(
    `SELECT DISTINCT f.feature
     FROM service_features f
     JOIN services s ON s.id = f.service_id
     WHERE s.category_id = ? AND s.is_published = 1
     ORDER BY f.feature`,
    [categoryId],
  )
  return rows.map((row) => row.feature)
}

const readFilters = (query, response) => {
  const minPrice = readPrice(query.minPrice)
  const maxPrice = readPrice(query.maxPrice)
  const features = readFeatures(query.feature)
  if (minPrice === undefined || maxPrice === undefined || features.some((feature) => !feature)) {
    response.status(400).json({ message: 'Los filtros no son válidos.' })
    return null
  }
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    response.status(400).json({ message: 'El precio mínimo no puede ser mayor que el máximo.' })
    return null
  }
  return { minPrice, maxPrice, features }
}

const findPublishedService = async (slug, serviceId) => {
  const category = await findCategory(slug)
  if (!category) return null
  const [rows] = await pool.query(
    `SELECT s.id FROM services s
     JOIN users u ON u.id = s.provider_id AND u.role = 'proveedor'
     WHERE s.id = ? AND s.category_id = ? AND s.is_published = 1
     LIMIT 1`,
    [serviceId, category.id],
  )
  return rows[0] ? category : null
}

const clientServiceTables = {
  quote_requests: 'INSERT INTO quote_requests (client_id, service_id) VALUES (?, ?)',
  planner_items: 'INSERT INTO planner_items (client_id, service_id) VALUES (?, ?)',
}

const saveClientService = async (table, clientId, serviceId) => {
  const statement = clientServiceTables[table]
  if (!statement) throw new Error('Tabla de catálogo no permitida.')
  const [existing] = await pool.query(
    `SELECT id FROM ${table} WHERE client_id = ? AND service_id = ? AND event_id IS NULL LIMIT 1`,
    [clientId, serviceId],
  )
  if (existing[0]) return false
  try {
    await pool.query(statement, [clientId, serviceId])
    return true
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return false
    throw error
  }
}

const readPage = (value, fallback) => {
  const page = Number(value)
  if (!Number.isInteger(page) || page < 1 || page > 500) return fallback
  return page
}

const readLimit = (value, fallback) => {
  const limit = Number(value)
  if (!Number.isInteger(limit) || limit < 1 || limit > 48) return fallback
  return limit
}

const marketplaceSort = (sort) => {
  if (sort === 'price_asc') return 's.price_cents IS NULL ASC, s.price_cents ASC, s.id DESC'
  if (sort === 'price_desc') return 's.price_cents IS NULL ASC, s.price_cents DESC, s.id DESC'
  if (sort === 'featured' || sort === 'recommended') return 'c.sort_order ASC, s.id DESC'
  if (sort === 'popular') return 's.id DESC'
  return 's.created_at DESC, s.id DESC'
}

const toMarketplaceService = (row, features) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  priceCents: row.price_cents === null ? null : Number(row.price_cents),
  imageUrl: row.image_url || row.category_image || null,
  features: features.get(row.id) || [],
  category: {
    slug: row.category_slug,
    title: row.category_title,
  },
  provider: {
    businessName: row.business_name || row.full_name,
    city: row.city || '',
    description: row.provider_description || '',
  },
})

export const registerCatalog = (app, { requireUser, requireRole }) => {
  app.get('/api/categories', async (_request, response) => {
    const [rows] = await pool.query(
      `SELECT slug, title, description, image_url,
        (SELECT COUNT(*) FROM services s WHERE s.category_id = categories.id AND s.is_published = 1) AS service_count
       FROM categories
       ORDER BY sort_order, id`,
    )
    response.json({
      categories: rows.map((row) => ({ ...toCategory(row), serviceCount: Number(row.service_count) })),
    })
  })

  app.get('/api/marketplace/feed', async (request, response) => {
    const page = readPage(request.query.page, 1)
    const limit = readLimit(request.query.limit, 12)
    const offset = (page - 1) * limit
    const q = String(request.query.q || '').trim().slice(0, 80)
    const city = String(request.query.city || '').trim().slice(0, 80)
    const categorySlug = String(request.query.category || '').trim()
    const pricing = String(request.query.pricing || 'all')
    const sort = String(request.query.sort || 'recent')
    const minPrice = readPrice(request.query.minPrice)
    const maxPrice = readPrice(request.query.maxPrice)
    if (minPrice === undefined || maxPrice === undefined) {
      response.status(400).json({ message: 'Los filtros de precio no son válidos.' })
      return
    }
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      response.status(400).json({ message: 'El precio mínimo no puede ser mayor que el máximo.' })
      return
    }
    if (categorySlug && !slugPattern.test(categorySlug)) {
      response.status(400).json({ message: 'La categoría no es válida.' })
      return
    }
    if (!['all', 'fixed', 'quote'].includes(pricing)) {
      response.status(400).json({ message: 'El filtro de precio no es válido.' })
      return
    }
    if (!['recent', 'price_asc', 'price_desc', 'popular', 'featured', 'recommended'].includes(sort)) {
      response.status(400).json({ message: 'El ordenamiento no es válido.' })
      return
    }

    const filters = ['s.is_published = 1', "u.role = 'proveedor'"]
    const params = []
    if (categorySlug) {
      filters.push('c.slug = ?')
      params.push(categorySlug)
    }
    if (q) {
      filters.push('(s.title LIKE ? OR s.description LIKE ? OR COALESCE(p.business_name, u.full_name) LIKE ? OR c.title LIKE ?)')
      const like = `%${q.replace(/[%_]/g, '')}%`
      params.push(like, like, like, like)
    }
    if (city) {
      filters.push('p.city LIKE ?')
      params.push(`%${city.replace(/[%_]/g, '')}%`)
    }
    if (minPrice !== null) {
      filters.push('s.price_cents IS NOT NULL AND s.price_cents >= ?')
      params.push(minPrice * 100)
    }
    if (maxPrice !== null) {
      filters.push('s.price_cents IS NOT NULL AND s.price_cents <= ?')
      params.push(maxPrice * 100)
    }
    if (pricing === 'fixed') filters.push('s.price_cents IS NOT NULL')
    if (pricing === 'quote') filters.push('s.price_cents IS NULL')

    const where = filters.join(' AND ')
    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM services s
       JOIN categories c ON c.id = s.category_id
       JOIN users u ON u.id = s.provider_id
       LEFT JOIN provider_profiles p ON p.user_id = u.id
       WHERE ${where}`,
      params,
    )
    const total = Number(countRow.total) || 0
    const [rows] = await pool.query(
      `SELECT s.id, s.title, s.description, s.price_cents, s.image_url,
        c.slug AS category_slug, c.title AS category_title, c.image_url AS category_image,
        u.full_name, p.business_name, p.city, p.description AS provider_description
       FROM services s
       JOIN categories c ON c.id = s.category_id
       JOIN users u ON u.id = s.provider_id
       LEFT JOIN provider_profiles p ON p.user_id = u.id
       WHERE ${where}
       ORDER BY ${marketplaceSort(sort)}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )
    const featureMap = await loadFeatures(rows.map((row) => row.id))
    const [categoryRows] = await pool.query(
      `SELECT slug, title, description, image_url,
        (SELECT COUNT(*) FROM services s WHERE s.category_id = categories.id AND s.is_published = 1) AS service_count
       FROM categories
       ORDER BY sort_order, id`,
    )
    response.json({
      services: rows.map((row) => toMarketplaceService(row, featureMap)),
      total,
      page,
      pageSize: limit,
      hasMore: offset + rows.length < total,
      categories: categoryRows.map((row) => ({ ...toCategory(row), serviceCount: Number(row.service_count) })),
    })
  })

  app.get('/api/categories/:slug', async (request, response) => {
    const category = await findCategory(request.params.slug)
    if (!category) {
      response.status(404).json({ message: 'No encontramos esa categoría.' })
      return
    }
    const filters = readFilters(request.query, response)
    if (!filters) return
    const [services, features] = await Promise.all([
      selectServices(category.id, filters.minPrice, filters.maxPrice, filters.features),
      categoryFeatures(category.id),
    ])
    response.json({ category: toCategory(category), services, features })
  })

  const viewerOf = async (request) => {
    if (!request.session?.userId) return null
    const [rows] = await pool.query('SELECT id, role FROM users WHERE id = ? LIMIT 1', [request.session.userId])
    return rows[0] || null
  }

  const loadServiceDetail = async (category, serviceId) => {
    const [rows] = await pool.query(
      `SELECT s.id, s.title, s.description, s.price_cents, s.image_url, s.is_published, s.provider_id,
        u.full_name, p.business_name, p.city, p.description AS provider_description,
        v.space_type, v.address, v.capacity_min, v.capacity_max, v.price_mode
       FROM services s
       JOIN users u ON u.id = s.provider_id AND u.role = 'proveedor'
       LEFT JOIN provider_profiles p ON p.user_id = u.id
       LEFT JOIN venue_details v ON v.service_id = s.id
       WHERE s.id = ? AND s.category_id = ?
       LIMIT 1`,
      [serviceId, category.id],
    )
    return rows[0] || null
  }

  app.get('/api/categories/:slug/services/:serviceId', async (request, response) => {
    const category = await findCategory(request.params.slug)
    const serviceId = Number(request.params.serviceId)
    if (!category || !Number.isInteger(serviceId) || serviceId < 1) {
      response.status(404).json({ message: 'No encontramos ese servicio.' })
      return
    }
    const row = await loadServiceDetail(category, serviceId)
    if (!row) {
      response.status(404).json({ message: 'No encontramos ese servicio.' })
      return
    }
    const viewer = await viewerOf(request)
    const canSeeHidden = viewer && (viewer.role === 'admin' || (viewer.role === 'proveedor' && viewer.id === row.provider_id))
    if (!row.is_published && !canSeeHidden) {
      const hidden = category.slug === 'banquetes'
        ? 'Este banquete no está publicado.'
        : category.slug === 'flores-decoracion'
          ? 'Esta decoración no está publicada.'
          : category.slug === 'musica'
            ? 'Este servicio musical no está publicado.'
            : category.slug === 'meseros'
              ? 'Este servicio de meseros no está publicado.'
              : category.slug === 'mobiliario'
                ? 'Este servicio de mobiliario no está publicado.'
                : 'Este lugar no está publicado.'
      response.status(404).json({ message: hidden, code: 'unpublished' })
      return
    }
    const [images, features, others] = await Promise.all([
      pool.query(
        'SELECT id, image_url, alt_text FROM service_images WHERE service_id = ? AND package_id IS NULL AND decoration_package_id IS NULL ORDER BY sort_order, id',
        [serviceId],
      ),
      pool.query('SELECT feature FROM service_features WHERE service_id = ? ORDER BY feature', [serviceId]),
      pool.query(
        `SELECT s.id, s.title, c.slug, c.title AS category_title
         FROM services s
         JOIN categories c ON c.id = s.category_id
         WHERE s.provider_id = ? AND s.is_published = 1 AND s.id <> ?
         ORDER BY c.sort_order, s.id
         LIMIT 6`,
        [row.provider_id, serviceId],
      ),
    ])
    const gallery = []
    if (row.image_url) gallery.push({ id: 0, url: row.image_url, alt: row.title })
    for (const image of images[0]) {
      if (image.image_url === row.image_url) continue
      gallery.push({ id: image.id, url: image.image_url, alt: image.alt_text || row.title })
    }
    response.json({
      category: toCategory(category),
      service: {
        id: row.id,
        title: row.title,
        description: row.description,
        priceCents: row.price_cents === null ? null : Number(row.price_cents),
        imageUrl: row.image_url || null,
        isPublished: Boolean(row.is_published),
        features: features[0].map((feature) => feature.feature),
        providerId: row.provider_id,
        provider: {
          businessName: row.business_name || row.full_name,
          city: row.city || '',
          description: row.provider_description || '',
        },
        venue: {
          spaceType: row.space_type || '',
          address: row.address || '',
          capacityMin: row.capacity_min === null || row.capacity_min === undefined ? null : Number(row.capacity_min),
          capacityMax: row.capacity_max === null || row.capacity_max === undefined ? null : Number(row.capacity_max),
          priceMode: row.price_mode || 'cotizacion',
        },
        images: gallery,
        providerServices: others[0].map((item) => ({
          id: item.id,
          title: item.title,
          slug: item.slug,
          categoryTitle: item.category_title,
        })),
        banquet: category.slug === 'banquetes' ? await loadBanquet(serviceId) : null,
        decoration: category.slug === 'flores-decoracion' ? await loadDecoration(serviceId) : null,
        music: category.slug === 'musica' ? await loadMusic(serviceId) : null,
        waitstaff: category.slug === 'meseros' ? await loadWaitstaff(serviceId) : null,
        furniture: category.slug === 'mobiliario' ? await loadFurniture(serviceId) : null,
      },
    })
  })

  const saveForClient = (table, duplicateMessage) => async (request, response) => {
    const serviceId = Number(request.params.serviceId)
    if (!Number.isInteger(serviceId)) {
      response.status(404).json({ message: 'No encontramos ese servicio.' })
      return
    }
    const category = await findPublishedService(request.params.slug, serviceId)
    if (!category) {
      response.status(404).json({ message: 'No encontramos ese servicio.' })
      return
    }
    const created = await saveClientService(table, request.account.id, serviceId)
    response.json({
      ok: true,
      created,
      message: created ? undefined : duplicateMessage,
    })
  }

  const saveVenueAction = (kind) => async (request, response) => {
    const serviceId = Number(request.params.serviceId)
    if (!Number.isInteger(serviceId) || serviceId < 1) {
      response.status(404).json({ message: 'No encontramos ese servicio.' })
      return
    }
    const category = await findPublishedService(request.params.slug, serviceId)
    if (!category) {
      response.status(404).json({ message: 'No encontramos ese servicio.' })
      return
    }
    if (category.slug === 'flores-decoracion') {
      const result = await saveDecoration({
        clientId: request.account.id,
        serviceId,
        kind: kind === 'quote' ? 'quote' : 'planner',
        body: request.body,
      })
      if (result.status) {
        response.status(result.status).json({ message: result.message })
        return
      }
      response.json({ ok: true, ...result })
      return
    }
    if (category.slug === 'musica') {
      const result = await saveMusic({
        clientId: request.account.id,
        serviceId,
        kind: kind === 'quote' ? 'quote' : 'planner',
        body: request.body,
      })
      if (result.status) {
        response.status(result.status).json({ message: result.message })
        return
      }
      response.json({ ok: true, ...result })
      return
    }
    if (category.slug === 'meseros') {
      const result = await saveWaitstaff({
        clientId: request.account.id,
        serviceId,
        kind: kind === 'quote' ? 'quote' : 'planner',
        body: request.body,
      })
      if (result.status) {
        response.status(result.status).json({ message: result.message })
        return
      }
      response.json({ ok: true, ...result })
      return
    }
    if (category.slug === 'mobiliario') {
      const result = await saveFurniture({
        clientId: request.account.id,
        serviceId,
        kind: kind === 'quote' ? 'quote' : 'planner',
        body: request.body,
      })
      if (result.status) {
        response.status(result.status).json({ message: result.message })
        return
      }
      response.json({ ok: true, ...result })
      return
    }
    if (category.slug === 'banquetes') {
      const result = await saveBanquet({
        clientId: request.account.id,
        serviceId,
        kind: kind === 'quote' ? 'quote' : 'planner',
        body: request.body,
      })
      if (result.status) {
        response.status(result.status).json({ message: result.message })
        return
      }
      response.json({ ok: true, ...result })
      return
    }
    if (category.slug !== 'locacion') {
      const created = await saveClientService(
        kind === 'quote' ? 'quote_requests' : 'planner_items',
        request.account.id,
        serviceId,
      )
      response.json({
        ok: true,
        created,
        message: created ? undefined : (kind === 'quote' ? 'Ya habías solicitado cotización para este servicio.' : 'Este servicio ya está en tu planificador.'),
      })
      return
    }
    const result = kind === 'quote'
      ? await requestServiceQuote({
          clientId: request.account.id,
          serviceId,
          eventId: request.body?.eventId,
          notes: request.body?.notes,
        })
      : await addServiceToEvent({
          clientId: request.account.id,
          serviceId,
          eventId: request.body?.eventId,
        })
    if (result.status) {
      response.status(result.status).json({ message: result.message })
      return
    }
    response.json({ ok: true, ...result })
  }

  app.post(
    '/api/categories/:slug/services/:serviceId/quotes',
    requireUser,
    requireRole('cliente'),
    saveVenueAction('quote'),
  )

  app.post(
    '/api/categories/:slug/services/:serviceId/planner',
    requireUser,
    requireRole('cliente'),
    saveVenueAction('planner'),
  )
}
