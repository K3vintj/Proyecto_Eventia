import crypto from 'node:crypto'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'

const databaseName = process.env.MYSQL_DATABASE || 'eventia'

if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
  throw new Error('MYSQL_DATABASE solo puede contener letras, números y guion bajo.')
}

const connection = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
}

export const pool = mysql.createPool({
  ...connection,
  database: databaseName,
  waitForConnections: true,
  connectionLimit: 10,
})

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL,
    username VARCHAR(40) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('cliente', 'proveedor', 'admin') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY users_email (email),
    UNIQUE KEY users_username (username)
  )`,
  `CREATE TABLE IF NOT EXISTS provider_profiles (
    user_id INT UNSIGNED PRIMARY KEY,
    business_name VARCHAR(160) NOT NULL DEFAULT '',
    city VARCHAR(120) NOT NULL DEFAULT '',
    description VARCHAR(500) NOT NULL DEFAULT '',
    is_complete TINYINT(1) NOT NULL DEFAULT 0,
    CONSTRAINT provider_profiles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(40) NOT NULL,
    title VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE KEY categories_slug (slug)
  )`,
  `CREATE TABLE IF NOT EXISTS services (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    provider_id INT UNSIGNED NOT NULL,
    category_id INT UNSIGNED NOT NULL,
    title VARCHAR(160) NOT NULL,
    description VARCHAR(500) NOT NULL,
    price_cents INT UNSIGNED NULL,
    image_url VARCHAR(500) NULL,
    is_published TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY services_category (category_id, is_published),
    CONSTRAINT services_provider FOREIGN KEY (provider_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT services_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS service_features (
    service_id INT UNSIGNED NOT NULL,
    feature VARCHAR(80) NOT NULL,
    PRIMARY KEY (service_id, feature),
    CONSTRAINT service_features_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS quote_requests (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    client_id INT UNSIGNED NOT NULL,
    service_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY quote_client_service (client_id, service_id),
    CONSTRAINT quote_client FOREIGN KEY (client_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT quote_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS planner_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    client_id INT UNSIGNED NOT NULL,
    service_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY planner_client_service (client_id, service_id),
    CONSTRAINT planner_client FOREIGN KEY (client_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT planner_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS venue_details (
    service_id INT UNSIGNED PRIMARY KEY,
    space_type VARCHAR(80) NOT NULL DEFAULT '',
    address VARCHAR(200) NOT NULL DEFAULT '',
    capacity_min INT UNSIGNED NULL,
    capacity_max INT UNSIGNED NULL,
    price_mode ENUM('fijo', 'desde', 'cotizacion') NOT NULL DEFAULT 'cotizacion',
    CONSTRAINT venue_details_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS service_images (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(160) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    KEY service_images_service (service_id, sort_order),
    CONSTRAINT service_images_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS client_events (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    client_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    event_date DATE NULL,
    guest_count INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY client_events_client (client_id, event_date),
    CONSTRAINT client_events_client FOREIGN KEY (client_id) REFERENCES users (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS banquet_details (
    service_id INT UNSIGNED PRIMARY KEY,
    service_type VARCHAR(80) NOT NULL DEFAULT '',
    coverage_area VARCHAR(200) NOT NULL DEFAULT '',
    price_mode ENUM('fijo', 'persona', 'cotizacion') NULL,
    guest_min INT UNSIGNED NULL,
    guest_max INT UNSIGNED NULL,
    CONSTRAINT banquet_details_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS banquet_packages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    price_cents INT UNSIGNED NULL,
    price_unit ENUM('persona', 'fijo', 'cotizacion') NOT NULL DEFAULT 'cotizacion',
    min_guests INT UNSIGNED NULL,
    conditions VARCHAR(500) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    KEY banquet_packages_service (service_id, is_active, sort_order),
    CONSTRAINT banquet_packages_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS banquet_menu_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    package_id INT UNSIGNED NOT NULL,
    course ENUM('entrada', 'fuerte', 'guarnicion', 'postre', 'bebida', 'otro') NOT NULL DEFAULT 'otro',
    name VARCHAR(160) NOT NULL,
    option_group VARCHAR(80) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    KEY banquet_menu_package (package_id, sort_order),
    CONSTRAINT banquet_menu_package FOREIGN KEY (package_id) REFERENCES banquet_packages (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS banquet_offerings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    inclusion ENUM('incluido', 'opcional', 'no_incluido') NOT NULL,
    price_cents INT UNSIGNED NULL,
    price_unit ENUM('fijo', 'persona', 'cotizacion') NOT NULL DEFAULT 'cotizacion',
    sort_order INT NOT NULL DEFAULT 0,
    KEY banquet_offerings_service (service_id, inclusion, sort_order),
    CONSTRAINT banquet_offerings_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS decoration_details (
    service_id INT UNSIGNED PRIMARY KEY,
    coverage_area VARCHAR(200) NOT NULL DEFAULT '',
    specialties VARCHAR(300) NOT NULL DEFAULT '',
    price_mode ENUM('fijo', 'desde', 'cotizacion') NULL,
    CONSTRAINT decoration_details_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS decoration_styles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    KEY decoration_styles_service (service_id, is_active, sort_order),
    CONSTRAINT decoration_styles_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS decoration_palettes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    name VARCHAR(80) NOT NULL,
    colors VARCHAR(80) NOT NULL DEFAULT '',
    description VARCHAR(300) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    KEY decoration_palettes_service (service_id, sort_order),
    CONSTRAINT decoration_palettes_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS decoration_elements (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    price_cents INT UNSIGNED NULL,
    price_unit ENUM('unidad', 'fijo', 'cotizacion') NOT NULL DEFAULT 'cotizacion',
    min_qty INT UNSIGNED NULL,
    max_qty INT UNSIGNED NULL,
    is_addon TINYINT(1) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    KEY decoration_elements_service (service_id, is_addon, sort_order),
    CONSTRAINT decoration_elements_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS decoration_packages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    price_cents INT UNSIGNED NULL,
    price_unit ENUM('fijo', 'desde', 'cotizacion') NOT NULL DEFAULT 'cotizacion',
    included_items VARCHAR(500) NOT NULL DEFAULT '',
    coverage VARCHAR(200) NOT NULL DEFAULT '',
    conditions VARCHAR(500) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    KEY decoration_packages_service (service_id, is_active, sort_order),
    CONSTRAINT decoration_packages_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS music_details (
    service_id INT UNSIGNED PRIMARY KEY,
    artist_name VARCHAR(160) NOT NULL DEFAULT '',
    service_type VARCHAR(80) NOT NULL DEFAULT '',
    coverage_area VARCHAR(200) NOT NULL DEFAULT '',
    presentation VARCHAR(800) NOT NULL DEFAULT '',
    price_mode ENUM('fijo', 'desde', 'cotizacion') NULL,
    min_space VARCHAR(200) NOT NULL DEFAULT '',
    electrical_requirements VARCHAR(300) NOT NULL DEFAULT '',
    needs_stage VARCHAR(120) NOT NULL DEFAULT '',
    sound_included VARCHAR(300) NOT NULL DEFAULT '',
    lighting_included VARCHAR(300) NOT NULL DEFAULT '',
    setup_time VARCHAR(120) NOT NULL DEFAULT '',
    teardown_time VARCHAR(120) NOT NULL DEFAULT '',
    access_requirements VARCHAR(300) NOT NULL DEFAULT '',
    restrictions VARCHAR(500) NOT NULL DEFAULT '',
    travel_notes VARCHAR(300) NOT NULL DEFAULT '',
    CONSTRAINT music_details_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS music_genres (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(300) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    KEY music_genres_service (service_id, sort_order),
    CONSTRAINT music_genres_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS music_tracks (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    title VARCHAR(160) NOT NULL,
    audio_url VARCHAR(500) NOT NULL,
    duration_seconds INT UNSIGNED NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    KEY music_tracks_service (service_id, is_active, sort_order),
    CONSTRAINT music_tracks_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS music_videos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    title VARCHAR(160) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    video_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    KEY music_videos_service (service_id, is_active, sort_order),
    CONSTRAINT music_videos_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS music_repertoire (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    title VARCHAR(160) NOT NULL,
    genre VARCHAR(80) NOT NULL DEFAULT '',
    notes VARCHAR(300) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    KEY music_repertoire_service (service_id, is_active, sort_order),
    CONSTRAINT music_repertoire_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS music_packages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    duration_minutes INT UNSIGNED NULL,
    duration_options VARCHAR(80) NOT NULL DEFAULT '',
    member_count INT UNSIGNED NULL,
    presentation_type VARCHAR(120) NOT NULL DEFAULT '',
    equipment_included VARCHAR(500) NOT NULL DEFAULT '',
    price_cents INT UNSIGNED NULL,
    price_unit ENUM('fijo', 'desde', 'cotizacion') NOT NULL DEFAULT 'cotizacion',
    conditions VARCHAR(500) NOT NULL DEFAULT '',
    extras VARCHAR(500) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    KEY music_packages_service (service_id, is_active, sort_order),
    CONSTRAINT music_packages_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS music_addons (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    price_cents INT UNSIGNED NULL,
    price_unit ENUM('unidad', 'fijo', 'cotizacion') NOT NULL DEFAULT 'cotizacion',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    KEY music_addons_service (service_id, is_active, sort_order),
    CONSTRAINT music_addons_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS waitstaff_details (
    service_id INT UNSIGNED PRIMARY KEY,
    coverage_area VARCHAR(200) NOT NULL DEFAULT '',
    specialties VARCHAR(300) NOT NULL DEFAULT '',
    price_mode ENUM('fijo', 'desde', 'cotizacion') NULL,
    guests_per_server INT UNSIGNED NULL,
    min_servers INT UNSIGNED NULL,
    max_servers INT UNSIGNED NULL,
    min_hours INT UNSIGNED NULL,
    overtime_cents INT UNSIGNED NULL,
    overtime_unit ENUM('hora', 'cotizacion') NOT NULL DEFAULT 'cotizacion',
    conditions VARCHAR(500) NOT NULL DEFAULT '',
    CONSTRAINT waitstaff_details_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS waitstaff_roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    price_cents INT UNSIGNED NULL,
    price_unit ENUM('hora', 'jornada', 'persona', 'fijo', 'cotizacion') NOT NULL DEFAULT 'cotizacion',
    min_hours INT UNSIGNED NULL,
    min_qty INT UNSIGNED NULL,
    max_qty INT UNSIGNED NULL,
    is_primary TINYINT(1) NOT NULL DEFAULT 0,
    image_url VARCHAR(500) NOT NULL DEFAULT '',
    conditions VARCHAR(500) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    KEY waitstaff_roles_service (service_id, is_active, is_primary, sort_order),
    CONSTRAINT waitstaff_roles_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS waitstaff_modalities (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(300) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    KEY waitstaff_modalities_service (service_id, is_active, sort_order),
    CONSTRAINT waitstaff_modalities_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS waitstaff_uniforms (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(300) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    KEY waitstaff_uniforms_service (service_id, is_active, sort_order),
    CONSTRAINT waitstaff_uniforms_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS waitstaff_duties (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    name VARCHAR(160) NOT NULL,
    description VARCHAR(400) NOT NULL DEFAULT '',
    inclusion ENUM('incluido', 'adicional') NOT NULL DEFAULT 'incluido',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    KEY waitstaff_duties_service (service_id, is_active, inclusion, sort_order),
    CONSTRAINT waitstaff_duties_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS waitstaff_packages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    server_count INT UNSIGNED NULL,
    hours_included INT UNSIGNED NULL,
    included_staff VARCHAR(500) NOT NULL DEFAULT '',
    modality_name VARCHAR(120) NOT NULL DEFAULT '',
    price_cents INT UNSIGNED NULL,
    price_unit ENUM('fijo', 'desde', 'cotizacion') NOT NULL DEFAULT 'cotizacion',
    conditions VARCHAR(500) NOT NULL DEFAULT '',
    services_included VARCHAR(500) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    KEY waitstaff_packages_service (service_id, is_active, sort_order),
    CONSTRAINT waitstaff_packages_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS furniture_details (
    service_id INT UNSIGNED PRIMARY KEY,
    coverage_area VARCHAR(200) NOT NULL DEFAULT '',
    specialties VARCHAR(300) NOT NULL DEFAULT '',
    furniture_types VARCHAR(300) NOT NULL DEFAULT '',
    price_mode ENUM('fijo', 'desde', 'cotizacion') NULL,
    conditions VARCHAR(500) NOT NULL DEFAULT '',
    CONSTRAINT furniture_details_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS furniture_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    name VARCHAR(160) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    subcategory VARCHAR(80) NOT NULL DEFAULT '',
    style VARCHAR(80) NOT NULL DEFAULT '',
    capacity INT UNSIGNED NULL,
    price_cents INT UNSIGNED NULL,
    price_unit ENUM('evento', 'dia', 'jornada', 'unidad', 'fijo', 'cotizacion') NOT NULL DEFAULT 'cotizacion',
    min_qty INT UNSIGNED NULL,
    stock INT UNSIGNED NULL,
    image_url VARCHAR(500) NOT NULL DEFAULT '',
    conditions VARCHAR(500) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    KEY furniture_items_service (service_id, is_active, subcategory, sort_order),
    CONSTRAINT furniture_items_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS furniture_packages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    price_cents INT UNSIGNED NULL,
    price_unit ENUM('evento', 'dia', 'jornada', 'fijo', 'cotizacion') NOT NULL DEFAULT 'cotizacion',
    rental_label VARCHAR(120) NOT NULL DEFAULT '',
    conditions VARCHAR(500) NOT NULL DEFAULT '',
    image_url VARCHAR(500) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    KEY furniture_packages_service (service_id, is_active, sort_order),
    CONSTRAINT furniture_packages_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS furniture_package_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    package_id INT UNSIGNED NOT NULL,
    item_id INT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 1,
    UNIQUE KEY furniture_package_item (package_id, item_id),
    CONSTRAINT furniture_package_items_package FOREIGN KEY (package_id) REFERENCES furniture_packages (id) ON DELETE CASCADE,
    CONSTRAINT furniture_package_items_item FOREIGN KEY (item_id) REFERENCES furniture_items (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS furniture_addons (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    price_cents INT UNSIGNED NULL,
    price_unit ENUM('evento', 'dia', 'unidad', 'fijo', 'cotizacion') NOT NULL DEFAULT 'cotizacion',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    KEY furniture_addons_service (service_id, is_active, sort_order),
    CONSTRAINT furniture_addons_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS password_resets (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY password_resets_token (token_hash),
    KEY password_resets_user (user_id),
    CONSTRAINT password_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )`,
]

const catalogCategories = [
  { slug: 'locacion', title: 'Locación', description: 'Salones, terrazas y espacios para recibir a tus invitados.', imageUrl: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1600&q=85', sortOrder: 1 },
  { slug: 'fotografia', title: 'Fotografía', description: 'Miradas editoriales que guardan la luz, el gesto y el ritmo del día.', imageUrl: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1600&q=85', sortOrder: 2 },
  { slug: 'banquetes', title: 'Servicios de banquetes', description: 'Menús, mesas y servicio de banquete pensados para cada celebración.', imageUrl: 'https://images.unsplash.com/photo-1643066873594-4df339b2e232?auto=format&fit=crop&w=1600&q=85', sortOrder: 3 },
  { slug: 'musica', title: 'Música y DJ', description: 'En vivo o en cabina, el sonido que sostiene la noche de principio a fin.', imageUrl: 'https://images.unsplash.com/photo-1553190842-24c3f93ba116?auto=format&fit=crop&w=1600&q=85', sortOrder: 4 },
  { slug: 'flores-decoracion', title: 'Flores y decoración', description: 'Flores y decoración que dan atmósfera a la ceremonia y a la mesa.', imageUrl: 'https://images.unsplash.com/photo-1562050147-fda1cc9a6378?auto=format&fit=crop&w=1600&q=85', sortOrder: 5 },
  { slug: 'meseros', title: 'Servicio de meseros', description: 'Equipo de servicio para atender a tus invitados durante el evento.', imageUrl: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1600&q=85', sortOrder: 6 },
  { slug: 'mobiliario', title: 'Mobiliario', description: 'Mesas, sillas y montaje para armar el espacio de la celebración.', imageUrl: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1600&q=85', sortOrder: 7 },
]

const categoryRenames = [
  ['espacios', 'locacion'],
  ['gastronomia', 'banquetes'],
  ['decoracion', 'flores-decoracion'],
]

const venueDescription = 'Salón para celebraciones.'
const banquetDescription = 'Servicio de banquetes.'

const venueProviders = [
  { username: 'salon-fantas', email: 'salon-fantas@eventia.test', businessName: 'Salón Fantas', services: [{ title: 'Planta baja', feature: 'Planta baja' }, { title: 'Planta alta', feature: 'Planta alta' }] },
  { username: 'salon-los-altos', email: 'salon-los-altos@eventia.test', businessName: 'Salón Los Altos' },
  { username: 'salon-yacoba', email: 'salon-yacoba@eventia.test', businessName: 'Salón Yacoba' },
  { username: 'salon-imperial', email: 'salon-imperial@eventia.test', businessName: 'Salón Imperial' },
  { username: 'salon-bugambilias', email: 'salon-bugambilias@eventia.test', businessName: 'Salón Bugambilias' },
  { username: 'salon-las-mercedes', email: 'salon-las-mercedes@eventia.test', businessName: 'Salón Las Mercedes' },
  { username: 'salon-la-nelson', email: 'salon-la-nelson@eventia.test', businessName: 'Salón La Nelson' },
  { username: 'salon-las-tortugas', email: 'salon-las-tortugas@eventia.test', businessName: 'Salón Las Tortugas' },
  { username: 'salon-los-macuillis', email: 'salon-los-macuillis@eventia.test', businessName: 'Salón Los Macuillis' },
  { username: 'salon-el-rolys', email: 'salon-el-rolys@eventia.test', businessName: 'Salón El Rolys' },
  { username: 'salon-el-solar', email: 'salon-el-solar@eventia.test', businessName: 'Salón El Solar' },
  { username: 'salon-partyland', email: 'salon-partyland@eventia.test', businessName: 'Salón Partyland' },
]

const banquetProviders = [
  { username: 'banquetes', email: 'banquetes@eventia.test', businessName: 'Banquetes' },
  { username: 'banquetes-luis-mendez', email: 'banquetes-luis-mendez@eventia.test', businessName: 'Banquetes luis Méndez' },
  { username: 'alberto-rikitiki', email: 'alberto-rikitiki@eventia.test', businessName: 'Alberto rikitiki' },
  { username: 'rosy-salgado', email: 'rosy-salgado@eventia.test', businessName: 'Rosy Salgado' },
  { username: 'aroon', email: 'aroon@eventia.test', businessName: 'Aroon' },
  { username: 'cm-eventos', email: 'cm-eventos@eventia.test', businessName: 'Cm eventos' },
]

const ensureCatalogProviders = async (slug, description, providers) => {
  const [categories] = await pool.query('SELECT id FROM categories WHERE slug = ? LIMIT 1', [slug])
  const categoryId = categories[0]?.id
  if (!categoryId) return
  for (const venue of providers) {
    const services = venue.services ?? [{ title: venue.businessName }]
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [venue.username])
    let userId = existing[0]?.id
    if (!userId) {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('base64url'), 12)
      const [created] = await pool.query(
        'INSERT INTO users (full_name, email, username, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        [venue.businessName, venue.email, venue.username, passwordHash, 'proveedor'],
      )
      userId = created.insertId
    }
    await pool.query(
      `INSERT INTO provider_profiles (user_id, business_name, city, description, is_complete)
       VALUES (?, ?, '', '', 0)
       ON DUPLICATE KEY UPDATE business_name = IF(business_name = '', VALUES(business_name), business_name)`,
      [userId, venue.businessName],
    )
    for (const service of services) {
      const [found] = await pool.query(
        'SELECT id FROM services WHERE provider_id = ? AND category_id = ? AND title = ? LIMIT 1',
        [userId, categoryId, service.title],
      )
      let serviceId = found[0]?.id
      if (!serviceId) {
        const [createdService] = await pool.query(
          'INSERT INTO services (provider_id, category_id, title, description, price_cents, image_url, is_published) VALUES (?, ?, ?, ?, NULL, NULL, 1)',
          [userId, categoryId, service.title, description],
        )
        serviceId = createdService.insertId
      }
      if (!service.feature) continue
      await pool.query(
        'INSERT IGNORE INTO service_features (service_id, feature) VALUES (?, ?)',
        [serviceId, service.feature],
      )
    }
  }
}

const developmentAccounts = [
  { fullName: 'Valentina Pérez', email: 'cliente@eventia.test', username: 'cliente', password: 'cliente', role: 'cliente' },
  { fullName: 'Estudio Magnolia', email: 'proveedor@eventia.test', username: 'proveedor', password: 'proveedor', role: 'proveedor' },
  { fullName: 'Ana Vidal', email: 'admin@eventia.test', username: 'admin', password: 'admin', role: 'admin' },
]

const columnExists = async (table, column) => {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column],
  )
  return rows.length > 0
}

const indexExists = async (table, index) => {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [table, index],
  )
  return rows.length > 0
}

const addColumn = async (table, column, definition) => {
  if (await columnExists(table, column)) return
  await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
}

const ensurePlanningColumns = async () => {
  await addColumn('quote_requests', 'event_id', 'INT UNSIGNED NULL')
  await addColumn('quote_requests', 'notes', "VARCHAR(500) NOT NULL DEFAULT ''")
  await addColumn('quote_requests', 'status', "VARCHAR(20) NOT NULL DEFAULT 'recibida'")
  await addColumn('planner_items', 'event_id', 'INT UNSIGNED NULL')
  await addColumn('planner_items', 'estimated_cents', 'INT UNSIGNED NULL')
  if (!(await indexExists('quote_requests', 'quote_client_lookup'))) {
    await pool.query('ALTER TABLE quote_requests ADD INDEX quote_client_lookup (client_id)')
  }
  if (!(await indexExists('quote_requests', 'quote_service_lookup'))) {
    await pool.query('ALTER TABLE quote_requests ADD INDEX quote_service_lookup (service_id)')
  }
  if (!(await indexExists('planner_items', 'planner_client_lookup'))) {
    await pool.query('ALTER TABLE planner_items ADD INDEX planner_client_lookup (client_id)')
  }
  if (!(await indexExists('planner_items', 'planner_service_lookup'))) {
    await pool.query('ALTER TABLE planner_items ADD INDEX planner_service_lookup (service_id)')
  }
  if (await indexExists('quote_requests', 'quote_client_service')) {
    await pool.query('ALTER TABLE quote_requests DROP INDEX quote_client_service')
  }
  if (await indexExists('planner_items', 'planner_client_service')) {
    await pool.query('ALTER TABLE planner_items DROP INDEX planner_client_service')
  }
  if (!(await indexExists('quote_requests', 'quote_client_event_service'))) {
    await pool.query('ALTER TABLE quote_requests ADD UNIQUE KEY quote_client_event_service (client_id, service_id, event_id)')
  }
  if (!(await indexExists('planner_items', 'planner_client_event_service'))) {
    await pool.query('ALTER TABLE planner_items ADD UNIQUE KEY planner_client_event_service (client_id, service_id, event_id)')
  }
  if (!(await indexExists('quote_requests', 'quote_event'))) {
    await pool.query('ALTER TABLE quote_requests ADD CONSTRAINT quote_event FOREIGN KEY (event_id) REFERENCES client_events (id) ON DELETE CASCADE')
  }
  if (!(await indexExists('planner_items', 'planner_event'))) {
    await pool.query('ALTER TABLE planner_items ADD CONSTRAINT planner_event FOREIGN KEY (event_id) REFERENCES client_events (id) ON DELETE CASCADE')
  }
  await addColumn('planner_items', 'selection_json', 'TEXT NULL')
  await addColumn('quote_requests', 'selection_json', 'TEXT NULL')
  await addColumn('service_images', 'package_id', 'INT UNSIGNED NULL')
  if (!(await indexExists('service_images', 'service_images_package'))) {
    await pool.query('ALTER TABLE service_images ADD CONSTRAINT service_images_package FOREIGN KEY (package_id) REFERENCES banquet_packages (id) ON DELETE CASCADE')
  }
  await addColumn('service_images', 'gallery_tag', "VARCHAR(80) NOT NULL DEFAULT ''")
  await addColumn('service_images', 'style_id', 'INT UNSIGNED NULL')
  await addColumn('service_images', 'decoration_package_id', 'INT UNSIGNED NULL')
  await addColumn('client_events', 'event_type', "VARCHAR(80) NOT NULL DEFAULT ''")
  await addColumn('client_events', 'budget_target_cents', 'INT UNSIGNED NULL')
  await addColumn('client_events', 'location', "VARCHAR(200) NOT NULL DEFAULT ''")
  await addColumn('client_events', 'start_time', "VARCHAR(20) NOT NULL DEFAULT ''")
  await addColumn('users', 'avatar_url', 'VARCHAR(500) NULL')
  await addColumn('users', 'phone', 'VARCHAR(40) NULL')
  await pool.query(`CREATE TABLE IF NOT EXISTS service_contracts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    client_id INT UNSIGNED NOT NULL,
    event_id INT UNSIGNED NOT NULL,
    service_id INT UNSIGNED NOT NULL,
    quote_id INT UNSIGNED NULL,
    amount_cents INT UNSIGNED NULL,
    conditions_text VARCHAR(500) NOT NULL DEFAULT '',
    status VARCHAR(40) NOT NULL DEFAULT 'vigente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY contract_client_event_service (client_id, event_id, service_id),
    KEY contract_event (event_id),
    CONSTRAINT contract_client FOREIGN KEY (client_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT contract_event FOREIGN KEY (event_id) REFERENCES client_events (id) ON DELETE CASCADE,
    CONSTRAINT contract_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE,
    CONSTRAINT contract_quote FOREIGN KEY (quote_id) REFERENCES quote_requests (id) ON DELETE SET NULL
  )`)
  if (!(await indexExists('service_images', 'service_images_style'))) {
    await pool.query('ALTER TABLE service_images ADD CONSTRAINT service_images_style FOREIGN KEY (style_id) REFERENCES decoration_styles (id) ON DELETE SET NULL')
  }
  if (!(await indexExists('service_images', 'service_images_decoration_package'))) {
    await pool.query('ALTER TABLE service_images ADD CONSTRAINT service_images_decoration_package FOREIGN KEY (decoration_package_id) REFERENCES decoration_packages (id) ON DELETE CASCADE')
  }
}

export const prepareDatabase = async () => {
  const root = await mysql.createConnection(connection)
  await root.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await root.end()
  for (const statement of statements) await pool.query(statement)
  await ensurePlanningColumns()
  for (const [fromSlug, toSlug] of categoryRenames) {
    const [target] = await pool.query('SELECT id FROM categories WHERE slug = ? LIMIT 1', [toSlug])
    if (target.length > 0) continue
    await pool.query('UPDATE categories SET slug = ? WHERE slug = ?', [toSlug, fromSlug])
  }
  for (const category of catalogCategories) {
    await pool.query(
      `INSERT INTO categories (slug, title, description, image_url, sort_order)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), image_url = VALUES(image_url), sort_order = VALUES(sort_order)`,
      [category.slug, category.title, category.description, category.imageUrl, category.sortOrder],
    )
  }
  const activeSlugs = catalogCategories.map((category) => category.slug)
  const [storedCategories] = await pool.query('SELECT id, slug FROM categories')
  for (const storedCategory of storedCategories) {
    if (activeSlugs.includes(storedCategory.slug)) continue
    const [linkedServices] = await pool.query('SELECT id FROM services WHERE category_id = ? LIMIT 1', [storedCategory.id])
    if (linkedServices.length > 0) continue
    await pool.query('DELETE FROM categories WHERE id = ?', [storedCategory.id])
  }
  await ensureCatalogProviders('locacion', venueDescription, venueProviders)
  await ensureCatalogProviders('banquetes', banquetDescription, banquetProviders)
  await ensureCatalogProviders('flores-decoracion', 'Servicio de decoración.', [
    { username: 'efrain-cm-evento', email: 'efrain-cm-evento@eventia.test', businessName: 'Efraín CM Evento' },
  ])
  await ensureCatalogProviders('musica', 'Servicio de música y entretenimiento.', [
    { username: 'musica-fantas', email: 'musica-fantas@eventia.test', businessName: 'Fantas' },
    { username: 'musica-oasis', email: 'musica-oasis@eventia.test', businessName: 'Oasis' },
  ])
  await ensureCatalogProviders('meseros', 'Servicio de meseros y personal para eventos.', [
    { username: 'servicios-la', email: 'servicios-la@eventia.test', businessName: 'Servicios LA' },
    { username: 'servisan-eventos', email: 'servisan-eventos@eventia.test', businessName: 'Servisan Eventos' },
    { username: 'el-cholo', email: 'el-cholo@eventia.test', businessName: 'El Cholo' },
    { username: 'rp-may', email: 'rp-may@eventia.test', businessName: 'RP MAY' },
    { username: 'buena-vista-meseros', email: 'buena-vista-meseros@eventia.test', businessName: 'Buena Vista' },
    { username: 'la-pancha', email: 'la-pancha@eventia.test', businessName: 'La Pancha' },
  ])
  await ensureCatalogProviders('mobiliario', 'Servicio de mobiliario para eventos.', [
    { username: 'musica-fantas', email: 'musica-fantas@eventia.test', businessName: 'Fantas' },
    { username: 'servisan-eventos', email: 'servisan-eventos@eventia.test', businessName: 'Servisan Eventos' },
    { username: 'leovino', email: 'leovino@eventia.test', businessName: 'Leovino' },
    { username: 'cm-eventos', email: 'cm-eventos@eventia.test', businessName: 'Cm eventos' },
  ])
  if (process.env.NODE_ENV === 'production') return
  for (const account of developmentAccounts) {
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [account.username])
    if (existing.length > 0) continue
    const passwordHash = await bcrypt.hash(account.password, 12)
    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, username, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [account.fullName, account.email, account.username, passwordHash, account.role],
    )
    if (account.role === 'proveedor') {
      await pool.query('INSERT INTO provider_profiles (user_id, business_name, city, description, is_complete) VALUES (?, ?, ?, ?, 0)', [result.insertId, '', '', ''])
    }
  }
}

export const publicUserSelect = `SELECT u.id, u.full_name, u.email, u.username, u.role, u.avatar_url, u.phone,
  p.business_name, p.city, p.description, p.is_complete
  FROM users u
  LEFT JOIN provider_profiles p ON p.user_id = u.id`

export const toPublicUser = (row) => {
  if (!row) return null
  const words = String(row.full_name).trim().split(/\s+/).slice(0, 2)
  const initials = words.map((word) => word[0]?.toUpperCase() || '').join('') || 'EV'
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    username: row.username,
    role: row.role,
    initials,
    avatarUrl: row.avatar_url || null,
    phone: row.phone || null,
    providerProfile: row.role === 'proveedor'
      ? {
          businessName: row.business_name || '',
          city: row.city || '',
          description: row.description || '',
          isComplete: Boolean(row.is_complete),
        }
      : null,
  }
}
