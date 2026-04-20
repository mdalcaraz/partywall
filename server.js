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
const { q }   = require('./db');

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

// ── Slideshow state (in-memory timers, per event) ─────────────────────────
const slideshowTimers = new Map(); // eventId → { timer, interval, active }

function getSsState(eventId) {
  if (!slideshowTimers.has(eventId))
    slideshowTimers.set(eventId, { timer: null, interval: 5000, active: false });
  return slideshowTimers.get(eventId);
}

function startSlideshow(eventId) {
  stopSlideshow(eventId);
  const ss = getSsState(eventId);
  const eligible = q.getSlideshowPhotos.all(eventId);
  if (!eligible.length) return;
  let idx = -1;
  ss.active = true;
  ss.timer = setInterval(() => {
    const current = q.getSlideshowPhotos.all(eventId);
    if (!current.length) return;
    idx = (idx + 1) % current.length;
    const photo = current[idx];
    io.to(`event:${eventId}`).emit('mostrar_foto', normalize(photo));
  }, ss.interval);
}

function stopSlideshow(eventId) {
  const ss = getSsState(eventId);
  if (ss.timer) { clearInterval(ss.timer); ss.timer = null; }
  ss.active = false;
}

function normalize(photo) {
  if (!photo) return null;
  return { ...photo, inSlideshow: photo.in_slideshow === 1 };
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
  const ip  = req.headers['cf-connecting-ip'] || req.ip;
  const key = `${req.params.eventId}:${ip}`;
  const now = Date.now();
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
app.post(`${BASE}/api/login`, (req, res) => {
  const { username, password } = req.body;

  if (username === SA_USER && password === SA_PASS) {
    return res.json({
      success: true,
      token: signToken({ role: 'superadmin', sub: username }),
      role: 'superadmin'
    });
  }

  const event = q.getEventByUser.get(username);
  if (event && bcrypt.compareSync(password, event.op_pass)) {
    return res.json({
      success: true,
      token: signToken({ role: 'operario', sub: username, eventId: event.id, eventName: event.name }),
      role: 'operario',
      eventId: event.id
    });
  }

  res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
});

// ── API: SuperAdmin — Events ──────────────────────────────────────────────
app.get(`${BASE}/api/events`, requireSuperAdmin, (req, res) => {
  res.json(q.listEvents.all());
});

app.post(`${BASE}/api/events`, requireSuperAdmin, (req, res) => {
  const { name, date, opUser, opPass } = req.body;
  if (!name || !opUser || !opPass)
    return res.status(400).json({ error: 'Faltan campos: name, opUser, opPass' });

  const id         = crypto.randomBytes(6).toString('hex');
  const hashedPass = bcrypt.hashSync(opPass, 10);

  try {
    q.createEvent.run(id, name, date || null, opUser, hashedPass);
    res.json({ success: true, event: q.getEventById.get(id) });
  } catch (e) {
    if (e.message.includes('UNIQUE'))
      return res.status(409).json({ error: 'El usuario ya existe' });
    res.status(500).json({ error: 'Error al crear evento' });
  }
});

app.patch(`${BASE}/api/events/:id`, requireSuperAdmin, (req, res) => {
  const { name, date, opUser, opPass } = req.body;
  const hashedPass = opPass ? bcrypt.hashSync(opPass, 10) : null;
  try {
    q.updateEvent.run(name || null, date || null, opUser || null, hashedPass, req.params.id);
    res.json({ success: true, event: q.getEventById.get(req.params.id) });
  } catch (e) {
    if (e.message.includes('UNIQUE'))
      return res.status(409).json({ error: 'El usuario ya existe' });
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

app.patch(`${BASE}/api/events/:id/active`, requireSuperAdmin, (req, res) => {
  q.setEventActive.run(req.body.active ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete(`${BASE}/api/events/:id`, requireSuperAdmin, (req, res) => {
  const event = q.getEventById.get(req.params.id);
  if (!event) return res.status(404).json({ error: 'No encontrado' });

  try { fs.rmSync(`uploads/${req.params.id}`, { recursive: true, force: true }); } catch {}
  q.deleteEvent.run(req.params.id);
  res.json({ success: true });
});

// ── API: Event (operario + superadmin) ───────────────────────────────────
app.get(`${BASE}/api/e/:eventId/photos`, requireAnyAdmin, (req, res) => {
  res.json(q.getPhotos.all(req.params.eventId).map(normalize));
});

app.get(`${BASE}/api/e/:eventId/qr`, (req, res) => {
  const event = q.getEventById.get(req.params.eventId);
  if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
  const base = TUNNEL_URL || `http://${LOCAL_IP}:${PORT}`;
  const url  = `${base}${BASE}/e/${req.params.eventId}/guest`;
  QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#000', light: '#fff' } })
    .then(qr => res.json({ url, qr }));
});

app.patch(`${BASE}/api/e/:eventId/photos/:photoId/slideshow`, requireAnyAdmin, (req, res) => {
  const photo = q.getPhoto.get(req.params.photoId, req.params.eventId);
  if (!photo) return res.status(404).json({ error: 'No encontrada' });
  q.toggleSlideshow.run(req.params.photoId, req.params.eventId);
  const updated = q.getPhoto.get(req.params.photoId, req.params.eventId);
  io.to(`event:${req.params.eventId}`).emit('foto_actualizada', {
    id: updated.id, inSlideshow: updated.in_slideshow === 1
  });
  res.json({ success: true, inSlideshow: updated.in_slideshow === 1 });
});

app.delete(`${BASE}/api/e/:eventId/photos/:photoId`, requireAnyAdmin, (req, res) => {
  const photo = q.getPhoto.get(req.params.photoId, req.params.eventId);
  if (!photo) return res.status(404).json({ error: 'No encontrada' });
  try { fs.unlinkSync(`uploads/${req.params.eventId}/${photo.filename}`); } catch {}
  q.deletePhoto.run(req.params.photoId, req.params.eventId);
  io.to(`event:${req.params.eventId}`).emit('foto_eliminada', { id: req.params.photoId });
  res.json({ success: true });
});

// ── API: Upload (public, rate-limited) ────────────────────────────────────
app.post(`${BASE}/api/e/:eventId/upload`, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Sin archivo' });

  const event = q.getEventById.get(req.params.eventId);
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

  q.addPhoto.run(id, req.params.eventId, req.file.filename, url, timestamp);
  const photo = normalize(q.getPhoto.get(id, req.params.eventId));

  io.to(`event:${req.params.eventId}`).emit('nueva_foto', photo);
  console.log(`📸 [${req.params.eventId}] ${req.file.filename}`);
  res.json({ success: true, photo });
});

// ── Socket.io ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 ${socket.id}`);

  socket.on('join_event', ({ eventId, token }) => {
    if (!eventId) return;

    // Verify role if token provided
    if (token) {
      try {
        const p = jwt.verify(token, JWT_SECRET);
        socket.data.role    = p.role;
        socket.data.eventId = p.eventId || eventId;
      } catch { /* viewer */ }
    }

    socket.join(`event:${eventId}`);
    socket.data.currentEventId = eventId;

    const photos    = q.getPhotos.all(eventId).slice(0, 50).map(normalize);
    const ss        = getSsState(eventId);

    socket.emit('estado_inicial', {
      current:   null,
      photos,
      slideshow: { active: ss.active, interval: ss.interval }
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
server.listen(PORT, '0.0.0.0', () => {
  const lan = `http://${LOCAL_IP}:${PORT}`;
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║           🎉 FOTOBOOTH SaaS ACTIVO                   ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  👑 Super Admin: ${lan}${BASE}/superadmin`);
  console.log(`║  🔑 Login:       ${lan}${BASE}/login`);
  console.log('╚══════════════════════════════════════════════════════╝\n');
});
