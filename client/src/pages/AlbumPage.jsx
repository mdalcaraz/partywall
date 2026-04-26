import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { getSocket } from '../lib/socket'
import TermsModal from '../components/TermsModal'
import s from './AlbumPage.module.css'

const BASE = import.meta.env.BASE_URL

function IgIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )
}

export default function AlbumPage() {
  const { eventId } = useParams()
  const [info, setInfo]           = useState(null)
  const [photos, setPhotos]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [showTerms, setShowTerms] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected]   = useState(new Set())
  const socketRef = useRef(null)

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}api/e/${eventId}/album/info`).then(r => r.json()),
      fetch(`${BASE}api/e/${eventId}/album`).then(r => r.json()),
    ]).then(([inf, ph]) => {
      setInfo(inf)
      setPhotos(Array.isArray(ph) ? ph : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [eventId])

  useEffect(() => {
    const socket = getSocket(eventId)
    socketRef.current = socket
    const onNueva     = (photo) => setPhotos(prev => [photo, ...prev])
    const onEliminada = ({ id }) => setPhotos(prev => prev.filter(p => p.id !== id))
    socket.on('nueva_foto',    onNueva)
    socket.on('foto_eliminada', onEliminada)
    return () => {
      socket.off('nueva_foto',    onNueva)
      socket.off('foto_eliminada', onEliminada)
    }
  }, [eventId])

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const cancelSelect = () => { setSelecting(false); setSelected(new Set()) }

  const downloadSelected = () => {
    const ids = [...selected].join(',')
    window.location.href = `${BASE}api/e/${eventId}/album/download?ids=${ids}`
  }

  const downloadAll = () => {
    window.location.href = `${BASE}api/e/${eventId}/album/download`
  }

  if (loading) {
    return (
      <div className={s.loading}>
        <img src={`${BASE}logo.png`} alt="logo" className={s.loadingLogo} />
        <div className={s.spinner} />
      </div>
    )
  }

  const logo = info?.brand_logo_url || `${BASE}logo.png`
  const ig   = info?.brand_instagram

  const dateStr = info?.date
    ? new Date(info.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className={s.page}>
      {/* ── Header ── */}
      <div className={s.header}>
        <div className={s.headerRow}>
          <img src={logo} alt="logo" className={s.logo} />
          <div className={s.headerActions}>
            {photos.length > 0 && !selecting && (
              <>
                <button className={s.btnSelect} onClick={() => setSelecting(true)}>
                  Seleccionar
                </button>
                <button className={s.btnDownloadAll} onClick={downloadAll}>
                  ↓ Descargar todo
                </button>
              </>
            )}
            {selecting && (
              <button className={s.btnCancel} onClick={cancelSelect}>
                ✕ Cancelar
              </button>
            )}
          </div>
        </div>

        {(info?.name || dateStr || info?.location) && (
          <div className={s.headerInfo}>
            {info?.name     && <span className={s.eventName}>{info.name}</span>}
            {dateStr        && <span className={s.eventMeta}>{dateStr}</span>}
            {info?.location && <span className={s.eventMeta}>{info.location}</span>}
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      {photos.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}>📭</div>
          <p>Todavía no hay fotos en este álbum.</p>
        </div>
      ) : (
        <div className={s.grid}>
          {photos.map(photo => {
            const isSelected = selected.has(photo.id)
            return (
              <div
                key={photo.id}
                className={`${s.photoCard} ${selecting ? s.photoCardSelecting : ''} ${isSelected ? s.photoCardSelected : ''}`}
                onClick={selecting ? () => toggleSelect(photo.id) : undefined}
              >
                <img src={photo.url} alt="" loading="lazy" className={s.photoImg} />

                {selecting ? (
                  <div className={s.checkWrap}>
                    <div className={`${s.checkCircle} ${isSelected ? s.checkCircleActive : ''}`}>
                      {isSelected && '✓'}
                    </div>
                  </div>
                ) : (
                  <div className={s.photoOverlay}>
                    <a
                      href={photo.url}
                      download={photo.filename}
                      className={s.btnDownload}
                      onClick={e => e.stopPropagation()}
                    >
                      ↓
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Video próximamente ── */}
      <div className={s.comingSoon}>
        <div className={s.comingSoonIcon}>🎬</div>
        <div className={s.comingSoonText}>
          <span className={s.comingSoonTitle}>Video · Próximamente</span>
          <span className={s.comingSoonSub}>Subí y compartí momentos en video desde la app</span>
        </div>
        <span className={s.comingSoonBadge}>Premium</span>
      </div>

      {/* ── Footer ── */}
      <footer className={s.footer}>
        {ig && (
          <a href={`https://www.instagram.com/${ig}`} target="_blank" rel="noreferrer" className={s.igLink}>
            <IgIcon /> @{ig}
          </a>
        )}
        <span className={s.terms}>
          Al usar esta app aceptás nuestros{' '}
          <button className={s.termsLink} onClick={() => setShowTerms(true)}>Términos y Condiciones</button>
        </span>
      </footer>

      {/* ── Selection action bar ── */}
      {selecting && (
        <div className={s.selectBar}>
          <span className={s.selectBarCount}>
            {selected.size === 0
              ? 'Tocá las fotos para elegir'
              : `${selected.size} foto${selected.size !== 1 ? 's' : ''} seleccionada${selected.size !== 1 ? 's' : ''}`}
          </span>
          <button
            className={s.btnDownloadSelected}
            onClick={downloadSelected}
            disabled={selected.size === 0}
          >
            ↓ Descargar{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        </div>
      )}

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
    </div>
  )
}
