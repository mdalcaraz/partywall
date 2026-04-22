import { useEffect } from 'react'
import s from './TermsModal.module.css'

export default function TermsModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.sheet} onClick={(e) => e.stopPropagation()}>
        <button className={s.close} onClick={onClose} aria-label="Cerrar">✕</button>
        <h2 className={s.title}>Términos y Condiciones</h2>
        <div className={s.body}>
          <p>Al utilizar esta aplicación, aceptás los presentes términos en su totalidad.</p>

          <h3>Moderación de contenido</h3>
          <p>
            El proveedor del servicio se reserva el derecho de no exhibir fotografías y/o no
            reproducir temas musicales que, a su exclusivo criterio, resulten inapropiados,
            ofensivos, de mal gusto o incompatibles con la temática y el ambiente del evento.
            El envío de contenido no garantiza su publicación o reproducción.
          </p>

          <h3>Curación editorial</h3>
          <p>
            El proveedor actúa como curador del contenido del evento. La selección de qué
            fotografías se proyectan y qué temas se reproducen queda a discreción exclusiva
            del operador, sin que ello genere obligación ni responsabilidad alguna frente al usuario.
          </p>

          <h3>Contenido enviado</h3>
          <p>
            Al enviar una fotografía o solicitar un tema, el usuario declara que el contenido
            es de su autoría o cuenta con las autorizaciones necesarias, y que no contiene
            material ilegal, ofensivo o que viole derechos de terceros.
          </p>

          <h3>Privacidad</h3>
          <p>
            Las fotografías enviadas podrán ser exhibidas en pantalla durante el evento con
            fines de entretenimiento. No se almacena información personal de identificación.
          </p>

          <h3>Limitación de responsabilidad</h3>
          <p>
            El uso de este servicio es voluntario. El proveedor no asume responsabilidad por
            contenido enviado por usuarios ni por decisiones editoriales tomadas durante el evento.
          </p>
        </div>
        <button className={s.btnClose} onClick={onClose}>Entendido</button>
      </div>
    </div>
  )
}
