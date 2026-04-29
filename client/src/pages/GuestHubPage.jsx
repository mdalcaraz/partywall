import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import s from './GuestHubPage.module.css'

const BASE = import.meta.env.BASE_URL

export default function GuestHubPage() {
  const { eventId } = useParams()
  const [info, setInfo] = useState(null)

  useEffect(() => {
    fetch(`${BASE}api/e/${eventId}/hub`)
      .then(r => r.json())
      .then(setInfo)
      .catch(() => {})
  }, [eventId])

  const links = [
    { to: `${BASE}e/${eventId}/guest`,  emoji: '📸', label: 'Subir foto',    sub: 'Aparece en la pantalla del evento' },
    { to: `${BASE}e/${eventId}/music`,  emoji: '🎵', label: 'Pedir canción', sub: 'Pedile una canción al DJ',         show: info?.music_enabled },
    { to: `${BASE}e/${eventId}/album`,  emoji: '🖼', label: 'Ver álbum',     sub: 'Todas las fotos del evento' },
  ].filter(l => l.show !== false)

  const logo  = info?.brand_logo_url || `${BASE}logo.png`
  const brand = info?.brand_instagram || '@topdjgroup'

  return (
    <div className={s.page}>
      <div className={s.glow} />

      <div className={s.content}>
        <header className={s.header}>
          <img src={logo} alt={info?.brand_name || 'Top DJ Group'} className={s.logo} />
          {info?.name && <h1 className={s.eventName}>{info.name}</h1>}
          {(info?.date || info?.location) && (
            <p className={s.eventMeta}>
              {info.date && new Date(info.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {info.date && info.location && ' · '}
              {info.location}
            </p>
          )}
        </header>

        <nav className={s.links}>
          {links.map(link => (
            <a key={link.to} href={link.to} className={s.link}>
              <span className={s.linkEmoji}>{link.emoji}</span>
              <span className={s.linkText}>
                <span className={s.linkLabel}>{link.label}</span>
                <span className={s.linkSub}>{link.sub}</span>
              </span>
              <span className={s.linkArrow}>›</span>
            </a>
          ))}
        </nav>

        <footer className={s.footer}>
          <a
            href={`https://instagram.com/${brand.replace('@', '')}`}
            target="_blank"
            rel="noreferrer"
            className={s.igLink}
          >
            {brand}
          </a>
        </footer>
      </div>
    </div>
  )
}
