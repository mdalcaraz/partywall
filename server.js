require('dotenv').config();
const http    = require('http');
const express = require('express');
const { Server } = require('socket.io');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const QRCode  = require('qrcode');
const os      = require('os');
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { sequelize, Event, Photo } = require('./models');

// ── Config ────────────────────────────────────────────────────────────────
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces))
    for (const iface of interfaces[name])
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
  return 'localhost';
}

const LOCAL_IP   = getLocalIP();
const PORT       = parseInt(process.env.PORT) || 3000;
const BASE       = '/partywall';
const TUNNEL_URL = process.env.TUNNEL_URL || null;
const JWT_SECRET = process.env.JWT_SECRET  || crypto.randomBytes(32).toString('hex');
const SA_USER    = process.env.SUPER_ADMIN_USER || 'superadmin';
const SA_PASS    = process.env.SUPER_ADMIN_PASS || 'changeme';

// ── Auth ──────────────────────────────────────────────────────────────────
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}
function verifyToken(req) {
  const token = req.headers['x-auth-token'];
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}
function requireSuperAdmin(req, res, next) {
  const p = verifyToken(req);
  if (!p || p.role !== 'superadmin') return res.status(401).json({ error: 'No autorizado' });
  req.user = p; next();
}
function requireOperario(req, res, next) {
  const p = verifyToken(req);
  if (!p || p.role !== 'operario') return res.status(401).json({ error: 'No autorizado' });
  if (req.params.eventId && req.params.eventId !== p.eventId)
    return res.status(403).json({ error: 'Acceso denegado' });
  req.user = p; next();
}
function requireAnyAdmin(req, res, next) {
  const p = verifyToken(req);
  if (!p) return res.status(401).json({ error: 'No autorizado' });
  if (p.role === 'operario' && req.params.eventId && req.params.eventId !== p.eventId)
    return res.status(403).json({ error: 'Acceso denegado' });
  req.user = p; next();
}

// ── Helpers ───────────────────────────────────────────────────────────────
function normalize(photo) {
  if (!photo) return null;
  const p = photo.toJSON ? photo.toJSON() : photo;
  return { ...p, inSlideshow: !!p.in_slideshow };
}

// ── Slideshow state (in-memory timers, per event) ─────────────────────────
const slideshowTimers = new Map();

function getSsState(eventId) {
  if (!slideshowTimers.has(eventId))
    slideshowTimers.set(eventId, { timer: null, interval: 5000, active: false });
  return slideshowTimers.get(eventId);
}

function startSlideshow(eventId) {
  stopSlideshow(eventId);
  const ss = getSsState(eventId);
  let idx = -1;
  ss.active = true;
  ss.timer = setInterval(async () => {
    const photos = await Photo.findAll({
      where:   { event_id: eventId, in_slideshow: true },
      order:   [['timestamp', 'ASC']],
    });
    if (!photos.length) return;
    idx = (idx + 1) % photos.length;
    io.to(`event:${eventId}`).emit('mostrar_foto', normalize(photos[idx]));
  }, ss.interval);
}

function stopSlideshow(eventId) {
  const ss = getSsState(eventId);
  if (ss.timer) { clearInterval(ss.timer); ss.timer = null; }
  ss.active = false;
}

// ── Express + Socket.io ───────────────────────────────────────────────────
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(BASE, express.static('public'));
app.use(`${BASE}/uploads`, express.static('uploads'));
app.use(express.json());
app.get('/', (req, res) => res.redirect(301, `${BASE}/`));

// ── Multer ────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = `uploads/${req.params.eventId}`;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `foto_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo imágenes'));
  }
});

// ── Rate limiting ─────────────────────────────────────────────────────────
const uploadLimits = new Map();
const RL_MAX = 3, RL_WINDOW = 60 * 1000;

function checkUploadLimit(req) {
  const ip    = req.headers['cf-connecting-ip'] || req.ip;
  const key   = `${req.params.eventId}:${ip}`;
  const now   = Date.now();
  const entry = uploadLimits.get(key) || { timestamps: [] };
  entry.timestamps = entry.timestamps.filter(t => now - t < RL_WINDOW);
  if (entry.timestamps.length >= RL_MAX) {
    const retryAfter = Math.ceil((entry.timestamps[0] + RL_WINDOW - now) / 1000);
    uploadLimits.set(key, entry);
    return { allowed: false, retryAfter };
  }
  entry.timestamps.push(now);
  uploadLimits.set(key, entry);
  return { allowed: true };
}

// ── API: Login ────────────────────────────────────────────────────────────
app.post(`${BASE}/api/login`, async (req, res) => {
  const { username, password } = req.body;

  if (username === SA_USER && password === SA_PASS) {
    return res.json({
      success: true,
      token: signToken({ role: 'superadmin', sub: username }),
      role: 'superadmin',
    });
  }

  const event = await Event.findOne({ where: { op_user: username, active: true } });
  if (event && bcrypt.compareSync(password, event.op_pass)) {
    return res.json({
      success: true,
      token: signToken({ role: 'operario', sub: username, eventId: event.id, eventName: event.name }),
      role: 'operario',
      eventId: event.id,
    });
  }

  res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
});

// ── API: SuperAdmin — Events ──────────────────────────────────────────────
app.get(`${BASE}/api/events`, requireSuperAdmin, async (req, res) => {
  const events = await Event.findAll({ order: [['created_at', 'DESC']] });
  const result = await Promise.all(events.map(async e => {
    const photo_count = await Photo.count({ where: { event_id: e.id } });
    return { ...e.toJSON(), photo_count };
  }));
  res.json(result);
});

app.post(`${BASE}/api/events`, requireSuperAdmin, async (req, res) => {
  const { name, date, opUser, opPass } = req.body;
  if (!name || !opUser || !opPass)
    return res.status(400).json({ error: 'Faltan campos: name, opUser, opPass' });

  const id         = crypto.randomBytes(6).toString('hex');
  const hashedPass = bcrypt.hashSync(opPass, 10);

  try {
    await Event.create({ id, name, date: date || null, op_user: opUser, op_pass: hashedPass });
    const event = await Event.findByPk(id);
    res.json({ success: true, event: event.toJSON() });
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError')
      return res.status(409).json({ error: 'El usuario ya existe' });
    console.error(e);
    res.status(500).json({ error: 'Error al crear evento' });
  }
});

app.patch(`${BASE}/api/events/:id`, requireSuperAdmin, async (req, res) => {
  const { name, date, opUser, opPass } = req.body;
  const updates = {};
  if (name)   updates.name    = name;
  if (date)   updates.date    = date;
  if (opUser) updates.op_user = opUser;
  if (opPass) updates.op_pass = bcrypt.hashSync(opPass, 10);

  try {
    await Event.update(updates, { where: { id: req.params.id } });
    const event = await Event.findByPk(req.params.id);
    res.json({ success: true, event: event.toJSON() });
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError')
      return res.status(409).json({ error: 'El usuario ya existe' });
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

app.patch(`${BASE}/api/events/:id/active`, requireSuperAdmin, async (req, res) => {
  await Event.update({ active: !!req.body.active }, { where: { id: req.params.id } });
  res.json({ success: true });
});

app.delete(`${BASE}/api/events/:id`, requireSuperAdmin, async (req, res) => {
  const event = await Event.findByPk(req.params.id);
  if (!event) return res.status(404).json({ error: 'No encontrado' });

  try { fs.rmSync(`uploads/${req.params.id}`, { recursive: true, force: true }); } catch {}
  await event.destroy();
  res.json({ success: true });
});

// ── API: Event (operario + superadmin) ────────────────────────────────────
app.get(`${BASE}/api/e/:eventId/photos`, requireAnyAdmin, async (req, res) => {
  const photos = await Photo.findAll({
    where: { event_id: req.params.eventId },
    order: [['timestamp', 'DESC']],
  });
  res.json(photos.map(normalize));
});

app.get(`${BASE}/api/e/:eventId/qr`, async (req, res) => {
  const event = await Event.findByPk(req.params.eventId);
  if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
  const base = TUNNEL_URL || `http://${LOCAL_IP}:${PORT}`;
  const url  = `${base}${BASE}/e/${req.params.eventId}/guest`;
  const qr   = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#000', light: '#fff' } });
  res.json({ url, qr });
});

app.patch(`${BASE}/api/e/:eventId/photos/:photoId/slideshow`, requireAnyAdmin, async (req, res) => {
  const photo = await Photo.findOne({ where: { id: req.params.photoId, event_id: req.params.eventId } });
  if (!photo) return res.status(404).json({ error: 'No encontrada' });
  await photo.update({ in_slideshow: !photo.in_slideshow });
  io.to(`event:${req.params.eventId}`).emit('foto_actualizada', { id: photo.id, inSlideshow: photo.in_slideshow });
  res.json({ success: true, inSlideshow: photo.in_slideshow });
});

app.delete(`${BASE}/api/e/:eventId/photos/:photoId`, requireAnyAdmin, async (req, res) => {
  const photo = await Photo.findOne({ where: { id: req.params.photoId, event_id: req.params.eventId } });
  if (!photo) return res.status(404).json({ error: 'No encontrada' });
  try { fs.unlinkSync(`uploads/${req.params.eventId}/${photo.filename}`); } catch {}
  await photo.destroy();
  io.to(`event:${req.params.eventId}`).emit('foto_eliminada', { id: req.params.photoId });
  res.json({ success: true });
});

// ── API: Upload (public, rate-limited) ────────────────────────────────────
app.post(`${BASE}/api/e/:eventId/upload`, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Sin archivo' });

  const event = await Event.findByPk(req.params.eventId);
  if (!event || !event.active) {
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(404).json({ error: 'Evento no encontrado o inactivo' });
  }

  const limit = checkUploadLimit(req);
  if (!limit.allowed) {
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(429).json({ error: 'Límite alcanzado', retryAfter: limit.retryAfter });
  }

  const id        = path.basename(req.file.filename, path.extname(req.file.filename));
  const url       = `${BASE}/uploads/${req.params.eventId}/${req.file.filename}`;
  const timestamp = new Date().toISOString();

  const newPhoto = await Photo.create({ id, event_id: req.params.eventId, filename: req.file.filename, url, timestamp });
  const photo    = normalize(newPhoto);

  io.to(`event:${req.params.eventId}`).emit('nueva_foto', photo);
  console.log(`📸 [${req.params.eventId}] ${req.file.filename}`);
  res.json({ success: true, photo });
});

// ── Socket.io ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 ${socket.id}`);

  socket.on('join_event', async ({ eventId, token }) => {
    if (!eventId) return;

    if (token) {
      try {
        const p = jwt.verify(token, JWT_SECRET);
        socket.data.role    = p.role;
        socket.data.eventId = p.eventId || eventId;
      } catch { /* viewer */ }
    }

    socket.join(`event:${eventId}`);
    socket.data.currentEventId = eventId;

    const photos = await Photo.findAll({
      where:  { event_id: eventId },
      order:  [['timestamp', 'DESC']],
      limit:  50,
    });
    const ss = getSsState(eventId);

    socket.emit('estado_inicial', {
      current:   null,
      photos:    photos.map(normalize),
      slideshow: { active: ss.active, interval: ss.interval },
    });
    console.log(`📌 ${socket.id} → event:${eventId}`);
  });

  socket.on('proyectar', ({ eventId, photo }) => {
    if (!canControl(socket, eventId)) return;
    stopSlideshow(eventId);
    io.to(`event:${eventId}`).emit('mostrar_foto', photo);
  });

  socket.on('slideshow_start', ({ eventId, interval }) => {
    if (!canControl(socket, eventId)) return;
    const ss = getSsState(eventId);
    ss.interval = interval || 5000;
    startSlideshow(eventId);
    io.to(`event:${eventId}`).emit('slideshow_estado', { active: true, interval: ss.interval });
  });

  socket.on('slideshow_stop', ({ eventId }) => {
    if (!canControl(socket, eventId)) return;
    stopSlideshow(eventId);
    io.to(`event:${eventId}`).emit('slideshow_estado', { active: false });
  });

  socket.on('disconnect', () => console.log(`❌ ${socket.id}`));
});

function canControl(socket, eventId) {
  const role = socket.data.role;
  if (role === 'superadmin') return true;
  if (role === 'operario' && socket.data.eventId === eventId) return true;
  return false;
}

// ── SPA fallback ──────────────────────────────────────────────────────────
app.get(`${BASE}/*`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Arrancar ──────────────────────────────────────────────────────────────
sequelize.authenticate()
  .then(() => {
    console.log('✅ MySQL conectado');
    return server.listen(PORT, '0.0.0.0', () => {
      const lan = `http://${LOCAL_IP}:${PORT}`;
      console.log('\n╔══════════════════════════════════════════════════════╗');
      console.log('║              🎉 PARTYWALL ACTIVO                     ║');
      console.log('╠══════════════════════════════════════════════════════╣');
      console.log(`║  👑 Super Admin: ${lan}${BASE}/superadmin`);
      console.log(`║  🔑 Login:       ${lan}${BASE}/login`);
      console.log('╚══════════════════════════════════════════════════════╝\n');
    });
  })
  .catch(err => {
    console.error('❌ No se pudo conectar a MySQL:', err.message);
    process.exit(1);
  });
