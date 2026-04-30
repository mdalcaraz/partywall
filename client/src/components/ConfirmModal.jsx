import { useEffect } from 'react'
import s from './ConfirmModal.module.css'

export default function ConfirmModal({ message, confirmLabel = 'Eliminar', onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className={s.overlay} onClick={onCancel}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        <p className={s.message}>{message}</p>
        <div className={s.actions}>
          <button className={s.btnCancel} onClick={onCancel}>Cancelar</button>
          <button className={s.btnConfirm} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
