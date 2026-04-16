// Fetch autenticado — incluye el token en el header
// Si el servidor devuelve 401, limpia la sesión y redirige al login
export function authFetch(url, options = {}) {
  const token = sessionStorage.getItem('auth_token')
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'x-auth-token': token || '',
    },
  }).then((res) => {
    if (res.status === 401) {
      sessionStorage.removeItem('auth_token')
      window.location.href = '/fotobooth/login'
    }
    return res
  })
}
