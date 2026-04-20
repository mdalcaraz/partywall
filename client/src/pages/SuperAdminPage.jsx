import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authFetch, clearToken } from '../lib/api'
import s from './SuperAdminPage.module.css'

const BASE = import.meta.env.BASE_URL

const emptyForm = { name: '', date: '', opUser: '', opPass: '' }

export default function SuperAdminPage() {
  const navigate = useNavigate()
  const [events, setEvents]     = useState([])
  const [form, setForm]         = useState(emptyForm)
  const [editId, setEditId]     = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [toast, setToast]       = useState({ msg: '', err: false, v: false })
  let toastTimer = null

  const logout = () => { clearToken(); navigate('/login', { replace: true }) }

  const load = () => {
    authFetch(`${BASE}api/events`).then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setEvents(data)
    })
  }

  useEffect(() => { load() }, [])

  const showToast = (msg, err = false) => {
    clearTimeout(toastTimer)
    setToast({ msg, err, v: true })
    toastTimer = setTimeout(() => setToast((t) => ({ ...t, v: false })), 2800)
  }

  const openCreate = () => { setForm(emptyForm); setEditId(null); setShowForm(true) }
  const openEdit   = (ev) => {
    setForm({ name: ev.name, date: ev.date || '', opUser: ev.op_user, opPass: '' })
    setEditId(ev.id)
    setShowForm(true)
  }
  const closeForm  = () => { setShowForm(false); setEditId(null); setForm(emptyForm) }

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const body = { name: form.name, date: form.date, opUser: form.opUser, opPass: form.opPass }
    const url  = editId ? `${BASE}api/events/${editId}` : `${BASE}api/events`
    const method = editId ? 'PATCH' : 'POST'
    const res  = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { showToast(data.error || 'Error', true); return }
    showToast(editId ? 'Evento actualizado' : 'Evento creado')
    closeForm()
    load()
  }

  const toggleActive = async (ev) => {
    await authFetch(`${BASE}api/events/${ev.id}/active`, { method: 'PATCH' })
    load()
  }

  const deleteEvent = async (ev) => {
    if (!confirm(`¿Eliminar el evento "${ev.name}" y todas sus fotos?`)) return
    await authFetch(`${BASE}api/events/${ev.id}`, { method: 'DELETE' })
    showToast('Evento eliminado')
    load()
  }

  const guestUrl   = (id) => `${window.location.origin}${BASE}e/${id}/guest`
  const displayUrl = (id) => `${window.location.origin}${BASE}e/${id}/display`

  return (
    <div className={s.page}>
      <div className={s.topbar}>
        <img src={`${BASE}logo.png`} alt="Top DJ Group" className={s.logo} />
        <div className={s.title}>Super Admin</div>
        <div className={s.spacer} />
        <button className={s.btnNew} onClick={openCreate}>+ Nuevo evento</button>
        <button className={s.btnLogout} onClick={logout}>⎋ Salir</button>
      </div>

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
              <span>Usuario op.</span>
              <span>Fotos</span>
              <span>Estado</span>
              <span>Acciones</span>
            </div>
            {events.map((ev) => (
              <div key={ev.id} className={`${s.row} ${ev.active ? s.rowActive : s.rowInactive}`}>
                <span className={s.cellName}>{ev.name}</span>
                <span className={s.cellDate}>{ev.date || '—'}</span>
                <span className={s.cellUser}>{ev.op_user}</span>
                <span className={s.cellCount}>{ev.photo_count ?? 0}</span>
                <span>
                  <button
                    className={`${s.pill} ${ev.active ? s.pillOn : s.pillOff}`}
                    onClick={() => toggleActive(ev)}
                  >
                    {ev.active ? 'Activo' : 'Inactivo'}
                  </button>
                </span>
                <span className={s.cellActions}>
                  <button className={s.btnIcon} title="Editar" onClick={() => openEdit(ev)}>✏️</button>
                  <a className={s.btnIcon} href={`${BASE}admin/${ev.id}`} target="_blank" rel="noreferrer" title="Panel admin">🎛️</a>
                  <a className={s.btnIcon} href={guestUrl(ev.id)} target="_blank" rel="noreferrer" title="Ver página invitados">📷</a>
                  <a className={s.btnIcon} href={displayUrl(ev.id)} target="_blank" rel="noreferrer" title="Ver display">📽️</a>
                  <button className={`${s.btnIcon} ${s.btnDel}`} title="Eliminar" onClick={() => deleteEvent(ev)}>🗑</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className={s.overlay} onClick={(e) => e.target === e.currentTarget && closeForm()}>
          <div className={s.modal}>
            <div className={s.modalTitle}>{editId ? 'Editar evento' : 'Nuevo evento'}</div>
            <form onSubmit={submit} className={s.form}>
              <label className={s.label}>Nombre del evento</label>
              <input className={s.input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />

              <label className={s.label}>Fecha</label>
              <input className={s.input} type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />

              <label className={s.label}>Usuario operario</label>
              <input className={s.input} value={form.opUser} onChange={(e) => setForm((f) => ({ ...f, opUser: e.target.value }))} required />

              <label className={s.label}>{editId ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña operario'}</label>
              <input className={s.input} type="password" value={form.opPass} onChange={(e) => setForm((f) => ({ ...f, opPass: e.target.value }))} required={!editId} />

              <div className={s.modalActions}>
                <button type="button" className={s.btnCancel} onClick={closeForm}>Cancelar</button>
                <button type="submit" className={s.btnSubmit} disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className={`${s.toast} ${toast.v ? s.toastShow : ''} ${toast.err ? s.toastErr : ''}`}>{toast.msg}</div>
    </div>
  )
}
