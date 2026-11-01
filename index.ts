import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env, Admin } from './types';
import {
  hashPassword,
  verifyPassword,
  createSession,
  getSessionAdmin,
  destroySession,
  generateOrderRef,
  checkRateLimit,
} from './auth';

const app = new Hono<{ Bindings: Env; Variables: { admin: Admin } }>();

// ========== Security & CORS ==========
app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://unpkg.com"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "blob:", "https:"],
    connectSrc: ["'self'"],
  },
}));

app.use('/api/*', cors({
  origin: (origin) => origin || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ========== Helpers ==========
async function requireAdmin(c: any) {
  const sessionId = getCookie(c, 'eds_session');
  const admin = await getSessionAdmin(c.env, sessionId);
  if (!admin) return c.json({ error: 'Unauthorized' }, 401);
  c.set('admin', admin);
  return null;
}

function jsonOk(c: any, data: any, status = 200) {
  return c.json({ success: true, data }, status);
}

function jsonError(c: any, message: string, status = 400) {
  return c.json({ success: false, error: message }, status);
}

// ========== PUBLIC API ==========

// Services
app.get('/api/services', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM services WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`
  ).all();
  return jsonOk(c, results);
});

app.get('/api/services/:slug', async (c) => {
  const slug = c.req.param('slug');
  const row = await c.env.DB.prepare(`SELECT * FROM services WHERE slug = ? AND is_active = 1`).bind(slug).first();
  if (!row) return jsonError(c, 'Service not found', 404);
  return jsonOk(c, row);
});

// Projects / Portfolio (sample demos)
app.get('/api/projects', async (c) => {
  const featured = c.req.query('featured');
  let query = `SELECT * FROM projects WHERE is_active = 1`;
  if (featured === '1') query += ` AND is_featured = 1`;
  query += ` ORDER BY sort_order ASC, id DESC`;
  const { results } = await c.env.DB.prepare(query).all();
  return jsonOk(c, results);
});

app.get('/api/projects/:slug', async (c) => {
  const slug = c.req.param('slug');
  const row = await c.env.DB.prepare(`SELECT * FROM projects WHERE slug = ? AND is_active = 1`).bind(slug).first();
  if (!row) return jsonError(c, 'Project not found', 404);
  return jsonOk(c, row);
});

// Published Reviews only
app.get('/api/reviews', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, customer_name, service_taken, rating, review_text_en, review_text_bn, created_at
     FROM reviews WHERE is_published = 1 AND is_approved = 1
     ORDER BY created_at DESC LIMIT 50`
  ).all();
  return jsonOk(c, results);
});

// Submit a real customer review (goes to pending)
app.post('/api/reviews', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.customer_name || !body?.review_text_en || !body?.rating) {
    return jsonError(c, 'Name, review text and rating are required');
  }
  const rating = Math.min(5, Math.max(1, parseInt(body.rating, 10) || 5));
  await c.env.DB.prepare(
    `INSERT INTO reviews (customer_name, service_taken, rating, review_text_en, review_text_bn, is_approved, is_published)
     VALUES (?, ?, ?, ?, ?, 0, 0)`
  ).bind(
    body.customer_name.slice(0, 100),
    (body.service_taken || '').slice(0, 150),
    rating,
    body.review_text_en.slice(0, 1000),
    (body.review_text_bn || '').slice(0, 1000)
  ).run();
  return jsonOk(c, { message: 'Thank you! Your review is pending approval.' });
});

// Packages
app.get('/api/packages', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM packages WHERE is_active = 1 ORDER BY sort_order ASC`
  ).all();
  return jsonOk(c, results);
});

// FAQs
app.get('/api/faqs', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM faqs WHERE is_active = 1 ORDER BY sort_order ASC`
  ).all();
  return jsonOk(c, results);
});

// Blog posts (published)
app.get('/api/posts', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, slug, title_en, title_bn, excerpt_en, excerpt_bn, cover_image, published_at
     FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 20`
  ).all();
  return jsonOk(c, results);
});

app.get('/api/posts/:slug', async (c) => {
  const slug = c.req.param('slug');
  const row = await c.env.DB.prepare(
    `SELECT * FROM posts WHERE slug = ? AND status = 'published'`
  ).bind(slug).first();
  if (!row) return jsonError(c, 'Post not found', 404);
  return jsonOk(c, row);
});

// Contact / Inquiry
app.post('/api/contact', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.name || !body?.message) return jsonError(c, 'Name and message are required');
  await c.env.DB.prepare(
    `INSERT INTO messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)`
  ).bind(
    body.name.slice(0, 100),
    (body.email || '').slice(0, 150),
    (body.phone || '').slice(0, 30),
    (body.subject || '').slice(0, 200),
    body.message.slice(0, 2000)
  ).run();
  return jsonOk(c, { message: 'Message received. We will contact you soon.' });
});

// Create Order
app.post('/api/orders', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.customer_name || !body?.customer_phone) {
    return jsonError(c, 'Name and phone are required');
  }
  const ref = generateOrderRef();
  await c.env.DB.prepare(
    `INSERT INTO orders (reference_no, customer_name, customer_phone, customer_email, service_id, service_title, package_id, requirements, preferred_contact, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`
  ).bind(
    ref,
    body.customer_name.slice(0, 100),
    body.customer_phone.slice(0, 30),
    (body.customer_email || '').slice(0, 150),
    body.service_id || null,
    (body.service_title || '').slice(0, 200),
    body.package_id || null,
    (body.requirements || '').slice(0, 2000),
    (body.preferred_contact || 'whatsapp').slice(0, 30)
  ).run();
  return jsonOk(c, { reference_no: ref, message: 'Order submitted successfully.' });
});

// Settings (public)
app.get('/api/settings', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT key, value FROM settings`).all();
  const map: Record<string, string> = {};
  for (const r of results as any[]) map[r.key] = r.value;
  return jsonOk(c, map);
});

// ========== ADMIN AUTH ==========
app.post('/api/admin/login', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  if (!checkRateLimit(`login:${ip}`, 8, 15 * 60 * 1000)) {
    return jsonError(c, 'Too many attempts. Try again later.', 429);
  }

  const body = await c.req.json().catch(() => null);
  if (!body?.email || !body?.password) return jsonError(c, 'Email and password required');

  const admin = await c.env.DB.prepare(
    `SELECT id, email, password_hash, name, role, is_active FROM admins WHERE email = ?`
  ).bind(body.email.toLowerCase().trim()).first<any>();

  if (!admin || !admin.is_active) return jsonError(c, 'Invalid credentials', 401);

  const valid = await verifyPassword(body.password, admin.password_hash, c.env.PASSWORD_PEPPER);
  if (!valid) return jsonError(c, 'Invalid credentials', 401);

  const sessionId = await createSession(c.env, admin.id, ip, c.req.header('user-agent'));
  setCookie(c, 'eds_session', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  await c.env.DB.prepare(`UPDATE admins SET last_login_at = datetime('now') WHERE id = ?`).bind(admin.id).run();

  return jsonOk(c, { id: admin.id, email: admin.email, name: admin.name, role: admin.role });
});

app.post('/api/admin/logout', async (c) => {
  const sessionId = getCookie(c, 'eds_session');
  if (sessionId) await destroySession(c.env, sessionId);
  deleteCookie(c, 'eds_session', { path: '/' });
  return jsonOk(c, { message: 'Logged out' });
});

app.get('/api/admin/me', async (c) => {
  const err = await requireAdmin(c);
  if (err) return err;
  return jsonOk(c, c.get('admin'));
});

// ========== ADMIN DASHBOARD STATS ==========
app.get('/api/admin/stats', async (c) => {
  const err = await requireAdmin(c);
  if (err) return err;

  const [orders, pending, completed, services, projects, reviews, messages] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) as c FROM orders`).first<{ c: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) as c FROM orders WHERE status IN ('new','pending')`).first<{ c: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'completed'`).first<{ c: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) as c FROM services WHERE is_active = 1`).first<{ c: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) as c FROM projects WHERE is_active = 1`).first<{ c: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) as c FROM reviews`).first<{ c: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) as c FROM messages WHERE is_read = 0`).first<{ c: number }>(),
  ]);

  return jsonOk(c, {
    total_orders: orders?.c || 0,
    pending_orders: pending?.c || 0,
    completed_orders: completed?.c || 0,
    total_services: services?.c || 0,
    total_projects: projects?.c || 0,
    total_reviews: reviews?.c || 0,
    unread_messages: messages?.c || 0,
  });
});

// ========== ADMIN: ORDERS ==========
app.get('/api/admin/orders', async (c) => {
  const err = await requireAdmin(c);
  if (err) return err;
  const status = c.req.query('status');
  let q = `SELECT * FROM orders`;
  if (status) q += ` WHERE status = ?`;
  q += ` ORDER BY created_at DESC LIMIT 100`;
  const stmt = status ? c.env.DB.prepare(q).bind(status) : c.env.DB.prepare(q);
  const { results } = await stmt.all();
  return jsonOk(c, results);
});

app.put('/api/admin/orders/:id', async (c) => {
  const err = await requireAdmin(c);
  if (err) return err;
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  if (!body) return jsonError(c, 'Invalid body');

  await c.env.DB.prepare(
    `UPDATE orders SET status = COALESCE(?, status), admin_notes = COALESCE(?, admin_notes), updated_at = datetime('now') WHERE id = ?`
  ).bind(body.status || null, body.admin_notes || null, id).run();
  return jsonOk(c, { message: 'Order updated' });
});

// ========== ADMIN: PROJECTS (Demos) ==========
app.get('/api/admin/projects', async (c) => {
  const err = await requireAdmin(c);
  if (err) return err;
  const { results } = await c.env.DB.prepare(`SELECT * FROM projects ORDER BY sort_order ASC`).all();
  return jsonOk(c, results);
});

app.post('/api/admin/projects', async (c) => {
  const err = await requireAdmin(c);
  if (err) return err;
  const body = await c.req.json().catch(() => null);
  if (!body?.slug || !body?.title_en) return jsonError(c, 'Slug and title required');

  await c.env.DB.prepare(
    `INSERT INTO projects (slug, title_en, title_bn, description_en, description_bn, category, client_name, image_url, demo_url, is_featured, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.slug, body.title_en, body.title_bn || body.title_en,
    body.description_en || '', body.description_bn || '',
    body.category || 'General', body.client_name || 'Sample',
    body.image_url || null, body.demo_url || null,
    body.is_featured ? 1 : 0, body.is_active !== false ? 1 : 0,
    body.sort_order || 0
  ).run();
  return jsonOk(c, { message: 'Project created' }, 201);
});

app.put('/api/admin/projects/:id', async (c) => {
  const err = await requireAdmin(c);
  if (err) return err;
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  if (!body) return jsonError(c, 'Invalid body');

  await c.env.DB.prepare(
    `UPDATE projects SET
      title_en = COALESCE(?, title_en), title_bn = COALESCE(?, title_bn),
      description_en = COALESCE(?, description_en), description_bn = COALESCE(?, description_bn),
      category = COALESCE(?, category), client_name = COALESCE(?, client_name),
      image_url = COALESCE(?, image_url), demo_url = COALESCE(?, demo_url),
      is_featured = COALESCE(?, is_featured), is_active = COALESCE(?, is_active),
      sort_order = COALESCE(?, sort_order), updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    body.title_en, body.title_bn, body.description_en, body.description_bn,
    body.category, body.client_name, body.image_url, body.demo_url,
    body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : null,
    body.is_active !== undefined ? (body.is_active ? 1 : 0) : null,
    body.sort_order, id
  ).run();
  return jsonOk(c, { message: 'Project updated' });
});

app.delete('/api/admin/projects/:id', async (c) => {
  const err = await requireAdmin(c);
  if (err) return err;
  await c.env.DB.prepare(`DELETE FROM projects WHERE id = ?`).bind(c.req.param('id')).run();
  return jsonOk(c, { message: 'Project deleted' });
});

// ========== ADMIN: REVIEWS ==========
app.get('/api/admin/reviews', async (c) => {
  const err = await requireAdmin(c);
  if (err) return err;
  const { results } = await c.env.DB.prepare(`SELECT * FROM reviews ORDER BY created_at DESC`).all();
  return jsonOk(c, results);
});

app.put('/api/admin/reviews/:id', async (c) => {
  const err = await requireAdmin(c);
  if (err) return err;
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  if (!body) return jsonError(c, 'Invalid body');

  await c.env.DB.prepare(
    `UPDATE reviews SET
      is_approved = COALESCE(?, is_approved),
      is_published = COALESCE(?, is_published),
      updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    body.is_approved !== undefined ? (body.is_approved ? 1 : 0) : null,
    body.is_published !== undefined ? (body.is_published ? 1 : 0) : null,
    id
  ).run();
  return jsonOk(c, { message: 'Review updated' });
});

app.delete('/api/admin/reviews/:id', async (c) => {
  const err = await requireAdmin(c);
  if (err) return err;
  await c.env.DB.prepare(`DELETE FROM reviews WHERE id = ?`).bind(c.req.param('id')).run();
  return jsonOk(c, { message: 'Review deleted' });
});

// ========== ADMIN: SERVICES ==========
app.get('/api/admin/services', async (c) => {
  const err = await requireAdmin(c);
  if (err) return err;
  const { results } = await c.env.DB.prepare(`SELECT * FROM services ORDER BY sort_order ASC`).all();
  return jsonOk(c, results);
});

app.put('/api/admin/services/:id', async (c) => {
  const err = await requireAdmin(c);
  if (err) return err;
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  if (!body) return jsonError(c, 'Invalid body');

  await c.env.DB.prepare(
    `UPDATE services SET
      title_en = COALESCE(?, title_en), title_bn = COALESCE(?, title_bn),
      description_en = COALESCE(?, description_en), is_active = COALESCE(?, is_active),
      is_featured = COALESCE(?, is_featured), price_label = COALESCE(?, price_label),
      updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    body.title_en, body.title_bn, body.description_en,
    body.is_active !== undefined ? (body.is_active ? 1 : 0) : null,
    body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : null,
    body.price_label, id
  ).run();
  return jsonOk(c, { message: 'Service updated' });
});

// ========== ADMIN: MESSAGES ==========
app.get('/api/admin/messages', async (c) => {
  const err = await requireAdmin(c);
  if (err) return err;
  const { results } = await c.env.DB.prepare(`SELECT * FROM messages ORDER BY created_at DESC LIMIT 100`).all();
  return jsonOk(c, results);
});

app.put('/api/admin/messages/:id/read', async (c) => {
  const err = await requireAdmin(c);
  if (err) return err;
  await c.env.DB.prepare(`UPDATE messages SET is_read = 1 WHERE id = ?`).bind(c.req.param('id')).run();
  return jsonOk(c, { message: 'Marked as read' });
});

// ========== ADMIN: CHANGE PASSWORD ==========
app.post('/api/admin/change-password', async (c) => {
  const err = await requireAdmin(c);
  if (err) return err;
  const admin = c.get('admin');
  const body = await c.req.json().catch(() => null);
  if (!body?.current_password || !body?.new_password) return jsonError(c, 'Both passwords required');
  if (body.new_password.length < 10) return jsonError(c, 'New password must be at least 10 characters');

  const row = await c.env.DB.prepare(`SELECT password_hash FROM admins WHERE id = ?`).bind(admin.id).first<any>();
  const valid = await verifyPassword(body.current_password, row.password_hash, c.env.PASSWORD_PEPPER);
  if (!valid) return jsonError(c, 'Current password is incorrect');

  const newHash = await hashPassword(body.new_password, c.env.PASSWORD_PEPPER);
  await c.env.DB.prepare(`UPDATE admins SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(newHash, admin.id).run();
  return jsonOk(c, { message: 'Password changed successfully' });
});

// Admin dashboard entry points
app.get('/admin', async (c) => {
  return c.env.ASSETS.fetch(new Request(new URL('/dashboard.html', c.req.url)));
});
app.get('/admin/', async (c) => {
  return c.env.ASSETS.fetch(new Request(new URL('/dashboard.html', c.req.url)));
});

// ========== Serve static assets (fallback) ==========
app.get('*', async (c) => {
  // Try to serve from ASSETS binding first
  if (c.env.ASSETS) {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    if (res.status !== 404) return res;
  }
  // SPA fallback for frontend routes
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url)));
  }
  return c.text('Elite Digital Solutions API is running. Frontend assets not found.', 200);
});

export default app;
