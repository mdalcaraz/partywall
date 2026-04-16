# 📸 Foto Booth LAN

Sistema de foto booth para eventos en red local (LAN). Los invitados sacan fotos con su celular vía QR y el admin selecciona cuáles se proyectan.

---

## ⚡ Instalación rápida (Windows)

1. **Instalar Node.js** → https://nodejs.org (versión LTS)
2. Extraer esta carpeta en el escritorio
3. Ejecutar **`INSTALAR.bat`** (una sola vez)
4. Para arrancar el servidor: **`INICIAR.bat`**

---

## 🖥 Flujo de uso

```
1. Arrancar INICIAR.bat
2. Abrir /display en el proyector (pantalla completa con F11)
3. Abrir /admin en otra ventana del mismo PC
4. El admin comparte el QR de la pantalla de admin a los invitados
   (o imprimirlo antes del evento)
5. Los invitados escanean el QR con su celular, sacan fotos
6. El admin ve las fotos en tiempo real y hace click en "Proyectar"
```

---

## 📍 URLs

Una vez corriendo, el servidor muestra las IPs en la consola:

| Pantalla | URL | Para quién |
|---|---|---|
| Cámara | `https://192.168.X.X:3000/guest` | Invitados (vía QR) |
| Admin | `https://192.168.X.X:3000/admin` | Organizador |
| Proyector | `https://192.168.X.X:3000/display` | Pantalla conectada al proyector |

---

## ⚠️ Certificado autofirmado (importante)

El servidor usa HTTPS con un certificado autofirmado para poder acceder a la cámara del celular. La primera vez que se abra en el celular va a aparecer una advertencia de "conexión no segura". Esto es normal.

**Para aceptarlo en Android/Chrome:**
1. Abrir la URL del QR
2. Tocar "Configuración avanzada"
3. Tocar "Continuar de todas formas"

**Para aceptarlo en iPhone/Safari:**
1. Abrir la URL del QR
2. Tocar "Mostrar detalles"
3. Tocar "visitar este sitio web"
4. Confirmar en Ajustes si lo pide

---

## 📦 Stack técnico

- **Backend**: Node.js + Express + Socket.io
- **Upload**: Multer (hasta 15MB por foto)
- **HTTPS**: `selfsigned` (certificado autogenerado en cada arranque)
- **QR**: `qrcode` (generado automáticamente con la IP local)
- **Frontend**: HTML/CSS/JS vanilla (sin frameworks)

---

## 🎛 Funciones del Admin

- Ver fotos en tiempo real a medida que llegan
- Proyectar foto individual con un click
- Apagar pantalla (modo negro)
- **Slideshow automático** con intervalos de 3/5/10/15 segundos
- Eliminar fotos individuales o todas
- QR para compartir con invitados

---

## 💡 Tips para el evento

- Conectar el PC a un buen router WiFi mesh (o access point dedicado)
- Abrir `/display` en pantalla completa con **F11** antes de conectar el proyector
- Imprimir el QR con anticipación o tenerlo en una pantalla secundaria
- Las fotos se guardan en la carpeta `uploads/` — respaldarlas al finalizar

---

## 🔧 Configuración avanzada

Cambiar puerto en `server.js`:
```js
const PORT = 3000; // cambiar acá
```

Cambiar tamaño máximo de foto:
```js
limits: { fileSize: 15 * 1024 * 1024 } // en bytes
```
