import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import s from './LoginPage.module.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res  = await fetch(`${import.meta.env.BASE_URL}api/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      })
      const data = await res.json()

      if (data.success) {
        sessionStorage.setItem('auth_token', data.token)
        navigate('/admin', { replace: true })
      } else {
        setError(data.error || 'Credenciales incorrectas')
      }
    } catch {
      setError('No se pudo conectar al servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={s.page}>
      <div className={s.card}>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Top DJ Group" className={s.logo} />

        <div className={s.title}>Panel Admin</div>
        <div className={s.sub}>Ingresá tus credenciales para continuar</div>

        <form className={s.form} onSubmit={handleSubmit}>
          <div className={s.field}>
            <label className={s.label}>Usuario</label>
            <input
              className={s.input}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className={s.field}>
            <label className={s.label}>Contraseña</label>
            <input
              className={s.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className={s.error}>{error}</div>}

          <button className={s.btn} type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
