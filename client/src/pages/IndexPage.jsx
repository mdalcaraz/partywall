import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import s from './IndexPage.module.css'

export default function IndexPage() {
  const navigate = useNavigate()
  const [qr, setQr] = useState(null)
  const [ip, setIp] = useState('')

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/qr`)
      .then((r) => r.json())
      .then((data) => {
        setQr(data.qr)
        const match = data.url.match(/https?:\/\/([^/]+)/)
        if (match) setIp(match[1])
      })
  }, [])

  return (
    <div className={s.page}>
      <div className={s.header}>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Top DJ Group" className={s.logo} />
        <div className={s.tagline}>Partywall · Panel de control</div>
      </div>

      <div className={s.grid}>
        <div className={s.card} onClick={() => navigate('/admin')}>
          <div className={s.cardIcon}>🎛</div>
          <div className={s.cardTitle}>Admin</div>
          <div className={s.cardDesc}>Ver fotos recibidas, elegir cuál proyectar y controlar el slideshow.</div>
          <div className={s.cardBadge}>Operador</div>
        </div>

        <div className={s.card} onClick={() => navigate('/display')}>
          <div className={s.cardIcon}>📽</div>
          <div className={s.cardTitle}>Proyector</div>
          <div className={s.cardDesc}>Pantalla completa para el proyector. Click para activar fullscreen.</div>
          <div className={s.cardBadge}>Proyector</div>
        </div>

        <div className={s.card} onClick={() => navigate('/guest')}>
          <div className={s.cardIcon}>📸</div>
          <div className={s.cardTitle}>Cámara</div>
          <div className={s.cardDesc}>Interfaz para los invitados. Se accede escaneando el QR desde el celular.</div>
          <div className={s.cardBadge}>Invitados</div>
        </div>
      </div>

      {qr && (
        <div className={s.qrSection}>
          <div className={s.qrLabel}>QR para invitados</div>
          <div className={s.qrWrap}>
            <img src={qr} alt="QR" className={s.qrImg} />
          </div>
          <div className={s.qrUrl}>
            <span className={s.qrUrlText}>
              {ip ? `https://${ip}/guest` : 'Cargando...'}
            </span>
            <span className={s.qrNote}>
              Los celulares deben aceptar el certificado la primera vez
            </span>
          </div>
        </div>
      )}

      <footer className={s.footer}>
        <a
          href="https://www.instagram.com/topdjgroup/"
          target="_blank"
          rel="noreferrer"
          className={s.igLink}
        >
          <span>📷</span> @topdjgroup
        </a>
        <span className={s.trademark}>Top DJ Group® es una marca registrada — Mendoza, Argentina</span>
      </footer>
    </div>
  )
}
