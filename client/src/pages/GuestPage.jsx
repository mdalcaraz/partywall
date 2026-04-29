import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { getDeviceId } from '../lib/api'
import TermsModal from '../components/TermsModal'
import s from './GuestPage.module.css'

const TIMER_OPTIONS = [0, 3, 5]
const MAX_REC_SECS  = 60
const BASE          = import.meta.env.BASE_URL

function launchConfetti() {
  const colors = ['#c8a042', '#e8bf5a', '#f5f2ec', '#a07830', '#fff8e0']
  for (let i = 0; i < 16; i++) {
    const dot = document.createElement('div')
    dot.style.cssText = `position:fixed;width:8px;height:8px;border-radius:50%;background:${colors[Math.floor(Math.random()*colors.length)]};left:${30+Math.random()*40}%;top:72%;pointer-events:none;animation:confetti-float ${0.7+Math.random()*0.5}s ease-out ${Math.random()*0.3}s forwards;z-index:9999;`
    document.body.appendChild(dot)
    dot.addEventListener('animationend', () => dot.remove())
  }
}

const wait       = (ms) => new Promise((r) => setTimeout(r, ms))
const fmtTime    = (s)  => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
const getSupportedMimeType = () =>
  ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm'

export default function GuestPage() {
  const { eventId } = useParams()

  // ── Camera refs / shared ─────────────────────────────────────────────────
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)
  const fileRef    = useRef(null)

  // ── Photo state ──────────────────────────────────────────────────────────
  const [mediaType, setMediaType]     = useState('photo')
  const [facingMode, setFacingMode]   = useState('user')
  const [timerIdx, setTimerIdx]       = useState(0)
  const [sentCount, setSentCount]     = useState(0)
  const [status, setStatus]           = useState({ text: 'Enfocá y presioná el botón', type: '' })
  const [capturedBlob, setCapturedBlob] = useState(null)
  const [previewUrl, setPreviewUrl]   = useState(null)
  const [timerCount, setTimerCount]   = useState(null)
  const [showFlash, setShowFlash]     = useState(false)
  const [cameraError, setCameraError] = useState(false)
  const [cooldown, setCooldown]       = useState(0)
  const [showTerms, setShowTerms]     = useState(false)
  const cooldownRef = useRef(null)
  const timerDelay  = TIMER_OPTIONS[timerIdx]

  // ── Event config ────────────────────────────────────────────────────────
  const [videoEnabled, setVideoEnabled] = useState(false)

  useEffect(() => {
    fetch(`${BASE}api/e/${eventId}/album/info`)
      .then(r => r.json())
      .then(d => { if (d.video_enabled) setVideoEnabled(true) })
      .catch(() => {})
  }, [eventId])

  // ── Video state ──────────────────────────────────────────────────────────
  const [vidState, setVidState]   = useState('idle')   // idle|recording|preview|sending|sent
  const [vidBlob, setVidBlob]     = useState(null)
  const [vidUrl, setVidUrl]       = useState(null)
  const [recSecs, setRecSecs]     = useState(0)
  const [vidStatus, setVidStatus] = useState({ text: '', type: '' })
  const recorderRef    = useRef(null)
  const chunksRef      = useRef([])
  const recordTimerRef = useRef(null)
  const vidFileRef     = useRef(null)

  // ── Camera ───────────────────────────────────────────────────────────────
  const startCamera = useCallback(async (facing, withAudio = false) => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: withAudio,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraError(false)
    } catch {
      setCameraError(true)
      setStatus({ text: 'Sin acceso a la cámara', type: 'err' })
    }
  }, [])

  useEffect(() => {
    startCamera(facingMode, false)
    return () => streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [startCamera]) // eslint-disable-line

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)')
    const handler = () => startCamera(facingMode, mediaType === 'video')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [facingMode, mediaType, startCamera])

  useEffect(() => {
    fetch(`${BASE}api/e/${eventId}/guest/info`, { headers: { 'X-Device-ID': getDeviceId() } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.rateLimit?.retryAfter > 0) startCooldown(d.rateLimit.retryAfter) })
      .catch(() => {})
  }, [eventId]) // eslint-disable-line

  // ── Media type switch ─────────────────────────────────────────────────────
  const switchMediaType = async (type) => {
    if (type === mediaType) return
    if (type === 'video') {
      setMediaType('video')
      await startCamera(facingMode, true)
    } else {
      stopRecording()
      resetVideo()
      setMediaType('photo')
      await startCamera(facingMode, false)
    }
  }

  // ── Photo actions ─────────────────────────────────────────────────────────
  const flipCamera = async () => {
    const next = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(next)
    await startCamera(next, mediaType === 'video')
  }

  const toggleTimer = () => setTimerIdx((i) => (i + 1) % TIMER_OPTIONS.length)

  const torch = async (on) => {
    try {
      const track = streamRef.current?.getVideoTracks()[0]
      if (track) await track.applyConstraints({ advanced: [{ torch: on }] })
    } catch {}
  }

  const capture = async () => {
    if (timerDelay > 0) {
      for (let i = timerDelay; i >= 1; i--) { setTimerCount(i); await wait(1000) }
      setTimerCount(null)
    }
    await torch(true); await wait(220)
    setShowFlash(true); setTimeout(() => setShowFlash(false), 400)
    const video = videoRef.current, canvas = canvasRef.current
    const vw = video.videoWidth  || 1280
    const vh = video.videoHeight || 960
    // Si el stream es landscape pero el teléfono está en portrait, rotamos 90°
    const angle    = screen.orientation?.angle ?? (window.orientation ?? 0)
    const portrait = angle === 0 || angle === 180 || angle === -180
    const rotate90 = vw > vh && portrait
    canvas.width  = rotate90 ? vh : vw
    canvas.height = rotate90 ? vw : vh
    const ctx = canvas.getContext('2d')
    if (rotate90) {
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(Math.PI / 2)
      if (facingMode === 'user') ctx.scale(1, -1)
      ctx.drawImage(video, -vw / 2, -vh / 2)
    } else {
      if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1) }
      ctx.drawImage(video, 0, 0)
    }
    setTimeout(() => torch(false), 300)
    canvas.toBlob((blob) => {
      setCapturedBlob(blob); setPreviewUrl(URL.createObjectURL(blob))
      setMode('preview'); setStatus({ text: '¿Te gustó? Enviala ✨', type: '' })
    }, 'image/jpeg', 0.88)
  }

  const [mode, setMode] = useState('camera')

  const sendPhoto = async () => {
    if (!capturedBlob) return
    setMode('sending'); setStatus({ text: 'Enviando...', type: 'sending' })
    const fd = new FormData()
    fd.append('photo', capturedBlob, `foto_${Date.now()}.jpg`)
    try {
      const res  = await fetch(`${BASE}api/e/${eventId}/upload`, { method: 'POST', body: fd, headers: { 'X-Device-ID': getDeviceId() } })
      const data = await res.json()
      if (res.status === 429) { setMode('camera'); startCooldown(data.retryAfter || 60); return }
      if (!data.success) throw new Error(data.error)
      setSentCount((c) => c + 1); launchConfetti()
      const remaining = data.remaining ?? 1
      setStatus({ text: remaining > 0 ? `¡Foto enviada! 🎉 · Te queda${remaining !== 1 ? 'n' : ''} ${remaining}` : '¡Foto enviada! 🎉', type: 'ok' })
      setMode('sent')
      if (remaining === 0) startCooldown(data.retryAfter || 60)
      setTimeout(resetToCamera, 2200)
    } catch {
      setStatus({ text: 'Error al enviar. Reintentá.', type: 'err' }); setMode('preview')
    }
  }

  const startCooldown = (secs) => {
    setCooldown(secs); clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => { if (c <= 1) { clearInterval(cooldownRef.current); return 0 } return c - 1 })
    }, 1000)
  }

  const pickFromGallery = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setCapturedBlob(file); setPreviewUrl(URL.createObjectURL(file))
    setMode('preview'); setStatus({ text: '¿Te gustó? Enviala ✨', type: '' })
    e.target.value = ''
  }

  const resetToCamera = () => {
    setCapturedBlob(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null); setMode('camera')
    setStatus({ text: 'Enfocá y presioná el botón', type: '' })
  }

  // ── Video actions ─────────────────────────────────────────────────────────
  const startRecording = () => {
    if (!streamRef.current) return
    chunksRef.current = []
    const mimeType = getSupportedMimeType()
    const recorder = new MediaRecorder(streamRef.current, { mimeType })
    recorderRef.current = recorder
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const url  = URL.createObjectURL(blob)
      setVidBlob(blob); setVidUrl(url)
      setVidState('preview'); setVidStatus({ text: '¿Te gustó? Envialo 🎬', type: '' })
    }
    recorder.start(1000)
    setVidState('recording'); setRecSecs(0)
    let elapsed = 0
    recordTimerRef.current = setInterval(() => {
      elapsed++; setRecSecs(elapsed)
      if (elapsed >= MAX_REC_SECS) stopRecording()
    }, 1000)
  }

  const stopRecording = () => {
    clearInterval(recordTimerRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const pickVideo = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''
    if (file.size > 200 * 1024 * 1024) {
      setVidStatus({ text: 'El video supera el límite de 200MB', type: 'err' }); return
    }
    const url = URL.createObjectURL(file)
    const test = document.createElement('video')
    test.preload = 'metadata'
    test.onloadedmetadata = () => {
      if (test.duration > 60) {
        URL.revokeObjectURL(url)
        setVidStatus({ text: 'El video no puede superar 60 segundos', type: 'err' }); return
      }
      setVidBlob(file); setVidUrl(url)
      setVidState('preview'); setVidStatus({ text: '¿Te gustó? Envialo 🎬', type: '' })
    }
    test.onerror = () => { URL.revokeObjectURL(url); setVidStatus({ text: 'No se pudo leer el video', type: 'err' }) }
    test.src = url
  }

  const sendVideo = async () => {
    if (!vidBlob) return
    setVidState('sending'); setVidStatus({ text: 'Subiendo...', type: 'sending' })
    const fd = new FormData()
    const ext = vidBlob.type?.includes('mp4') ? 'mp4' : vidBlob.type?.includes('quicktime') ? 'mov' : 'webm'
    fd.append('video', vidBlob, `video_${Date.now()}.${ext}`)
    try {
      const res  = await fetch(`${BASE}api/e/${eventId}/videos/upload`, { method: 'POST', body: fd, headers: { 'X-Device-ID': getDeviceId() } })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setVidState('sent'); setVidStatus({ text: '¡Video enviado! Procesando... 🎬', type: 'ok' })
      setTimeout(resetVideo, 3000)
    } catch (err) {
      setVidStatus({ text: err.message || 'Error al enviar. Reintentá.', type: 'err' }); setVidState('preview')
    }
  }

  const resetVideo = () => {
    if (vidUrl) URL.revokeObjectURL(vidUrl)
    setVidBlob(null); setVidUrl(null)
    setVidState('idle'); setRecSecs(0)
    setVidStatus({ text: '', type: '' })
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const isPhotoPreview = mode === 'preview' || mode === 'sending' || mode === 'sent'
  const isPhotoBusy    = mode === 'sending' || timerCount !== null || cooldown > 0
  const isVidPreview   = vidState === 'preview' || vidState === 'sending' || vidState === 'sent'
  const showLive       = !(mediaType === 'photo' && isPhotoPreview) && !(mediaType === 'video' && isVidPreview)

  return (
    <div className={s.page}>
      {/* ── Header ── */}
      <header className={s.header}>
        <img src={`${BASE}logo.png`} alt="logo" className={s.logo} />
        {videoEnabled && (
          <div className={s.mediaTabs}>
            <button className={`${s.mediaTab} ${mediaType === 'photo' ? s.mediaTabActive : ''}`} onClick={() => switchMediaType('photo')}>
              📷 Foto
            </button>
            <button className={`${s.mediaTab} ${mediaType === 'video' ? s.mediaTabActive : ''}`} onClick={() => switchMediaType('video')}>
              🎬 Video
            </button>
          </div>
        )}
        <div className={`${s.counter} ${sentCount > 0 ? s.pulse : ''}`}>
          {sentCount} foto{sentCount !== 1 ? 's' : ''}
        </div>
      </header>

      {/* ── Viewfinder ── */}
      <div className={s.viewfinderWrap}>
        <div className={s.viewfinder}>
          {/* Live camera */}
          <video
            ref={videoRef}
            className={s.video}
            style={{
              display:   showLive ? 'block' : 'none',
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
            }}
            autoPlay playsInline muted
          />

          {/* Photo preview */}
          {mediaType === 'photo' && isPhotoPreview && previewUrl && (
            <img className={s.preview} src={previewUrl} alt="preview" />
          )}

          {/* Video preview */}
          {mediaType === 'video' && isVidPreview && vidUrl && (
            <video
              key={vidUrl}
              src={vidUrl}
              className={s.vidPreview}
              controls
              autoPlay
              playsInline
            />
          )}

          {/* Recording indicator */}
          {mediaType === 'video' && vidState === 'recording' && (
            <div className={s.recBadge}>
              <span className={s.recDot} /> {fmtTime(recSecs)} / 1:00
              <div className={s.recBar} style={{ width: `${(recSecs / MAX_REC_SECS) * 100}%` }} />
            </div>
          )}

          {/* Decorative corners */}
          <div className={s.corners}>
            <div className={`${s.corner} ${s.tl}`} />
            <div className={`${s.corner} ${s.tr}`} />
            <div className={`${s.corner} ${s.bl}`} />
            <div className={`${s.corner} ${s.br}`} />
          </div>

          {showFlash && <div className={s.flash} />}
          {timerCount !== null && <div className={s.timerOverlay}>{timerCount}</div>}

          {cameraError && (
            <div className={s.noCam}>
              <span className={s.noCamIcon}>📵</span>
              <span>No se pudo acceder a la cámara.<br />Asegurate de dar permiso.</span>
            </div>
          )}

          {cooldown > 0 && mediaType === 'photo' && (
            <div className={s.cooldownOverlay}>
              <div className={s.cooldownNum}>{cooldown}</div>
              <div className={s.cooldownMsg}>Podés volver a enviar en un momento</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Controls: Foto ── */}
      {mediaType === 'photo' && (
        <div className={s.controls}>
          {videoEnabled && (
            <div className={`${s.mediaTabs} ${s.mediaTabsLandscape}`}>
              <button className={`${s.mediaTab} ${s.mediaTabActive}`} onClick={() => switchMediaType('photo')}>📷 Foto</button>
              <button className={s.mediaTab} onClick={() => switchMediaType('video')}>🎬 Video</button>
            </div>
          )}
          <div className={s.shootRow}>
            <button className={`${s.btnIcon} ${timerDelay > 0 ? s.btnIconActive : ''}`} onClick={toggleTimer} title="Temporizador" disabled={isPhotoPreview}>
              {timerDelay === 0 ? '⏱' : `${timerDelay}s`}
            </button>
            <button className={s.shutter} onClick={capture} disabled={isPhotoBusy || isPhotoPreview}>
              <div className={s.shutterInner} />
            </button>
            <button className={s.btnIcon} onClick={flipCamera} title="Cambiar cámara" disabled={isPhotoPreview}>
              🔄
            </button>
          </div>

          {isPhotoPreview && (
            <div className={s.actionRow}>
              <button className={`${s.btn} ${s.btnSecondary}`} onClick={resetToCamera} disabled={isPhotoBusy}>↩ Repetir</button>
              {previewUrl && (
                <a href={previewUrl} download={`foto_${Date.now()}.jpg`} className={`${s.btn} ${s.btnSecondary}`} style={{ textDecoration: 'none' }}>
                  ↓ Guardar
                </a>
              )}
              <button className={`${s.btn} ${s.btnPrimary}`} onClick={sendPhoto} disabled={isPhotoBusy}>
                {mode === 'sending' ? 'Enviando...' : '✉ Enviar'}
              </button>
            </div>
          )}

          {!isPhotoPreview && (
            <button className={s.btnGallery} onClick={() => fileRef.current?.click()}>
              🖼 Elegir de galería
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickFromGallery} />

          <div className={`${s.status} ${s[status.type]}`}>{status.text}</div>
        </div>
      )}

      {/* ── Controls: Video ── */}
      {mediaType === 'video' && (
        <div className={s.controls}>
          {videoEnabled && (
            <div className={`${s.mediaTabs} ${s.mediaTabsLandscape}`}>
              <button className={s.mediaTab} onClick={() => switchMediaType('photo')}>📷 Foto</button>
              <button className={`${s.mediaTab} ${s.mediaTabActive}`} onClick={() => switchMediaType('video')}>🎬 Video</button>
            </div>
          )}
          {(vidState === 'idle' || vidState === 'recording') && (
            <div className={s.shootRow}>
              <button className={s.btnIcon} onClick={flipCamera} disabled={vidState === 'recording'}>🔄</button>
              {vidState === 'idle' ? (
                <button className={s.recordBtn} onClick={startRecording} disabled={!!cameraError}>
                  <div className={s.recordDot} />
                </button>
              ) : (
                <button className={s.stopBtn} onClick={stopRecording}>
                  <div className={s.stopSquare} />
                </button>
              )}
              <div className={s.btnIcon} style={{ opacity: 0, pointerEvents: 'none' }} />
            </div>
          )}

          {vidState === 'idle' && (
            <button className={s.btnGallery} onClick={() => vidFileRef.current?.click()}>
              📂 Elegir video de galería
            </button>
          )}
          <input ref={vidFileRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" style={{ display: 'none' }} onChange={pickVideo} />

          {isVidPreview && (
            <div className={s.actionRow}>
              <button className={`${s.btn} ${s.btnSecondary}`} onClick={resetVideo} disabled={vidState === 'sending'}>↩ Repetir</button>
              {vidUrl && (
                <a href={vidUrl} download={`video_${Date.now()}.mp4`} className={`${s.btn} ${s.btnSecondary}`} style={{ textDecoration: 'none' }}>
                  ↓ Guardar
                </a>
              )}
              <button className={`${s.btn} ${s.btnPrimary}`} onClick={sendVideo} disabled={vidState !== 'preview'}>
                {vidState === 'sending' ? 'Subiendo...' : '✉ Enviar'}
              </button>
            </div>
          )}

          <div className={`${s.status} ${s[vidStatus.type]}`}>{vidStatus.text}</div>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className={s.footer}>
        <a href="https://www.instagram.com/topdjgroup/" target="_blank" rel="noreferrer" className={s.igLink}>
          📷 @topdjgroup
        </a>
        <span className={s.trademark}>Top DJ Group® · Marca registrada</span>
        <span className={s.terms}>
          Al usar esta app aceptás nuestros{' '}
          <button className={s.termsLink} onClick={() => setShowTerms(true)}>Términos y Condiciones</button>
        </span>
      </footer>

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
