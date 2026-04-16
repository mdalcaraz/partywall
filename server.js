require('dotenv').config();
const http    = require('http');
const express = require('express');
const { Server } = require('socket.io');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const QRCode  = require('qrcode');
const os      = require('os');

// ── Config ────────────────────────────────────────────────────────────────
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces))
    for (const iface of interfaces[name])
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
  return 'localhost';
}

const LOCAL_IP   = getLocalIP();
const PORT       = 3000;
const BASE       = '/fotobooth';
const TUNNEL_URL = process.env.TUNNEL_URL || null;

// ── Auth ──────────────────────────────────────────────────────────────────
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'topdjgroup';
// Token generado al arrancar — cambia con cada reinicio
const SESSION_TOKEN = require('crypto').randomBytes(32).toString('hex');

function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (token === SESSION_TOKEN) return next();
  res.status(401).json({ error: 'No autorizado' });
}

// ── Asegurar carpeta uploads ──────────────────────────────────────────────
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// ── Express + Socket.io ───────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

// ── Multer ────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: 'uploads/',
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

// ── Estado en memoria ─────────────────────────────────────────────────────
let photos         = [];
let currentDisplay = null;
let slideshow      = { active: false, interval: 5000, timer: null };

// Las URLs de las fotos incluyen el base path para que el cliente las cargue bien
try {
  const files = fs.readdirSync('uploads').filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  photos = files.map(f => ({
    id:          path.basename(f, path.extname(f)),
    filename:    f,
    url:         `${BASE}/uploads/${f}`,
    timestamp:   fs.statSync(`uploads/${f}`).mtime.toISOString(),
    inSlideshow: true
  })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  console.log(`📷 ${photos.length} foto(s) preexistente(s) cargadas`);
} catch (e) {}

// ── Estáticos bajo /fotobooth ─────────────────────────────────────────────
app.use(BASE, express.static('public'));
app.use(`${BASE}/uploads`, express.static('uploads'));
app.use(express.json());

// Redirigir raíz → /fotobooth
app.get('/', (req, res) => res.redirect(301, `${BASE}/`));

// ── API: Login ────────────────────────────────────────────────────────────
app.post(`${BASE}/api/login`, (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.json({ success: true, token: SESSION_TOKEN });
  } else {
    res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
  }
});

// ── API ───────────────────────────────────────────────────────────────────
app.post(`${BASE}/api/upload`, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Sin archivo' });

  const photo = {
    id:          path.basename(req.file.filename, path.extname(req.file.filename)),
    filename:    req.file.filename,
    url:         `${BASE}/uploads/${req.file.filename}`,
    timestamp:   new Date().toISOString(),
    inSlideshow: true
  };

  photos.unshift(photo);
  io.emit('nueva_foto', photo);
  console.log(`📸 Nueva foto: ${photo.filename}`);
  res.json({ success: true, photo });
});

app.get(`${BASE}/api/photos`,  requireAuth, (req, res) => res.json(photos));
app.get(`${BASE}/api/display`, requireAuth, (req, res) => res.json({ current: currentDisplay, slideshow }));

app.get(`${BASE}/api/qr`, async (req, res) => {
  const base = TUNNEL_URL || `http://${LOCAL_IP}:${PORT}`;
  const url  = `${base}${BASE}/guest`;
  const qr   = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#000', light: '#fff' } });
  res.json({ url, qr });
});

app.patch(`${BASE}/api/photos/:id/slideshow`, requireAuth, (req, res) => {
  const { id } = req.params;
  const photo = photos.find(p => p.id === id);
  if (!photo) return res.status(404).json({ error: 'No encontrada' });
  photo.inSlideshow = !photo.inSlideshow;
  io.emit('foto_actualizada', { id: photo.id, inSlideshow: photo.inSlideshow });
  res.json({ success: true, inSlideshow: photo.inSlideshow });
});

app.delete(`${BASE}/api/photos/:id`, requireAuth, (req, res) => {
  const { id } = req.params;
  const idx = photos.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrada' });

  const photo = photos[idx];
  try { fs.unlinkSync(`uploads/${photo.filename}`); } catch (e) {}
  photos.splice(idx, 1);
  io.emit('foto_eliminada', { id });
  res.json({ success: true });
});

// ── Socket.io ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Conectado: ${socket.id}`);
  socket.emit('estado_inicial', { current: currentDisplay, photos: photos.slice(0, 50) });

  socket.on('proyectar', (data) => {
    currentDisplay = data;
    stopSlideshow();
    io.emit('mostrar_foto', data);
  });

  socket.on('slideshow_start', ({ interval }) => {
    slideshow.interval = interval || 5000;
    slideshow.active = true;
    startSlideshow();
    io.emit('slideshow_estado', { active: true, interval: slideshow.interval });
  });

  socket.on('slideshow_stop', () => {
    stopSlideshow();
    io.emit('slideshow_estado', { active: false });
  });

  socket.on('disconnect', () => console.log(`❌ Desconectado: ${socket.id}`));
});

// ── Slideshow ─────────────────────────────────────────────────────────────
function startSlideshow() {
  stopSlideshow();
  const eligible = photos.filter(p => p.inSlideshow);
  if (eligible.length === 0) return;
  let idx = currentDisplay ? eligible.findIndex(p => p.id === currentDisplay.id) : -1;
  slideshow.timer = setInterval(() => {
    const current = photos.filter(p => p.inSlideshow);
    if (current.length === 0) return;
    idx = (idx + 1) % current.length;
    currentDisplay = current[idx];
    io.emit('mostrar_foto', currentDisplay);
  }, slideshow.interval);
}

function stopSlideshow() {
  if (slideshow.timer) { clearInterval(slideshow.timer); slideshow.timer = null; }
  slideshow.active = false;
}

// ── SPA fallback — cualquier ruta bajo /fotobooth sirve el index.html ─────
app.get(`${BASE}/*`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Arrancar ──────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const pub  = TUNNEL_URL || `http://${LOCAL_IP}:${PORT}`;
  const lan  = `http://${LOCAL_IP}:${PORT}`;

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║              🎉 FOTOBOOTH ACTIVO                     ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  📱 Invitados:  ${pub}${BASE}/guest`);
  console.log(`║  🎛️  Admin:     ${lan}${BASE}/admin`);
  console.log(`║  📽️  Proyector: ${lan}${BASE}/display`);
  console.log('╚══════════════════════════════════════════════════════╝\n');
});
