import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authFetch, clearToken } from '../lib/api'
import s from './SuperAdminPage.module.css'

const BASE = import.meta.env.BASE_URL

const emptyForm = {
  name: '', date: '',
  location: '', address: '',
  opUser: '', opPass: '',
  photoLimit: 3, photoWindow: 60,
  musicLimit: 10, musicWindow: 600,
  brandName: '', brandLogoUrl: '', brandInstagram: '',
}

function formatDateAR(dateStr) {
  if (!dateStr) return '—'
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export default function SuperAdminPage() {
  const navigate = useNavigate()
  const [events, setEvents]   = useState([])
  const [form, setForm]       = useState(emptyForm)
  const [editId, setEditId]   = useState(null)
  const [view, setView]       = useState('list') // 'list' | 'form'
  const [loading, setLoading] = useState(false)
  const [toast, setToast]     = useState({ msg: '', err: false, v: false })
  let toastTimer = null

  const logout = () => { clearToken(); navigate('/login', { replace: true }) }

  const load = () => {
    authFetch(`${BASE}api/events`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setEvents(data)
    })
  }

  useEffect(() => { load() }, [])

  const showToast = (msg, err = false) => {
    clearTimeout(toastTimer)
    setToast({ msg, err, v: true })
    toastTimer = setTimeout(() => setToast(t => ({ ...t, v: false })), 2800)
  }

  const set    = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  const setNum = (key) => (e) => setForm(f => ({ ...f, [key]: Number(e.target.value) }))

  const openCreate = () => { setForm(emptyForm); setEditId(null); setView('form') }
  const openEdit   = (ev) => {
    setForm({
      name:           ev.name           || '',
      date:           ev.date           || '',
      location:       ev.location       || '',
      address:        ev.address        || '',
      opUser:         ev.op_user        || '',
      opPass:         '',
      photoLimit:     ev.photo_limit    ?? 3,
      photoWindow:    ev.photo_window   ?? 60,
      musicLimit:     ev.music_limit    ?? 10,
      musicWindow:    ev.music_window   ?? 600,
      brandName:      ev.brand_name     || '',
      brandLogoUrl:   ev.brand_logo_url || '',
      brandInstagram: ev.brand_instagram|| '',
    })
    setEditId(ev.id)
    setView('form')
  }
  const closeForm = () => { setView('list'); setEditId(null); setForm(emptyForm) }

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const body = {
      name:           form.name,
      date:           form.date           || null,
      opUser:         form.opUser,
      opPass:         form.opPass,
      location:       form.location       || null,
      address:        form.address        || null,
      photoLimit:     Number(form.photoLimit),
      photoWindow:    Number(form.photoWindow),
      musicLimit:     Number(form.musicLimit),
      musicWindow:    Number(form.musicWindow),
      brandName:      form.brandName      || null,
      brandLogoUrl:   form.brandLogoUrl   || null,
      brandInstagram: form.brandInstagram || null,
    }
    const url    = editId ? `${BASE}api/events/${editId}` : `${BASE}api/events`
    const method = editId ? 'PATCH' : 'POST'
    const res    = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data   = await res.json()
    setLoading(false)
    if (!res.ok) { showToast(data.error || 'Error', true); return }
    showToast(editId ? 'Evento actualizado' : 'Evento creado')
    closeForm()
    load()
  }

  const toggleActive = async (ev) => {
    await authFetch(`${BASE}api/events/${ev.id}/active`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !ev.active }),
    })
    load()
  }

  const toggleMusic = async (ev) => {
    await authFetch(`${BASE}api/events/${ev.id}/music`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !ev.music_enabled }),
    })
    showToast(ev.music_enabled ? 'Música desactivada' : 'Música activada')
    load()
  }

  const toggleVideo = async (ev) => {
    await authFetch(`${BASE}api/events/${ev.id}/video`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !ev.video_enabled }),
    })
    showToast(ev.video_enabled ? 'Video desactivado' : 'Video activado')
    load()
  }

  const deleteEvent = async (ev) => {
    if (!confirm(`¿Eliminar el evento "${ev.name}" y todas sus fotos?`)) return
    await authFetch(`${BASE}api/events/${ev.id}`, { method: 'DELETE' })
    showToast('Evento eliminado')
    load()
  }

  const hubUrl     = (id) => `${window.location.origin}${BASE}e/${id}`
  const guestUrl   = (id) => `${window.location.origin}${BASE}e/${id}/guest`
  const displayUrl = (id) => `${window.location.origin}${BASE}e/${id}/display`
  const musicUrl   = (id) => `${window.location.origin}${BASE}e/${id}/music`

  return (
    <div className={s.page}>
      {/* ── Topbar ── */}
      <div className={s.topbar}>
        <img src={`${BASE}logo.png`} alt="Top DJ Group" className={s.logo} />
        <div className={s.title}>Super Admin</div>
        <div className={s.spacer} />
        {view === 'list' ? (
          <button className={s.btnNew} onClick={openCreate}>+ Nuevo evento</button>
        ) : (
          <button className={s.btnBack} onClick={closeForm}>← Volver</button>
        )}
        <button className={s.btnLogout} onClick={logout}>⎋ Salir</button>
      </div>

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div className={s.content}>
          {events.length === 0 ? (
            <div className={s.empty}>
              <div className={s.emptyIcon}>🎉</div>
              <p>No hay eventos aún. Creá el primero.</p>
            </div>
          ) : (
            <div className={s.table}>
              <div className={s.thead}>
                <span>Evento</span>
                <span>Fecha</span>
                <span>Operario</span>
                <span>Fotos</span>
                <span>Estado</span>
                <span>Música</span>
                <span>Video</span>
                <span>Acciones</span>
              </div>
              {events.map((ev) => (
                <div key={ev.id} className={`${s.row} ${ev.active ? s.rowActive : s.rowInactive}`}>
                  <span className={s.cellName}>
                    {ev.name}
                    {ev.location && <span className={s.cellSub}>{ev.location}</span>}
                  </span>
                  <span className={s.cellDate}>{formatDateAR(ev.date)}</span>
                  <span className={s.cellUser}>{ev.op_user}</span>
                  <span className={s.cellCount}>{ev.photo_count ?? 0}</span>
                  <span>
                    <button className={`${s.pill} ${ev.active ? s.pillOn : s.pillOff}`} onClick={() => toggleActive(ev)}>
                      {ev.active ? 'Activo' : 'Inactivo'}
                    </button>
                  </span>
                  <span>
                    <button
                      className={`${s.pill} ${ev.music_enabled ? s.pillMusic : s.pillOff}`}
                      onClick={() => toggleMusic(ev)}
                      title={ev.music_enabled ? 'Desactivar música' : 'Activar música'}
                    >
                      {ev.music_enabled ? '🎵 On' : '🎵 Off'}
                    </button>
                  </span>
                  <span>
                    <button
                      className={`${s.pill} ${ev.video_enabled ? s.pillVideo : s.pillOff}`}
                      onClick={() => toggleVideo(ev)}
                      title={ev.video_enabled ? 'Desactivar video' : 'Activar video'}
                    >
                      {ev.video_enabled ? '🎬 On' : '🎬 Off'}
                    </button>
                  </span>
                  <span className={s.cellActions}>
                    <button className={s.btnIcon} title="Editar" onClick={() => openEdit(ev)}>✏️</button>
                    <a className={s.btnIcon} href={`${BASE}admin/${ev.id}`} target="_blank" rel="noreferrer" title="Panel admin">🎛️</a>
                    <a className={`${s.btnIcon} ${s.btnHub}`} href={hubUrl(ev.id)} target="_blank" rel="noreferrer" title="Hub de invitados">🔗</a>
                    <a className={s.btnIcon} href={displayUrl(ev.id)} target="_blank" rel="noreferrer" title="Display">📽️</a>
                    {ev.music_enabled && <a className={s.btnIcon} href={musicUrl(ev.id)} target="_blank" rel="noreferrer" title="Música">🎵</a>}
                    <button className={`${s.btnIcon} ${s.btnDel}`} title="Eliminar" onClick={() => deleteEvent(ev)}>🗑</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FORM VIEW ── */}
      {view === 'form' && (
        <div className={s.formPage}>
          <div className={s.formWrap}>
            <div className={s.formPageTitle}>
              {editId ? 'Editar evento' : 'Nuevo evento'}
            </div>

            <form onSubmit={submit} className={s.form}>

              {/* ── Evento ── */}
              <div className={s.formSection}>Evento</div>
              <div className={s.row2}>
                <div>
                  <label className={s.label}>Nombre del evento *</label>
                  <input className={s.input} value={form.name} onChange={set('name')} required />
                </div>
                <div>
                  <label className={s.label}>Fecha</label>
                  <input className={s.input} type="date" value={form.date} onChange={set('date')} />
                </div>
              </div>

              {/* ── Lugar ── */}
              <div className={s.formSection}>Lugar</div>
              <div className={s.row2}>
                <div>
                  <label className={s.label}>Nombre del lugar</label>
                  <input className={s.input} placeholder="Ej: Salón El Dorado" value={form.location} onChange={set('location')} />
                </div>
                <div>
                  <label className={s.label}>Dirección</label>
                  <input className={s.input} placeholder="Ej: Av. Corrientes 1234" value={form.address} onChange={set('address')} />
                </div>
              </div>

              {/* ── Operario ── */}
              <div className={s.formSection}>Operario</div>
              <div className={s.row2}>
                <div>
                  <label className={s.label}>Usuario *</label>
                  <input className={s.input} value={form.opUser} onChange={set('opUser')} required />
                </div>
                <div>
                  <label className={s.label}>{editId ? 'Contraseña (vacío = sin cambios)' : 'Contraseña *'}</label>
                  <input className={s.input} type="password" value={form.opPass} onChange={set('opPass')} required={!editId} />
                </div>
              </div>

              {/* ── Límites de fotos ── */}
              <div className={s.formSection}>Límites — Fotos</div>
              <div className={s.row2}>
                <div>
                  <label className={s.label}>Máx. fotos por cliente</label>
                  <input className={s.input} type="number" min="1" max="50" value={form.photoLimit} onChange={setNum('photoLimit')} />
                </div>
                <div>
                  <label className={s.label}>Ventana de tiempo (segundos)</label>
                  <input className={s.input} type="number" min="10" max="3600" value={form.photoWindow} onChange={setNum('photoWindow')} />
                </div>
              </div>

              {/* ── Límites de música ── */}
              <div className={s.formSection}>Límites — Música</div>
              <div className={s.row2}>
                <div>
                  <label className={s.label}>Máx. pedidos por cliente</label>
                  <input className={s.input} type="number" min="1" max="100" value={form.musicLimit} onChange={setNum('musicLimit')} />
                </div>
                <div>
                  <label className={s.label}>Ventana de tiempo (segundos)</label>
                  <input className={s.input} type="number" min="60" max="7200" value={form.musicWindow} onChange={setNum('musicWindow')} />
                </div>
              </div>

              {/* ── Marca ── */}
              <div className={s.formSection}>Marca</div>
              <div>
                <label className={s.label}>Nombre de la empresa</label>
                <input className={s.input} placeholder="Top DJ Group" value={form.brandName} onChange={set('brandName')} />
              </div>
              <div className={s.row2}>
                <div>
                  <label className={s.label}>URL del logo</label>
                  <input className={s.input} type="url" placeholder="https://…/logo.png" value={form.brandLogoUrl} onChange={set('brandLogoUrl')} />
                </div>
                <div>
                  <label className={s.label}>Instagram (sin @)</label>
                  <input className={s.input} placeholder="topdjgroup" value={form.brandInstagram} onChange={set('brandInstagram')} />
                </div>
              </div>
              {form.brandLogoUrl && (
                <div className={s.logoPreview}>
                  <img src={form.brandLogoUrl} alt="preview" onError={e => e.target.style.display='none'} />
                  <span>Preview del logo</span>
                </div>
              )}

              <div className={s.formActions}>
                <button type="button" className={s.btnCancel} onClick={closeForm}>Cancelar</button>
                <button type="submit" className={s.btnSubmit} disabled={loading}>{loading ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className={`${s.toast} ${toast.v ? s.toastShow : ''} ${toast.err ? s.toastErr : ''}`}>{toast.msg}</div>
    </div>
  )
}
