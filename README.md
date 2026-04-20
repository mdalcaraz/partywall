# Partywall

Sistema de fotobooth SaaS para eventos. Los invitados escanean un QR, sacan fotos desde su celular, y el operario proyecta las imágenes en pantalla en tiempo real.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js + Express + Socket.io |
| Base de datos | MySQL 8 + Sequelize ORM |
| Frontend | React 18 + Vite |
| Proceso | PM2 |
| Deploy | VPS Ubuntu 22.04 |

---

## Estructura del proyecto

```
partywall/
├── config/
│   └── database.js          # Config Sequelize por entorno
├── migrations/              # Migraciones de DB (sequelize-cli)
│   ├── 20260419000001-create-events.js
│   └── 20260419000002-create-photos.js
├── models/
│   ├── index.js             # Conexión Sequelize + asociaciones
│   ├── Event.js             # Modelo de evento
│   └── Photo.js             # Modelo de foto
├── client/                  # Frontend React (Vite)
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── SuperAdminPage.jsx
│       │   ├── AdminPage.jsx
│       │   ├── GuestPage.jsx
│       │   └── DisplayPage.jsx
│       └── lib/
│           ├── api.js       # Auth + fetch helpers
│           └── socket.js    # Socket.io client
├── public/                  # Build del frontend (generado)
├── uploads/                 # Fotos subidas (por eventId)
├── scripts/
│   └── backup.sh            # Script de backup MySQL
├── backups/                 # Backups diarios (no se commitea)
├── server.js                # Servidor principal
├── .env                     # Variables de entorno (no se commitea)
├── .sequelizerc             # Config paths para sequelize-cli
└── package.json
```

---

## Roles y accesos

| Rol | Ruta | Descripción |
|-----|------|-------------|
| Super Admin | `/partywall/superadmin` | Gestiona todos los eventos y operarios |
| Operario | `/partywall/admin` | Controla las fotos de su evento |
| Invitado | `/partywall/e/:eventId/guest` | Saca y sube fotos (público) |
| Display | `/partywall/e/:eventId/display` | Pantalla de proyección (público) |

---

## Variables de entorno (.env)

```ini
NODE_ENV=production

# App
PORT=3000
SUPER_ADMIN_USER=superadmin
SUPER_ADMIN_PASS=topdjgroup2024
JWT_SECRET=<32-byte hex aleatorio>
TUNNEL_URL=https://fotobooth.topdjgroup.com   # URL pública opcional

# MySQL
DB_NAME=partywall
DB_USER=root
DB_PASSWORD=<password>
DB_HOST=127.0.0.1
DB_PORT=3316
```

---

## Comandos npm

```bash
npm start              # Inicia el servidor en producción
npm run dev            # Servidor + Vite dev en paralelo
npm run build          # Compila el frontend React → public/
npm run migrate        # Ejecuta migraciones pendientes
npm run migrate:undo   # Revierte la última migración
```

---

## Primer deploy desde cero

```bash
# 1. Clonar repo
git clone https://github.com/mdalcaraz/partywall.git /opt/partywall
cd /opt/partywall

# 2. Crear .env con las variables de entorno

# 3. Instalar dependencias
npm install

# 4. Compilar frontend
npm run build

# 5. Crear DB en MySQL
mysql -u root -p -e "CREATE DATABASE partywall CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 6. Ejecutar migraciones
npm run migrate

# 7. Iniciar con PM2
pm2 start server.js --name partywall
pm2 save
```

---

## Actualizar en producción (deploy)

```bash
cd /opt/partywall
git pull origin main
npm install
npm run migrate        # solo si hay migraciones nuevas
npm run build          # solo si cambió el frontend
pm2 restart partywall --update-env
```

---

## Infraestructura del VPS

**Servidor:** `66.94.108.215` — Ubuntu 22.04  
**Usuario deploy:** `mdalcaraz`  
**App:** `/opt/partywall`  
**Puerto:** `3000`

### PM2 — arranque automático al bootear

PM2 está configurado como servicio systemd. Al reiniciar el VPS, el proceso `partywall` arranca automáticamente.

```bash
pm2 status              # Ver estado de procesos
pm2 logs partywall      # Ver logs en vivo
pm2 restart partywall   # Reiniciar la app
```

### MySQL

- **Versión:** MySQL 8.0
- **Puerto:** 3316
- **Base de datos:** `partywall`
- **Acceso remoto:** bloqueado (`bind-address = 127.0.0.1`)
- **Backups:** `/opt/partywall/backups/` — retención 30 días

### Tareas programadas (cron root)

| Hora | Tarea |
|------|-------|
| Todos los días 10:00 (Europe/Berlin) | Backup de MySQL → `/opt/partywall/backups/` |
| Miércoles 13:45 (Europe/Berlin) | Reinicio del VPS |

Ver o editar crons:
```bash
sudo crontab -l         # Ver crons de root
sudo crontab -e         # Editar
```

Ver log de backups:
```bash
tail -f /var/log/partywall-backup.log
```

### Backup manual

```bash
sudo /opt/partywall/scripts/backup.sh
```

Los backups se guardan como `partywall_YYYYMMDD_HHMMSS.sql.gz` y se eliminan automáticamente después de 30 días.

Restaurar un backup:

```bash
gunzip -c /opt/partywall/backups/partywall_YYYYMMDD_HHMMSS.sql.gz | mysql -u root -p -P 3316 -h 127.0.0.1 partywall
```

---

## Modelos de base de datos

### events

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | VARCHAR(12) PK | ID aleatorio (6 bytes hex) |
| `name` | VARCHAR | Nombre del evento |
| `date` | VARCHAR | Fecha del evento (opcional) |
| `op_user` | VARCHAR UNIQUE | Usuario del operario |
| `op_pass` | VARCHAR | Contraseña hasheada (bcrypt) |
| `active` | BOOLEAN | Si el evento acepta fotos |
| `created_at` | DATETIME | Fecha de creación |

### photos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | VARCHAR(60) PK | Basado en el nombre del archivo |
| `event_id` | VARCHAR(12) FK | Referencia al evento |
| `filename` | VARCHAR | Nombre del archivo en disco |
| `url` | VARCHAR | Ruta relativa de la imagen |
| `timestamp` | VARCHAR | ISO timestamp de la subida |
| `in_slideshow` | BOOLEAN | Si aparece en el slideshow |

---

## Seguridad

- JWT firmado con secret de 32 bytes, expira en 24h
- Contraseñas de operarios hasheadas con bcrypt (10 rounds)
- MySQL solo acepta conexiones locales (`127.0.0.1`)
- Rate limiting en uploads: 3 fotos por minuto por IP
- Archivos `.env` y `uploads/` excluidos del repositorio
